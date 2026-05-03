# Regiekamer NBA telemetry — architectural charter

## 1. TL;DR

- **Regiekamer Next Best Action (NBA) telemetry has no production backend sink.** That absence is intentional.
- **`AuditLog` and `CaseDecisionLog` MUST NOT store NBA telemetry.** Existing audit read APIs MUST NOT be repurposed or extended to ingest telemetry.
- **Production-grade telemetry** requires explicit product, legal, and security approval; a **new pipeline** (dedicated ingestion with retention, legal basis, and controls). Until then, the system remains **frontend-only** for these signals.

**Audit ≠ Telemetry ≠ Governance.** Not all events belong in the system of record.

---

## 2. Current implementation

### Location

- **Modules:** `client/src/lib/regiekamerNbaInstrumentation.ts` (emit + dedupe), `client/src/lib/telemetryAdapter.ts` (central sink), `client/src/lib/telemetrySchema.ts` (v1 envelope type).
- **Call sites:** Regiekamer / system-awareness UI (e.g. `SystemAwarenessPage.tsx`) invokes `emitRegiekamerNbaEvent` and related helpers.

### Payload structure

Emitted telemetry is **`RegiekamerNbaTelemetryEvent`** (`schema_version: "v1"`). **Raw NBA title strings are not included** (privacy minimisation).

| Field | Description |
|--------|-------------|
| `event` | Instrumentation event name (e.g. `nba_shown`, `nba_primary_clicked`). |
| `route` | Regiekamer NBA route (`REGIEKAMER_NBA_ROUTE`, `"/regiekamer"`). |
| `uiMode` | Presentation mode (`RegiekamerNbaUiMode`). |
| `actionKey` | Optional in type; always set for current Regiekamer emissions (`RegiekamerNbaActionKey`). |
| `reasonCount` | Count of structured reasons at emission time. |
| `timestamp` | Unix epoch milliseconds (`number`). |
| `schema_version` | Literal `"v1"`. |

Internal builder input **`RegiekamerNbaInstrumentationPayload`** carries `actionKey`, `uiMode`, `reasonCount`, `route`, and optional `now` (tests only). It does **not** carry title or case identifiers.

`emitRegiekamerNbaEvent` maps to `trackNbaEvent` in `telemetryAdapter.ts`.

### Emission behavior (`trackNbaEvent`)

Execution order:

1. **If** `typeof window.__REGIEKAMER_NBA_TRACK__ === "function"`: invoke `__REGIEKAMER_NBA_TRACK__(telemetryEvent)` **once per emission** and **return**. No `console` output on this path.
2. **Else if** `import.meta.env.DEV` is true: `console.debug("[NBA_EVENT]", telemetryEvent)`.
3. **Else** (production build, no hook): **no-op** — nothing is logged and nothing is sent.

**External hook contract:** staging or analytics must assign a **single-argument** callback:

```ts
window.__REGIEKAMER_NBA_TRACK__ = (event) => { ... };
```

`event` is a `RegiekamerNbaTelemetryEvent` (see `client/src/lib/telemetrySchema.ts`). The **previous two-argument** shape `(eventName, payload)` is **no longer supported**.

`nba_shown` may be suppressed by `shouldEmitRegiekamerNbaShown` (short-window deduplication for identical snapshots; see module docstring).

### Backend

- **No POST (or other write) endpoint** exists for Regiekamer NBA telemetry.
- **`audit_log_api`** is **GET-only** (`@require_http_methods(["GET"])` in `contracts/api/views.py`). It reads `AuditLog` rows for display; it does not accept telemetry writes.

---

## 3. Event types

Canonical names are the union **`RegiekamerNbaInstrumentationEventName`** in `regiekamerNbaInstrumentation.ts`. Any rename or new event **must** change that type and this document together.

| Event | Purpose | UI / behavior represented |
|--------|---------|---------------------------|
| `nba_shown` | Exposure | The NBA strip was shown for a computed snapshot (after dedupe rules). |
| `nba_primary_clicked` | Primary intent | User activated the **primary** CTA on the NBA strip. |
| `nba_secondary_clicked` | Secondary intent | User activated the **secondary** CTA. |
| `nba_cases_link_clicked` | Navigation | User followed the link toward casussen / case work from NBA context. |
| `nba_insight_opened` | Disclosure | User expanded an insight panel (telemetry v1 does not encode which panel — minimisation). |

---

## 4. Event classification (critical)

Zorg OS distinguishes three classes of recorded signals. **Confusing them corrupts architecture and compliance posture.**

