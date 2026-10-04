import 'dotenv/config';
import pg from 'pg';
import {testDatabase,databaseIdentity} from './lib/test-database.mjs';
const source=testDatabase(process.env.OWNER_DATABASE_URL);
const admin=new pg.Client({connectionString:source.href});
try {
 await admin.connect();
 for(const key of ['QUERY_OWNER_DATABASE_URL','UPGRADE_OWNER_DATABASE_URL','RECOVERY_OWNER_DATABASE_URL']) {
   const url=testDatabase(process.env[key],key);
   if(url.hostname!==source.hostname || (url.port||'5432')!==(source.port||'5432'))throw new Error('Test databases must use the same disposable cluster.');
   if(databaseIdentity(url)===databaseIdentity(source))throw new Error('Test destinations must differ from the main test database.');
   const name=url.pathname.slice(1);
   if((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)
     throw new Error(`Test database ${name} already exists. The harness does not drop it. Recreate the disposable Compose stack.`);
   await admin.query(`CREATE DATABASE "${name}"`);
 }
} finally {await admin.end();}
