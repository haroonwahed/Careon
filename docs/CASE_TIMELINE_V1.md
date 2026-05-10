# Case timeline v1

## Purpose

**Case timeline** is an **append-only operational log** of workflow milestones for a `CareCase`. It gives operators and the product a **stable, ordered sequence of what happened** (who, when, which phase transition) as the first step toward **replayable operational history** and **workflow causality**—without replacing the existing workflow engine or case state.

## What it is not

- **Not** full event sourcing. We do not rebuild all state from events.
- **Not** a second source of truth for workflow. `CaseIntakeProcess.workflow_state` and existing guards remain authoritative.
- **Not** a notification or analytics module. Rows are **operational history**, not user notifications.
- **Not** a place for **PHI** (free-text client/patient data). Do not copy narrative or identifiers beyond what is already considered safe operational references (e.g. placement id, status codes).

## Append-only rule

`CaseTimelineEvent` rows are **immutable** after insert:

- Application code must only **create** rows.
- Updates and deletes are **forbidden** via the model’s `save` / manager (see `GovernanceLogImmutableError`).

This matches the “golden copy” idea for audit-oriented tables: the timeline is a **log**, not mutable case data.

## Selected boundary (v1)

The first implementation records events when the workflow moves from **gemeente validatie** into **aanbieder beoordeling** (i.e. into `PROVIDER_REVIEW_PENDING`), on the same code paths that already perform `SEND_TO_PROVIDER` (HTML `case_matching_action` and JSON `matching_action_api` `assign` / `send_to_provider`).

## Event types (canonical set for v1)

| `event_type` | Meaning (operational) |
|--------------|------------------------|
| `GEMEENTE_VALIDATION_APPROVED` | Gemeente completed matching validation (`MATCHING_READY` → `GEMEENTE_VALIDATED`) in the same request, when applicable. |
| `PLACEMENT_REQUEST_CREATED` | Placement request is in play for provider review (ids/status in `metadata` only). |
| `PROVIDER_REVIEW_OPENED` | Aanbieder beoordeling is open (`GEMEENTE_VALIDATED` → `PROVIDER_REVIEW_PENDING`). |
| `WORKFLOW_BLOCKED` | Reserved for future use (not emitted in v1 success path). |
| `WORKFLOW_ESCALATED` | Reserved for future use (not emitted in v1 success path). |

## Safe metadata rule

`metadata` must contain **only** operational, low-sensitivity fields, for example:

- numeric **ids** (`placement_id`, `provider_id`)
- **status** enums (`placement_status`)
- short structural markers (e.g. `step` with a fixed vocabulary)

Do **not** store intake titles, child names, free-text complaints, or stack traces.

## API

- `GET /care/api/cases/<case_id>/timeline/` — same access rules as case detail (tenant scope + provider visibility). Returns ordered events (`occurred_at`, then `id`).

## Pilot rehearsal

After **gemeente-demo** seed (`reset_pilot_environment` / `prepare_pilot_e2e`):

- `python manage.py rehearsal_timeline_evidence --json-out reports/rehearsal_timeline_evidence.json` — assigns **Demo Casus B** to **Kompas Zorg**, then asserts timeline rows + authorization (quiet stdout; details in JSON).

**Full pilot rehearsal** (`./scripts/run_full_pilot_rehearsal.sh`) runs this step and merges evidence into `reports/rehearsal_report.json` under `timeline_boundary_evidence`.

Human-readable verification output (not JSON): `reports/rehearsal_verify.log` (`rehearsal_verify`), `reports/rehearsal_timeline_step.log` (`rehearsal_timeline_evidence` summary lines). JSON artifacts remain machine-parseable only.

**Golden-path script** (`./scripts/run_golden_path_e2e.sh`) runs the same command before Playwright so the golden path is timeline-checked against the rehearsal DB (timeline summary appended to `reports/rehearsal_timeline_step.log`).

### Release readiness (pilot GO)

Merged timeline evidence and automated GO/NO-GO for the **gemeente validatie → aanbieder beoordeling** boundary:

```bash
python manage.py release_evidence_bundle
```

Writes `reports/release_evidence_bundle.json`. **NO-GO** when evidence ontbreekt, `event_types_ordered` afwijkt van `GEMEENTE_VALIDATION_APPROVED` → `PLACEMENT_REQUEST_CREATED` → `PROVIDER_REVIEW_OPENED`, `request_ids_present` false is, timeline-HTTP-checks (gemeente / gekoppelde aanbieder / andere aanbieder) falen, of metadata-/authorization-checks falen. Integrated as **Gate 8** in `./scripts/production_readiness_gates.sh` (skip alleen via `SKIP_TIMELINE_RELEASE_GATE=1`).

## Future path

- **Replay**: enrich events with stable correlation across services (`request_id`, release/build lineage).
- **Audit chains**: hash-linked batches or export pipelines feeding long-term storage (out of scope for v1).
- **Causality graphs**: derive edges from transitions + decision logs; timeline rows become nodes/edges materialization for UX.
