import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {InventoryIndex, normalize, compareStock} from '../shared/algorithms.mjs';
import {benchmarkItems, ITEM_COUNT, SEED} from './benchmark-data.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || args.some(a => !a.startsWith('--output='))) {
  throw new Error('Use npm run benchmark [-- --output=path]. This benchmark stays at 1,000 items.');
}
const output = args[0]?.slice('--output='.length) || 'benchmark-results';
const data = benchmarkItems(), WARMUPS = 3, ROUNDS = 15, QUERIES = 200;
const prepare = values => values.map(item => ({item, name: normalize(item.name), sku: normalize(item.sku)}));
const baseline = prepare(data), index = new InventoryIndex(data);
const prefixes = Array.from({length: QUERIES}, (_, i) => ['ca', 'Cable 00', 'inv-09', 'Sensor 0', 'zzzz', 'able', 'INV-000', 'reader'][i % 8]);
const skus = Array.from({length: QUERIES}, (_, i) => i % 5 === 0 ? `MISSING-${i}` : ` inv-${String((i * 37) % ITEM_COUNT).padStart(4, '0')} `);
const updates = Array.from({length: 100}, (_, i) => ({...data[(i * 7) % ITEM_COUNT], quantity: (i * 3) % 251}));
const scanPrefix = q => {const key = normalize(q); return baseline.filter(i => i.name.startsWith(key) || i.sku.startsWith(key)).map(i => i.item);};
const scanExact = q => {const key = normalize(q); return baseline.find(i => i.sku === key)?.item;};
const sorted = items => [...items].sort(compareStock).slice(0, 10);
const canonical = items => items.map(i => i.id).sort();
const checksum = items => items.reduce((sum, item) => sum + item.quantity + item.id.length, 0);

// Equivalent semantics before timing: startsWith vs startsWith, identical ties.
for (const q of prefixes) assert.deepEqual(canonical(index.prefix(q)), canonical(scanPrefix(q)));
for (const q of skus) assert.equal(index.exact(q)?.id, scanExact(q)?.id);
assert.deepEqual(index.lowest(10), sorted(data));
const changed = data.map(item => updates.find(u => u.id === item.id) ?? item);
const changedIndex = new InventoryIndex(data); updates.forEach(item => changedIndex.upsert(item));
assert.deepEqual(changedIndex.lowest(10), sorted(changed));
for (const item of changed) assert.equal(changedIndex.exact(item.sku).quantity, item.quantity);

