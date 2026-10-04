# Milestone Four: database enhancement

## Starting point and scope

Use the uploaded Milestone Three source as the baseline, not the older design-only summary. The working code uses `items`, `on_hand`, `reorder_level`, manager/clerk/viewer roles, PostgreSQL-backed sessions, scrypt password hashing, raw SQL migrations, delta stock adjustments and row locks. Those decisions remain. This milestone does not replace them with the older proposed names, Knex, absolute quantity updates, bcrypt or new role names.

The original `DBHelper.java` actually defines `inventory_items(id,item_name,sku,quantity,location,notes,updated_at)` and `users(id,username,password_hash)`. It has no category or reorder threshold. Its update timestamp is text with no timezone. Those facts determine the importer; missing business values are not silently inferred.

## New implementation map

| File | Purpose |
| --- | --- |
| `db/migrations/002_database_enhancement.sql` | Additional constraints, indexes, `import_batches`, `import_rows` and reconciliation view. |
| `tools/migrate.mjs` | Applies the new file and explicitly grants read-only access to import records for the runtime role. |
| `server/repository.mjs` | Extracts the existing item creation operation into `createItemInTransaction` so an import can share one transaction. API behavior and adjustment rules stay the same. |
| `tools/export-android.py` | Read-only export of the original SQLite inventory fields, excluding users and password hashes. |
| `tools/lib/android-import.mjs` | Mapping validation, source identity, duplicate detection and the all-or-nothing import service. |
| `tools/import-android.mjs` | Operator CLI: preview by default; explicit `--apply` for writes. |
| `tools/db-report.mjs` | Read-only counts, import summary and ledger/balance discrepancy report. |
| `tools/evaluate-db.mjs` | Query-plan comparison on exactly 1,000 synthetic items. |
| `tools/verify-upgrade.mjs` | Populated 001 -> 002 migration, repeat run, failure rollback and checksum-tamper checks. |
| `tools/verify-recovery.mjs` | Synthetic snapshot-based dump, empty-target restore and data/permission checks. |
| `tests/import-*.test.mjs`, `tests/test_export_android.py` | Mapping, actual SQLite and complete export/mapping pipeline tests. |
| `tests/database-m4.test.mjs` | Import transactions, failures, concurrent retries, permissions, constraints and reconciliation. |
| `compose.verify.yml`, `Dockerfile.verify`, `tools/verify-all.sh` | Isolated end-to-end verification without using the normal app's volume. |

## Schema and relationships

`001_initial.sql` is unchanged. Editing an already-applied SQL file would invalidate its stored checksum. The new numbered file adds to the existing database instead of dropping and rebuilding it.

| Relation | Role |
| --- | --- |
| `users` -> `sessions` | Existing authenticated sessions. |
| `categories` / `locations` -> `items` | Existing foreign-key relationships; new indexes support the referencing columns. |
| `items` / `users` -> `stock_transactions` | Existing append-only-for-runtime history of accepted delta adjustments and opening counts. |
| `items` / `users` -> `audit_log` | Existing application audit entries; new per-item history index. |
| `users` -> `import_batches` | Manager attribution, explicit mapping settings and one source fingerprint per imported export. |
| `import_batches` / `items` -> `import_rows` | Original numeric ID to new UUID mapping, original timestamp text and raw source record. |
| `inventory_reconciliation` | Read-only aggregate comparing `items.on_hand` with the sum of its ledger, including archived items. |

The source identity is a SHA-256 digest of canonical original inventory rows, sorted by original ID. It is not a hash of the filename, and it is not proof of who supplied the data. Different whitespace or row ordering in the JSON file does not create a new batch. Changed source values create a new identity, but their existing SKUs still prevent an accidental duplicate import.

The view flags both mismatched balances and missing history. A zero opening count is a real history row and is not mistaken for missing history. This is a detection query, not an automatic correction or a database-level guarantee that arbitrary owner SQL cannot cause drift.

## Export and import procedure

Back up the target PostgreSQL database first. Work with a consistent backup of the Android SQLite database. A main-file-only copy from an actively writing WAL-mode app can omit committed changes; do not treat that copy as a complete backup. No real Android database was supplied in this task.

Install Python 3 for the exporter and the locked Node dependencies for the importer. From `enhanced-pwa`:

```sh
python3 tools/export-android.py /path/to/warehouse_inventory.db /path/to/android-inventory.json
```

On Windows, `py` can replace `python3`. The exporter opens the source read-only and refuses to replace the source or an existing output file. It selects only the seven inventory fields; it never exports users, password hashes or invents past stock events.

Preview against a running, migrated target:

```sh
npm run import:android -- --file /path/to/android-inventory.json --username manager --category "Imported from Android" --reorder-level 2 --report import-preview.json
```

The category and reorder threshold are operator decisions, not recovered Android fields. Review those values, every normalization change and every reported conflict. Preview connects using `DATABASE_URL` and uses a read-only transaction. It checks archived SKUs too. A ready preview is not a reservation; concurrent changes can still make a later apply fail.

Apply only after reviewing the preview and making a backup:

```sh
npm run import:android -- --file /path/to/android-inventory.json --username manager --category "Imported from Android" --reorder-level 2 --report import-applied.json --apply
```

Apply uses `OWNER_DATABASE_URL`, separate from runtime credentials, and must name an existing manager account. The owner credential is an operator capability, not a substitute for application login. This CLI is not a public API endpoint. Run it during a maintenance window and keep owner credentials private.

The implementation uses one transaction for the batch, all items, opening stock records, audit entries and source mappings. If any row or database write fails, it rolls the batch back. An advisory transaction lock serializes import attempts; the SKU and source uniqueness constraints handle conflicts. A racing API insert can cause the entire import to fail safely. No item is silently skipped or merged.