| Type | Purpose | System role | Example |
|------|---------|-------------|---------|
| **Audit events** | Prove **who** changed **which persisted domain object**, when, and how (CRUD, auth, exports, middleware-backed actions). | **Operational audit trail** tied to models and `AuditLog.Action`. | `AuditLog`: user updated `CaseIntakeProcess`, login, approve/reject on persisted entities. |
| **Governance events** | Prove **decision-relevant** workflow and recommendation evidence on **cases** (append-only, immutable rows). | **Governance / decision evidence** for allocation flow. | `CaseDecisionLog`: `STATE_TRANSITION`, `MATCH_RECOMMENDED`, provider selection, SLA escalation — with case snapshots. |
| **Product telemetry events** | Measure **how operators use UI guidance** (clicks, impressions, navigation from NBA). **Not** persistence of workflow truth. | **Behavioral / product signal** for friction and guidance quality. | Regiekamer NBA: `nba_primary_clicked`, `nba_shown`, etc. |

**Rule:** Telemetry answers “did the operator engage with guidance?” Audit answers “what changed in the database?” Governance answers “what decision evidence exists on this case?”

---

## 5. Hard architectural rules (non-negotiable)

| # | Rule |
|---|------|
| R1 | **NBA telemetry MUST NOT** be persisted to **`AuditLog`**. |
| R2 | **NBA telemetry MUST NOT** be persisted to **`CaseDecisionLog`**. |
| R3 | **`audit_log_api` MUST NOT** be extended to accept telemetry POST bodies or side-channel writes; it remains a **read** surface for existing audit rows. |
| R4 | **No middleware or signal handler** may silently route NBA events into audit or governance tables. |
| R5 | **Backend workflow enforcement** stays the source of truth for state transitions; telemetry **never** substitutes for API-validated transitions. |

### Why mixing layers breaks the system

- **`AuditLog`** is an **authoritative workflow-and-change record** for domain entities (`model_name`, `object_id`, `changes`). Investigators and operators interpret it as **fact** about system-of-record mutations.
- **`CaseDecisionLog`** is **append-only governance evidence** scoped to **cases** and formal event types (`EventType`). Legal and operational reviews treat it as **decision lineage**.
- **NBA telemetry** is **UI-layer behavioral signal**: route, clicks, disclosure opens. It does **not** assert a persisted state change or a case-level governance decision.

**Consequences of mixing:**

| Failure mode | Effect |
|--------------|--------|
| Audit integrity | Audit queries blend **real mutations** with **high-volume UI noise**. Incident response and compliance reviews lose trust in the trail. |
| Legal interpretation | Governance exports imply **decisions**; dumping clicks into `CaseDecisionLog` creates **false decision records** or forces fake case linkage. |
| System-of-truth guarantees | Operators may infer workflow state from telemetry; **only the backend** may authoritatively assert transitions. |

---

## 6. Why `AuditLog` is not a telemetry sink

**`AuditLog` is model-centric:** each row targets `model_name`, `object_id`, `object_repr`, and optional `changes` JSON describing **persisted entity** effects.

**NBA telemetry is UI-centric:** events are keyed by **interaction** and **NBA snapshot metadata** (`actionKey`, `uiMode`, `reasonCount`, …). **Title text is not stored** in v1 telemetry. Signals are not domain mutation records.

Forcing NBA events into `AuditLog` implies:

- Inventing **synthetic `model_name` / `object_id`** mappings for non-persisted UI moments, or
- Overloading **`changes`** with arbitrary telemetry blobs unrelated to entity diffs.

**Forcing NBA events into `AuditLog` would require synthetic model mappings and misuse of the `changes` field for non-domain telemetry. That violates this system’s separation between system-of-record audit and product instrumentation.**

---

## 7. Why `CaseDecisionLog` is not applicable

`CaseDecisionLog` **requires case governance context**: FK / snapshots to case and optionally placement, `event_type` from a closed **governance** vocabulary, actor attribution consistent with **decision evidence**.

NBA events:

- Are **not** workflow state transitions.
- Are **not** necessarily tied to a single case (current payload carries **no** `case_id`).
- Represent **guidance interaction**, not a formal “decision” in the Zorg OS sense.

**Verdict:** `CaseDecisionLog` is the **wrong abstraction layer**. Using it for NBA telemetry would pollute immutable governance rows with non-decision signals or force fabricated case associations.

---

## 8. GDPR and privacy considerations

Telemetry without `case_id` is **not** automatically anonymous.

### Personal data

