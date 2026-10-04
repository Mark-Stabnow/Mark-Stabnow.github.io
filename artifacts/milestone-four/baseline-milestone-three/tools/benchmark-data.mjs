/** Synthetic records for the fixed 1,000-item benchmark, never a database seed. */
export const ITEM_COUNT = 1000;
export const SEED = 499003;
export function random(seed = SEED) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function benchmarkItems() {
  const next = random();
  const groups = ['Cable', 'Connector', 'Sensor', 'Switch', 'Relay', 'Bracket', 'Reader', 'Battery'];
  return Array.from({length: ITEM_COUNT}, (_, i) => ({
    id: `item-${String(i).padStart(4, '0')}`,
    sku: `INV-${String(i).padStart(4, '0')}`,
    name: `${groups[i % groups.length]} ${String(i).padStart(4, '0')}`,
    quantity: Math.floor(next() * 251), reorderLevel: 10, archived: false
  }));
}
