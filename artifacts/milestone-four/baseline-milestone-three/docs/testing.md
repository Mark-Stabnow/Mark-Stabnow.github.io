# Run the checks

The automated workflow starts a separate PostgreSQL 17 database and runs the build, unit/HTTP checks, PostgreSQL checks, and Chromium browser checks. It saves the logs even when something fails. The original Android app is copied into the artifact but is not compiled or exercised by these web tests.

## Unit and HTTP checks

```sh
npm ci
npm run build
npm test
```

The unit tests exercise input rules, password hashing, and queue decisions. The HTTP tests use a small repository stub so they can check sessions, routes, role enforcement, CSRF, origin checks, and response behavior without a database.

## PostgreSQL checks

Use a separate database ending in `_test`. The script refuses to run without that suffix and ALLOW_TEST_DB=yes. The tests add temporary records and briefly add a constraint to force a failed write. They must not share a database with real work.

For a local PostgreSQL service, create the database using the owner account. This example assumes the localhost container from the README is running:

```sh
docker compose exec db createdb -U warehouse_owner warehouse_test
```

Copy your private `.env` somewhere safe. Temporarily change the database name in both database URLs from `/warehouse` to `/warehouse_test`, and add `ALLOW_TEST_DB=yes`. Keep the generated passwords unchanged. Then run:

```sh
npm run migrate
npm run seed
npm run test:db
```

Restore the original `.env` before going back to the normal demo. Do not commit either copy. The database checks cover duplicate SKUs, missing permissions on history tables, balance/ledger agreement, rollback after an audit failure, stale edits, concurrent withdrawals, retries, migration re-runs, session expiry, and account lockout.

## Browser checks

Keep the test database settings in place, then run the following in one terminal:

```sh
npm run build
npm start
```

In another terminal, in the same folder:

```sh
npx playwright install chromium
npm run test:e2e
```

The browser suite expects fresh seed data. It adds one sample item and changes another stock count. Use a fresh test database for another full browser run rather than pointing it at an old test state. Stop the app before resetting a disposable test database. There is no automatic destructive reset command in the package.

The suite covers login, item creation and editing, duplicate SKU handling, recorded stock changes, history display, offline reload and replay, viewer restrictions, logout, and phone/tablet widths. It saves screenshots and a machine-readable report under `test-results/`.

## Manual checks before submission

Run the app on your computer and try the normal warehouse tasks yourself. Check keyboard navigation, form labels, error messages, and how the layout reads at a comfortable font size. Confirm offline queue behavior with your browser. Physical phone installation, HTTPS hosting, Safari, Firefox, and Android compilation are separate checks, not results claimed by the Chromium suite.

Read `evidence/run.txt` and the logs in the submission zip. Report the results recorded there. Do not convert a skipped step into a passing test, or use the number of assertions as the number of tests.

## Milestone Three checks

`npm run test:algorithms` runs 39 named tests, including deliberate hash collisions, trie pruning, heap position invariants, edits and archives, and equivalent results on 1,000 items. The implementation uses custom structures; native Map is used only as an independent test oracle.

`npm run benchmark` generates JSON, Markdown and CSV under `benchmark-results/`. It uses exactly 1,000 synthetic records and does not connect to the database. Read the methodology and limitations with the numbers.

The browser suite adds six checks: prefix/exact lookup and local misses, stock reordering, name/SKU edits and archiving, offline reload, another page expanding the index, and phone layout with viewer restrictions. Run the complete browser suite against a fresh disposable test database; the original seven checks use a shared seeded sequence.
