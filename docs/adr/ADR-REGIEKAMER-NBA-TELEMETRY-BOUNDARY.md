# ADR: Regiekamer NBA telemetry boundary

| Field | Value |
|--------|--------|
| **Status** | Accepted |
| **Date** | 2026-05-01 |

## Context

Regiekamer **Next Best Action (NBA)** telemetry records how operators interact with guidance UI (impressions, primary/secondary actions, navigation, insight disclosure). These signals are **product and UX observability** — they measure alignment between system guidance and operator behavior.

They are **not** authoritative workflow mutations, **not** case-level governance evidence, and **not** substitutes for backend-enforced state transitions.

Zorg OS already maintains:

- **`AuditLog`** — operational audit of persisted domain changes and security-relevant actions.
- **`CaseDecisionLog`** — append-only governance evidence tied to cases and formal event types.

Mixing NBA telemetry into those stores would blur **audit integrity**, **legal interpretation of governance rows**, and **system-of-truth** guarantees.

## Decision

**Keep Regiekamer NBA telemetry frontend-only** until an explicitly approved sink exists (product, legal, security). Today, emission is limited to development logging, an optional `window.__REGIEKAMER_NBA_TRACK__` hook, and a minimal v1 schema — **no production backend ingestion** is implemented or required by this ADR.

## Consequences

- **No coupling** of NBA telemetry to **`AuditLog`**, **`CaseDecisionLog`**, or **`/audit-log`** HTTP usage in the same client modules that emit `nba_*` events (see charter: `docs/REGIEKAMER_NBA_TELEMETRY.md`).
- **No** use of audit or governance tables as telemetry sinks without a new ADR and approved pipeline.
- **Review burden:** PRs that route telemetry into audit infrastructure are **blocking architecture violations**.

## Enforcement

- **Normative charter:** `docs/REGIEKAMER_NBA_TELEMETRY.md` (rules R1–R5, enforcement section).
- **Automated guard:** `client/src/lib/regiekamerNbaTelemetryBoundary.test.ts` — Vitest fails if any file under `client/src/` contains both `nba_` and any of `AuditLog`, `CaseDecisionLog`, or `/audit-log` (the guard file itself is excluded from scanning; `docs/` is out of scope for this check).

## Future options (out of scope until approved)

1. **Dedicated instrumentation endpoint** — e.g. authenticated POST with validation, rate limits, and documented retention (see charter §10).
2. **Consented analytics adapter** — implement transport behind `window.__REGIEKAMER_NBA_TRACK__` with consent gating, filtering, and vendor abstraction.

Neither option is implemented by this ADR.

## References

- `docs/REGIEKAMER_NBA_TELEMETRY.md` — full architectural charter and GDPR notes.
- `client/src/lib/telemetrySchema.ts`, `client/src/lib/telemetryAdapter.ts`, `client/src/lib/regiekamerNbaInstrumentation.ts` — current frontend implementation.