Reapplying the same canonical source and settings returns `already-imported` and writes nothing. Changing the mapping settings for an already-imported source is rejected. Importing a later export is not a stock synchronization feature: existing SKUs are rejected, not updated. Use reviewed stock adjustments for ongoing inventory changes.

### Mapping choices

| Android field | Enhanced destination / handling |
| --- | --- |
| `id` | Retained as `import_rows.source_id`; item gets a new UUID. |
| `item_name` | Validated and trimmed into `items.name`. |
| `sku` | Trimmed and uppercased using the API's existing rules; normalized duplicates reject the batch. |
| `quantity` | Integer in the allowed range; saved as current count and one explicitly labeled import opening balance. |
| `location` | Existing case-insensitive reference table; no made-up location for blanks. |
| `notes` | Null becomes empty app notes; unmodified original value remains in provenance. Overlong text is rejected, not truncated. |
| `updated_at` | Preserved as original text in provenance. The new row's actual import time is recorded separately. No timezone is guessed. |
| No category or reorder level | Both must be explicitly supplied by the operator. |

An import is bounded to 1,000 records and an 8 MiB JSON file for this capstone. The source has no stock-change history to recover. Opening balances are labeled as import opening counts, not fabricated historical transactions. Existing enhanced accounts keep their current password hashing; Android password hashes are not reused.

## Runtime data integrity

The inherited `adjust` method accepts signed quantity changes, locks the current item and records the accepted change with its resulting balance. A unique user/operation ID prevents a retried offline request from being counted twice. Separate metadata edits use the item's version. Those are intentionally different operations; this milestone does not switch stock changes back to stale absolute counts.

The app database role can append stock and audit records but cannot update/delete those histories. It receives only SELECT on import provenance. The database owner can still change data for administration and tests; this is not tamper-proof logging against a database administrator. Viewer/clerk/manager authorization is enforced by the existing API, not by a separate database login per warehouse user.

To check for discrepancies:

```sh
npm run db:report
```

This uses one read-only snapshot and exits nonzero when discrepancies are found. Investigate the records; the script deliberately does not overwrite quantities to make the report green.

## Query evaluation and trade-offs

`items_low_stock_idx` is a partial index on `(on_hand,id)` for active items with positive stock at or below their reorder level. It supports an explicitly lowest-stock-first SQL query. The existing warehouse list still uses UUID keyset pagination; the index is not claimed to optimize every existing list or substring search. The loaded-view trie/hash map/heap controls are unchanged.

Additional indexes consume space and add write maintenance. A small database can legitimately use a sequential scan. The evaluator records the planner's actual choice without disabling sequential scans or forcing an index.

The evaluator requires `QUERY_OWNER_DATABASE_URL` ending in `_test`, `ALLOW_TEST_DB=yes` and an empty disposable database. It imports exactly 1,000 synthetic records, then compares the same ordered low-stock query before/after the new index. The temporary index removal occurs inside a transaction that is rolled back. It also records exact-SKU, item-history and keyset-page plans.

It saves seven warm-cache samples per query and the full JSON `EXPLAIN (ANALYZE, BUFFERS)` output. Before/after order is not randomized. Results are local query observations, not a universal speedup, a scaling experiment or end-to-end phone timings. **No PostgreSQL measurements were obtained during this package preparation.**

## Upgrade and recovery checks

The upgrade helper creates the exact initial SQL schema in its own empty `_test` database, adds inventory/history, and invokes the real migration runner. It asserts retained rows and history, a harmless repeated migration, transaction rollback when new SQL fails, and rejection of an edited applied migration. Tamper/failure files exist only in a temporary directory.

The recovery helper uses the evaluator's 1,000-item database. A PostgreSQL exported snapshot connects its reference fingerprints to the snapshot used by `pg_dump`. `pg_restore` targets a different, empty `_test` database with error-stop and a single restore transaction. It never drops a preexisting database or table. The script compares per-table row counts and hashes, checks zero balance discrepancies, reapplies migration grants and checks the runtime role's restrictions.

The rehearsal uses synthetic data and is intended for one disposable cluster. It does not set up real scheduled backups, external encrypted storage, point-in-time recovery or backup monitoring. Dumps contain sensitive database contents and should not be published. The verification script removes its temporary synthetic dump and retains only the test result.

**Upgrade, real PostgreSQL import, query and recovery scripts were written but not executed here.** Read `../../evidence/VERIFICATION.md`. Run the isolated suite in the root submission instructions before treating these behaviors as verified.

## Plan changes and course outcomes

The PostgreSQL conversion and basic ledger were already present in Milestone Three. This enhancement completes additional database tooling rather than claiming that previous code was newly created. The initial design mentioned Knex and a full list cache; the actual baseline uses checksum-tracked SQL and a labeled loaded/cached view. Preserve and explain those decisions rather than silently describing the initial plan as implemented literally.

Outcome 4 is the main focus: relational modeling, preserving existing records and repeatable migration/import procedures. Outcome 5 is supported by rejecting invalid data, excluding legacy passwords, separate owner credentials and runtime history restrictions. Outcome 2 is supported by documentation and the narrative. Outcome 3 has query/index trade-offs, but its new measured PostgreSQL evidence remains pending. Outcome 1 still needs genuine feedback and collaboration evidence; documentation alone does not prove a review took place.

## Reference documentation

These references support the database techniques; they do not certify this implementation or replace its tests.

* PostgreSQL 17, `pg_dump`: https://www.postgresql.org/docs/17/app-pgdump.html
* PostgreSQL 17, Using EXPLAIN: https://www.postgresql.org/docs/17/using-explain.html
* Project-specific schema source: `original-android/app/src/main/java/com/example/marksinventoryapp/DBHelper.java` in the submission root.
