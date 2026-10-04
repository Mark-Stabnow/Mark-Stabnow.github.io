# Public-copy preparation

Source: `CS499_Milestone_Four_Mark_Stabnow_UI_Update.zip`.

This copy is for publishing in `Mark-Stabnow/Mark-Stabnow.github.io` under `artifacts/milestone-four/`. It does not replace the running project on Mark's laptop.

## Changes from the private UI-update ZIP

- Excluded the private `enhanced-pwa/.env` file. Kept `.env.example` with placeholders.
- Excluded Android IDE state and generated Android release metadata, without changing the original Java source or resources.
- Added the existing journal-formatted Milestone Four narrative without editing it.
- Updated public setup wording and the current search-control label in the README files.
- Added a project entry README and these publication notes.
- Rebuilt `SHA256SUMS` for this public artifact folder. The earlier package manifest is not reused.
- Added root Git ignore rules for private settings, database files, archives and generated output. Added line-ending rules for Docker scripts on Windows.

Application code, database migrations, package locks, and tests match the UI-update ZIP byte for byte. Existing evidence files remain unchanged and retain their original scope; publication is not another test run.

The existing portfolio `README.md` and `_config.yml` are not part of the upload bundle and are not overwritten. The optional workflow stays in `workflows/` as an example. It is not installed in `.github/workflows/`.

## Excluded paths

- `enhanced-pwa/.env`
- `original-android/.idea/.gitignore`
- `original-android/.idea/.name`
- `original-android/.idea/AndroidProjectSystem.xml`
- `original-android/.idea/compiler.xml`
- `original-android/.idea/deploymentTargetSelector.xml`
- `original-android/.idea/deviceManager.xml`
- `original-android/.idea/gradle.xml`
- `original-android/.idea/misc.xml`
- `original-android/.idea/runConfigurations.xml`
- `original-android/app/release/baselineProfiles/0/app-release.dm`
- `original-android/app/release/baselineProfiles/1/app-release.dm`
- `original-android/app/release/output-metadata.json`
