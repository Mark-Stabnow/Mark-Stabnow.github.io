# Warehouse inventory PWA

This is the CS 499 Milestone Three version of the Warehouse Inventory App. The starting artifact is the Java/SQLite Android project from CS 360. This version moves the screens to React and TypeScript and puts inventory rules and database access behind an Express API.

The original Android source stays separate. It comes from commit `e34cbd8a055a15b21856c5a6ca5943b7e6825415` in `Mark-Stabnow/CS---360--Mobile--Architecture--and--Programming`. Do not replace it with the web app when preparing the before-and-after comparison.

## Run it locally

Use Node.js 22.12 or newer within the Node 22 release line, plus Docker with Compose. Start Docker before running the commands. Open a terminal in this folder.

```sh
npm run setup
docker compose up --build
```

`setup` uses only built-in Node modules, so it works before package installation. It creates `.env` with random passwords. Compose starts PostgreSQL, applies the migration, adds sample inventory, and starts the app. The app runs at `http://localhost:4173`.

Open `.env` locally and use one of these accounts:

| Username | Password setting | What it can do |
| --- | --- | --- |
| manager | DEMO_MANAGER_PASSWORD | View, add, edit, archive, and adjust stock |
| clerk | DEMO_CLERK_PASSWORD | View inventory and adjust stock |
| viewer | DEMO_VIEWER_PASSWORD | View inventory and its history |

The download may include local demo settings. Keep `.env` out of GitHub and screenshots. Use `npm run setup` to generate fresh local settings when needed. Re-running setup keeps it. Re-running the seed keeps existing accounts and stock records; changing a demo password in `.env` does not reset an existing account.

Press Ctrl+C to stop the attached services. `docker compose down` stops them and keeps the database volume. `docker compose down -v` deletes that volume and its inventory, so do not use `-v` unless you intend to start over.

The Compose ports bind to this computer, not the whole network. Access from a phone over a LAN requires an HTTPS deployment, the correct APP_ORIGIN, and secure cookies. Do not expose the local demo as a public service.

## Run without the app container

This route still uses the PostgreSQL container. It helps when you want to edit the code or run the tests from your terminal.

```sh
npm run setup
npm ci
docker compose up -d db
npm run migrate
npm run seed
npm run build
npm start
```

Use `npm install` only when there is no lockfile yet. The packaged hand-in includes the lockfile captured during verification. If port 5432 is already in use, stop the other local database or change the Compose mapping and both database URLs in `.env` together.

For front-end development, keep the API running and open a second terminal for `npm run dev`. The Vite address is for editing only; use the built app at localhost:4173 for service-worker and offline tests. The API rejects cross-origin writes, so set APP_ORIGIN to the Vite origin only while using that development server, then restore it for the built app.

## Try the main workflow

Sign in as manager. Add an item with a new SKU, an opening quantity, a location, and a reorder level. Open Details and stock. Enter a positive change for stock received or a negative change for stock used, along with a reason. The count changes only after the server accepts the request. The history records the user, reason, change, and resulting balance.

Edit changes item details, not quantity. Archive removes an item from the active list and keeps its history. A viewer should have no stock-change controls, and the API should reject that viewer's direct write requests too.

For the offline demo, load the built app online first and wait for the service worker to install. Turn the browser offline in its developer tools, reload, and open a cached item. Record a change and reload again. It should remain in Pending changes without changing the confirmed count. Reconnect and use Sync now if needed. The request keeps the same ID through retries, so a lost response does not create a second stock change.

Only the last saved view is cached, not the full inventory. Adding, editing, and archiving items require a connection. Stock history is loaded online. Login also requires a connection. The browser can reopen a recent cached view offline on the same trusted device; this is not a separate offline authentication system. Logging out online ends the session and clears that user's cached data. Resolve or remove pending changes before logging out.

## Code to review

- `client/App.tsx`: screens, forms, status messages, and responsive inventory workflow.
- `client/offline.ts` and `client/sync.mjs`: local storage and retry handling.
- `server/app.mjs`: routes, sessions, CSRF checks, permissions, and error responses.
- `server/validation.mjs`: shared server-side input rules.
- `server/repository.mjs`: database access and stock-change transactions.
- `db/migrations/001_initial.sql`: tables, relationships, constraints, and indexes.
- `tools/migrate.mjs`: migration checks and restricted runtime database permissions.
- `tests/`: validation, HTTP, PostgreSQL, and browser checks.

## Tests

```sh
npm run build
npm test
npm run test:algorithms
npm run benchmark
```

Database and browser tests need a separate PostgreSQL database whose name ends with `_test`. Set DATABASE_URL and OWNER_DATABASE_URL to that database, set ALLOW_TEST_DB=yes, then run the migration and seed before the tests. Never point those tests at inventory you want to keep. See `docs/testing.md` for exact commands.

A green workflow is useful only when its build, unit/API, PostgreSQL, and browser steps all ran. The download includes logs and a run record. The package audit is a report for review; the workflow does not treat an audit warning as an automatic pass or erase it.

## Milestone scope

Milestone Two focuses on separating responsibilities, rebuilding the interface, protecting writes, and testing the workflow. The PostgreSQL schema and stock history are included because the PWA needs them. They provide a starting point for the database enhancement, not a claim that its final evaluation is done.

Milestone Three adds a custom trie, separate-chaining hash map, indexed min-heap, and a fixed 1,000-item comparison. Enable "Search and order the loaded view" to use them on the inventory records already loaded. The warehouse search above still uses the API and keyset pages. A miss in the local view is not a warehouse-wide miss. See `docs/algorithms.md` for the code, complexity, and trade-offs. The browser rebuilds its indexes when the confirmed loaded list changes; the benchmark measures both construction and individual operations.

The local demo is not a production deployment. There is no password reset, account-management screen, public registration, outbound SMS, or external stock system integration. Read `docs/security-and-sync.md` before putting real information into it.
