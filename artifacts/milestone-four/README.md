# CS 499 Milestone Four: Warehouse Inventory

Mark Stabnow

This update contains my database enhancement for the CS 360 Warehouse Inventory App. It also includes the updated search panel from October 4, 2026.

## Project files

* [Enhanced PWA source and startup instructions](enhanced-pwa/README.md)
* [Database enhancement details](enhanced-pwa/docs/milestone-four-database.md)
* [Milestone Four narrative (Word)](CS499_Milestone_Four_Narrative_Mark_Stabnow_Formatted.docx)
* [Original Android source](original-android/)
* [Milestone Three baseline](baseline-milestone-three/)
* [Verification status and limits](evidence/VERIFICATION.md)
* [Full milestone instructions](README_SUBMISSION.md)
* [Public-copy changes](PUBLICATION_NOTES.md)

## Run or review

Use `enhanced-pwa/` for the current app. The demo has five sample inventory items. The benchmark and database test fixtures use 1,000 items.

The public copy contains `.env.example`, not `.env`. Generate private settings on a fresh clone with `npm run setup` from `enhanced-pwa/` before starting the normal app. Do not replace the settings or database of an existing installation.

The source package records 99 passing local tests. The full Docker/PostgreSQL/browser verification remains unconfirmed for this source revision. See the evidence documents for what ran and what did not. Preparing this GitHub copy did not rerun or change those results.

GitHub Pages hosts the portfolio, not the running Express API or PostgreSQL server. Run the app locally using Docker; publishing the source here does not deploy that backend.

