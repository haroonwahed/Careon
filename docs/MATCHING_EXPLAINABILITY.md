# Matching: explainability and rejection learning

## Product rules (non-negotiable)

- Matching is **advisory** — no silent auto-assignment (`AGENTS.md`, Constitution v2 §4.4).
- Recommendations must surface **fit**, **confidence / uncertainty**, and **trade-offs** where the backend supplies them (`contracts/provider_matching_service.py`: `confidence_label`, `trade_offs`, factor-style penalties).

## Backend sources of truth

| Area | Code |
|------|------|
| Scoring + trade-offs | `contracts/provider_matching_service.py` |
| Decision / risk signals (incl. repeated rejections) | `contracts/decision_engine.py` — `provider_rejection_count`, `latest_rejection_reason`, thresholds such as `repeated_rejection_count` |
| Provider decision API | `contracts/api/views.py` — structured `rejection_reason_code` / notes persisted on placement |

## Frontend status

- **`MatchingPageWithMap`** currently builds ranked rows with **demo** explanations (score tiers, trade-offs, `confidenceLabel`) while real API wiring lands — tooltip already states factors and advisory stance.
- **`MatchExplanation`** component exists for structured score + strengths + trade-offs when fed real props.

## Roadmap (rejection learning)

1. **Persist** normalized rejection reason codes at provider decision time (already partially modeled — extend analytics export if needed).
2. **Feed** last N rejections per case/provider into matching read model as **soft signals** (never hard exclusions without human policy).
3. **Expose** in API payload: `confidence_label`, `trade_offs[]`, optional `verification_checks[]` for gemeente reviewers.
4. **UI:** bind list rows to API payload; keep “verify capacity + region + arrangement” copy adjacent to low-confidence rows.

## Scope boundary (automated “learning”)

**Out of scope until explicit product + DPIA sign-off:** auto-tuning rank weights from rejections, opaque ML reranking, or persisted “learned scores” that change financing or placement outcomes without human-visible reason codes. The roadmap above keeps signals **inspectable** and **advisory**.

## Tests / guardrails

- Contract tests on matching JSON shape when API stabilizes.
- Keep `tests/test_matching_operational_contract_regression.py` (and related) green when changing ranking.
