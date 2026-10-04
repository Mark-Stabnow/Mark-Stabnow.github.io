import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {credentials,itemInput,adjustment,listInput,uuid} from '../server/validation.mjs';
import {hashPassword,verifyPassword} from '../server/passwords.mjs';
import {syncCommands} from '../client/sync.mjs';
const item={name:'Cable',sku:'cat6-1',quantity:5,reorderLevel:2,location:'Shelf A',category:'Cable',notes:''};
const command=()=>({operationId:randomUUID(),userId:'worker',itemId:randomUUID(),delta:2,reason:'Received stock',status:'pending'});

test('SKU is normalized before saving',()=>assert.equal(itemInput(item).sku,'CAT6-1'));
test('required item fields cannot be blank',()=>assert.throws(()=>itemInput({...item,name:' '}),{status:400}));
test('a stock count cannot be negative',()=>assert.throws(()=>itemInput({...item,quantity:-1}),{status:400}));
test('a stock count must be an integer',()=>assert.throws(()=>itemInput({...item,quantity:1.5}),{status:400}));
test('a string is not silently accepted as a numeric stock count',()=>assert.throws(()=>itemInput({...item,quantity:'5'}),{status:400}));
test('SKU rejects spaces and punctuation outside its allowed format',()=>assert.throws(()=>itemInput({...item,sku:'bad sku!'}),{status:400}));
test('notes have a length limit',()=>assert.throws(()=>itemInput({...item,notes:'a'.repeat(1001)}),{status:400}));
test('editing details cannot overwrite quantity',()=>assert.throws(()=>itemInput({...item,version:1},true),{status:400}));
test('stock adjustments need a nonzero change',()=>assert.throws(()=>adjustment({...command(),delta:0}),{status:400}));
test('stock adjustments need a reason',()=>assert.throws(()=>adjustment({...command(),reason:' '}),{status:400}));
test('negative stock adjustments are valid commands',()=>assert.equal(adjustment({...command(),delta:-2}).delta,-2));
test('a missing or malformed request ID is rejected',()=>assert.throws(()=>uuid('wrong'),{status:400}));
test('page size is capped at 100',()=>assert.throws(()=>listInput({limit:'101'}),{status:400}));
test('query objects cannot replace search text',()=>assert.throws(()=>listInput({q:{bad:'value'}}),{status:400}));
test('the default page size is 25',()=>assert.equal(listInput({}).limit,25));
test('unknown stock filters are rejected',()=>assert.throws(()=>listInput({filter:'anything'}),{status:400}));
test('password spaces are kept',()=>assert.equal(credentials({username:' Manager ',password:'  test-password  '}).password,'  test-password  '));
test('password length has upper and lower bounds',()=>{assert.throws(()=>credentials({username:'manager',password:'short'}),{status:400});assert.throws(()=>credentials({username:'manager',password:'x'.repeat(129)}),{status:400});});
test('password hashes use different salts and verify the right password',async()=>{
  const a=await hashPassword('example-password'),b=await hashPassword('example-password');
  assert.notEqual(a,b);assert.equal(await verifyPassword('example-password',a),true);assert.equal(await verifyPassword('wrong-password',a),false);assert.equal(await verifyPassword('example-password','old-sha256-value'),false);
});
async function queueTest({entries=[command()],send=async()=>({accepted:true,item:{}}),onAccepted=async()=>{}}={}){
  const removed=[],failed=[];
  const result=await syncCommands({userId:'worker',list:async()=>entries,send,remove:async id=>removed.push(id),fail:async(c,message)=>failed.push({c,message}),onAccepted});
  return {result,removed,failed};
}
test('the queue removes a command only after confirmation',async()=>{const r=await queueTest();assert.equal(r.removed.length,1);assert.equal(r.result.applied,1);});
test('a lost response keeps the original request ID in the queue',async()=>{const c=command();const r=await queueTest({entries:[c],send:async seen=>{assert.equal(seen.operationId,c.operationId);throw Object.assign(new Error('Offline'),{status:0});}});assert.equal(r.removed.length,0);assert.equal(r.result.paused,true);});
test('an expired session pauses the queue',async()=>{const r=await queueTest({send:async()=>{throw Object.assign(new Error('Sign in'),{status:401});}});assert.equal(r.failed.length,0);assert.equal(r.result.paused,true);});
test('a rejected adjustment stays visible for review',async()=>{const r=await queueTest({send:async()=>{throw Object.assign(new Error('Not enough stock'),{status:409});}});assert.equal(r.failed.length,1);assert.equal(r.removed.length,0);});
test('one account cannot send another account\'s queued change',async()=>{const r=await queueTest({entries:[{...command(),userId:'someone-else'}],send:async()=>{assert.fail('Do not send another user\'s command.');}});assert.equal(r.result.applied,0);});
test('a failed local cache write does not discard a confirmed request',async()=>{const r=await queueTest({onAccepted:async()=>{throw new Error('Storage is full');}});assert.equal(r.removed.length,0);assert.equal(r.result.paused,true);});
test('an unconfirmed response does not count as success',async()=>{const r=await queueTest({send:async()=>({})});assert.equal(r.removed.length,0);assert.equal(r.result.paused,true);});
