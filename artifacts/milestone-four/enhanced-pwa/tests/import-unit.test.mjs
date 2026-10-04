import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareImport,importInventory} from '../tools/lib/android-import.mjs';
import {androidFixture} from '../tools/lib/fixtures.mjs';
const options={category:'Imported from Android',reorderLevel:2};
const prepare=d=>prepareImport(d,options);
const altered=(field,value)=>{const d=androidFixture(1);d.items[0][field]=value;return d;};

test('original DBHelper fields map to the enhanced schema',()=>{
 const p=prepare(androidFixture(1));assert.equal(p.ok,true);assert.equal(p.records[0].input.name,'Cable inventory 0001');
 assert.equal(p.records[0].input.category,options.category);assert.equal(p.records[0].input.reorderLevel,2);
});
test('an exact 1,000-record export validates without expanding the dataset',()=>{
 const p=prepare(androidFixture(1000));assert.equal(p.ok,true);assert.equal(p.records.length,1000);
});
test('empty import is rejected',()=>assert.equal(prepare(androidFixture(0)).ok,false));
test('more than 1,000 records are rejected as one batch',()=>assert.equal(prepare(androidFixture(1001)).ok,false));
test('a missing category is not silently invented',()=>assert.equal(prepareImport(androidFixture(),{reorderLevel:2}).ok,false));
test('a missing reorder level is not silently invented',()=>assert.equal(prepareImport(androidFixture(),{category:'Imported'}).ok,false));
test('SKU normalization is explicit in the report and raw source is retained',()=>{
 const p=prepare(altered('sku',' legacy-1 '));assert.equal(p.records[0].input.sku,'LEGACY-1');
 assert.equal(p.records[0].source.sku,' legacy-1 ');assert.ok(p.changes.some(c=>c.field==='sku'));
});
test('case-normalized duplicate SKUs reject the whole export',()=>{
 const d=androidFixture(2);d.items[1].sku=d.items[0].sku.toLowerCase();const p=prepare(d);
 assert.equal(p.ok,false);assert.equal(p.records.length,0);assert.match(p.errors[0].message,/duplicates/);
});
test('duplicate original IDs reject the export',()=>{
 const d=androidFixture(2);d.items[1].id=1;assert.equal(prepare(d).ok,false);
});
test('unsafe original numeric IDs are rejected rather than rounded',()=>assert.equal(prepare(altered('id',Number.MAX_SAFE_INTEGER+1)).ok,false));
test('negative quantities are rejected',()=>assert.equal(prepare(altered('quantity',-1)).ok,false));
test('fractional quantities are rejected',()=>assert.equal(prepare(altered('quantity',2.5)).ok,false));
test('numeric text is not silently converted to a quantity',()=>assert.equal(prepare(altered('quantity','5')).ok,false));
test('zero is a valid opening balance',()=>assert.equal(prepare(altered('quantity',0)).ok,true));
test('an over-limit stock count is rejected',()=>assert.equal(prepare(altered('quantity',1000000001)).ok,false));
test('missing location is reported instead of guessed',()=>assert.equal(prepare(altered('location',' ')).ok,false));
test('null notes become empty notes but are preserved in provenance',()=>{
 const p=prepare(altered('notes',null));assert.equal(p.records[0].input.notes,'');assert.equal(p.records[0].source.notes,null);
});
test('overlong notes are rejected, not truncated',()=>assert.equal(prepare(altered('notes','x'.repeat(1001))).ok,false));
test('original timestamp text is retained without assuming a timezone',()=>{
 const p=prepare(altered('updated_at','10/04/2026 14:00'));assert.equal(p.records[0].source.updated_at,'10/04/2026 14:00');
});
test('unexpected inventory fields are rejected',()=>assert.equal(prepare(altered('password_hash','do-not-import')).ok,false));
test('incorrect export format is rejected',()=>assert.equal(prepare({format:'other',items:[]}).ok,false));
test('source hash is stable across row order and JSON property order',()=>{
 const a=androidFixture(),b=structuredClone(a);b.items.reverse();b.items=b.items.map(r=>Object.fromEntries(Object.entries(r).reverse()));
 assert.equal(prepare(a).sourceSha256,prepare(b).sourceSha256);
});
test('a source quantity change changes the source fingerprint',()=>{
 const a=androidFixture(),b=structuredClone(a);b.items[0].quantity++;assert.notEqual(prepare(a).sourceSha256,prepare(b).sourceSha256);
});
test('validation errors are reported before a database connection is requested',async()=>{
 const pool={connect(){throw new Error('Connection must not be requested.');}};
 const result=await importInventory(pool,altered('quantity',-1),options);assert.equal(result.status,'rejected');assert.equal(result.imported,0);
});
