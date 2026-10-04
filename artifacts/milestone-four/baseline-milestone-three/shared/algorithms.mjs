/** CS 499: indexes for an already-loaded inventory view.
 * These structures never authorize a request or change confirmed database stock.
 */
export const normalize = value => value.trim().toLowerCase();

/** Separate chaining. Collisions share an array bucket, not a built-in Map. */
export class HashMap {
  constructor(capacity = 16) {
    if (!Number.isInteger(capacity) || capacity < 2) throw new RangeError('Capacity must be at least two.');
    this.buckets = Array.from({length: capacity}, () => []);
    this.size = 0;
  }
  bucketIndex(key) {
    if (typeof key !== 'string') throw new TypeError('HashMap keys must be strings.');
    // FNV-1a over UTF-16 code units. Equality checks still resolve collisions.
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619) >>> 0;
    return hash % this.buckets.length;
  }
  get(key) { return this.buckets[this.bucketIndex(key)].find(pair => pair[0] === key)?.[1]; }
  has(key) { return this.buckets[this.bucketIndex(key)].some(pair => pair[0] === key); }
  set(key, value) {
    const bucket = this.buckets[this.bucketIndex(key)];
    const old = bucket.find(pair => pair[0] === key);
    if (old) { old[1] = value; return this; }
    bucket.push([key, value]);
    this.size++;
    if (this.size > this.buckets.length * 0.75) this.resize(this.buckets.length * 2);
    return this;
  }
  delete(key) {
    const bucket = this.buckets[this.bucketIndex(key)];
    const i = bucket.findIndex(pair => pair[0] === key);
    if (i < 0) return false;
    bucket.splice(i, 1);
    this.size--;
    return true;
  }
  resize(capacity) {
    if (!Number.isInteger(capacity) || capacity < Math.max(2, Math.ceil(this.size / 0.75))) {
      throw new RangeError('New capacity must keep the load factor at or below 0.75.');
    }
    const entries = this.entries();
    this.buckets = Array.from({length: capacity}, () => []);
    this.size = 0;
    for (const [key, value] of entries) this.set(key, value);
  }
  entries() { return this.buckets.flatMap(bucket => bucket.map(pair => [...pair])); }
}

const trieNode = () => ({children: Object.create(null), ids: new Set()});
/** Terminal nodes keep item IDs. Search walks the matching subtree iteratively. */
export class Trie {
  constructor() { this.root = trieNode(); }
  insert(key, id) {
    let node = this.root;
    for (const char of normalize(key)) node = node.children[char] ??= trieNode();
    node.ids.add(id);
  }
  remove(key, id) {
    let node = this.root;
    const path = [];
    for (const char of normalize(key)) {
      if (!node.children[char]) return false;
      path.push([node, char]);
      node = node.children[char];
    }
    if (!node.ids.delete(id)) return false;
    for (let i = path.length - 1; i >= 0; i--) {
      const [parent, char] = path[i], child = parent.children[char];
      if (child.ids.size || Object.keys(child.children).length) break;
      delete parent.children[char];
    }
    return true;
  }
  search(prefix) {
    let node = this.root;
    for (const char of normalize(prefix)) {
      node = node.children[char];
      if (!node) return [];
    }
    const ids = new Set(), stack = [node];
    while (stack.length) {
      const current = stack.pop();
      for (const id of current.ids) ids.add(id);
      for (const child of Object.values(current.children)) stack.push(child);
    }
    return [...ids];
  }
}

