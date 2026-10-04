import 'dotenv/config';
import pg from 'pg';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const c=await pool.connect();
try {
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const totals=(await c.query(`SELECT count(*)::int AS items,
    count(*) FILTER (WHERE archived)::int AS archived,
    coalesce(sum(on_hand::bigint),0)::text AS units,
    count(*) FILTER (WHERE NOT balanced)::int AS discrepancies FROM inventory_reconciliation`)).rows[0];
  const discrepancies=(await c.query('SELECT * FROM inventory_reconciliation WHERE NOT balanced ORDER BY sku')).rows;
  const imports=(await c.query(`SELECT id,source_label,item_count,created_at FROM import_batches ORDER BY created_at DESC LIMIT 20`)).rows;
  await c.query('COMMIT');
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),...totals,discrepancies,imports},null,2));
  if(discrepancies.length)process.exitCode=1;
} catch(error) {await c.query('ROLLBACK');throw error;}
finally {c.release();await pool.end();}
