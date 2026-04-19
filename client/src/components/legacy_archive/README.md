# Legacy UI Archive

Purpose: hold UI shell components removed from active Zorgregie runtime during cleanup.

## Archived Files

| File | Category | Why Archived | Reusable Ideas | Deletion Candidate |
| --- | --- | --- | --- | --- |
| ModernSidebar.tsx | Frontend layout legacy | Replaced by active care/navigation shell | Maybe (navigation grouping patterns) | Yes, after full shell migration freeze |
| ModernTopbar.tsx | Frontend layout legacy | Replaced by active top-level header flows | Maybe (header action density patterns) | Yes, after no references for 2 releases |
| ModernFilterBar.tsx | Frontend layout legacy | Not used by active pages; superseded by page-local filters | Low | Yes |

## Runtime Status

- Active runtime imports from this folder: none.
- Keep folder read-only.
- Do not import from this folder in new code.