Authenticated operators generate events tied (at minimum) to **session / account / organization** when any future sink attaches identity. **User + organization + timestamp + behavioral sequence** can constitute **personal data** under GDPR.

### Re-identification risk

| Factor | Risk |
|--------|------|
| Absence of `case_id` in payload | Reduces **direct** case linkage from the payload alone; does **not** remove identification via account metadata. |
| `actionKey` (enum-like strings) | May encode **operational context** (care domain semantics). Treat as potentially sensitive in aggregation and retention. |
| Interaction patterns | **Sequences** of clicks and timings can **fingerprint** individuals or roles within small teams. |

### Obligations before any production storage

| Requirement | Status |
|-------------|--------|
| **Purpose limitation** | Define why telemetry is collected (e.g. guidance quality). |
| **Legal basis** | Document **legitimate interest** (with balancing test) or **consent** where required — not assumed. |
| **Retention** | **Define and enforce retention** before enabling storage; indefinite behavioral logs are **not** acceptable by default. |
| **Data minimisation** | Store only fields required for the stated purpose; avoid expanding payloads with free-text case content. |
| **Transparency** | Align with privacy notices / DPIA updates as applicable. |

---

## 9. Purpose of NBA telemetry

NBA telemetry exists to measure **alignment between**:

- The system’s proposed **next best action** (guidance layer), and  
- **Actual operator behavior** (follow-through, alternate paths, ignored guidance).

**Value:**

- Detect **friction** (repeated dismissals, bypass paths).
- Improve **decision guidance** and Regiekamer UX without turning the product into a passive dashboard.

This matches Zorg OS as a **decision system**: instrumentation informs whether **guidance** works; it does **not** replace backend workflow truth.

---

## 10. Future integration paths (no implementation)

No endpoint below exists in the codebase as of this charter. These are **approved directions only after** legal, security, and product sign-off.

### Option A — Internal ingestion endpoint

Example shape (illustrative):

`POST /care/api/instrumentation/events/`  

Body (conceptual):

- `event_name` — string, validated against an allowlist (mirror frontend union or server-owned superset).
- `payload` — JSON object; schema-validated; **reject** unknown dangerous keys.
- `timestamp` — server-normalized preferred to reduce clock skew abuse.
- **`user_id` / `org_id`** — derived from **authenticated session**, not trusted from client body.

**Mandatory controls:** authentication, authorization, **rate limiting**, request size bounds, **retention job** or TTL, audit of the telemetry subsystem itself (admin ops — distinct from `AuditLog` semantics).

### Option B — External analytics

- Implement transport behind **`window.__REGIEKAMER_NBA_TRACK__`** as an **adapter**.
- **Consent gating** where required.
- **Data filtering** (strip or hash sensitive fields before vendor egress).
- **Vendor abstraction** so the application does not spread provider-specific SDKs across the codebase.

---

## 11. Current decision

- **Production telemetry is disabled:** production builds emit **nothing** unless `__REGIEKAMER_NBA_TRACK__` is injected (staging experiments, local overrides).
- **That silence is intentional.** It avoids undeclared processing and undefined retention.
- **The frontend hook remains** the single extension point for **controlled** future activation.

---

## 12. Verification

Normative text in this document must stay aligned with `telemetrySchema.ts`, `telemetryAdapter.ts`, and `regiekamerNbaInstrumentation.ts`.

**Developers must treat this file as normative** alongside backend workflow rules in `AGENTS.md`.

---

## Enforcement

**Pull-request / architecture gate**

- **Any use of `AuditLog` or `CaseDecisionLog` for NBA telemetry is forbidden.**
- **Any pull request that does so must be rejected** during review.
- **This is a blocking architecture violation** — not a style preference.
- **Automated guard:** `client/src/lib/regiekamerNbaTelemetryBoundary.test.ts` fails if any file under `client/src/` contains both `nba_` and any of `AuditLog`, `CaseDecisionLog`, or `/audit-log` (documentation under `docs/` is excluded by design). The guard file itself is skipped during scanning because it embeds those matcher strings.

Violations (writing NBA telemetry to `AuditLog` / `CaseDecisionLog`, or extending audit APIs for telemetry) are **architecture defects** and must be blocked in code review. Correct remediation is a **dedicated telemetry pipeline** approved under Section 10.

Violation of these rules (R1–R5) must be treated as a blocking architecture issue. Any pull request that writes NBA telemetry to `AuditLog`, writes NBA telemetry to `CaseDecisionLog`, or extends audit endpoints for telemetry purposes must be rejected during review. These constraints are not stylistic — they protect system integrity and legal compliance.
