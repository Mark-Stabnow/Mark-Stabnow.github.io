export interface IndexedItem {id: string; name: string; sku: string; quantity: number; archived?: boolean}
export function normalize(value: string): string;
export function compareStock<T extends IndexedItem>(a: T, b: T): number;
export class HashMap<V = unknown> {
  constructor(capacity?: number);
  size: number;
  buckets: [string, V][][];
  bucketIndex(key: string): number;
  get(key: string): V | undefined;
  has(key: string): boolean;
  set(key: string, value: V): this;
  delete(key: string): boolean;
  resize(capacity: number): void;
  entries(): [string, V][];
}
export class Trie {
  insert(key: string, id: string): void;
  remove(key: string, id: string): boolean;
  search(prefix: string): string[];
}
export class MinHeap<T extends {id: string}> {
  constructor(compare: (a: T, b: T) => number);
  readonly size: number;
  peek(): T | undefined;
  upsert(item: T): void;
  remove(id: string): T | undefined;
  pop(): T | undefined;
  smallest(k: number, accept?: (item: T) => boolean): T[];
}
export class InventoryIndex<T extends IndexedItem = IndexedItem> {
  constructor(items?: T[]);
  readonly size: number;
  upsert(item: T): void;
  remove(id: string): boolean;
  exact(sku: string): T | undefined;
  prefix(query: string): T[];
  lowest(count?: number, accept?: (item: T) => boolean): T[];
}
