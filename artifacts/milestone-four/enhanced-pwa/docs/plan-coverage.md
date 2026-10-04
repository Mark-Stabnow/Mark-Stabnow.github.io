## Milestone Four update (October 4, 2026)

The PostgreSQL import, forward migration, reconciliation report, query evaluator and recovery/upgrade test helpers are now included. They extend the Milestone Three baseline described below. New PostgreSQL/browser checks remain unexecuted in the preparation environment; the passing current local checks are listed in `../evidence/VERIFICATION.md` from the app root. Use `docs/milestone-four-database.md` from the app root and the submission README for the isolated verification command.

# Enhancement plan coverage through Milestone Three

This implementation follows Category One of the September 20 Warehouse PWA plan. It keeps the same artifact and React/TypeScript, Express, PostgreSQL, service-worker, and IndexedDB direction. The plan's duplicate-submission and conflict rules are filled in here with request IDs, row locks, rejected-change messages, and tests.

| Planned work | Code in this milestone | Remaining review |
| --- | --- | --- |
| Responsive PWA | React screens, manifest, built service worker, phone/tablet CSS | Physical-device installation and additional browsers |
| Separate application responsibilities | Client API module, server routes, validation module, repository | Mark's code walkthrough and instructor feedback |
| Stronger authentication | Salted scrypt, timed account lockout, IP limiting, session cookies, CSRF and Origin checks | Production deployment and account-management design |
| Offline support | Last-view snapshots, durable local commands, explicit pending state, replay IDs | Real device storage limits and recovery testing |
| Main workflow tests | Unit, stubbed HTTP, real PostgreSQL, and Chromium suites | Check the run record for executed results |
| Database foundations | Related tables, SKU constraint, ledger, audit, migration, runtime role limits | Final database narrative, query evaluation, backup/restore work |
| Custom algorithms | Custom trie, hash map, min-heap; loaded-view controls; 1,000-item equivalent-task benchmark | Review recorded results and instructor feedback |

## Course outcomes

Outcome 4 has the main implementation evidence: a working client/API/database structure and repeatable setup. Outcome 5 has concrete protection and failure-path tests, but does not imply a production security certification. Outcome 2 is supported by the setup guide, architecture notes, API reference, and narrative. Outcome 3 has design trade-offs and bounded pagination here; the custom algorithms and their 1,000-item measurements are covered in Milestone Three. Outcome 1 needs actual review and feedback evidence. Clear documentation helps another person participate, but it does not prove a team collaboration happened.

## Scope changes to discuss with the instructor

The Android SMS feature is not ported. The PWA uses in-app low-stock and out-of-stock indicators. Accounts are seeded locally rather than exposed through public registration. Adding/editing item metadata remains online-only. These choices keep Milestone Two focused on its architecture and stock-change workflow. The final submission should describe them rather than imply feature-for-feature parity with Android.

## Milestone Three scope

The benchmark stays at 1,000 synthetic items, matching the submitted Milestone Two narrative and Mark's confirmed scope. No larger dataset is part of this enhancement. Outcome 3 is the main focus; Outcome 2 is supported by the narrative and test documentation, and Outcome 4 by the working UI integration. Existing API authorization remains unchanged. Instructor feedback and final database evaluation remain separate work.
