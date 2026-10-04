import 'dotenv/config';
import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const passwords:Record<string,string>={manager:process.env.DEMO_MANAGER_PASSWORD!,clerk:process.env.DEMO_CLERK_PASSWORD!,viewer:process.env.DEMO_VIEWER_PASSWORD!};
async function login(page:Page,role='manager'){
  await page.goto('/');await page.getByLabel('Username',{exact:true}).fill(role);await page.getByLabel('Password',{exact:true}).fill(passwords[role]);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Inventory',exact:true})).toBeVisible();await expect(page.locator('article').first()).toBeVisible();
}
const card=(page:Page,name:string)=>page.locator('article').filter({has:page.getByRole('heading',{name,exact:true})});
test('manager can sign in and view the desktop inventory',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await login(page);await expect(page.getByRole('button',{name:'Add item',exact:true})).toBeVisible();await expect(page.locator('article')).toHaveCount(5);await mkdir('test-results/screenshots',{recursive:true});await page.screenshot({path:'test-results/screenshots/desktop-inventory.png',fullPage:true});
});
test('manager can add and edit an item; duplicate SKU is rejected',async({page})=>{
  await login(page);await page.getByRole('button',{name:'Add item',exact:true}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('Item name',{exact:true}).fill('Browser test item');await dialog.getByLabel('SKU',{exact:true}).fill('BROWSER-TEST-1');await dialog.getByLabel('Location',{exact:true}).fill('Test shelf');await dialog.getByLabel('Opening quantity',{exact:true}).fill('8');await dialog.getByRole('button',{name:'Save item'}).click();await expect(dialog).not.toBeVisible();await expect(card(page,'Browser test item')).toBeVisible();await card(page,'Browser test item').getByRole('button',{name:'Edit',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Item name',{exact:true}).fill('Updated browser item');await dialog.getByRole('button',{name:'Save item'}).click();await expect(card(page,'Updated browser item')).toBeVisible();
  await page.getByRole('button',{name:'Add item',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Item name',{exact:true}).fill('Duplicate item');await dialog.getByLabel('SKU',{exact:true}).fill('BROWSER-TEST-1');await dialog.getByLabel('Location',{exact:true}).fill('Test shelf');await dialog.getByRole('button',{name:'Save item'}).click();await expect(dialog.getByRole('alert')).toContainText('already exists');
});
test('stock changes update the confirmed count and show a history record',async({page})=>{
  await login(page);await card(page,'Updated browser item').getByRole('button',{name:'Details and stock'}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Quantity change',{exact:true}).fill('3');await dialog.getByLabel('Reason',{exact:true}).fill('Received test stock');await dialog.getByRole('button',{name:'Record change',exact:true}).click();await expect(dialog.locator('.detail-count')).toContainText('11');await expect(dialog.locator('.history')).toContainText('Received test stock');await expect(page.locator('.queue-panel')).toContainText('No pending changes');
});
test('an offline change survives reload and syncs after reconnection',async({page,context})=>{
  await login(page);await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
  await expect.poll(()=>page.evaluate(async()=>new Promise(resolve=>{const r=indexedDB.open('warehouse-capstone-v1');r.onsuccess=()=>{const db=r.result;const q=db.transaction('snapshots').objectStore('snapshots').getAll();q.onsuccess=()=>{resolve(q.result.some((s:{items:unknown[]})=>s.items.length>=5));db.close();};};}))).toBe(true);
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.banner')).toContainText('Offline');await card(page,'Maglock, 12/24 V with bond sensor').getByRole('button',{name:'Details and stock'}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('Quantity change',{exact:true}).fill('3');await dialog.getByLabel('Reason',{exact:true}).fill('Received while offline');await dialog.getByRole('button',{name:'Save pending change'}).click();await expect(page.locator('.queue-list li')).toHaveCount(1);await expect(dialog.locator('.detail-count')).toContainText('10');await dialog.getByRole('button',{name:'Close dialog'}).click();await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.queue-list li')).toHaveCount(1);await mkdir('test-results/screenshots',{recursive:true});await page.screenshot({path:'test-results/screenshots/offline-queue.png',fullPage:true});
  await context.setOffline(false);await expect(page.locator('.queue-panel')).toContainText('No pending changes');await expect(card(page,'Maglock, 12/24 V with bond sensor').locator('.quantity strong')).toHaveText('13');
});
test('viewer controls and the API both block stock changes',async({page})=>{
  await login(page,'viewer');await expect(page.getByRole('button',{name:'Add item',exact:true})).toHaveCount(0);await page.locator('article').first().getByRole('button',{name:'Details and stock'}).click();await expect(page.getByRole('button',{name:'Record change',exact:true})).toHaveCount(0);
  const me=await (await page.request.get('/api/me')).json();const response=await page.request.post('/api/items',{headers:{Origin:'http://localhost:4173','X-CSRF-Token':me.csrf},data:{}});expect(response.status()).toBe(403);
});
test('phone and tablet layouts keep their content inside the screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});await login(page,'clerk');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await mkdir('test-results/screenshots',{recursive:true});await page.screenshot({path:'test-results/screenshots/phone-inventory.png',fullPage:true});await page.setViewportSize({width:820,height:1180});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/screenshots/tablet-inventory.png',fullPage:true});
});
test('signing out ends the server session and clears this user\'s cached view',async({page})=>{
  await login(page);await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();expect((await page.request.get('/api/me')).status()).toBe(401);expect(await page.evaluate(async()=>new Promise<number>(resolve=>{const r=indexedDB.open('warehouse-capstone-v1');r.onsuccess=()=>{const db=r.result;const q=db.transaction('snapshots').objectStore('snapshots').count();q.onsuccess=()=>{resolve(q.result);db.close();};};}))).toBe(0);
});

// Milestone Three: keep the real page, authentication and PostgreSQL in the loop.
async function headers(page:Page){const me=await(await page.request.get('/api/me')).json();return {Origin:'http://localhost:4173','X-CSRF-Token':me.csrf};}
async function enableTools(page:Page){const toggle=page.getByRole('button',{name:'Search & sort this view',exact:true});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');}
async function waitForSavedView(page:Page){
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
  await expect.poll(()=>page.evaluate(async()=>new Promise<boolean>(resolve=>{const r=indexedDB.open('warehouse-capstone-v1');r.onsuccess=()=>{const db=r.result;const q=db.transaction('snapshots').objectStore('snapshots').getAll();q.onsuccess=()=>{resolve(q.result.some((s:{items:unknown[]})=>s.items.length>=5));db.close();};};}))).toBe(true);
}
test('loaded-view prefix and exact SKU tools distinguish local misses',async({page})=>{
  await login(page);await enableTools(page);
  await page.getByLabel('Loaded-view search',{exact:true}).fill(' CAT6 ');await expect(page.locator('article')).toHaveCount(2);
  await page.getByLabel('Loaded-view search',{exact:true}).fill('at6');await expect(page.locator('article')).toHaveCount(0);await expect(page.getByText('No match in the loaded view.',{exact:false})).toBeVisible();
  await page.getByRole('combobox',{name:'Match type',exact:true}).selectOption('exact');await page.getByLabel('Loaded-view search',{exact:true}).fill(' cat6-1000-a ');
  await expect(page.locator('article')).toHaveCount(1);await expect(card(page,'Cat6 cable, 1,000 ft box')).toBeVisible();
  await page.getByLabel('Loaded-view search',{exact:true}).fill('MISSING-SKU');await expect(page.getByText('Use the warehouse search above to look beyond this view.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Search & sort this view',exact:true}).click();await expect(page.locator('article')).toHaveCount(6);
});
test('lowest-stock view rebuilds after a confirmed stock adjustment',async({page})=>{
  await login(page);await enableTools(page);await page.getByRole('combobox',{name:'Loaded-view order',exact:true}).selectOption('lowest');
  const quantities=()=>page.locator('.quantity strong').allTextContents();
  let numbers=(await quantities()).map(Number);expect(numbers).toEqual([...numbers].sort((a,b)=>a-b));expect(numbers[0]).toBe(0);
  await card(page,'Cat6 cable, 2,000 ft box').getByRole('button',{name:'Details and stock'}).click();
  const dialog=page.getByRole('dialog');await dialog.getByLabel('Quantity change',{exact:true}).fill('100');await dialog.getByLabel('Reason',{exact:true}).fill('M3 reorder test');
  await dialog.getByRole('button',{name:'Record change',exact:true}).click();await expect(dialog.locator('.detail-count')).toContainText('102');await dialog.getByRole('button',{name:'Close dialog'}).click();
  await expect(card(page,'Cat6 cable, 2,000 ft box').locator('.quantity strong')).toHaveText('102');
  numbers=(await quantities()).map(Number);expect(numbers).toEqual([...numbers].sort((a,b)=>a-b));
  await mkdir('test-results/screenshots',{recursive:true});await page.screenshot({path:'test-results/screenshots/m3-lowest-stock.png',fullPage:true});
});
test('loaded-view indexes discard old names, old SKUs and archived records',async({page})=>{
  await login(page);const h=await headers(page);
  const created=await page.request.post('/api/items',{headers:h,data:{name:'M3 initial item',sku:'M3-INITIAL',quantity:1,reorderLevel:2,location:'Test shelf',category:'Test',notes:''}});expect(created.status()).toBe(201);
  let record=(await created.json()).item;await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(card(page,'M3 initial item')).toBeVisible();await enableTools(page);
  await page.getByLabel('Loaded-view search',{exact:true}).fill('M3 initial');await expect(page.locator('article')).toHaveCount(1);
  const edited=await page.request.patch(`/api/items/${record.id}`,{headers:h,data:{name:'M3 renamed item',sku:'M3-RENAMED',category:record.category,location:record.location,notes:record.notes,reorderLevel:record.reorderLevel,version:record.version}});expect(edited.status()).toBe(200);record=(await edited.json()).item;
  await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.locator('article')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Match type',exact:true}).selectOption('exact');await page.getByLabel('Loaded-view search',{exact:true}).fill('M3-INITIAL');await expect(page.locator('article')).toHaveCount(0);
  await page.getByLabel('Loaded-view search',{exact:true}).fill('M3-RENAMED');await expect(card(page,'M3 renamed item')).toBeVisible();
  const archived=await page.request.post(`/api/items/${record.id}/archive`,{headers:h,data:{version:record.version}});expect(archived.status()).toBe(204);
  await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.locator('article')).toHaveCount(0);
});
test('loaded-view tools work after offline reload and do not claim warehouse-wide results',async({page,context})=>{
  await login(page);await waitForSavedView(page);await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('.banner')).toContainText('Offline');await enableTools(page);await page.getByLabel('Loaded-view search',{exact:true}).fill('mag');await expect(page.locator('article')).toHaveCount(1);
  await page.getByRole('combobox',{name:'Match type',exact:true}).selectOption('exact');await page.getByLabel('Loaded-view search',{exact:true}).fill('NOT-CACHED');
  await expect(page.getByText('Reconnect to search beyond the saved view.',{exact:false})).toBeVisible();await context.setOffline(false);
});
test('loading another page expands the exact-SKU index without pretending the first page was complete',async({page})=>{
  await login(page);const h=await headers(page);
  for(let i=0;i<30;i++){
    const response=await page.request.post('/api/items',{headers:h,data:{name:`M3 page item ${i}`,sku:`M3-PAGE-${i}`,quantity:i,reorderLevel:2,location:'M3 test shelf',category:'Test',notes:''}});expect(response.status()).toBe(201);
  }
  const first=await(await page.request.get('/api/items?q=M3%20page&limit=25')).json();
  const second=await(await page.request.get(`/api/items?q=M3%20page&limit=25&after=${first.nextCursor}`)).json();expect(second.items.length).toBe(5);const target=second.items[0];
  await page.getByLabel('Search inventory',{exact:true}).fill('M3 page');await expect(page.locator('article')).toHaveCount(25);await enableTools(page);
  await page.getByRole('combobox',{name:'Match type',exact:true}).selectOption('exact');await page.getByLabel('Loaded-view search',{exact:true}).fill(target.sku);await expect(page.locator('article')).toHaveCount(0);
  await page.getByRole('button',{name:'Load more items'}).click();await expect(card(page,target.name)).toBeVisible();
  await expect(page.locator('.indexed-count')).toHaveText('30 items loaded');await expect(page.getByRole('button',{name:'Load more items'})).toHaveCount(0);
});
test('loaded-view controls fit a phone and do not grant a viewer write access',async({page})=>{
  await page.setViewportSize({width:390,height:844});await login(page,'viewer');await enableTools(page);await page.getByRole('combobox',{name:'Loaded-view order',exact:true}).selectOption('lowest');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByRole('button',{name:'Add item',exact:true})).toHaveCount(0);
  await mkdir('test-results/screenshots',{recursive:true});await page.screenshot({path:'test-results/screenshots/m3-phone-tools.png',fullPage:true});
  const h=await headers(page),response=await page.request.post('/api/items',{headers:h,data:{}});expect(response.status()).toBe(403);
});

