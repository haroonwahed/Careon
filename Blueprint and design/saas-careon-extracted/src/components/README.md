# Blueprint Extracted Components (Archive Snapshot)

Purpose: keep extracted design-time component snapshot separate from production runtime.

## Current Status

- This directory is not part of active Zorgregie runtime.
- Zero-reference cleanup removed multiple obsolete component files.
- Remaining files are retained for design reference and migration comparison.

## Classification

| Category | Description | Reusable Ideas | Deletion Candidate |
| --- | --- | --- | --- |
| Frontend layout legacy | Historical marketplace and shell components superseded in active app | Medium (layout and interaction patterns) | Yes, after migration docs are complete |
| Uncertain business/UI logic | Components containing interaction flows not validated in current runtime | Medium | Maybe |

## Rule

Use this directory for reference only. Do not wire imports from this snapshot into active client/src runtime.
