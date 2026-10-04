# Milestone Three verification

Mark Stabnow | September 27, 2026 | Warehouse Inventory PWA

## Recorded run

- Repository: `Mark-Stabnow/CS---360--Mobile--Architecture--and--Programming`
- Branch: `capstone/milestone-three-1000-20260927`
- Tested application commit: `8336f692dce2b7e1722e3733acd67e34bb82ff36`
- Milestone Two baseline commit: `24f5226bd4fac3a4b5ffa159cbbb1722ee3db33c`
- Original Android commit: `e34cbd8a055a15b21856c5a6ca5943b7e6825415`
- GitHub Actions run: https://github.com/Mark-Stabnow/CS---360--Mobile--Architecture--and--Programming/actions/runs/36334386906
- Environment: GitHub Ubuntu runner, Node v22.23.2, PostgreSQL 17, Playwright Chromium.
- Downloaded CI artifact SHA-256: `7ab300033bdf0e7590ff6312cafc6591691b532706c17c164e37c6ac62cc7c79`.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript and production build | Passed | `build.log` |
| Unit and HTTP/API regression tests | 39 passed; 0 failed; 0 skipped | `unit-api.log` |
| Algorithm correctness tests | 39 passed; 0 failed; 0 skipped | `algorithms.log` |
| Real PostgreSQL regression tests | 18 passed; 0 failed; 0 skipped | `postgres.log` |
| Chromium workflow/integration tests | 13 passed; 0 failed; 0 skipped; 0 flaky | `browser.log`, `browser-results/browser-results.json` |
| Fixed 1,000-item benchmark | Equivalent answers checked; all five tasks recorded | `benchmark/benchmark-1000.json` and `.md` / `.csv` |
| Dependency audit | 0 reported vulnerabilities in this run | `npm-audit.json` |

Total: **109 passing automated tests**, plus the build and benchmark. These are named tests, not assertion counts. No skipped checks are counted as passing. The audit result applies to the recorded lockfile and report time; it is not a production security certification.

The six added browser checks exercise prefix/exact controls and cache-miss messages, confirmed stock reordering, name/SKU edits and archiving, offline reload, another page expanding the index, and phone-width layout with viewer restrictions. Existing browser and database regression checks still run. Screenshots are in `browser-results/screenshots/`.

## Benchmark: exactly 1,000 records

The seed is 499003. Each task has three warmup batches and 15 measured batches with alternating execution order. Values below are median **milliseconds per complete batch**, not per operation. CPU: Intel(R) Xeon(R) 6973P-C.

| Task | Operations per batch | Baseline median ms | Indexed median ms |
| --- | ---: | ---: | ---: |
| Build read model | 1 | 0.036 | 3.126 |
| Prefix search | 200 | 2.748 | 4.391 |
| Exact SKU lookup | 200 | 0.769 | 0.021 |
| Lowest 10 stock | 200 | 25.114 | 1.226 |
| 100 stock updates | 100 | 0.266 | 0.272 |

The custom hash map and heap were faster for the measured exact-SKU and unfiltered lowest-ten queries. Prefix search was slower with this terminal-ID trie than with the normalized scan. Building all indexes was more expensive than preparing the baseline array. The 100-update medians were close; the recorded samples do not justify a strong advantage for either update path. Read raw samples and p95 values with these medians.

Construction and update costs are recorded separately from lookup time. Prefix comparisons use equivalent prefix semantics, and lowest-stock comparisons use the same quantity/SKU/ID ordering. The browser rebuilds indexes after its loaded list changes, so the incremental update benchmark is not an end-to-end UI-update timing.

This is a Node.js in-memory microbenchmark. It does not measure network, database, DOM, physical-phone latency, memory use, or scaling beyond 1,000 items. No 10,000-item expansion was made.

## First-run correction

Run `36333969265` passed the build, unit/API, algorithm and database checks, but six new browser tests failed. Five timed out while locating nested select controls by an exact label-text match. The controls now have explicit names, and those tests use the combobox role and accessible name. The edit fixture also sent its full record, including `quantity`, to the metadata-edit endpoint. That endpoint correctly rejected it. The corrected fixture sends the permitted metadata fields and version only. The API's stock-adjustment rule was not weakened.

The complete suite ran again against a fresh disposable database in the successful run above. `development-history/first-run-browser.log` preserves the initial failures separately from the final results.

## Packaging and limits

The application, tests and lockfile in `enhanced-pwa/` match the successful CI artifact. The downloaded hand-in adds submission instructions, this verification note, the unchanged Milestone Two comparison source, and local demo configuration. Documentation added to the GitHub branch after this tested commit does not change the tested application code.

The private hand-in retains Mark's database and demo account passwords. Its `.env` origin/cookie settings are normalized for `http://localhost:4173`; the source in GitHub excludes `.env`. This local configuration was not the temporary database configuration used by CI. No changes were made to Mark's running installation.

The original Android source is preserved byte-for-byte from the uploaded package and was not compiled by these web tests. Docker Compose on Mark's machine, physical-phone installation, Safari, Firefox, production hosting, backup/restore, final database evaluation and final ePortfolio review are not claimed as completed checks.
