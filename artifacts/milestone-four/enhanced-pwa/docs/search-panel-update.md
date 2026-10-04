# Milestone Four: Search panel update

Mark Stabnow | October 4, 2026

## Change

The optional loaded-view tools now share the main search panel. A compact
"Search & sort this view" button replaces the oversized checkbox card. The button
expands and closes the existing prefix, exact-SKU and lowest-stock controls.
Closing it restores the unfiltered loaded view, as turning off the old checkbox did.
A loaded-item count stays visible. A reset button clears only the local view tools,
not the main inventory search or stock filter.

The field labels remain compatible with the existing browser tests. The expand
button exposes its state through aria-expanded, supports native button keyboard
interaction, and controls a named content element. The layout wraps on narrow
screens and respects reduced-motion preferences for the chevron.

No database tables, migrations, authentication, inventory records, stock history,
algorithm implementations, lockfile or environment settings were changed. The
original Android source and Milestone Three baseline remain unchanged. The
1,000-item test fixtures were preserved. The UI does not claim that a partial
loaded view is the entire inventory.

## Skill used

Reviewed UI UX Pro Max's component-review guidance and static quick-reference
rules for progressive disclosure, visual hierarchy, native controls, focus,
labeling, text reflow, and reduced motion:

https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md
https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/references/quick-reference.md

Used the static reference route for this focused component change, not the design
system generator or CLI search. No skill, new font, runtime library, or global
package was installed in the application. Existing colors and typography were kept.

## Verification performed for this update

* 90 existing dependency-free Node tests passed.
* 9 existing SQLite exporter tests passed.
* TypeScript transpile/syntax checks passed for the two changed TSX source files
  and the changed browser-test file. This is not a full typecheck or Vite build.
* Six static JSX render cases checked collapsed/expanded, prefix, exact SKU,
  lowest-stock ordering and a missing result using the actual component calculation
  code with fixed hook values.
* Chromium checked the static JSX renders at widths 320, 375, 390, 768, 1024 and
  1440 in collapsed and expanded states. No horizontal overflow was detected;
  the button was at least 44px high and exposed a visible focus outline. A 375px
  check with 200% root text size reflowed, and reduced motion disabled the chevron
  transition. These are layout checks, not React runtime/integration tests or a
  complete accessibility audit.

The full production build, real React browser interactions, database/API tests,
Docker stack and new browser regression test have NOT run for this update. npm
registry downloads were unavailable in this environment. The older evidence in
the full ZIP is historical; a screenshot of a static render is not an end-to-end
pass. Run the isolated Docker verifier for current integration evidence.

## Apply to the laptop's existing installation

1. Extract CS499_M4_Search_UI_Patch.zip to a temporary normal Windows folder.
2. Back up the existing enhanced-pwa/client and enhanced-pwa/tests folders.
3. Copy the patch's client, tests, and docs folders into the existing enhanced-pwa
   folder. Merge folders and replace the matching files. Do not delete the existing
   folders. The patch has no .env, Compose configuration, or database files.
4. With Docker Desktop and the current database still running, open PowerShell in
   the existing enhanced-pwa folder. Confirm that it is the cs499-m4-demo project
   used in the earlier setup. Then rebuild only the application:

   docker compose -p cs499-m4-demo -f compose.yml up -d --build --no-deps app

5. After the command succeeds, reopen http://localhost:4173 and refresh. If an old
   tab still shows the former checkbox, close that tab and reopen the address.
   Do not clear site storage while offline stock changes are pending.

Use the same Compose project name as your current running app. No database reset,
reseed, new migration or docker compose down -v is required for this UI update.

For the full integration checks, use the separate disposable verification stack:

   docker compose -f compose.verify.yml up --build --abort-on-container-exit --exit-code-from verify

Check the exit code and this run's verification-results/RUN_STATUS.json. Only a
current PASSED result confirms that the entire suite completed. These tests are
separate from the running demo's database.

## Hand-in archive

The full UI_Update ZIP includes the same four source/test replacements plus these
notes and updated package evidence/checksums. Prefer that archive as the source
for the next hand-in instead of the previous ZIP. Your Word narrative was not
edited as part of this UI-only change. The root SHA256SUMS in an older extracted
archive will no longer describe files after manually applying this patch; use the
full updated archive when you need a consistent package manifest.