/** Binary min-heap. A custom hash map tracks each item's array position. */
export class MinHeap {
  constructor(compare) {
    if (typeof compare !== 'function') throw new TypeError('A comparator is required.');
    this.compare = compare;
    this.nodes = [];
    this.positions = new HashMap();
  }
  get size() { return this.nodes.length; }
  peek() { return this.nodes[0]; }
  swap(a, b) {
    [this.nodes[a], this.nodes[b]] = [this.nodes[b], this.nodes[a]];
    this.positions.set(this.nodes[a].id, a).set(this.nodes[b].id, b);
  }
  up(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.compare(this.nodes[parent], this.nodes[i]) <= 0) break;
      this.swap(parent, i);
      i = parent;
    }
    return i;
  }
  down(i) {
    while (true) {
      let smallest = i;
      const left = 2 * i + 1, right = left + 1;
      if (left < this.size && this.compare(this.nodes[left], this.nodes[smallest]) < 0) smallest = left;
      if (right < this.size && this.compare(this.nodes[right], this.nodes[smallest]) < 0) smallest = right;
      if (smallest === i) return i;
      this.swap(smallest, i);
      i = smallest;
    }
  }
  upsert(item) {
    if (!item || typeof item.id !== 'string') throw new TypeError('Heap items need a string ID.');
    let i = this.positions.get(item.id);
    if (i === undefined) {
      i = this.size;
      this.nodes.push(item);
      this.positions.set(item.id, i);
    } else this.nodes[i] = item;
    this.down(this.up(i));
  }
  remove(id) {
    const i = this.positions.get(id);
    if (i === undefined) return undefined;
    const removed = this.nodes[i], last = this.nodes.pop();
    this.positions.delete(id);
    if (i < this.size) {
      this.nodes[i] = last;
      this.positions.set(last.id, i);
      this.down(this.up(i));
    }
    return removed;
  }
  pop() { return this.size ? this.remove(this.nodes[0].id) : undefined; }
  /** Best-first top-k traversal; leaves the inventory heap unchanged.
   * Filtering may require visiting more nodes than the requested result count.
   */
  smallest(k, accept = () => true) {
    if (!Number.isInteger(k) || k < 0) throw new RangeError('Count must be a nonnegative integer.');
    if (!k || !this.size) return [];
    const frontier = new MinHeap((a, b) => this.compare(this.nodes[a.index], this.nodes[b.index]));
    frontier.upsert({id: '0', index: 0});
    const result = [];
    while (frontier.size && result.length < k) {
      const {index} = frontier.pop(), item = this.nodes[index];
      if (accept(item)) result.push(item);
      for (const child of [index * 2 + 1, index * 2 + 2]) {
        if (child < this.size) frontier.upsert({id: String(child), index: child});
      }
    }
    return result;
  }
}

const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const compareStock = (a, b) => a.quantity - b.quantity || compareText(a.sku, b.sku) || compareText(a.id, b.id);
function checkedItem(item) {
  if (!item || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' ||
      !normalize(item.name) || item.name.length > 120 || typeof item.sku !== 'string' ||
      !normalize(item.sku) || item.sku.length > 64 || !Number.isSafeInteger(item.quantity) || item.quantity < 0) {
    throw new TypeError('Inventory needs an ID, name, SKU and nonnegative whole-number stock.');
  }
  return Object.freeze({...item});
}
/** Coordinates the three structures so edits cannot leave old search entries. */
export class InventoryIndex {
  constructor(items = []) {
    this.byId = new HashMap();
    this.bySku = new HashMap();
    this.prefixes = new Trie();
    this.stock = new MinHeap(compareStock);
    for (const item of items) this.upsert(item);
  }
  get size() { return this.byId.size; }
  upsert(input) {
    const item = checkedItem(input);
    if (item.archived) { this.remove(item.id); return; }
    const sku = normalize(item.sku), duplicate = this.bySku.get(sku);
    // Check before removal. A rejected edit must leave the old record intact.
    if (duplicate && duplicate.id !== item.id) throw new Error('Duplicate SKU in loaded inventory.');
    this.remove(item.id);
    this.byId.set(item.id, item);
    this.bySku.set(sku, item);
    this.prefixes.insert(item.name, item.id);
    this.prefixes.insert(item.sku, item.id);
    this.stock.upsert(item);
  }
  remove(id) {
    const old = this.byId.get(id);
    if (!old) return false;
    this.prefixes.remove(old.name, id);
    this.prefixes.remove(old.sku, id);
    this.bySku.delete(normalize(old.sku));
    this.byId.delete(id);
    this.stock.remove(id);
    return true;
  }
  exact(sku) { return this.bySku.get(normalize(sku)); }
  prefix(query) { return this.prefixes.search(query).map(id => this.byId.get(id)); }
  lowest(count = 10, accept) { return this.stock.smallest(count, accept); }
}
