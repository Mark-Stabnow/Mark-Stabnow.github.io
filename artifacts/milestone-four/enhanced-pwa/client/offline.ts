import type {Command,Snapshot} from './types';
const DB='warehouse-capstone-v1';
function open():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB,1);
    r.onupgradeneeded=()=>{r.result.createObjectStore('snapshots',{keyPath:'user.id'});r.result.createObjectStore('commands',{keyPath:'operationId'});r.result.createObjectStore('settings');};
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
}
async function run<T>(store:string,mode:IDBTransactionMode,work:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,mode);const r=work(tx.objectStore(store));
    tx.oncomplete=()=>{db.close();resolve(r.result);};
    tx.onerror=()=>{db.close();reject(tx.error);};
    tx.onabort=()=>{db.close();reject(tx.error??new Error('Local storage was not saved.'));};
  });
}
export async function saveSnapshot(snapshot:Snapshot){
  await run('snapshots','readwrite',s=>s.put(snapshot));
  await run('settings','readwrite',s=>s.put(snapshot.user.id,'lastUser'));
}
export async function readSnapshot(userId?:string):Promise<Snapshot|undefined>{
  const id=userId??await run('settings','readonly',s=>s.get('lastUser'));
  return id?run('snapshots','readonly',s=>s.get(id)):undefined;
}
export async function commands(userId:string):Promise<Command[]>{
  const all=await run<Command[]>('commands','readonly',s=>s.getAll());
  return all.filter(c=>c.userId===userId).sort((a,b)=>a.createdAt-b.createdAt||a.operationId.localeCompare(b.operationId));
}
export async function putCommand(command:Command){await run('commands','readwrite',s=>s.put(command));}
export async function removeCommand(id:string){await run('commands','readwrite',s=>s.delete(id));}
export async function failCommand(command:Command,message:string){await putCommand({...command,status:'failed',error:message});}
export async function clearUser(userId:string){
  for(const command of await commands(userId))await removeCommand(command.operationId);
  await run('snapshots','readwrite',s=>s.delete(userId));
  await run('settings','readwrite',s=>s.delete('lastUser'));
}
