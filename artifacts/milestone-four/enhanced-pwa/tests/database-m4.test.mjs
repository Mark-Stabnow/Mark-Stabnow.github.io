import 'dotenv/config';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {InventoryRepository} from '../server/repository.mjs';
import {importInventory} from '../tools/lib/android-import.mjs';
import {androidFixture} from '../tools/lib/fixtures.mjs';
import {testDatabase,databaseIdentity} from '../tools/lib/test-database.mjs';
const appUrl=testDatabase(process.env.DATABASE_URL),ownerUrl=testDatabase(process.env.OWNER_DATABASE_URL);
assert.equal(databaseIdentity(appUrl),databaseIdentity(ownerUrl),'Application and owner must point at the same test database.');
const app=new pg.Pool({connectionString:appUrl.href}),owner=new pg.Pool({connectionString:ownerUrl.href});
const repo=new InventoryRepository(app),created=[],batches=[];
let manager;
const options={category:'Android import tests',reorderLevel:2,username:'manager',sourceLabel:'Synthetic test fixture'};
const fixture=(n=2)=>androidFixture(n,'M4-'+randomUUID().slice(0,8).toUpperCase());
before(async()=>{manager=(await repo.findUser('manager')).id;});
after(async()=>{
 for(const batch of batches) {
  const ids=(await owner.query('SELECT item_id FROM import_rows WHERE batch_id=$1',[batch])).rows.map(r=>r.item_id);
  await owner.query('DELETE FROM import_rows WHERE batch_id=$1',[batch]);
  await owner.query('DELETE FROM import_batches WHERE id=$1',[batch]);created.push(...ids);
 }
 for(const id of new Set(created)) {
  await owner.query('DELETE FROM audit_log WHERE item_id=$1',[id]);
  await owner.query('DELETE FROM stock_transactions WHERE item_id=$1',[id]);
  await owner.query('DELETE FROM items WHERE id=$1',[id]);
 }
 await app.end();await owner.end();
});
async function apply(document,extras={}) {
 const r=await importInventory(owner,document,{...options,...extras,apply:true});
 if(r.status==='imported')batches.push(r.batchId);return r;
}
async function fresh() {
 const row=await repo.createItem({name:'M4 test',sku:'M4-'+randomUUID().toUpperCase(),quantity:4,
   category:'M4',location:'M4 shelf',reorderLevel:2,notes:''},manager);created.push(row.id);return row;
}
async function counts() {
 const tables=['items','categories','locations','stock_transactions','audit_log','import_batches','import_rows'];
 return Object.fromEntries(await Promise.all(tables.map(async t=>[t,(await owner.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n])));
}
test('preview reads the real database without writing any records',async()=>{
 const before=await counts(),r=await importInventory(app,fixture(),options);
 assert.equal(r.status,'ready');assert.equal(r.imported,0);assert.deepEqual(await counts(),before);
});
test('one import commits every item, opening count, audit record and source mapping',async()=>{
 const d=fixture(3),r=await apply(d);assert.equal(r.status,'imported',JSON.stringify(r));assert.equal(r.imported,3);
 const rows=(await owner.query('SELECT * FROM import_rows WHERE batch_id=$1 ORDER BY source_id',[r.batchId])).rows;
 assert.equal(rows.length,3);assert.deepEqual(rows[0].source_record,d.items[0]);
 for(const row of rows)assert.equal((await repo.history(row.item_id)).length,1);
});
test('replaying the same export creates no duplicate records',async()=>{
 const d=fixture(),a=await apply(d),before=await counts(),b=await apply(d);
 assert.equal(b.status,'already-imported');assert.equal(b.batchId,a.batchId);assert.deepEqual(await counts(),before);
});
test('a reordered export is recognized as the same source',async()=>{
 const d=fixture(),a=await apply(d);d.items.reverse();const b=await apply(d);assert.equal(b.batchId,a.batchId);assert.equal(b.imported,0);
});
test('reimporting a source with different mapping settings is rejected',async()=>{
 const d=fixture();await apply(d);assert.equal((await apply(d,{reorderLevel:8})).status,'rejected');
});
test('existing SKU conflicts reject the entire import',async()=>{
 const i=await fresh(),d=fixture();d.items[1].sku=i.sku;const before=await counts();
 assert.equal((await apply(d)).status,'rejected');assert.deepEqual(await counts(),before);
});
test('archived SKUs still conflict with an import',async()=>{
 const i=await fresh();await repo.archiveItem(i.id,i.version,manager);const d=fixture();d.items[0].sku=i.sku;
 assert.equal((await apply(d)).status,'rejected');
});
test('a later-row audit failure rolls back the batch and its earlier rows',async()=>{
 const d=fixture(3),before=await counts();
 // A test-only owner constraint fails the second item, not the preflight.
 await owner.query(`ALTER TABLE audit_log ADD CONSTRAINT m4_reject_second CHECK(detail->>'sku' <> '${d.items[1].sku}') NOT VALID`);
 try {const r=await apply(d);assert.equal(r.status,'rejected');assert.equal(r.imported,0);}
 finally {await owner.query('ALTER TABLE audit_log DROP CONSTRAINT m4_reject_second');}
 assert.deepEqual(await counts(),before);
});
test('concurrent copies of an import commit only once',async()=>{
 const d=fixture(),results=await Promise.all([apply(d),apply(d)]);
 assert.equal(results.filter(r=>r.status==='imported').length,1);
 assert.equal(results.filter(r=>r.status==='already-imported').length,1);
});
test('an import cannot be attributed to a viewer',async()=>assert.equal((await apply(fixture(),{username:'viewer'})).status,'rejected'));
test('runtime database credentials cannot write import provenance',async()=>{
 const d=fixture();const r=await importInventory(app,d,{...options,apply:true});assert.equal(r.status,'rejected');assert.equal(r.errors[0].code,'42501');
});
test('runtime credentials cannot update or delete provenance after import',async()=>{
 const r=await apply(fixture());
 await assert.rejects(()=>app.query('UPDATE import_batches SET item_count=1 WHERE id=$1',[r.batchId]),{code:'42501'});
 await assert.rejects(()=>app.query('DELETE FROM import_rows WHERE batch_id=$1',[r.batchId]),{code:'42501'});
});
test('category and location names are reused without case-only duplicates',async()=>{
 const d=fixture(2);d.items[0].location='Same import shelf';d.items[1].location='same IMPORT shelf';const r=await apply(d);
 const ids=(await owner.query('SELECT DISTINCT i.location_id FROM import_rows r JOIN items i ON i.id=r.item_id WHERE r.batch_id=$1',[r.batchId])).rows;
 assert.equal(ids.length,1);
});
test('reconciliation includes zero opening counts and archived stock',async()=>{
 const d=fixture(1);d.items[0].quantity=0;const r=await apply(d);
 const id=(await owner.query('SELECT item_id FROM import_rows WHERE batch_id=$1',[r.batchId])).rows[0].item_id;
 const i=await repo.getItem(id);await repo.archiveItem(id,i.version,manager);
 const report=(await app.query('SELECT * FROM inventory_reconciliation WHERE item_id=$1',[id])).rows[0];
 assert.equal(report.balanced,true);assert.equal(report.archived,true);assert.equal(Number(report.transaction_count),1);
});
test('reconciliation reports owner-created drift without silently repairing it',async()=>{
 const i=await fresh();await owner.query('UPDATE items SET on_hand=99 WHERE id=$1',[i.id]);
 const report=(await app.query('SELECT * FROM inventory_reconciliation WHERE item_id=$1',[i.id])).rows[0];
 assert.equal(report.balanced,false);assert.equal(report.on_hand,99);assert.equal(Number(report.ledger_balance),4);
});
test('the database rejects nonpositive record versions',async()=>{
 const i=await fresh();await assert.rejects(()=>owner.query('UPDATE items SET version=0 WHERE id=$1',[i.id]),{code:'23514'});
});
test('the database rejects invalid category references',async()=>{
 const i=await fresh();await assert.rejects(()=>owner.query('UPDATE items SET category_id=$2 WHERE id=$1',[i.id,randomUUID()]),{code:'23503'});
});
test('the database rejects negative stock even through direct SQL',async()=>{
 const i=await fresh();await assert.rejects(()=>owner.query('UPDATE items SET on_hand=-1 WHERE id=$1',[i.id]),{code:'23514'});
});
