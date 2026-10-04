import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {testDatabase,pgEnvironment,databaseIdentity} from './lib/test-database.mjs';
const run=promisify(execFile);
const source=testDatabase(process.env.QUERY_OWNER_DATABASE_URL,'QUERY_OWNER_DATABASE_URL');
const target=testDatabase(process.env.RECOVERY_OWNER_DATABASE_URL,'RECOVERY_OWNER_DATABASE_URL');
if(databaseIdentity(source)===databaseIdentity(target))throw new Error('Recovery source and target must be different databases.');
const runtime=testDatabase(process.env.DATABASE_URL);runtime.pathname=target.pathname;
if(source.hostname!==target.hostname || (source.port||'5432')!==(target.port||'5432'))
 throw new Error('This test harness only supports separate databases in the same disposable cluster.');
const a=new pg.Client({connectionString:source.href}),b=new pg.Client({connectionString:target.href});
const temp=await mkdtemp(path.join(tmpdir(),'cs499-recovery-'));
async function fingerprint(c) {
 const tables=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
 const result={};
 for(const {tablename} of tables) {
   const name='"'+tablename.replaceAll('"','""')+'"';
   const rows=(await c.query(`SELECT row_to_json(t) AS record FROM public.${name} t`)).rows.map(r=>JSON.stringify(r.record)).sort();
   result[tablename]={rows:rows.length,sha256:createHash('sha256').update(rows.join('\n')).digest('hex')};
 }
 return result;
}
try {
 await a.connect();await b.connect();await a.query("SET TIME ZONE 'UTC'");await b.query("SET TIME ZONE 'UTC'");
 const targetObjects=Number((await b.query("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")).rows[0].count);
 if(targetObjects!==0)throw new Error('Recovery target is not empty. This script never drops an existing database or table.');
 if(Number((await a.query('SELECT count(*) FROM items')).rows[0].count)!==1000)
   throw new Error('Run query evaluation first: recovery expects its exactly 1,000-item synthetic database.');
 const archive=path.join(temp,'synthetic-inventory.dump');
 let before;
 await a.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try {
   const snapshot=(await a.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
   before=await fingerprint(a);
   // The dump and comparison use the same snapshot, not two unrelated read times.
   await run('pg_dump',['--format=custom','--no-acl',`--snapshot=${snapshot}`,`--file=${archive}`],
     {env:pgEnvironment(source),timeout:120000,maxBuffer:2*1024*1024});
 } finally {await a.query('ROLLBACK');}
 await run('pg_restore',['--exit-on-error','--single-transaction','--no-owner','--no-acl','--dbname='+target.pathname.slice(1),archive],
   {env:pgEnvironment(target),timeout:120000,maxBuffer:2*1024*1024});
 // Restore objects as the owner, then reapply the runtime role's explicit grants.
 await run(process.execPath,['tools/migrate.mjs'],{env:{...process.env,
   OWNER_DATABASE_URL:target.href,DATABASE_URL:runtime.href},timeout:30000});
 const after=await fingerprint(b);assert.deepEqual(after,before);
 const discrepancies=Number((await b.query('SELECT count(*) FROM inventory_reconciliation WHERE NOT balanced')).rows[0].count);
 assert.equal(discrepancies,0);
 const app=new pg.Client({connectionString:runtime.href});await app.connect();
 try {
   assert.equal(Number((await app.query('SELECT count(*) FROM items')).rows[0].count),1000);
   await assert.rejects(()=>app.query('DELETE FROM stock_transactions WHERE false'),{code:'42501'});
   await assert.rejects(()=>app.query('UPDATE audit_log SET action=action WHERE false'),{code:'42501'});
 } finally {await app.end();}
 const result={executedAt:new Date().toISOString(),passed:true,itemCount:1000,matchingTables:before,
   reconciliationDiscrepancies:discrepancies,runtimeHistoryRestrictionsVerified:true,
   limits:'Synthetic same-cluster logical backup/restore rehearsal. Not a backup of Mark\'s running database, disaster-recovery certification, encrypted offsite backup, or point-in-time recovery.'};
 const out=process.env.EVIDENCE_DIR??'verification-results';await mkdir(out,{recursive:true});
 await writeFile(`${out}/recovery-results.json`,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
} finally {await a.end();await b.end();await rm(temp,{recursive:true,force:true});}
