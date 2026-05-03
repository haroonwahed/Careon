# Pilot dry-run checklist (canonical flow)

Use this during a **pilot rehearsal**: execute top-to-bottom with **gemeente** and **aanbieder** test accounts in a **non-production** tenant.

**Base URL prefix:** all Care routes are under `/care/` (see `config/urls.py`).

**Identifiers**

- **`case_id` in API URLs** = **`CareCase.pk`** (SPA dossier: `/care/cases/<case_id>/`).
- **Intake PK** may differ from `case_id`; APIs that take `case_id` resolve intake via `CaseIntakeProcess.contract` → `CareCase`.

**Pre-flight (mandatory for provider visibility)**

1. Aanbieder is a `Client` (aanbiederorganisatie) in the same org as the casus.
2. The provider user account is linked with **`Client.responsible_coordinator`** = that user (staffing rule enforced in API).
3. Provider user has **`UserProfile.role`** = **Cliënt** (`CLIENT`) and org membership (non-owner/admin) so `workflowRole` resolves to **zorgaanbieder**.

---

## Checklist

| # | Step | Actor | Click path (UI) | Expected state / UI signal | Expected API result | Expected audit event |
|---|------|--------|-------------------|----------------------------|---------------------|----------------------|
| 1 | **Create casus** | Gemeente / admin | Dashboard or **Nieuwe casus** → form submit (SPA posts to intake API) or `/care/casussen/new/` (legacy) | New dossier exists; redirect to `/care/cases/<case_id>/` (or intake id depending on client) | `POST /care/api/cases/intake-create/` → **200**, JSON `ok: true`, `case_id` set | **`CaseDecisionLog`**: `event_type=STATE_TRANSITION`, `user_action=create_case`, `action_source=intake_create_api` (plus **`AuditLog`**: CREATE on `CaseIntakeProcess` via `log_action`) |
| 2 | **Structured samenvatting** (pilot gate) | Gemeente | Open casus dossier → **Beoordeling / samenvatting** (SPA); complete structured summary (context length, risks, urgency, etc.) | Summary fields saved; gate satisfied for matching | `GET/POST /care/api/cases/<case_id>/assessment-decision/` — POST with `workflowSummary` and decision path per UX | On **submit to matching** (`decision=matching` after summary complete): **`STATE_TRANSITION`**, `user_action=start_matching`, `action_source=assessment_decision_api`, `new_state` → **`MATCHING_READY`** (from prior state, e.g. `DRAFT_CASE` / `SUMMARY_READY`) |
| 3 | **Matching** (advisory) | Gemeente | Casus → **Matching** view; review candidates | Matching UI shows ranked options; no automatic assignment | `GET /care/api/cases/<case_id>/matching-candidates/` → **200**, candidate list (after summary gate) | No mandatory **CaseDecisionLog** row *by itself* for “view candidates”; optional product-specific logs only |
| 4 | **Gemeente validatie + send to provider** | Gemeente | Matching → **validate** (and send). *Pilot shortcut:* single **assign** action after matching ready | Workflow moves to **provider review**; case phase **provider beoordeling** | **`POST /care/api/cases/<case_id>/matching/action/`** with JSON e.g. `{"action":"assign","provider_id":"<aanbieder_client_id>"}` → **200**, `ok: true`, `providerId` / `placementId` / `caseId` | **Two `STATE_TRANSITION` rows** from `matching_action_api`: (a) `user_action=validate_matching`, (b) `user_action=send_to_provider` with `placement` FK populated. *Alternative split flow:* `confirm_validation` then `send_to_provider` → adds **`GEMEENTE_VALIDATION`** event (`user_action=gemeente_validate_matching`, `action_source=matching_action_api_confirm_validation`) plus transitions |
| 5 | **Provider sees only linked case** | Aanbieder | **Casussen** / worklist (SPA) | Only casussen with **`PlacementRequest`** pointing to **this** provider `Client` appear | `GET /care/api/cases/` → list **only** linked cases. `GET /care/api/cases/<other_case_id>/` for same org but **not** linked → **404** JSON | No new event on **read**; optional **`AuditLog` VIEW** if your deployment logs API reads (not assumed here) |
| 6 | **Provider accept (or reject)** | Aanbieder | Casus dossier → provider decision (SPA calls API) | Placement shows pending response; after accept → workflow **`PROVIDER_ACCEPTED`** | `POST /care/api/cases/<case_id>/provider-decision/` body e.g. `{"status":"ACCEPTED",...}` → **200**, `ok: true` | **`STATE_TRANSITION`**, `user_action=provider_accept`, `action_source=provider_decision_api` |
| 7 | **Gemeente confirms placement** | Gemeente | **Plaatsing** / dossier → confirm placement | Placement **APPROVED**; workflow moves toward **placement confirmed** | `POST /care/api/cases/<case_id>/placement-action/` with `{"status":"APPROVED",...}` → **200**, `ok: true` | **`STATE_TRANSITION`**, `user_action=confirm_placement`, `action_source=placement_action_api` |
| 8 | **Provider starts intake** | Aanbieder | Dossier → start intake (when enabled) | Intake started; case phase **actief** where applicable | `POST /care/api/cases/<case_id>/intake-action/` → **200**, `ok: true` | **`STATE_TRANSITION`**, `user_action=start_intake`, `action_source=intake_action_api` |
| 9 | **Audit trail proof** | Auditor / gemeente | **`/care/audit-log/`** (list) or SPA audit page if enabled | Entries show actor + target + time | `GET /care/api/audit-log/` → **200**, JSON entries (org-scoped) | **Case-level proof** in DB: query **`contracts_casedecisionlog`** (model **`CaseDecisionLog`**) for `case_id` / `case_id_snapshot` = intake PK — expect rows for steps 1–2 and 4–8 with **`event_type`** mostly **`STATE_TRANSITION`**, plus **`GEMEENTE_VALIDATION`** if you used **`confirm_validation`**. **`AuditLog`** may additionally show CREATE/UPDATE/VIEW depending on middleware |

