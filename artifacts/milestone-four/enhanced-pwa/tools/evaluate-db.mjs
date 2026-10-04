import 'dotenv/config';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {androidFixture} from './lib/fixtures.mjs';
import {importInventory} from './lib/android-import.mjs';
import {testDatabase} from './lib/test-database.mjs';
import {hashPassword} from '../server/passwords.mjs';
import {InventoryRepository} from '../server/repository.mjs';
const url=testDatabase(process.env.QUERY_OWNER_DATABASE_URL,'QUERY_OWNER_DATABASE_URL');
const pool=new pg.Pool({connectionString:url.href});
const out=process.env.EVIDENCE_DIR??'verification-results';
const lowQuery=`SELECT id,sku,on_hand FROM items WHERE NOT archived AND on_hand>0
 AND on_hand<=reorder_level ORDER BY on_hand,id LIMIT 25`;
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
async function measure(c,query,values=[]) {
 const runs=[];
 // Warm up once. Capture actual planner choices; do not force an index scan.
 await c.query(query,values);
 for(let n=0;n<7;n++)runs.push((await c.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+query,values)).rows[0]['QUERY PLAN'][0]);
 return {medianExecutionMs:median(runs.map(r=>r['Execution Time'])),runs};
}
try {
 if(Number((await pool.query('SELECT count(*) FROM items')).rows[0].count)!==0)
   throw new Error('Query evaluation needs an empty, disposable query database. No records were deleted.');
 const manager=randomUUID();
 await pool.query('INSERT INTO users(id,username,password_hash,role) VALUES($1,$2,$3,$4)',
   [manager,'query_manager',await hashPassword(randomUUID()),'manager']);
 const imported=await importInventory(pool,androidFixture(1000,'QUERY'),{
   apply:true,username:'query_manager',category:'Synthetic query inventory',reorderLevel:2,sourceLabel:'Exactly 1,000 synthetic items'});
 if(imported.status!=='imported')throw new Error(JSON.stringify(imported));
 const first=(await pool.query("SELECT id FROM items WHERE sku='QUERY-0001'")).rows[0].id;
 const repo=new InventoryRepository(pool);
 for(let i=0;i<10;i++)await repo.adjust(first,{operationId:randomUUID(),delta:i%2===0?1:-1,reason:'Synthetic history query'},manager);
 const count=Number((await pool.query('SELECT count(*) FROM items')).rows[0].count);
 if(count!==1000)throw new Error('The evaluation dataset is not exactly 1,000 items.');
 const c=await pool.connect();
 let before,after,sku,history,page,equivalent;
 try {
   await c.query('BEGIN');
   await c.query('ANALYZE items');await c.query('ANALYZE stock_transactions');
   // Only this new non-unique index is removed, inside a rollback-only experiment.
   await c.query('DROP INDEX items_low_stock_idx');
   const baselineRows=(await c.query(lowQuery)).rows;
   before=await measure(c,lowQuery);
   await c.query(`CREATE INDEX items_low_stock_idx ON items(on_hand,id)
     WHERE NOT archived AND on_hand>0 AND on_hand<=reorder_level`);
   const enhancedRows=(await c.query(lowQuery)).rows;
   equivalent=JSON.stringify(baselineRows)===JSON.stringify(enhancedRows);
   if(!equivalent)throw new Error('Low-stock query answers differ.');
   after=await measure(c,lowQuery);
   sku=await measure(c,'SELECT id,sku,on_hand FROM items WHERE sku=$1',['QUERY-0500']);
   history=await measure(c,'SELECT operation_id,delta,balance_after,reason FROM stock_transactions WHERE item_id=$1 ORDER BY created_at DESC,id LIMIT 50',[first]);
   page=await measure(c,'SELECT id,sku FROM items WHERE NOT archived AND id>$1 ORDER BY id LIMIT 25',[first]);
 } finally {await c.query('ROLLBACK');c.release();}
 const result={executedAt:new Date().toISOString(),node:process.version,
   postgres:(await pool.query('SELECT version() AS v')).rows[0].v,itemCount:count,
   query:lowQuery,equivalentAnswers:equivalent,lowStockWithoutNewIndex:before,lowStockWithNewIndex:after,
   exactSku:sku,itemHistory:history,keysetPage:page,
   limits:'Seven warm-cache samples per query in one disposable database. Before/after order is not randomized. No scale, phone, network, concurrency or universal speedup claim. The fixture stays in this isolated test database for recovery verification.'};
 await mkdir(out,{recursive:true});
 await writeFile(`${out}/database-query-results.json`,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({itemCount:count,equivalentAnswers:equivalent,
   beforeMedianMs:before.medianExecutionMs,afterMedianMs:after.medianExecutionMs,resultFile:`${out}/database-query-results.json`},null,2));
} finally {await pool.end();}
