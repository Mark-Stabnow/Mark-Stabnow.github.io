# Portfolio homepage

## Scope

This change adds a static entry page and portfolio-only CSS, replaces the placeholder root README with a project guide, and updates the site description. It does not edit files under `artifacts/`, app dependencies, Docker configuration, migrations, or application test results.

The page has no JavaScript, external font requests, analytics, third-party embeds, or runtime packages. It keeps the existing Minima theme setting. Its plain `index.html` has no Jekyll front matter and supplies its own layout. Existing artifact URLs and files stay in place.

## Content sources

The published Milestone Four README, database enhancement guide, algorithms guide, and verification record supply the project descriptions. The earlier design-only summary is not treated as the current implementation. The introduction uses Mark's stated work background and systems integration career goal; it does not claim a completed degree or a new job title.

The three review links point to the current source, the existing Word narrative, and the committed verification record. The Word download uses the existing same-origin file. Repository links open GitHub in the current tab. No localhost address is presented as a public app demo.

The evidence section is a dated summary of committed reports, not a live CI dashboard. Keep the 99 recorded local passes separate from the full application verification that is still unconfirmed. Do not combine historical Milestone Three results with new Milestone Four results.

## Update later

Add the final self-assessment, code review video, and the separate software design and algorithms narratives only after their public targets exist. Replace the pending text rather than introducing dead links. Update the evidence date and status only after checking new logs for the source revision being presented.

## Preview

From the repository root, serve the files with an available Python 3 installation:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080`. Stop the preview with Ctrl+C. This only serves the static site; it does not start the inventory app. Opening `index.html` directly also works for a visual check.

## Publication

Merge the homepage branch into `main`. Keep the existing GitHub Pages publishing configuration, which already built and deployed the previous `main` revision successfully. Check the new Pages run after merging; a successful local preview does not verify GitHub's Jekyll build or live deployment.

## Homepage checks

A local Chromium 144 static render passed layout checks at 320, 360, 375, 390, 768, 1024, and 1440 CSS pixels with no horizontal overflow. The 390px layout also passed with the root text size doubled. Keyboard activation of the skip link moved focus to main content; the next focusable link had a visible focus outline. Eight specified foreground/background text pairs exceeded a 4.5:1 calculated contrast ratio. This is not a complete accessibility audit.

The static checker resolved 24 href values against page anchors, the supplied repository file tree, or the repository root. The existing Word download target and two key evidence/source files matched their fetched GitHub blob hashes. That checks file identity, not successful HTTP delivery.

Browser policy blocked local HTTP navigation. The preview therefore used Chromium `set_content` with the exact stylesheet inlined. No live download, Jekyll build, GitHub Pages deployment, physical phone, Safari, or Firefox test was performed. The page uses no JavaScript. These website checks do not rerun or certify the Warehouse Inventory application.
