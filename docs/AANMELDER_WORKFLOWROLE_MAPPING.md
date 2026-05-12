# Aanmelder (product) ↔ `WorkflowRole` (technical)

**Purpose:** Close the gap between v1.3 product language (**Aanmelder** as primary operational initiator) and the current permission model, which still uses `WorkflowRole` on `UserProfile` / `OrganizationMembership`.

**Rule:** Authorization and audit **always** use technical `WorkflowRole` until a dedicated actor profile ships. UI copy may say “Aanmelder” when the acting user is a **gemeente** or other org member performing aanmelder-style steps for their organization.

## Current mapping (2026)

| Product actor | Typical org | Technical `WorkflowRole` today | Notes |
|----------------|------------|--------------------------------|--------|
| Aanmelder (wijkteam, JB, crisis, …) | Often a **gemeente**-hosted or contracted team | `gemeente` | Same role as gemeente validators when the account is tied to the municipality org. |
| Aanmelder as **zorgaanbieder** initiator | Provider org | `zorgaanbieder` | Zelfde technische rol; mag o.a. **nieuwe casus aanmaken** (`CREATE_CASE` / `POST …/intake-create/`) naast reacties en intake — keten blijft gemeente-validatie vóór toewijzing afdwingen. |
| Gemeente (financiële validatie, keten) | Municipality | `gemeente` | Unchanged; product text may still separate “validatie” from “aanmelding” in UI. |
| Zorgaanbieder | Provider | `zorgaanbieder` | Capacity and reacties. |
| Platform / systeem | — | N/A (batch jobs use **admin** or service principals) | Matching support and orchestration are system-assisted; no separate `platform` role in `WorkflowRole` yet. |

## Backend metadata (shipped)

- `CaseIntakeProcess.aanmelder_actor_profile` (`AanmelderActorProfile` choices) is set **server-side** on `POST …/intake-create/` from `WorkflowRole` + `entry_route` (o.a. `WIJKTEAM` vs standaard gemeente-route, `ZORGAANBIEDER_ORG`, `ADMIN`). **Geen** aparte security role; **niet** opgenomen in SPA case-list/detail JSON (alleen DB + Django-admin + toekomstige exports).
- Optioneel later: verfijnen met expliciete payload (bijv. `JEUGDBESCHERMING`, `CRISIS`) **alleen** voor gemeente-accounts, met strikte allowlist—mag nooit `WorkflowRole` vervangen.

## Future (explicit)

- If **Aanmelder** becomes a first-class role, ship with migration, API version, and regression tests on every mutation path.

## References

- `docs/FOUNDATION_LOCK.md` — actor ownership table  
- `docs/Zorg_OS_Product_System_Core_v1_3.md` — Aanmelder-first product model  
- `contracts/workflow_state_machine.py` — `WorkflowRole` and allowed actions  
