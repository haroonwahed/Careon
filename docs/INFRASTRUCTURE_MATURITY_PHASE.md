# Infrastructure maturity phase (temporary feature freeze)

**Status:** Active until explicitly lifted by project owners.

This project is in an **infrastructure maturity** window. The goal is a **stable, observable, auditable** orchestration system—not a wider feature surface.

Unstable systems fail pilots and erode trust. **Beautiful unstable systems** are the common failure mode; this phase exists to avoid that.

---

## Out of scope (do not start)

Unless owners explicitly exempt in writing:

- Net-new **AI** capabilities (summaries, matching logic expansions, copilots, “smart” modules).
- **Redesigns** or visual overhauls unrelated to fixing broken UX or constitution alignment.
- New **analytics** products, BI modules, or reporting suites beyond what existing workflow/regiekamer needs.
- **New modules** or major greenfield surfaces (extra dashboards, parallel apps, “four new tabs”).
- Speculative **integrations** without a signed operational need.

“Maybe later” belongs in a backlog **outside** this repo’s execution path until the freeze lifts.

---

## In scope (priority order)

1. **Reliability** — fewer 500s, predictable seeds, correct workflow gates, regression tests.
2. **Observability** — correlation IDs, structured logs, traceable API failures, deploy/build truth.
3. **Deterministic pilot/rehearsal** — locked demo universe, repeatable E2E, stable timestamps where intended.
4. **Security & tenancy** — session/org correctness, permission boundaries, audit trails.
5. **Minimal fixes** — bugs, copy that blocks operators, accessibility issues tied to real users.

Canonical workflow (`AGENTS.md`) is **unchanged** and remains non-negotiable; this phase tightens **what we add**, not **how decisions flow**.

---

## How to lift the freeze

Owners update this document and record the decision in `DECISIONS.md`. Agents and contributors treat this file as the source of truth until then.
