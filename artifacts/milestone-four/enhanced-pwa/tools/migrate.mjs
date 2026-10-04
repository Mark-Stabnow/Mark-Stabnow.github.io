import 'dotenv/config';
import pg from 'pg';
import { readFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const db=new pg.Client({connectionString:process.env.OWNER_DATABASE_URL});
await db.connect();
try {
  await db.query('BEGIN');
  await db.query("SELECT pg_advisory_xact_lock(499,2)");
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  for (const name of (await readdir('db/migrations')).filter(n=>n.endsWith('.sql')).sort()) {
    const sql=await readFile(`db/migrations/${name}`,'utf8');
    const hash=createHash('sha256').update(sql).digest('hex');
    const old=(await db.query('SELECT sha256 FROM schema_migrations WHERE name=$1',[name])).rows[0];
    if (old) {if(old.sha256!==hash)throw new Error(`Applied migration ${name} was changed.`);continue;}
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)',[name,hash]);
    console.log(`Applied ${name}.`);
  }
  const appUrl=new URL(process.env.DATABASE_URL);
  const role=decodeURIComponent(appUrl.username),password=decodeURIComponent(appUrl.password);
  if (!/^[a-z_][a-z0-9_]*$/.test(role))throw new Error('Use a simple lowercase database role name.');
  if (!(await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount) {
    const quoted="'"+password.replaceAll("'","''")+"'";
    await db.query(`CREATE ROLE "${role}" LOGIN PASSWORD ${quoted}`);
  }
  // The running app can append history, but cannot rewrite or delete it.
  await db.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO "${role}";
    GRANT SELECT,INSERT,UPDATE ON users,categories,locations,items TO "${role}";
    GRANT SELECT,INSERT,DELETE ON sessions TO "${role}";
    GRANT SELECT,INSERT ON stock_transactions,audit_log TO "${role}";
    REVOKE ALL ON import_batches,import_rows FROM "${role}";
    GRANT SELECT ON import_batches,import_rows,inventory_reconciliation TO "${role}";`);
  await db.query('COMMIT');
  console.log('Database is up to date.');
} catch(error) {await db.query('ROLLBACK');throw error;}
finally {await db.end();}
