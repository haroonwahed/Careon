# Aanmelder (product) ↔ `WorkflowRole` (technical)

**Purpose:** Close the gap between v1.3 product language (**Aanmelder** as primary operational initiator) and the current permission model, which still uses `WorkflowRole` on `UserProfile` / `OrganizationMembership`.

**Rule:** Authorization and audit **always** use technical `WorkflowRole` until a dedicated actor profile ships. UI copy may say “Aanmelder” when the acting user is a **gemeente** or other org member performing aanmelder-style steps for their organization.

## Current mapping (2026)

| Product actor | Typical org | Technical `WorkflowRole` today | Notes |
|----------------|------------|--------------------------------|--------|
| Aanmelder (wijkteam, JB, crisis, …) | Often a **gemeente**-hosted or contracted team | `gemeente` | Same role as gemeente validators when the account is tied to the municipality org. |
| Aanmelder as **zorgaanbieder** initiator | Provider org | `zorgaanbieder` | Limited to actions that workflow already allows for providers (e.g. responses, intake handoff). |
| Gemeente (financiële validatie, keten) | Municipality | `gemeente` | Unchanged; product text may still separate “validatie” from “aanmelding” in UI. |
| Zorgaanbieder | Provider | `zorgaanbieder` | Capacity and reacties. |
| Platform / systeem | — | N/A (batch jobs use **admin** or service principals) | Matching support and orchestration are system-assisted; no separate `platform` role in `WorkflowRole` yet. |

## Future (explicit)

- Optional `actor_profile` (e.g. `WIJKTEAM`, `JEUGDBESCHERMING`, `CRISIS`) on membership or case, **additive**, for analytics and UX only—must not bypass `WorkflowRole` checks until security review.
- If **Aanmelder** becomes a first-class role, ship with migration, API version, and regression tests on every mutation path.

## References

- `docs/FOUNDATION_LOCK.md` — actor ownership table  
- `docs/Zorg_OS_Product_System_Core_v1_3.md` — Aanmelder-first product model  
- `contracts/workflow_state_machine.py` — `WorkflowRole` and allowed actions  
