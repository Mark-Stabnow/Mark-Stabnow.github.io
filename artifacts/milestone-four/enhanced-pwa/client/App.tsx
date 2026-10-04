import {useCallback,useEffect,useRef,useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import type {Command,HistoryEntry,Item,User} from './types';
import {ApiError,forgetSession,request,session,signIn} from './api';
import {clearUser,commands,failCommand,putCommand,readSnapshot,removeCommand,saveSnapshot} from './offline';
import {syncCommands} from './sync.mjs';
import IndexedInventoryView from './IndexedInventoryView';

function Modal({title,children,close}:{title:string;children:ReactNode;close:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={e=>{e.preventDefault();close();}}><div className="dialog-head"><h2 id="dialog-title">{title}</h2><button className="plain" onClick={close} aria-label="Close dialog">Close</button></div>{children}</dialog>;
}
function Login({done}:{done:(u:User)=>Promise<void>}){
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');const data=new FormData(e.currentTarget);
    try{await done(await signIn(String(data.get('username')),String(data.get('password'))));}
    catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }
  return <main className="login-wrap"><section className="login-card"><span className="eyebrow">CS 499 · Warehouse app</span><h1>Warehouse inventory</h1><p>Sign in to check inventory and record stock changes.</p><form onSubmit={submit}><label>Username<input name="username" autoComplete="username" required maxLength={64}/></label><label>Password<input name="password" type="password" autoComplete="current-password" required minLength={12} maxLength={128}/></label><button disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form>{error&&<p role="alert" className="error">{error}</p>}<p className="muted small">Local demo accounts are listed in the setup instructions. Use the passwords generated in your .env file.</p></section></main>;
}
function ItemForm({item,done,close}:{item?:Item;done:()=>Promise<void>;close:()=>void}){
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');const d=new FormData(e.currentTarget);
    const body:Record<string,unknown>={name:d.get('name'),sku:d.get('sku'),category:d.get('category'),location:d.get('location'),notes:d.get('notes'),reorderLevel:Number(d.get('reorderLevel'))};
    if(item)body.version=item.version;else body.quantity=Number(d.get('quantity'));
    try{await request(item?`/api/items/${item.id}`:'/api/items',{method:item?'PATCH':'POST',body:JSON.stringify(body)});await done();close();}
    catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }
  return <Modal title={item?'Edit item':'Add item'} close={close}><form onSubmit={save} className="item-form"><label>Item name<input name="name" defaultValue={item?.name} required maxLength={120}/></label><div className="two-columns"><label>SKU<input name="sku" defaultValue={item?.sku} required maxLength={64}/></label><label>Category<input name="category" defaultValue={item?.category??'General'} required maxLength={80}/></label><label>Location<input name="location" defaultValue={item?.location} required maxLength={80}/></label><label>Reorder level<input name="reorderLevel" type="number" min={0} max={1000000000} step={1} defaultValue={item?.reorderLevel??2} required/></label></div>{!item&&<label>Opening quantity<input name="quantity" type="number" min={0} max={1000000000} step={1} defaultValue={0} required/></label>}<label>Notes<textarea name="notes" defaultValue={item?.notes??''} maxLength={1000}/></label>{item&&<p className="muted small">Use a stock adjustment to change quantity. Editing details keeps the stock history intact.</p>}{error&&<p role="alert" className="error">{error}</p>}<div className="actions"><button disabled={busy}>{busy?'Saving…':'Save item'}</button><button type="button" className="secondary" onClick={close}>Cancel</button></div></form></Modal>;
}
function Details({item,user,online,change,close}:{item:Item;user:User;online:boolean;change:(i:Item,delta:number,reason:string)=>Promise<void>;close:()=>void}){
  const [history,setHistory]=useState<HistoryEntry[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{if(online)request<{history:HistoryEntry[]}>(`/api/items/${item.id}/history`).then(r=>setHistory(r.history)).catch(e=>setError(e.message));},[item.id,item.version,online]);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const form=e.currentTarget,d=new FormData(form);setBusy(true);setError('');setMessage('');
    try{await change(item,Number(d.get('delta')),String(d.get('reason')));form.reset();setMessage('Change added to the queue. Check its status below the inventory.');}
    catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }
  return <Modal title={item.name} close={close}><p className="muted">{item.sku} · {item.location}</p><p className="detail-count">{item.quantity}<span> confirmed on hand</span></p>{item.notes&&<p>{item.notes}</p>}{user.role!=='viewer'&&<form onSubmit={submit}><h3>Record a stock change</h3><p className="small muted">Use a positive number for stock received and a negative number for stock used. Pending changes do not change the confirmed count.</p><div className="two-columns"><label>Quantity change<input name="delta" type="number" min={-1000000} max={1000000} step={1} required defaultValue={1}/></label><label>Reason<input name="reason" required maxLength={200} placeholder="Example: Used on a job"/></label></div><button disabled={busy}>{busy?'Saving…':online?'Record change':'Save pending change'}</button></form>}{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="error">{error}</p>}<h3>Recent stock history</h3>{!online?<p>Reconnect to load the server history.</p>:<ol className="history">{history.map(h=><li key={h.operationId}><strong>{h.delta>0?'+':''}{h.delta}</strong> · {h.reason}<span>{h.username} · {new Date(h.createdAt).toLocaleString()} · balance {h.balanceAfter}</span></li>)}</ol>}</Modal>;
}
export default function App(){
  const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[items,setItems]=useState<Item[]>([]),[queue,setQueue]=useState<Command[]>([]);
  const [online,setOnline]=useState(navigator.onLine),[cached,setCached]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [q,setQ]=useState(''),[filter,setFilter]=useState('all'),[cursor,setCursor]=useState<string|null>(null),[loading,setLoading]=useState(false),[syncing,setSyncing]=useState(false);
  const [selected,setSelected]=useState<Item|null>(null),[editing,setEditing]=useState<Item|null>(null),[adding,setAdding]=useState(false);
  const syncBusy=useRef(false),itemsRef=useRef<Item[]>([]),queryNumber=useRef(0),expiresAt=useRef(Date.now()+8*60*60*1000);
  useEffect(()=>{itemsRef.current=items;},[items]);
  useEffect(()=>{const change=()=>setOnline(navigator.onLine);window.addEventListener('online',change);window.addEventListener('offline',change);return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change);};},[]);
  useEffect(()=>{let active=true;(async()=>{
    try{const u=await session();if(active)setUser(u);}
    catch(e){if((e as ApiError).status===0){const saved=await readSnapshot();if(saved&&saved.expiresAt>Date.now()&&active){setUser(saved.user);setItems(saved.items);expiresAt.current=saved.expiresAt;setCached(true);}}}
    finally{if(active)setReady(true);}
  })();return()=>{active=false;};},[]);
  const refresh=useCallback(async(append=false)=>{
    if(!user)return;
    const n=++queryNumber.current;setLoading(true);setError('');
    try{
      const params=new URLSearchParams({q,filter,limit:'25'});if(append&&cursor)params.set('after',cursor);
      const result=await request<{items:Item[];nextCursor:string|null}>(`/api/items?${params}`);
      if(n!==queryNumber.current)return;
      const merged=append?[...itemsRef.current,...result.items.filter(i=>!itemsRef.current.some(old=>old.id===i.id))]:result.items;
      setItems(merged);itemsRef.current=merged;setCursor(result.nextCursor);setCached(false);
      await saveSnapshot({user,items:merged,savedAt:Date.now(),expiresAt:expiresAt.current});
    }catch(e){
      if(n!==queryNumber.current)return;
      if((e as ApiError).status===401){setSelected(null);setUser(null);forgetSession();}
      else{const saved=await readSnapshot(user.id);if(saved){setItems(saved.items);setCached(true);setCursor(null);}setError((e as Error).message);}
    }finally{if(n===queryNumber.current)setLoading(false);}
  },[user,q,filter,cursor]);
  // Debounce search without pulling every record down to the phone.
  useEffect(()=>{if(!user)return;const timer=setTimeout(()=>{void refresh(false);},250);return()=>clearTimeout(timer);},[user,q,filter,online]);
  useEffect(()=>{if(user)commands(user.id).then(setQueue).catch(e=>setError(e.message));},[user]);
  const sync=useCallback(async()=>{
    if(!user||!navigator.onLine||syncBusy.current)return;
    syncBusy.current=true;setSyncing(true);
    const work=async()=>{
      try{
        const current=await session();
        if(current.id!==user.id)throw new Error('Sign back into the account that recorded these changes.');
        const result=await syncCommands({userId:user.id,list:()=>commands(user.id),
          send:(c:Command)=>request(`/api/items/${c.itemId}/adjustments`,{method:'POST',body:JSON.stringify({operationId:c.operationId,delta:c.delta,reason:c.reason})}),
          remove:removeCommand,fail:failCommand,onAccepted:async(item:Item)=>{
            const next=itemsRef.current.map(old=>old.id===item.id?item:old);itemsRef.current=next;setItems(next);
            setSelected(old=>old?.id===item.id?item:old);
            await saveSnapshot({user,items:next,savedAt:Date.now(),expiresAt:expiresAt.current});
          }});
        setNotice(result.paused?'Sync paused. Pending changes are still on this device.':result.failed?'Some changes need your attention. Review the queue.':result.applied?`${result.applied} change${result.applied===1?'':'s'} confirmed.`:'No pending changes to send.');
        setQueue(await commands(user.id));
      }catch(e){setError((e as Error).message);}
    };
    try{if(navigator.locks)await navigator.locks.request('warehouse-stock-sync',work);else await work();}
    finally{syncBusy.current=false;setSyncing(false);}
  },[user]);
  useEffect(()=>{if(online&&user)void sync();},[online,user,sync]);
  async function change(item:Item,delta:number,reason:string){
    if(!user)return;
    if(!Number.isInteger(delta)||delta===0||Math.abs(delta)>1000000||!reason.trim())throw new Error('Enter a nonzero whole-number change and a reason.');
    if((await commands(user.id)).length>=200)throw new Error('Sync or review the existing changes before adding more.');
    await putCommand({operationId:crypto.randomUUID(),userId:user.id,itemId:item.id,delta,reason:reason.trim(),createdAt:Date.now(),status:'pending'});
    setQueue(await commands(user.id));await sync();
  }
  async function loggedIn(u:User){
    setSelected(null);setEditing(null);setItems([]);itemsRef.current=[];setQ('');setFilter('all');setError('');setNotice('');expiresAt.current=Date.now()+8*60*60*1000;setUser(u);
  }
  async function logout(){
    if(!user)return;
    if(!online){setError('Reconnect before signing out so the server session can be closed.');return;}
    if(queue.length){setError('Sync or remove the pending changes before signing out.');return;}
    try{await request('/api/logout',{method:'POST'});await clearUser(user.id);forgetSession();setUser(null);setItems([]);setQueue([]);setSelected(null);}
    catch(e){setError((e as Error).message);}
  }
  async function archive(item:Item){
    if(!confirm(`Archive ${item.name}? Its stock history will be kept.`))return;
    try{await request(`/api/items/${item.id}/archive`,{method:'POST',body:JSON.stringify({version:item.version})});await refresh();}
    catch(e){setError((e as Error).message);}
  }
  async function discard(command:Command){
    if(!user||!confirm('Remove this change from this device? This does not undo a server-confirmed change.'))return;
    await removeCommand(command.operationId);setQueue(await commands(user.id));
  }
  if(!ready)return <main className="loading" role="status">Opening inventory…</main>;
  if(!user)return <Login done={loggedIn}/>;
  const displayed=cached?items.filter(i=>(`${i.name} ${i.sku} ${i.location}`.toLowerCase().includes(q.toLowerCase()))&&(filter==='all'||filter==='low'&&i.quantity>0&&i.quantity<=i.reorderLevel||filter==='out'&&i.quantity===0||filter==='in'&&i.quantity>0)):items;
  return <><header className="site-header"><a href="/" className="brand">WI<span>Warehouse inventory</span></a><div className="header-actions"><span className="account">{user.username} · {user.role}</span><button className="secondary" onClick={()=>void logout()}>Sign out</button></div></header><main className="workspace"><div className="page-head"><div><span className="eyebrow">Stock records</span><h1>Inventory</h1><p className="muted">{displayed.length} items in this view. Quantities below are server-confirmed.</p></div><div className="actions"><button className="secondary" onClick={()=>void refresh()} disabled={loading||!online}>Refresh</button>{user.role==='manager'&&<button disabled={!online} onClick={()=>setAdding(true)}>Add item</button>}</div></div>
    {(!online||cached)&&<div className="banner" role="status">{!online?'Offline. ':'Showing cached data. '}Only the last saved view is available on this device. Stock changes stay pending until the server confirms them.</div>}
    {error&&<div className="error" role="alert">{error}</div>}{notice&&<p role="status" className="notice">{notice}</p>}
    <IndexedInventoryView items={displayed} online={online} loading={loading} filters={<><label className="search-label">Search inventory<input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Item name, SKU, or location" maxLength={100}/></label><label>Stock filter<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All stock</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="in">In stock</option></select></label></>}>{visible => <section className="inventory-grid" aria-label="Inventory items">{visible.map(item=><article className="item-card" key={item.id}><div className="card-top"><span className="sku">{item.sku}</span><span className={`badge ${item.quantity===0?'out':item.quantity<=item.reorderLevel?'low':''}`}>{item.quantity===0?'Out of stock':item.quantity<=item.reorderLevel?'Low stock':'In stock'}</span></div><h2>{item.name}</h2><p className="muted">{item.location} · {item.category}</p><div className="quantity"><strong>{item.quantity}</strong><span>on hand<br/>reorder at {item.reorderLevel}</span></div><div className="card-actions"><button className="secondary" onClick={()=>setSelected(item)}>Details and stock</button>{user.role==='manager'&&<><button className="plain" disabled={!online} onClick={()=>setEditing(item)}>Edit</button><button className="plain danger" disabled={!online} onClick={()=>void archive(item)}>Archive</button></>}</div></article>)}</section>}</IndexedInventoryView>{cursor&&!cached&&<button className="load-more secondary" disabled={loading} onClick={()=>void refresh(true)}>Load more items</button>}
    <section className="queue-panel" aria-labelledby="queue-heading"><div className="queue-head"><div><h2 id="queue-heading">Pending changes</h2><p className="muted small">These changes have not all been confirmed. Removing a queued request does not reverse recorded stock.</p></div><button className="secondary" disabled={!online||syncing} onClick={()=>void sync()}>{syncing?'Syncing…':'Sync now'}</button></div>{queue.length===0?<p className="muted">No pending changes on this device.</p>:<ul className="queue-list">{queue.map(c=><li key={c.operationId}><div><strong>{c.delta>0?'+':''}{c.delta}</strong> · {items.find(i=>i.id===c.itemId)?.name??c.itemId}<p>{c.reason}</p><span className={c.status==='failed'?'error-text':'muted'}>{c.status==='failed'?c.error:'Waiting for server confirmation'}</span></div><button className="plain danger" disabled={syncing} onClick={()=>void discard(c)}>Remove</button></li>)}</ul>}</section>
    <footer>CS 499 · Milestone Three · Sample inventory only</footer></main>{adding&&<ItemForm done={()=>refresh()} close={()=>setAdding(false)}/>} {editing&&<ItemForm item={editing} done={()=>refresh()} close={()=>setEditing(null)}/>} {selected&&<Details item={selected} user={user} online={online} change={change} close={()=>setSelected(null)}/>}</>;
}
