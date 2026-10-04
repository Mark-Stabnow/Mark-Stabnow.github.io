import test from 'node:test';
import assert from 'node:assert/strict';
import {HashMap, Trie, MinHeap, InventoryIndex, compareStock, normalize} from '../shared/algorithms.mjs';
import {benchmarkItems, ITEM_COUNT, random} from '../tools/benchmark-data.mjs';

const item = (id, quantity = 5, name = `Cable ${id}`, sku = `SKU-${id}`) => ({id, name, sku, quantity, archived: false});
const ids = values => values.map(v => v.id).sort();
function checkHeap(heap) {
  assert.equal(heap.size, heap.positions.size);
  heap.nodes.forEach((v, i) => {
    assert.equal(heap.positions.get(v.id), i);
    if (i) assert.ok(heap.compare(heap.nodes[Math.floor((i - 1) / 2)], v) <= 0);
  });
}

test('hash map reports missing keys and empty size', () => {
  const m = new HashMap(); assert.equal(m.size, 0); assert.equal(m.get('absent'), undefined); assert.equal(m.has('absent'), false);
});
test('hash map distinguishes a stored undefined value from a missing key', () => {
  const m = new HashMap(); m.set('present', undefined); assert.equal(m.has('present'), true); assert.equal(m.get('present'), undefined);
});
test('hash map replaces a value without increasing size', () => {
  const m = new HashMap(); m.set('a', 1).set('a', 2); assert.equal(m.get('a'), 2); assert.equal(m.size, 1);
});
test('hash map resolves deliberate collisions and deletion within a chain', () => {
  const m = new HashMap(16), keys = [];
  for (let i = 0; keys.length < 6; i++) if (m.bucketIndex(`key-${i}`) === 0) keys.push(`key-${i}`);
  keys.forEach((k, i) => m.set(k, i)); assert.equal(m.buckets[0].length, 6);
  assert.equal(m.delete(keys[2]), true); assert.equal(m.delete(keys[2]), false);
  keys.forEach((k, i) => assert.equal(m.get(k), i === 2 ? undefined : i));
});
test('hash map grows and retains exactly 1,000 entries', () => {
  const m = new HashMap(2); for (let i = 0; i < ITEM_COUNT; i++) m.set(String(i), i);
  assert.equal(m.size, 1000); assert.ok(m.buckets.length > 2);
  for (let i = 0; i < ITEM_COUNT; i++) assert.equal(m.get(String(i)), i);
});
test('hash map rejects invalid keys and capacities without corrupting entries', () => {
  assert.throws(() => new HashMap(1), RangeError); const m = new HashMap(); m.set('ok', 1);
  assert.throws(() => m.set(1, 3), TypeError); assert.throws(() => m.resize(0), RangeError); assert.equal(m.get('ok'), 1);
});
test('hash map treats prototype-like and empty strings as ordinary keys', () => {
  const m = new HashMap(); for (const key of ['__proto__', 'constructor', '']) m.set(key, key);
  assert.equal(m.size, 3); assert.equal(m.get('__proto__'), '__proto__');
});
test('hash map entries returns independent key-value pair arrays', () => {
  const m = new HashMap(); m.set('a', 1); m.entries()[0][1] = 9; assert.equal(m.get('a'), 1);
});

test('trie handles an empty structure and a missing prefix', () => {
  const t = new Trie(); assert.deepEqual(t.search(''), []); assert.deepEqual(t.search('x'), []); assert.equal(t.remove('x', '1'), false);
});
test('trie matches a whole-field prefix rather than a substring', () => {
  const t = new Trie(); t.insert('Cable reel', '1'); assert.deepEqual(t.search('cab'), ['1']); assert.deepEqual(t.search('able'), []);
});
test('trie ignores case and surrounding spaces', () => {
  const t = new Trie(); t.insert(' Cable ', '1'); assert.deepEqual(t.search(' CA '), ['1']);
});
test('trie preserves shared prefixes when removing another word', () => {
  const t = new Trie(); t.insert('cat', '1'); t.insert('catalog', '2'); t.remove('cat', '1'); assert.deepEqual(t.search('cat'), ['2']);
});
test('trie preserves different items with the same name', () => {
  const t = new Trie(); t.insert('Cable', '1'); t.insert('Cable', '2'); t.remove('Cable', '1'); assert.deepEqual(t.search('Cable'), ['2']);
});
test('trie deduplicates an ID matching both name and SKU', () => {
  const t = new Trie(); t.insert('Cable', '1'); t.insert('CAB-01', '1'); assert.deepEqual(t.search('ca'), ['1']);
});
test('trie removal prunes unused branches and permits reinsertion', () => {
  const t = new Trie(); t.insert('x', '1'); assert.equal(t.remove('x', '1'), true); assert.equal(Object.keys(t.root.children).length, 0);
  t.insert('x', '1'); assert.deepEqual(t.search(''), ['1']);
});
test('trie accepts prototype-like text without inheriting object properties', () => {
  const t = new Trie(); t.insert('__proto__', '1'); assert.deepEqual(t.search('__pro'), ['1']);
});
test('trie handles Unicode code points and long keys without recursive traversal', () => {
  const t = new Trie(); t.insert('🔧 Cable', '1'); t.insert('x'.repeat(1000), '2');
  assert.deepEqual(t.search('🔧'), ['1']); assert.deepEqual(t.search('x'.repeat(999)), ['2']);
});

