import 'dotenv/config';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {InventoryRepository} from '../server/repository.mjs';
import {token,digest} from '../server/passwords.mjs';

// These tests make temporary records. Never aim them at a working warehouse database.
if (process.env.ALLOW_TEST_DB !== 'yes' || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) {
  throw new Error('Use a database ending in _test and set ALLOW_TEST_DB=yes.');
}
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});
const owner = new pg.Pool({connectionString:process.env.OWNER_DATABASE_URL});
const repo = new InventoryRepository(pool);
const created = [];
let manager;
before(async () => { manager = (await repo.findUser('manager')).id; });
after(async () => {
  for (const id of created) {
    await owner.query('DELETE FROM audit_log WHERE item_id=$1',[id]);
    await owner.query('DELETE FROM stock_transactions WHERE item_id=$1',[id]);
    await owner.query('DELETE FROM items WHERE id=$1',[id]);
  }
  await pool.end();
  await owner.end();
});
async function fresh(quantity=10) {
  // Direct repository tests must follow the same SKU rule as validated API input.
  const item = await repo.createItem({
    name:'Database test item', sku:'DBT-'+randomUUID().toUpperCase(), quantity,
    reorderLevel:2, location:'Test shelf', category:'Test supplies', notes:''
  },manager);
  created.push(item.id);
  return item;
}
const command = delta => ({operationId:randomUUID(),delta,reason:'Database test'});

test('an item, opening stock record, and audit entry are saved together',async () => {
  const i=await fresh();
  assert.equal((await repo.history(i.id))[0].balanceAfter,10);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM audit_log WHERE item_id=$1',[i.id])).rows[0].n,1);
});
test('the database rejects duplicate SKUs',async () => {
  const i=await fresh();
  await assert.rejects(()=>repo.createItem({...i,quantity:0},manager),{code:'23505'});
});
test('stock changes append history and keep the balance correct',async () => {
  const i=await fresh(10);
  await repo.adjust(i.id,command(-3),manager);
  assert.equal((await repo.getItem(i.id)).quantity,7);
  assert.equal((await repo.history(i.id)).length,2);
});
test('replaying one request does not apply it twice',async () => {
  const i=await fresh(10),c=command(4);
  await repo.adjust(i.id,c,manager);
  const result=await repo.adjust(i.id,c,manager);
  assert.equal(result.replayed,true);
  assert.equal(result.item.quantity,14);
  assert.equal((await repo.history(i.id)).length,2);
});
test('concurrent copies of the same request are applied once',async () => {
  const i=await fresh(10),c=command(3);
  const results=await Promise.all(Array.from({length:8},()=>repo.adjust(i.id,c,manager)));
  assert.equal(results.filter(r=>!r.replayed).length,1);
  assert.equal((await repo.getItem(i.id)).quantity,13);
});
test('reusing a request ID with different content is rejected',async () => {
  const i=await fresh(),c=command(1);
  await repo.adjust(i.id,c,manager);
  await assert.rejects(()=>repo.adjust(i.id,{...c,delta:2},manager),{status:409});
});
test('two users cannot spend the same remaining stock',async () => {
  const i=await fresh(6),clerk=(await repo.findUser('clerk')).id;
  const r=await Promise.allSettled([repo.adjust(i.id,command(-4),manager),repo.adjust(i.id,command(-4),clerk)]);
  assert.equal(r.filter(s=>s.status==='fulfilled').length,1);
  assert.equal((await repo.getItem(i.id)).quantity,2);
});
test('an overdraw leaves both balance and history unchanged',async () => {
  const i=await fresh(2);
  await assert.rejects(()=>repo.adjust(i.id,command(-3),manager),{status:409});
  assert.equal((await repo.getItem(i.id)).quantity,2);
  assert.equal((await repo.history(i.id)).length,1);
});
test('an audit write failure rolls the whole stock change back',async () => {
  const i=await fresh(10);
  await owner.query("ALTER TABLE audit_log ADD CONSTRAINT test_reject_change CHECK(action <> 'stock changed') NOT VALID");
  try { await assert.rejects(()=>repo.adjust(i.id,command(5),manager),{code:'23514'}); }
  finally { await owner.query('ALTER TABLE audit_log DROP CONSTRAINT test_reject_change'); }
  assert.equal((await repo.getItem(i.id)).quantity,10);
  assert.equal((await repo.history(i.id)).length,1);
});
test('the running app cannot edit or delete stock history',async () => {
  const i=await fresh();
  await assert.rejects(()=>pool.query('UPDATE stock_transactions SET delta=0 WHERE item_id=$1',[i.id]),{code:'42501'});
  await assert.rejects(()=>pool.query('DELETE FROM stock_transactions WHERE item_id=$1',[i.id]),{code:'42501'});
});
test('the running app cannot rewrite audit history',async () => {
  const i=await fresh();
  await assert.rejects(()=>pool.query("UPDATE audit_log SET action='changed' WHERE item_id=$1",[i.id]),{code:'42501'});
});
test('a stale edit is rejected after another change',async () => {
  const i=await fresh();
  await repo.adjust(i.id,command(1),manager);
  await assert.rejects(()=>repo.editItem(i.id,{...i,name:'Stale name'},manager),{status:409});
});
test('archiving keeps history and prevents new stock changes',async () => {
  const i=await fresh();
  await repo.archiveItem(i.id,i.version,manager);
  assert.equal((await repo.getItem(i.id)).archived,true);
  assert.equal((await repo.history(i.id)).length,1);
  await assert.rejects(()=>repo.adjust(i.id,command(1),manager),{status:404});
});
test('the stock balance agrees with the sum of its ledger',async () => {
  const i=await fresh(7);
  await repo.adjust(i.id,command(5),manager);
  await repo.adjust(i.id,command(-2),manager);
  const sum=(await pool.query('SELECT sum(delta)::int AS quantity FROM stock_transactions WHERE item_id=$1',[i.id])).rows[0].quantity;
  assert.equal(sum,(await repo.getItem(i.id)).quantity);
});
test('keyset pages do not repeat records in a stable dataset',async () => {
  const seen=new Set();let after=null;
  do {
    const r=await repo.listItems({q:'',filter:'all',limit:2,after});
    for (const i of r.items) { assert.equal(seen.has(i.id),false);seen.add(i.id); }
    after=r.nextCursor;
  } while (after);
  assert.ok(seen.size>=5);
});
test('migration can run again without losing existing stock',async () => {
  const i=await fresh(9);
  execFileSync(process.execPath,['tools/migrate.mjs'],{env:process.env,timeout:30000});
  assert.equal((await repo.getItem(i.id)).quantity,9);
});
test('expired sessions cannot authenticate',async () => {
  const h=digest(token());
  await repo.startSession(h,manager,token());
  assert.ok(await repo.session(h));
  await owner.query("UPDATE sessions SET expires_at=now()-interval '1 minute' WHERE token_hash=$1",[h]);
  assert.equal(await repo.session(h),undefined);
});
test('five failed logins put an account into a timed lockout',async () => {
  const u=await repo.findUser('viewer');
  await repo.clearFailures(u.id);
  for (let n=0;n<5;n++) await repo.failLogin(u.id);
  const changed=await repo.findUser('viewer');
  assert.ok(new Date(changed.locked_until).getTime()>Date.now());
  await repo.clearFailures(u.id);
});
