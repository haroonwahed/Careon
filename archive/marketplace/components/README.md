# Marketplace Archive Components

Purpose: preserve historical marketplace UI components outside active Zorgregie runtime.

## Current Status

- Folder is archival only.
- Components with zero local runtime references were removed in cleanup pass.
- Remaining files are retained as snapshot artifacts and may still reference other archived modules.

## Archived File Classification

| Group | Category | Reusable Ideas | Deletion Candidate |
| --- | --- | --- | --- |
| ListingDetailsPage.tsx, PublishedListingsPage.tsx | Frontend layout legacy | Medium (detail page composition) | Yes, after snapshot export is finalized |
| MessageDetailPage.tsx, MessagesPage.tsx | Frontend layout legacy | Medium (thread/message layout patterns) | Yes, after snapshot export is finalized |
| SettingsPage.tsx | Frontend layout legacy | Low | Yes |
| tracking/* | Frontend experiment legacy | Low | Yes |

## Rule

Do not import from archive/marketplace/components into active application source.