// Milestone Four UI polish: the view tools share the main search panel.
test('view tools expand from a compact keyboard-accessible control and reset without changing the warehouse filters',async({page})=>{
  await login(page);
  const toggle=page.getByRole('button',{name:'Search & sort this view',exact:true});
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(page.getByLabel('Loaded-view search',{exact:true})).toHaveCount(0);
  await expect(page.locator('.indexed-tools input[type="checkbox"]')).toHaveCount(0);
  await expect(page.locator('.inventory-search-panel')).toContainText('Search inventory');
  const box=await page.locator('.indexed-tools').boundingBox();
  expect(box!.height).toBeLessThan(100);
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(page.getByLabel('Loaded-view search',{exact:true})).toBeVisible();
  await expect(page.locator('.indexed-scope')).toContainText('This view only');
  const filters=page.getByLabel('Search inventory',{exact:true});
  const warehouseQuery=await filters.inputValue();
  await page.getByLabel('Loaded-view search',{exact:true}).fill('M4-UI-NO-SUCH-SKU');
  await expect(page.locator('article')).toHaveCount(0);
  await page.getByRole('button',{name:'Reset view tools',exact:true}).click();
  await expect(page.getByLabel('Loaded-view search',{exact:true})).toHaveValue('');
  await expect(filters).toHaveValue(warehouseQuery);
  await expect(page.locator('article').first()).toBeVisible();
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(toggle).toBeFocused();
});
