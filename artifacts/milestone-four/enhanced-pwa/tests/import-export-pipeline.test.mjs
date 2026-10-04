import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {prepareImport} from '../tools/lib/android-import.mjs';

test('1,000 actual SQLite rows pass through the exporter and Node mapping without loss',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'cs499-export-'));
  const source=path.join(dir,'original.db'),output=path.join(dir,'inventory.json');
  try {
    execFileSync(process.env.PYTHON??'python3',['-c',`
import sqlite3,sys
c=sqlite3.connect(sys.argv[1])
c.execute('CREATE TABLE inventory_items(id INTEGER PRIMARY KEY,item_name TEXT NOT NULL,sku TEXT NOT NULL,quantity INTEGER NOT NULL,location TEXT NOT NULL,notes TEXT,updated_at TEXT NOT NULL)')
c.executemany('INSERT INTO inventory_items VALUES(?,?,?,?,?,?,?)',[(i+1,'Cable '+str(i+1),'CABLE-'+str(i+1),i,'Shelf A',None,'09/01/2026 12:00') for i in range(1000)])
c.commit();c.close()
`,source],{timeout:30000});
    execFileSync(process.env.PYTHON??'python3',['tools/export-android.py',source,output],{timeout:30000});
    const document=JSON.parse(await readFile(output,'utf8'));
    const result=prepareImport(document,{category:'Imported from Android',reorderLevel:2});
    assert.equal(result.ok,true);assert.equal(result.records.length,1000);
    assert.equal(result.records[0].source.id,1);assert.equal(result.records.at(-1).source.id,1000);
    assert.equal(result.records.reduce((sum,r)=>sum+r.input.quantity,0),499500);
  } finally {await rm(dir,{recursive:true,force:true});}
});
