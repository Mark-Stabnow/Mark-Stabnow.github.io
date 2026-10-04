# Milestone Three: algorithms and data structures

## Scope and code

The original artifact is the CS 360 Android inventory app. Milestone Two moved its inventory workflow to a React/TypeScript PWA, an Express API, and PostgreSQL. This enhancement adds read-only tools over the inventory records already loaded in the browser.

- `shared/algorithms.mjs`: custom `HashMap`, `Trie`, `MinHeap`, and their `InventoryIndex` coordinator.
- `shared/algorithms.d.mts`: typed interface used by the React client.
- `client/IndexedInventoryView.tsx`: the optional loaded-view controls.
- `tests/algorithms.test.mjs`: 39 correctness tests.
- `tests/browser.spec.ts`: the original seven workflow checks plus six integration checks.
- `tools/benchmark-data.mjs` and `tools/benchmark.mjs`: the fixed 1,000-item experiment.

The existing warehouse search still queries the API. It can search beyond the loaded page. The new prefix/exact controls search only the loaded records, and say so. A missing local SKU leads the user back to warehouse search while online, or asks them to reconnect while offline. It never claims that an uncached item does not exist. The benchmark does not change the API's 25-item page size or seed the database with 1,000 records.

## The three structures

The hash map computes a string hash and stores colliding entries in array buckets. It checks key equality inside each bucket. New entries trigger resizing above a 0.75 load factor. The implementation does not wrap JavaScript Map. Exact SKU lookup trims and lowercases the query; the database's original uniqueness and authorization checks remain in place.

The trie indexes the starts of whole item names and SKUs. Each node has character children; terminal nodes keep item IDs. Searching follows the query's characters, then traverses the matching subtree. A Set removes duplicate IDs when both name and SKU match. Removing an item prunes unused nodes while retaining shared prefixes. A search for `cab` can match `Cable`; `able` cannot. Existing warehouse substring search has not been silently replaced with prefix search.

The min-heap orders confirmed quantities, including zero. SKU, then ID, break ties. A custom hash map tracks node positions for replacement and removal. Top-k retrieval explores a small frontier heap instead of draining or copying the original heap. It returns up to ten matching records in stock order. Lowest quantity is distinct from the existing low-stock filter, which uses each item's reorder level.

`InventoryIndex` validates a record before replacing its old entries. A duplicate SKU rejects the edit without removing the old record. Accepted edits remove the old name/SKU and stock entry, then insert the new record. Archives remove the record from all indexes. Frozen copies prevent a caller from mutating a confirmed quantity behind the indexes.

The React wrapper builds an index only while the optional tools are enabled. It memoizes that index across local search keystrokes. It rebuilds after the loaded list changes, including new pages, refreshed edits, archives, and accepted stock changes. This is a simpler integration at this project's scale than maintaining incremental indexes across every asynchronous UI path. The standalone coordinator also supports incremental updates, which the correctness tests and benchmark exercise.

## Complexity and costs

Let n be the indexed item count, L a bounded key length, p the query length, V the visited trie-subtree nodes, R the emitted ID references, and k the result count. Hash-table expectations assume reasonable hash distribution; no strict constant-time guarantee applies to adversarial collisions.

| Operation | Cost in this implementation | Trade-off |
| --- | --- | --- |
| Exact SKU lookup | Expected O(L); collision-heavy worst case can scan O(n) entries | Buckets and resize work use memory and construction time. |
| Trie prefix lookup | O(p + V + R), plus mapping unique IDs to records | Broad prefixes traverse more nodes. This terminal-ID trie is not O(p + result count) in general. |
| Heap insertion, update or removal | Expected O(log n) for bounded IDs; occasional map resizing is amortized | Must update the position index on swaps. |
| Unfiltered lowest k | Expected O(k log k) frontier work for bounded IDs | Does not sort all n records. Filtering can visit more than k nodes, up to n. |
| Full index construction | Expected O(nL + n log n), using repeated heap insertions | More expensive than preparing a normalized array. |
| Browser list change | Full index rebuild while tools are enabled | Simple synchronization, not an O(log n) end-to-end UI update claim. |

The trie nodes and terminal IDs require memory proportional to the inserted key characters and IDs. Hash buckets, record references, heap nodes and position entries add O(n) storage. The experiment does not measure memory usage.

## Benchmark method

The dataset has exactly 1,000 synthetic inventory records, generated from seed 499003. Names, IDs and SKUs are deterministic, and SKUs are unique. Quantity values include repeated values and zeros. Each run records the dataset and source SHA-256 hashes.

The baseline prepares normalized fields once. Prefix comparison uses an equivalent `startsWith` scan, not the Android app's different substring semantics. Exact lookup compares a linear scan with the hash map. Lowest-ten compares copy-and-sort with heap retrieval, using the same comparator. Assertions check equivalent answers before timing.

Each task gets three warmup batches and 15 measured batches, alternating baseline/indexed order. Prefix, SKU and lowest-ten batches each contain 200 operations. The update batch contains 100 replacements; its fixture still contains 1,000 records. Fixtures are recreated outside each update timer. A separate row measures full read-model construction. Timings are milliseconds for complete batches, not per operation. Reports include medians, nearest-rank p95 values and the raw samples.

The build and update baselines maintain a normalized array; the enhanced side maintains all coordinated indexes. Those rows show the extra preparation/maintenance cost, not identical internal work. Query timings exclude index construction, so they should be read beside the build row. The UI currently rebuilds indexes after a changed list rather than using the benchmark's incremental update path.

This is an in-memory Node.js microbenchmark, not a warehouse response-time or phone benchmark. It excludes the network, database and DOM. CPU scheduling, garbage collection and JIT compilation affect results. One dataset size does not establish scaling. A custom structure can be slower than a simple scan at 1,000 items; retain and discuss those results rather than selecting only favorable rows.

## Remaining work

Review the narrative's first-person reflection before submission. Instructor feedback, final database evaluation and final ePortfolio publication remain separate from these completed algorithm deliverables. Physical-phone installation and production deployment are not claimed by the automated browser checks.
