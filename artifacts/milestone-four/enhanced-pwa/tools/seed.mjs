import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../server/passwords.mjs';
import { InventoryRepository } from '../server/repository.mjs';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try {
  for (const [role,key] of [['manager','DEMO_MANAGER_PASSWORD'],['clerk','DEMO_CLERK_PASSWORD'],['viewer','DEMO_VIEWER_PASSWORD']]) {
    const password=process.env[key];
    if (!password || password.length<12) throw new Error(`${key} must contain at least 12 characters.`);
    // Re-running the seed keeps existing accounts and their passwords.
    if (!(await pool.query('SELECT id FROM users WHERE username=$1',[role])).rowCount)
      await pool.query('INSERT INTO users(id,username,password_hash,role) VALUES($1,$2,$3,$2)',[randomUUID(),role,await hashPassword(password)]);
  }
  const user=(await pool.query("SELECT id FROM users WHERE username='manager'")).rows[0];
  const repo=new InventoryRepository(pool);
  for (const [name,sku,quantity,location,category] of [
    ['Cat6 cable, 1,000 ft box','CAT6-1000-A',0,'Aisle 3-C1','Cable'],
    ['Cat6 cable, 2,000 ft box','CAT6-2000-B',2,'Aisle 3-A','Cable'],
    ['Maglock, 12/24 V with bond sensor','MAG-1224-BS',10,'Aisle 3-B','Access control'],
    ['Request-to-exit button','REX-BUTTON',6,'Aisle 2-A','Access control'],
    ['RJ45 connector pack','RJ45-PACK',18,'Aisle 1-B','Connectors']]) {
    if (!(await pool.query('SELECT id FROM items WHERE sku=$1',[sku])).rowCount)
      await repo.createItem({name,sku,quantity,location,category,reorderLevel:2,notes:'Sample inventory for the Capstone demo.'},user.id);
  }
  console.log('Demo accounts and sample inventory are ready. Existing records were kept.');
} finally {await pool.end();}
