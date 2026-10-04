import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile,mkdtemp,mkdir,copyFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {InventoryRepository} from '../server/repository.mjs';
import {hashPassword} from '../server/passwords.mjs';
import {testDatabase} from './lib/test-database.mjs';
const run=promisify(execFile),url=testDatabase(process.env.UPGRADE_OWNER_DATABASE_URL,'UPGRADE_OWNER_DATABASE_URL');
const appUrl=testDatabase(process.env.DATABASE_URL);appUrl.hostname=url.hostname;appUrl.port=url.port;appUrl.pathname=url.pathname;
const pool=new pg.Pool({connectionString:url.href}),repo=new InventoryRepository(pool);
const env={...process.env,OWNER_DATABASE_URL:url.href,DATABASE_URL:appUrl.href};
const migrate=path.resolve('tools/migrate.mjs');
const temp=await mkdtemp(path.join(tmpdir(),'cs499-upgrade-'));
try {
 if(Number((await pool.query("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")).rows[0].count))
   throw new Error('Upgrade test requires an empty disposable database. Nothing was deleted.');
 const initial=await readFile('db/migrations/001_initial.sql','utf8');
 // Reproduce the already-applied Milestone Three schema and migration checksum.
 const c=await pool.connect();
 try {
   await c.query('BEGIN');await c.query(initial);
   await c.query('CREATE TABLE schema_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
   await c.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)',
     ['001_initial.sql',createHash('sha256').update(initial).digest('hex')]);
   await c.query('COMMIT');
 } catch(error){await c.query('ROLLBACK');throw error;} finally {c.release();}
 const user=randomUUID();await pool.query('INSERT INTO users(id,username,password_hash,role) VALUES($1,$2,$3,$4)',
   [user,'upgrade_manager',await hashPassword(randomUUID()),'manager']);
 const item=await repo.createItem({name:'Retained inventory',sku:'UPGRADE-KEEP',category:'Cable',location:'Shelf A',quantity:12,reorderLevel:2,notes:'Keep this record.'},user);
 await repo.adjust(item.id,{operationId:randomUUID(),delta:-2,reason:'Before migration'},user);
 const before=await repo.getItem(item.id),historyBefore=await repo.history(item.id);
 await run(process.execPath,[migrate],{env,timeout:30000});
 assert.deepEqual(await repo.getItem(item.id),before);assert.deepEqual(await repo.history(item.id),historyBefore);
 assert.equal(Number((await pool.query('SELECT count(*) FROM schema_migrations')).rows[0].count),2);
 await run(process.execPath,[migrate],{env,timeout:30000});
 assert.deepEqual(await repo.getItem(item.id),before);
 const migrationDir=path.join(temp,'db','migrations');await mkdir(migrationDir,{recursive:true});
 for(const name of ['001_initial.sql','002_database_enhancement.sql'])
   await copyFile('db/migrations/'+name,path.join(migrationDir,name));
 await writeFile(path.join(migrationDir,'003_deliberate_failure.sql'),'CREATE TABLE upgrade_rollback_probe(id INTEGER); SELECT nonexistent_m4_function();');
 await assert.rejects(()=>run(process.execPath,[migrate],{env,cwd:temp,timeout:30000}));
 assert.equal((await pool.query("SELECT to_regclass('public.upgrade_rollback_probe') AS name")).rows[0].name,null);
 assert.equal(Number((await pool.query('SELECT count(*) FROM schema_migrations')).rows[0].count),2);
 await rm(path.join(migrationDir,'003_deliberate_failure.sql'));
 await writeFile(path.join(migrationDir,'001_initial.sql'),initial+'\n-- Deliberate checksum tamper in a temporary copy.\n');
 await assert.rejects(()=>run(process.execPath,[migrate],{env,cwd:temp,timeout:30000}),error=>/was changed/.test(error.stderr));
 assert.deepEqual(await repo.getItem(item.id),before);
 const result={executedAt:new Date().toISOString(),passed:true,
   checks:['Milestone Three rows and history survive migration 002','Migration rerun preserves data',
     'A failed new migration rolls back DDL and its tracking record','Changed applied SQL fails checksum validation'],
   retainedQuantity:10,retainedHistoryRows:2};
 const out=process.env.EVIDENCE_DIR??'verification-results';await mkdir(out,{recursive:true});
 await writeFile(`${out}/upgrade-results.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
} finally {await pool.end();await rm(temp,{recursive:true,force:true});}