test('heap handles empty and one-item cases', () => {
  const h = new MinHeap(compareStock); assert.equal(h.peek(), undefined); assert.equal(h.pop(), undefined);
  h.upsert(item('a')); assert.equal(h.pop().id, 'a'); assert.equal(h.size, 0); checkHeap(h);
});
test('heap orders zero stock and uses SKU and ID to break ties', () => {
  const h = new MinHeap(compareStock); const values = [item('c', 5), item('b', 0), item('a', 0)];
  values.forEach(v => h.upsert(v)); assert.deepEqual(h.smallest(10), [...values].sort(compareStock)); checkHeap(h);
});
test('heap moves stock increases downward and decreases upward', () => {
  const h = new MinHeap(compareStock); [item('a', 1), item('b', 5), item('c', 10)].forEach(v => h.upsert(v));
  h.upsert(item('a', 20)); assert.equal(h.peek().id, 'b'); checkHeap(h);
  h.upsert(item('c', 0)); assert.equal(h.peek().id, 'c'); checkHeap(h);
});
test('heap removes a middle node, root, last node, and unknown ID', () => {
  const h = new MinHeap(compareStock); Array.from({length: 7}, (_, i) => item(String(i), i)).forEach(v => h.upsert(v));
  for (const id of ['3', '0', '6', 'absent']) {h.remove(id); checkHeap(h);} assert.equal(h.size, 4);
});
test('heap top-k leaves the main heap and position index unchanged', () => {
  const h = new MinHeap(compareStock); benchmarkItems().forEach(v => h.upsert(v)); const before = h.nodes.map(v => v.id);
  assert.equal(h.smallest(10).length, 10); assert.deepEqual(h.nodes.map(v => v.id), before); checkHeap(h);
});
test('heap filters before counting results and still returns sorted matches', () => {
  const h = new MinHeap(compareStock), values = benchmarkItems(); values.forEach(v => h.upsert(v));
  const accept = v => v.name.startsWith('Cable'); assert.deepEqual(h.smallest(10, accept), values.filter(accept).sort(compareStock).slice(0, 10));
  assert.deepEqual(h.smallest(10, () => false), []);
});
test('heap validates count and comparator; zero count is empty', () => {
  assert.throws(() => new MinHeap(), TypeError); const h = new MinHeap(compareStock);
  assert.deepEqual(h.smallest(0), []); assert.throws(() => h.smallest(-1), RangeError); assert.throws(() => h.smallest(1.5), RangeError);
});
test('heap drains 1,000 deterministic items in the same order as sorting', () => {
  const h = new MinHeap(compareStock), values = benchmarkItems(); values.forEach(v => h.upsert(v)); const out = [];
  while (h.size) {out.push(h.pop()); checkHeap(h);} assert.deepEqual(out, [...values].sort(compareStock));
});
test('heap keeps position and ordering invariants across 1,000 seeded mutations', () => {
  const h = new MinHeap(compareStock), reference = new Map(), next = random(777);
  for (let n = 0; n < 1000; n++) {
    const id = String(Math.floor(next() * 100));
    if (next() < .3) {h.remove(id); reference.delete(id);}
    else {const v = item(id, Math.floor(next() * 100)); h.upsert(v); reference.set(id, v);}
    checkHeap(h); assert.deepEqual(h.smallest(10), [...reference.values()].sort(compareStock).slice(0, 10));
  }
});

