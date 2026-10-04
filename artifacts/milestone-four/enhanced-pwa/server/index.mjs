import 'dotenv/config';
import pg from 'pg';
import { createApp } from './app.mjs';
import { InventoryRepository } from './repository.mjs';
const port=Number(process.env.PORT??4173);
const origin=process.env.APP_ORIGIN??'http://localhost:4173';
const secureCookie=process.env.COOKIE_SECURE==='true';
const url=new URL(origin);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Run npm run setup first.');
if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) && (url.protocol!=='https:' || !secureCookie))
  throw new Error('Non-local access requires HTTPS and COOKIE_SECURE=true.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10,statement_timeout:10000});
const app=await createApp(new InventoryRepository(pool),{origin,secureCookie,trustProxy:process.env.TRUST_PROXY==='true'});
const server=app.listen(port,process.env.HOST??'127.0.0.1',()=>console.log(`Warehouse app is listening on port ${port}.`));
async function stop(){server.close(async()=>{await pool.end();process.exit(0);});}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
