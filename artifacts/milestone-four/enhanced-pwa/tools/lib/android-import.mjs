import {createHash, randomUUID} from 'node:crypto';
import {itemInput} from '../../server/validation.mjs';
import {InventoryRepository} from '../../server/repository.mjs';

export const IMPORT_FORMAT = 'cs499-android-inventory-v1';
const sourceKeys = ['id','item_name','sku','quantity','location','notes','updated_at'];
const MAX_ITEMS = 1000;

/** Validate the original DBHelper schema, without guessing missing business data. */
export function prepareImport(document, {category, reorderLevel} = {}) {
  const errors=[], changes=[], records=[], ids=new Set(), skus=new Map();
  if (!document || document.format!==IMPORT_FORMAT || !Array.isArray(document.items))
    return {ok:false, errors:[{row:null,message:`Expected ${IMPORT_FORMAT} with an items array.`}], changes, records};
  if (document.items.length<1 || document.items.length>MAX_ITEMS)
    errors.push({row:null,message:'Import one to 1,000 records. Larger imports are outside this capstone scope.'});
  try {
    // Reuse the same field rules as the working PWA instead of a second schema.
    itemInput({name:'Validation',sku:'VALID',quantity:0,location:'Validation',category,reorderLevel,notes:''});
  } catch(error) { errors.push({row:null,message:error.message}); }
  for (const [index, raw] of document.items.slice(0,MAX_ITEMS).entries()) {
    const row=index+1;
    try {
      if (!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('Record must be an object.');
      if (Object.keys(raw).some(k=>!sourceKeys.includes(k)) || sourceKeys.some(k=>!(k in raw)))
        throw new Error('Record must contain exactly the seven inventory fields exported from DBHelper.');
      if (!Number.isSafeInteger(raw.id) || raw.id<1) throw new Error('Original ID must be a positive safe integer.');
      if (ids.has(raw.id)) throw new Error(`Duplicate original ID ${raw.id}.`);
      ids.add(raw.id);
      if (typeof raw.updated_at!=='string' || !raw.updated_at.trim() || raw.updated_at.length>80)
        throw new Error('Original updated_at must be nonempty text of at most 80 characters.');
      if (raw.notes!==null && typeof raw.notes!=='string') throw new Error('Original notes must be text or null.');
      const input=itemInput({name:raw.item_name,sku:raw.sku,quantity:raw.quantity,
        location:raw.location,category,reorderLevel,notes:raw.notes??''});
      if (skus.has(input.sku)) throw new Error(`SKU ${input.sku} duplicates original ID ${skus.get(input.sku)} after normalization.`);
      skus.set(input.sku,raw.id);
      const source=Object.fromEntries(sourceKeys.map(key=>[key,raw[key]]));
      for (const [from,to] of [['item_name','name'],['sku','sku'],['location','location'],['notes','notes']])
        if (raw[from]!==input[to]) changes.push({sourceId:raw.id,field:from,before:raw[from],after:input[to]});
      records.push({source,input});
    } catch(error) {errors.push({row,sourceId:raw?.id??null,message:error.message});}
  }
  if (errors.length) return {ok:false,errors,changes,records:[]};
  records.sort((a,b)=>a.source.id-b.source.id);
  // Row order, filename and JSON formatting do not change the identity of an export.
  const sourceSha256=createHash('sha256').update(JSON.stringify(records.map(r=>r.source))).digest('hex');
  return {ok:true,errors,changes,records,sourceSha256,
    category:records[0].input.category,reorderLevel:records[0].input.reorderLevel};
}

/** Preview is read-only. Apply inserts the batch, every item and all history together. */
export async function importInventory(pool, document, options) {
  const plan=prepareImport(document,options);
  const base={mode:options.apply?'apply':'preview',recordCount:document?.items?.length??0,
    normalizationChanges:plan.changes,errors:plan.errors};
  if (!plan.ok) return {...base,status:'rejected',imported:0};
  if (typeof options.username!=='string' || !options.username.trim())
    return {...base,status:'rejected',imported:0,errors:[{row:null,message:'A manager username is required.'}]};
  const label=options.sourceLabel??'Android inventory export';
  if (typeof label!=='string' || !label.trim() || label.length>255)
    return {...base,status:'rejected',imported:0,errors:[{row:null,message:'Source label must be 1 to 255 characters.'}]};
  const c=await pool.connect(),repo=new InventoryRepository(pool);
  try {
    await c.query(options.apply?'BEGIN': 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    if (options.apply) {
      await c.query('SELECT pg_advisory_xact_lock(499,4)');
      // An API insert racing this import is still checked by the SKU constraint.
      // A collision rolls back the entire batch rather than partially importing it.
    }
    const user=(await c.query('SELECT id,role FROM users WHERE username=$1',[options.username.trim().toLowerCase()])).rows[0];
    if (!user || user.role!=='manager') throw new Error('The import must be attributed to an existing manager account.');
    const prior=(await c.query('SELECT * FROM import_batches WHERE source_sha256=$1',[plan.sourceSha256])).rows[0];
    if (prior) {
      if (prior.category!==plan.category || prior.reorder_level!==plan.reorderLevel)
        throw new Error('This export was already imported with different category or reorder settings.');
      await c.query('COMMIT');
      return {...base,status:'already-imported',sourceSha256:plan.sourceSha256,batchId:prior.id,imported:0};
    }
    const conflicts=(await c.query('SELECT sku FROM items WHERE sku=ANY($1::text[]) ORDER BY sku',
      [plan.records.map(r=>r.input.sku)])).rows;
    if (conflicts.length) {
      await c.query('ROLLBACK');
      return {...base,status:'rejected',imported:0,errors:conflicts.map(r=>({row:null,message:`SKU ${r.sku} already exists, including archived inventory.`}))};
    }
    if (!options.apply) {
      await c.query('COMMIT');
      return {...base,status:'ready',sourceSha256:plan.sourceSha256,category:plan.category,reorderLevel:plan.reorderLevel,imported:0};
    }
    const batchId=randomUUID();
    await c.query(`INSERT INTO import_batches(id,source_sha256,source_label,category,reorder_level,item_count,imported_by)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[batchId,plan.sourceSha256,label.trim(),plan.category,plan.reorderLevel,plan.records.length,user.id]);
    for (const {source,input} of plan.records) {
      const item=await repo.createItemInTransaction(c,input,user.id,'Opening count from Android import');
      await c.query(`INSERT INTO import_rows(batch_id,source_id,item_id,source_updated_at,source_record)
        VALUES($1,$2,$3,$4,$5)`,[batchId,source.id,item.id,source.updated_at,source]);
    }
    await c.query('COMMIT');
    return {...base,status:'imported',batchId,sourceSha256:plan.sourceSha256,imported:plan.records.length};
  } catch(error) {
    await c.query('ROLLBACK');
    return {...base,status:'rejected',imported:0,errors:[{row:null,message:error.message,code:error.code??null}]};
  } finally {c.release();}
}
