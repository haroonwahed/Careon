# Roadmap: Aanmelder product model vs `WorkflowRole` enforcement

## Problem statement

- **Product** (Constitution v2, `AGENTS.md`) centers the **Aanmelder** as the operational protagonist for intake, matching progression, and placement steps *within policy*.
- **Backend today** authorizes mutations via **`WorkflowRole`** (`gemeente`, `zorgaanbieder`, `admin`) in `contracts/workflow_state_machine.py` and API views — see [`FOUNDATION_LOCK.md`](./FOUNDATION_LOCK.md) and [`AANMELDER_WORKFLOWROLE_MAPPING.md`](./AANMELDER_WORKFLOWROLE_MAPPING.md).

Without an explicit convergence plan, **permissions**, **UX copy**, and **audit attribution** can drift (e.g. gemeente shown as “owner” where product intends aanmelder-led wording).

## Target architecture (phased)

| Phase | Deliverable | Outcome |
|-------|-------------|---------|
| **P0 (now)** | Keep `WorkflowRole` as sole enforcement; document mapping; metadata `CaseIntakeProcess.aanmelder_actor_profile` for product context only (not auth) | No security regression |
| **P1** | Introduce **`ActorProfile` / intent** on sessions or cases (read models): wijkteam, crisis, aanbieder-referrer, etc., mapped to allowed `WorkflowRole` + org | Copy and NBA can name the real actor; auth unchanged |
| **P2** | Fine-grained **authorization policies** keyed by actor profile + org tenancy (e.g. aanmelder may trigger subset of transitions currently bundled under gemeente) | Product and enforcement align |
| **P3** | Optional: distinct auth federations per actor class (OIDC claims → profile) | Municipality vs chain partner IdPs |

## Engineering guardrails

1. **Never** grant provider-level decisions to gemeente actors — constitution + `FOUNDATION_LOCK` hard guards stay.
2. Every new surface that says “Aanmelder” must still **check** `evaluate_case` / allowed actions for the signed-in technical role.
3. Any profile field used for **authorization** must have migration + tests + audit event shape reviewed (HIGH risk per `AGENTS.md`).

## Exit criteria for “debt cleared”

- Product copy, NBA ownership, and audit log actor labels consistently reflect **aanmelder** where policy allows, **without** weakening tenant or workflow gates.
- Single developer-readable table: actor profile → permitted actions → audit code — maintained alongside `FOUNDATION_LOCK.md`.
