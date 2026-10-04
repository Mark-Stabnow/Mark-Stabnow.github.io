import 'dotenv/config';
import pg from 'pg';
import {readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {importInventory} from './lib/android-import.mjs';

const {values}=parseArgs({options:{
  file:{type:'string'},username:{type:'string'},category:{type:'string'},
  'reorder-level':{type:'string'},apply:{type:'boolean',default:false},
  report:{type:'string'},help:{type:'boolean',default:false}
}});
if (values.help) {
  console.log('npm run import:android -- --file inventory.json --username manager --category "Imported from Android" --reorder-level 2 [--apply] [--report import-report.json]');
  console.log('Default: read-only preview. Apply needs OWNER_DATABASE_URL. Back up first. Never import passwords.');
} else {
  let pool;
  try {
    if (!values.file || !values.username || !values.category || !/^\d+$/.test(values['reorder-level']??''))
      throw new Error('Provide --file, --username, --category and an integer --reorder-level. See --help.');
    const reportPath=path.resolve(values.report??'import-report.json');
    if (reportPath===path.resolve(values.file)) throw new Error('The report must not overwrite the input file.');
    if ((await stat(values.file)).size>8*1024*1024) throw new Error('Export exceeds the 8 MiB capstone input limit.');
    const document=JSON.parse(await readFile(values.file,'utf8'));
    const connectionString=values.apply?process.env.OWNER_DATABASE_URL:process.env.DATABASE_URL;
    if (!connectionString) throw new Error(values.apply?'Set OWNER_DATABASE_URL to apply an import.':'Set DATABASE_URL for the preview.');
    pool=new pg.Pool({connectionString,max:1});
    const result=await importInventory(pool,document,{apply:values.apply,username:values.username,
      category:values.category,reorderLevel:Number(values['reorder-level']),sourceLabel:path.basename(values.file)});
    await writeFile(reportPath,JSON.stringify(result,null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify(result,null,2));
    if (result.status==='rejected') process.exitCode=1;
  } catch(error) {console.error(error.message);process.exitCode=1;}
  finally {if(pool)await pool.end();}
}