test('coordinated index returns exact SKU, prefix, and lowest confirmed stock', () => {
  const x = new InventoryIndex([item('a', 10), item('b', 0)]); assert.equal(x.exact(' sku-A ').id, 'a');
  assert.deepEqual(ids(x.prefix('cable')), ['a', 'b']); assert.equal(x.lowest(1)[0].id, 'b');
});
test('coordinated index removes old name and SKU entries after an edit', () => {
  const x = new InventoryIndex([item('a')]); x.upsert(item('a', 1, 'Sensor', 'NEW-A'));
  assert.equal(x.exact('SKU-a'), undefined); assert.deepEqual(x.prefix('Cable'), []); assert.equal(x.prefix('Sensor')[0].id, 'a');
  assert.equal(x.exact('NEW-A').quantity, 1); assert.equal(x.size, 1);
});
test('coordinated index rejects duplicate SKU before removing the previous item', () => {
  const x = new InventoryIndex([item('a'), item('b')]);
  assert.throws(() => x.upsert(item('a', 1, 'Broken', 'sku-b')), /Duplicate/);
  assert.equal(x.exact('SKU-a').name, 'Cable a'); assert.equal(x.size, 2); assert.equal(x.prefix('Broken').length, 0);
});
test('coordinated index removes archived items from all structures', () => {
  const x = new InventoryIndex([item('a'), item('b')]); x.upsert({...item('a'), archived: true});
  assert.equal(x.exact('SKU-a'), undefined); assert.deepEqual(ids(x.prefix('Cable')), ['b']); assert.deepEqual(ids(x.lowest(10)), ['b']);
});
test('coordinated index permits reinsertion after removal', () => {
  const x = new InventoryIndex([item('a')]); assert.equal(x.remove('a'), true); assert.equal(x.remove('a'), false);
  x.upsert(item('a', 2)); assert.equal(x.exact('SKU-a').quantity, 2);
});
test('coordinated index keeps a defensive frozen snapshot', () => {
  const source = item('a', 10), x = new InventoryIndex([source]); source.quantity = 0;
  assert.equal(x.exact('SKU-a').quantity, 10); assert.throws(() => {x.exact('SKU-a').quantity = 1;}, TypeError);
});
test('coordinated index rejects invalid records without replacing a valid one', () => {
  const x = new InventoryIndex([item('a')]);
  for (const bad of [{quantity: -1}, {quantity: 1.5}, {quantity: NaN}, {name: ''}, {name: 'x'.repeat(121)}, {sku: ' '}, {id: ''}]) {
    assert.throws(() => x.upsert({...item('a'), ...bad}), TypeError);
  }
  assert.equal(x.size, 1); assert.equal(x.exact('SKU-a').quantity, 5);
});
test('coordinated index handles a name equal to its SKU without duplicate results', () => {
  const x = new InventoryIndex([item('a', 0, 'SAME', 'SAME')]); assert.equal(x.prefix('sa').length, 1);
  x.remove('a'); assert.equal(x.prefix('sa').length, 0);
});
test('a fresh loaded-view index drops records absent from the new page', () => {
  const first = new InventoryIndex([item('a'), item('b')]); const refreshed = new InventoryIndex([item('b', 9)]);
  assert.equal(first.size, 2); assert.equal(refreshed.exact('SKU-a'), undefined); assert.equal(refreshed.exact('SKU-b').quantity, 9);
});
test('1,000-item fixture is deterministic and uses unique synthetic IDs and SKUs', () => {
  const values = benchmarkItems(); assert.equal(values.length, 1000); assert.deepEqual(values, benchmarkItems());
  assert.equal(new Set(values.map(v => v.sku)).size, 1000); assert.equal(new Set(values.map(v => v.id)).size, 1000);
});
test('1,000-item prefix results equal an equivalent normalized startsWith scan', () => {
  const values = benchmarkItems(), x = new InventoryIndex(values);
  for (const q of ['', 'c', ' Cable 00 ', 'inv-09', 'zzzz', 'able', 'READER']) {
    const text = normalize(q), expected = values.filter(v => normalize(v.name).startsWith(text) || normalize(v.sku).startsWith(text));
    assert.deepEqual(ids(x.prefix(q)), ids(expected));
  }
});
test('1,000-item exact-SKU results equal a normalized linear scan', () => {
  const values = benchmarkItems(), x = new InventoryIndex(values);
  for (const v of values) assert.deepEqual(x.exact(` ${v.sku.toLowerCase()} `), v);
  assert.equal(x.exact('MISSING'), undefined);
});
test('1,000-item stock changes agree across lookup, prefix, and heap', () => {
  const values = benchmarkItems(), x = new InventoryIndex(values);
  for (let i = 0; i < 100; i++) {values[i] = {...values[i], quantity: 100 + i}; x.upsert(values[i]);}
  assert.deepEqual(x.lowest(10), [...values].sort(compareStock).slice(0, 10));
  for (const v of values) {assert.equal(x.exact(v.sku).quantity, v.quantity); assert.ok(x.prefix(v.name).some(found => found.id === v.id && found.quantity === v.quantity));}
});
