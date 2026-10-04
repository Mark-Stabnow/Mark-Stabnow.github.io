import { randomUUID } from 'node:crypto';
import { AppError } from './errors.mjs';
const itemSelect = `SELECT i.id, i.name, i.sku, i.on_hand AS quantity,
  i.reorder_level AS "reorderLevel", i.notes, i.version, i.archived,
  i.updated_at AS "updatedAt", c.name AS category, l.name AS location
  FROM items i JOIN categories c ON c.id=i.category_id JOIN locations l ON l.id=i.location_id`;

export class InventoryRepository {
  constructor(pool) { this.pool = pool; }
  async transaction(work) {
    const c = await this.pool.connect();
    try { await c.query('BEGIN'); const result = await work(c); await c.query('COMMIT'); return result; }
    catch (error) { await c.query('ROLLBACK'); throw error; }
    finally { c.release(); }
  }
  async health() { await this.pool.query('SELECT 1'); return true; }
  async findUser(username) { return (await this.pool.query('SELECT * FROM users WHERE username=$1', [username])).rows[0]; }
  async failLogin(id) {
    await this.pool.query(`UPDATE users SET failed_count=failed_count+1,
      locked_until=CASE WHEN failed_count+1>=5 THEN now()+interval '1 minute' ELSE locked_until END WHERE id=$1`, [id]);
  }
  async clearFailures(id) { await this.pool.query('UPDATE users SET failed_count=0, locked_until=NULL WHERE id=$1', [id]); }
  async startSession(hash, userId, csrf) {
    await this.pool.query('DELETE FROM sessions WHERE expires_at<=now()');
    await this.pool.query(`INSERT INTO sessions VALUES ($1,$2,$3,now()+interval '8 hours')`, [hash,userId,csrf]);
  }
  async session(hash) {
    return (await this.pool.query(`SELECT u.id,u.username,u.role,s.csrf_token AS csrf
      FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [hash])).rows[0];
  }
  async endSession(hash) { await this.pool.query('DELETE FROM sessions WHERE token_hash=$1', [hash]); }
  async getItem(id, db = this.pool) { return (await db.query(`${itemSelect} WHERE i.id=$1`,[id])).rows[0]; }
  async listItems({q,filter,limit,after}) {
    // The API owns the query. User input only goes into parameter values.
    const rows = (await this.pool.query(`${itemSelect} WHERE NOT i.archived
      AND ($1::text='' OR i.name ILIKE '%'||$1||'%' OR i.sku ILIKE '%'||$1||'%' OR l.name ILIKE '%'||$1||'%')
      AND ($2='all' OR ($2='low' AND i.on_hand>0 AND i.on_hand<=i.reorder_level)
        OR ($2='out' AND i.on_hand=0) OR ($2='in' AND i.on_hand>0))
      AND ($3::uuid IS NULL OR i.id>$3) ORDER BY i.id LIMIT $4`,[q,filter,after,limit+1])).rows;
    const more = rows.length>limit;
    const items = rows.slice(0,limit);
    return { items, nextCursor: more ? items.at(-1).id : null };
  }
  async namedRecord(c, table, name) {
    // table is a fixed internal choice, never a request parameter.
    if (!['categories','locations'].includes(table)) throw new Error('Unknown reference table.');
    return (await c.query(`INSERT INTO ${table}(id,name) VALUES ($1,$2)
      ON CONFLICT (lower(name)) DO UPDATE SET name=${table}.name RETURNING id`, [randomUUID(),name])).rows[0].id;
  }
  async audit(c,userId,itemId,action,detail) {
    await c.query('INSERT INTO audit_log(id,user_id,item_id,action,detail) VALUES ($1,$2,$3,$4,$5)',[randomUUID(),userId,itemId,action,detail]);
  }
  async createItem(input,userId) {
    const id=randomUUID();
    await this.transaction(async c => {
      const category=await this.namedRecord(c,'categories',input.category);
      const location=await this.namedRecord(c,'locations',input.location);
      await c.query(`INSERT INTO items(id,name,sku,category_id,location_id,on_hand,reorder_level,notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[id,input.name,input.sku,category,location,input.quantity,input.reorderLevel,input.notes]);
      await c.query(`INSERT INTO stock_transactions(id,item_id,user_id,operation_id,delta,balance_after,reason)
        VALUES ($1,$2,$3,$4,$5,$5,'Opening count')`,[randomUUID(),id,userId,randomUUID(),input.quantity]);
      await this.audit(c,userId,id,'created',{sku:input.sku,quantity:input.quantity});
    });
    return this.getItem(id);
  }
  async editItem(id,input,userId) {
    await this.transaction(async c => {
      const item=(await c.query('SELECT * FROM items WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if (!item || item.archived) throw new AppError(404,'Item was not found.');
      if (item.version!==input.version) throw new AppError(409,'This item changed. Refresh it before saving.');
      const category=await this.namedRecord(c,'categories',input.category);
      const location=await this.namedRecord(c,'locations',input.location);
      await c.query(`UPDATE items SET name=$2,sku=$3,category_id=$4,location_id=$5,reorder_level=$6,
        notes=$7,version=version+1,updated_at=now() WHERE id=$1`,[id,input.name,input.sku,category,location,input.reorderLevel,input.notes]);
      await this.audit(c,userId,id,'edited',{before:{name:item.name,sku:item.sku},after:{name:input.name,sku:input.sku}});
    });
    return this.getItem(id);
  }
  async archiveItem(id,version,userId) {
    await this.transaction(async c=> {
      const r=await c.query(`UPDATE items SET archived=true,version=version+1,updated_at=now()
        WHERE id=$1 AND version=$2 AND NOT archived RETURNING id`,[id,version]);
      if (!r.rowCount) throw new AppError(409,'This item changed or was already archived. Refresh the list.');
      await this.audit(c,userId,id,'archived',{});
    });
  }
  async adjust(id,command,userId) {
    return this.transaction(async c => {
      // Retrying a lost response must not apply the same change a second time.
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${userId}:${command.operationId}`]);
      const previous=(await c.query('SELECT * FROM stock_transactions WHERE user_id=$1 AND operation_id=$2',[userId,command.operationId])).rows[0];
      if (previous) {
        if (previous.item_id!==id || previous.delta!==command.delta || previous.reason!==command.reason)
          throw new AppError(409,'That request ID was already used for a different change.');
        return {accepted:true,replayed:true,balanceAtCommit:previous.balance_after,item:await this.getItem(id,c)};
      }
      const item=(await c.query('SELECT * FROM items WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if (!item || item.archived) throw new AppError(404,'Item was not found or has been archived.');
      const balance=item.on_hand+command.delta;
      if (balance<0 || balance>1000000000) throw new AppError(409,'This change would put the stock count outside the allowed range.');
      await c.query(`INSERT INTO stock_transactions(id,item_id,user_id,operation_id,delta,balance_after,reason)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,[randomUUID(),id,userId,command.operationId,command.delta,balance,command.reason]);
      await c.query('UPDATE items SET on_hand=$2,version=version+1,updated_at=now() WHERE id=$1',[id,balance]);
      await this.audit(c,userId,id,'stock changed',{operationId:command.operationId,delta:command.delta,balance});
      return {accepted:true,replayed:false,balanceAtCommit:balance,item:await this.getItem(id,c)};
    });
  }
  async history(id) {
    return (await this.pool.query(`SELECT t.operation_id AS "operationId",t.delta,t.balance_after AS "balanceAfter",
      t.reason,t.created_at AS "createdAt",u.username FROM stock_transactions t JOIN users u ON u.id=t.user_id
      WHERE t.item_id=$1 ORDER BY t.created_at DESC,t.id LIMIT 50`,[id])).rows;
  }
}