let consumed = 0;
const cases = [
  {name: 'Build read model', operations: 1,
    baseline: () => () => prepare(data).length,
    indexed: () => () => new InventoryIndex(data).size},
  {name: 'Prefix search', operations: QUERIES,
    baseline: () => () => prefixes.reduce((n, q) => n + checksum(scanPrefix(q)), 0),
    indexed: () => () => prefixes.reduce((n, q) => n + checksum(index.prefix(q)), 0)},
  {name: 'Exact SKU lookup', operations: QUERIES,
    baseline: () => () => skus.reduce((n, q) => n + (scanExact(q)?.quantity ?? -1), 0),
    indexed: () => () => skus.reduce((n, q) => n + (index.exact(q)?.quantity ?? -1), 0)},
  {name: 'Lowest 10 stock', operations: QUERIES,
    baseline: () => () => {let n = 0; for (let i = 0; i < QUERIES; i++) n += checksum(sorted(data)); return n;},
    indexed: () => () => {let n = 0; for (let i = 0; i < QUERIES; i++) n += checksum(index.lowest(10)); return n;}},
  {name: '100 stock updates', operations: updates.length,
    baseline: () => {const rows = prepare(data); return () => {for (const item of updates) {const i = rows.findIndex(r => r.item.id === item.id); rows[i] = {item, name: normalize(item.name), sku: normalize(item.sku)};} return rows.length;};},
    indexed: () => {const current = new InventoryIndex(data); return () => {for (const item of updates) current.upsert(item); return current.size;};}}
];
function timed(work) {const start = performance.now(); consumed += work(); return performance.now() - start;}
function stats(samples) {const s = [...samples].sort((a, b) => a - b); return {median_ms: s[Math.floor(s.length / 2)], p95_ms: s[Math.ceil(s.length * .95) - 1], samples_ms: samples};}
const results = [];
for (const entry of cases) {
  for (let i = 0; i < WARMUPS; i++) {timed(entry.baseline()); timed(entry.indexed());}
  const b = [], x = [];
  for (let r = 0; r < ROUNDS; r++) {
    // Fresh update fixtures are prepared before starting either timer.
    const bw = entry.baseline(), xw = entry.indexed();
    if (r % 2) {x.push(timed(xw)); b.push(timed(bw));} else {b.push(timed(bw)); x.push(timed(xw));}
  }
  results.push({task: entry.name, operations_per_sample: entry.operations, baseline: stats(b), indexed: stats(x)});
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const codeHashes = {};
for (const file of ['shared/algorithms.mjs', 'tools/benchmark-data.mjs', 'tools/benchmark.mjs']) codeHashes[file] = sha256(await readFile(file));
const report = {
  generated_at: new Date().toISOString(), items: ITEM_COUNT, seed: SEED,
  dataset_sha256: sha256(JSON.stringify(data)), code_sha256: codeHashes,
  environment: {node: process.version, platform: process.platform, architecture: process.arch, cpu: os.cpus()[0]?.model, logical_cpus: os.cpus().length},
  warmup_batches: WARMUPS, measured_batches: ROUNDS,
  measurement: 'Milliseconds per complete batch, not per operation. Median and p95 over 15 batches. Build excludes data generation. Queries exclude construction. Updates exclude fresh-fixture construction.',
  correctness: 'Equivalent prefix, exact, lowest-stock and update results checked before timing.',
  limitations: 'Synthetic in-memory microbenchmark on 1,000 items. No network, database, DOM or physical-device timings. Heap top-10 is unfiltered. Memory not measured. CPU scheduling, JIT and GC can affect results. One dataset size does not demonstrate scaling.',
  consumed, results
};
await mkdir(output, {recursive: true});
await writeFile(path.join(output, 'benchmark-1000.json'), JSON.stringify(report, null, 2) + '\n');
const table = results.map(r => `| ${r.task} | ${r.operations_per_sample} | ${r.baseline.median_ms.toFixed(3)} | ${r.indexed.median_ms.toFixed(3)} | ${r.baseline.p95_ms.toFixed(3)} | ${r.indexed.p95_ms.toFixed(3)} |`).join('\n');
const markdown = `# 1,000-item benchmark\n\nGenerated: ${report.generated_at}\n\nNode ${process.version}; ${report.environment.platform}/${report.environment.architecture}; ${report.environment.cpu}. Seed ${SEED}.\n\nAll values are **milliseconds per complete batch**, not per operation. ${WARMUPS} warmup batches and ${ROUNDS} measured batches; order alternates. Smaller values are faster for that batch.\n\n| Task | Operations / batch | Baseline median | Indexed median | Baseline p95 | Indexed p95 |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${table}\n\nBaseline: normalized array scan for prefix/SKU; copy-and-sort for lowest 10. Indexed: custom trie, hash map and non-destructive min-heap traversal. Build compares a normalized array with all coordinated indexes. The update row compares 100 linear record replacements with 100 coordinated index updates. Each update batch starts from a fresh 1,000-item fixture prepared outside its timer.\n\n${report.correctness}\n\n${report.limitations}\n\nRaw samples, dataset hash and code hashes are in benchmark-1000.json.\n`;
await writeFile(path.join(output, 'benchmark-1000.md'), markdown);
await writeFile(path.join(output, 'benchmark-1000.csv'), 'task,operations_per_batch,baseline_median_ms,indexed_median_ms,baseline_p95_ms,indexed_p95_ms\n' + results.map(r => [r.task,r.operations_per_sample,r.baseline.median_ms,r.indexed.median_ms,r.baseline.p95_ms,r.indexed.p95_ms].join(',')).join('\n') + '\n');
console.log(markdown);
