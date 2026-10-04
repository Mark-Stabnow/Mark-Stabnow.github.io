import { readdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const assets=(await readdir('dist/assets')).filter(n=>/\.(js|css)$/.test(n)).map(n=>'/assets/'+n);
const paths=['/','/index.html','/manifest.webmanifest','/icon.svg',...assets];
const version=createHash('sha256').update(await readFile('dist/index.html')).digest('hex').slice(0,16);
const code=`const CACHE='warehouse-shell-${version}';
const FILES=${JSON.stringify(paths)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('warehouse-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Only public app files belong here. API responses and login data do not.
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html')));return;
  }
  if(FILES.includes(url.pathname))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});\n`;
await writeFile('dist/sw.js',code);
console.log('Built the service worker for this app version.');
