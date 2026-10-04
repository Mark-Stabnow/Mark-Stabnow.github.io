# CS 499 Milestone Four: Databases

Mark Stabnow | Warehouse Inventory App | October 4, 2026

## Read this first

This package continues the actual Milestone Three code supplied by Mark. It does not treat the older design summary as the current implementation. The original Android source and the Milestone Three comparison source are preserved.

**Verification status:** 99 local automated tests passed (90 Node tests and 9 real SQLite tests). The unchanged 1,000-item algorithm benchmark also ran. New PostgreSQL integration, migration-upgrade, query-plan, backup/restore and browser checks are provided but have **not run in this preparation environment**. A complete production build was not rerun because dependency downloads were unavailable. Do not describe this Milestone Four package as fully verified until the isolated suite succeeds.

## Files for the assignment

The assignment requests this technical-artifacts ZIP and the separate Word narrative, `CS499_Milestone_Four_Narrative_Mark_Stabnow_Formatted.docx`. The narrative covers the four prompts and includes the current verification limit. Review the reflection in your own voice and update the final testing paragraph after the remaining checks run. Instructor feedback and final ePortfolio publication have not been claimed.

| Folder | Contents |
| --- | --- |
| `original-android/` | Original CS 360 source. IDE state and generated release metadata are omitted from this public copy; source files are unchanged. |
| `baseline-milestone-three/` | Uploaded Milestone Three PWA source for comparison. Its generated `dist` files and local `.env` are omitted. |
| `enhanced-pwa/` | Milestone Four source, migration, import tools, database checks, unchanged algorithms, tests, lockfile and setup. |
| `evidence/` | Current local test logs, fixed 1,000-item algorithm results and verification limits. Prior Milestone Three evidence is clearly separated. |
| `workflows/` | Optional manual GitHub Actions workflow. Not installed in or run against Mark's repository. |
| `SHA256SUMS` | SHA-256 checksums for the packaged files. |

## What changed in Milestone Four

The existing PostgreSQL tables, stock adjustment transactions, duplicate-request protection and user permissions remain. New work adds a forward-only SQL migration with reference/history indexes, a low-stock query index, source-tracking tables for Android imports, and a read-only reconciliation view. A SQLite exporter reads the actual original `DBHelper` schema. The importer previews a batch first, reports invalid data and duplicate SKUs, and is written to commit the whole accepted batch with its opening balances, audit entries and source mapping. It never imports Android passwords.

The fixed capstone dataset remains **1,000 items**, not 10,000. The normal demo still has five sample items; the larger fixtures live only in isolated tests.

See `enhanced-pwa/docs/milestone-four-database.md` for exact file locations, mapping decisions, command examples and limitations.

## Run the remaining checks safely

Start Docker Desktop. Extract this ZIP, then open a terminal in **`enhanced-pwa`** and run:

```sh
docker compose -f compose.verify.yml up --build --abort-on-container-exit --exit-code-from verify
```

The first build downloads the locked project dependencies and Chromium. The separate test stack is named `cs499-m4-verification`; it exposes no database port and uses temporary database storage. It does not use the normal `warehouse-data` volume or the private `.env` passwords.

Read **`enhanced-pwa/verification-results/RUN_STATUS.json`**. `PASSED` means every stage completed in that run. `FAILED`, `IN_PROGRESS` or a missing file is not a passing result. Individual logs and query/recovery reports are saved next to it. Old files may remain from an earlier attempt; use the overall status and current timestamps, not an isolated old log.

Remove only that separate test stack afterward:

```sh
docker compose -f compose.verify.yml down
```

These commands are included for execution on your machine; they were not executed here. The supplied GitHub Actions workflow invokes the same Docker checks on a separate runner and can be used instead.

## Run the normal application

Do this after the isolated checks pass. Back up an existing working database before applying migration 002.

```sh
npm run setup
docker compose up --build
```

Open `http://localhost:4173`. This public copy does not include `.env` or Mark's local passwords. On a fresh clone, `npm run setup` creates private local settings; open that file on your own computer to read the demo login passwords. Keep any existing installation's `.env` and database volume unchanged. Existing database accounts keep their passwords. Do not commit `.env` or publish it on GitHub Pages.

The original Android app was not rebuilt. Physical-phone testing, a migration of Mark's real Android database, a backup of his live installation, final instructor approval and final ePortfolio upload remain outside the executed checks.

## Search panel UI update

The compact search panel update is included. See `enhanced-pwa/docs/search-panel-update.md` and `evidence/search-ui-update/` (paths relative to the archive root). Its 99 dependency-free tests passed; static render checks are not full browser verification. The production build and integration suite must be rerun for this source revision.