---

## Quick API reference (same flow)

| Step | Method | Path |
|------|--------|------|
| Create | POST | `/care/api/cases/intake-create/` |
| Summary / assessment | GET/POST | `/care/api/cases/<case_id>/assessment-decision/` |
| Matching candidates | GET | `/care/api/cases/<case_id>/matching-candidates/` |
| Matching / validatie / verzenden | POST | `/care/api/cases/<case_id>/matching/action/` |
| Case list (provider scope) | GET | `/care/api/cases/` |
| Case detail | GET | `/care/api/cases/<case_id>/` |
| Provider decision | POST | `/care/api/cases/<case_id>/provider-decision/` |
| Placement confirm | POST | `/care/api/cases/<case_id>/placement-action/` |
| Start intake | POST | `/care/api/cases/<case_id>/intake-action/` |
| Audit (API) | GET | `/care/api/audit-log/` |

---

## SQL sanity check (optional)

```sql
-- Replace :intake_id with CaseIntakeProcess.pk for the casus
SELECT event_type, user_action, action_source, created_at,
       recommendation_context->>'old_state' AS old_state,
       recommendation_context->>'new_state' AS new_state
FROM contracts_casedecisionlog
WHERE case_id = :intake_id OR case_id_snapshot = :intake_id
ORDER BY created_at;
```

---

## Failure modes to record during dry-run

| Symptom | Likely cause |
|--------|----------------|
| Provider sees **no** cases after send | Provider `Client` missing **`responsible_coordinator`** = provider user, or wrong org |
| Provider gets **404** on dossier | No **`PlacementRequest`** linking that case to provider’s `Client` |
| Matching action **400** on `assign` | Summary incomplete, wrong workflow order, or validation error text in JSON `error` |
| No **`CaseDecisionLog` rows** | **`AuditLoggingError`** / exception during transition (API may return **503** on strict paths) |

---

*Last aligned with backend: `contracts/api/views.py`, `contracts/workflow_state_machine.py` (`WorkflowAction` / `log_transition_event`), `contracts/models.py` (`CaseDecisionLog.EventType`).*
