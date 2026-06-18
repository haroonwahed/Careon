# CareOn — repository, architecture & product-quality audit (2026-Q2)

**Status:** Audit / planning — **read-only**. No production code changed.
**Date:** 2026-06-17
**Author:** Engineering review (agent-assisted, read-only investigation)
**Companion:** [`docs/adr/ADR-CONTRACTS-VIEWS-DECOMPOSITION.md`](adr/ADR-CONTRACTS-VIEWS-DECOMPOSITION.md) (the `views.py` decomposition; this audit supersedes its phasing with a sharpened plan in §7)

> Scope note: this document fulfils a request to *pause* the actual `contracts/views.py` refactor and first deliver a broader audit, a target architecture, a standardization roadmap, a sharpened execution plan, and a reproducible test-infrastructure plan. It does **not** propose or perform a `models.py` change.

---

## 1. Executive summary

CareOn is a **mature, disciplined codebase** carrying a few large, high-leverage structural debts. The engineering hygiene is well above typical for a solo-founder product: 93 pytest modules, 13 Playwright specs, 6 CI workflows with tenant-integrity and terminology guards, pre-commit hooks, pyright, and a real service layer (`provider_matching_service`, `workflow_state_machine`, `decision_engine`, `governance`). Debt is tracked in docs, not scattered as `TODO`s (zero in app code).

The dominant structural problems are concentrated, not diffuse:

| Rank | Problem | Size / signal | Why it ranks here |
|------|---------|---------------|-------------------|
| **1** | **Inverted dependency: API depends on view helpers** | `contracts/api/matching.py` imports `_assign_provider_to_intake`, `_prepare_waitlist_proposal_for_intake` **from `contracts.views`** | Architectural correctness + latent import cycle. Cheapest to fix, highest unlock — it must be fixed *as part of*, and partly *before*, the views split. |
| **2** | **`contracts/views.py` god-module** | 8,235 LOC, ~320 defs (53 public, 72 private), mixes HTTP + matching + geo + scoring + flow-sync + SPA shell | Slows the active redesign wave; obscures where workflow/tenant gates live. This is the headline refactor — but see §3.1 for why #1 reframes it. |
| **3** | **Duplicated / parallel matching logic** | `views.py` imports `provider_matching_service.MatchEngine` **and** carries its own `_build_matching_suggestions_for_intake`, `_build_canonical_matching_suggestions_for_intake`, scoring, haversine | Two sources of matching truth risk divergence on a regulated, explainability-bound surface (`MATCHING_EXPLAINABILITY.md`). |
| **4** | **`contracts/models.py` god-module** | 4,641 LOC | Same smell as #2 but riskier (migrations). Explicitly deferred; flagged for a later ADR. |
| **5** | **`contracts/decision_engine.py`** | 2,364 LOC | Large but cohesive; lower urgency. Watch, don't split yet. |
| **6** | **No reproducible containerized test env** | no `Dockerfile` / `compose` / `.devcontainer` | The agent cannot run a trustworthy Python/Playwright baseline locally (see §8). CI exists but is not branch-triggerable on demand by an assistant without a PR. |
| **7** | **Doc sprawl** | 95 files in `docs/`, multiple overlapping roadmaps/matrices | Navigability and "single source of truth" erosion; low severity, easy ongoing cleanup. |
| **8** | **Frontend large components** | `NieuweCasusPage.tsx` 2.3k, `i18n.ts` 2.5k, `SystemAwarenessPage.tsx` 1.75k, `CaseExecutionPage.tsx` 1.5k | Normal for complex flows; track, don't prioritize over backend seams. |

**Verdict on the original question — is `views.py` the highest architectural priority?**
Partly. The *headline* is `views.py`, but the *root* is the **dependency inversion (#1)**: domain logic sat in views, and the API layer reached up into it. The correct framing is **"extract the domain seam, then thin the views,"** not "split the file." See §3.1. With that reframing, the work is higher-value and lower-risk than a pure file split.

---

## 2. Read-only investigation findings (the six questions)

### 2.1 Is `contracts/views.py` genuinely the highest architectural priority?

**It is the highest-visibility, second-highest-priority item.** The true #1 is the inverted dependency it causes (§1, rank 1). The views file is the right *vehicle* — fixing it forces the dependency direction to be corrected — but the *goal* should be stated as decoupling domain logic from the HTTP layer, with the file size shrinking as a consequence. Evidence:

- `contracts/api/matching.py:38` imports two private helpers from `contracts.views`. The API (lower-level, reusable) depends on the view (higher-level, HTTP). This is backwards and is the seam that makes the file dangerous to touch.
- `views.py` already imports the service layer (`provider_matching_service.MatchEngine`, `workflow_state_machine`) yet still hosts a parallel matching implementation — so the architecture *intends* a service layer that the views never fully migrated onto.

### 2.2 Which functions have become public / semi-public contracts?

The de-facto public surface of `contracts.views` (imported by name elsewhere) is small and precisely known — **6 names across 7 import sites**:

| Symbol | Imported by | Kind |
|--------|-------------|------|
| `_assign_provider_to_intake` | `contracts/api/matching.py` | **private helper, but a cross-layer contract** |
| `_prepare_waitlist_proposal_for_intake` | `contracts/api/matching.py` | **private helper, cross-layer contract** |
| `_build_matching_suggestions_for_intake` | `tests/test_adaptive_matching_behavior.py`, `tests/test_matching_recommendations.py` | private helper, test contract |
| `_provider_profile_match_surface` | `tests/test_zorgaanbieders_design_inheritance.py` | private helper, test contract |
| `sync_case_flow_state` | `tests/test_intake_assessment_matching_flow.py` | public, test contract |
| `build_provider_response_monitor` | `tests/test_sla_escalation_logic.py`, `tests/test_regiekamer_provider_response_monitor.py` | public, test contract |
| `build_provider_response_overview` | `tests/test_sla_escalation_logic.py` | public, test contract |

Separately, **`config/urls.py` accesses views by attribute** via `from contracts import views as careon_views` then `careon_views.<name>` (e.g. `index`, `favicon`, `health_check`, `build_info`, `ops_system_state`, `dashboard`, `profile`, `settings_hub`, `design_mode_settings`, and the CBVs through `.as_view()`). **Every URL-referenced name is therefore a hard public attribute of the package.** A package `__init__` must re-export all of them; a bare `from x import *` is insufficient because four of the seven cross-module symbols are underscore-prefixed and `*` skips them.

### 2.3 Which characterization / contract tests are missing before splitting?

Coverage is strong overall — 49 test files use the Django test client / `reverse`, with dedicated `test_cross_tenant_isolation.py` (1,306 LOC), `test_workflow_foundation_lock.py` (1,038), `test_governance_audit.py` (891), `test_build_info.py`, and provider-response suites. Gaps relevant to a safe split:

1. **A single "URL contract" test** that asserts every named route in `config/urls.py` resolves to a callable and `reverse()` round-trips — there are many client-based tests, but no one guard that the *import surface* of the views package is complete. This is the cheapest insurance against a re-export miss.
2. **Direct unit tests for the cross-layer private helpers** (`_assign_provider_to_intake`, `_prepare_waitlist_proposal_for_intake`) — currently only exercised indirectly via API/integration paths. Before they move to a domain module they deserve a characterization test pinning their inputs/outputs.
3. **Pure-function tests for geo/scoring** (`_haversine_distance_km`, `_build_matching_explanation`, tiebreak weighting) — partially covered through matching tests; a focused unit test makes the domain extraction provably safe.
4. **Context-key snapshot for the low-risk views** (`index`/SPA shell, `dashboard`, `health_check`, `build_info`, `ops_system_state`) — `test_build_info.py` covers one; a thin "context keys unchanged" assertion for the shell/ops group would lock behaviour before the move.

### 2.4 Desired target architecture and module boundaries

A layered structure with a one-way dependency rule (see §4 for the diagram):

```
HTTP layer        contracts/views/*  (request → response only; thin)
HTTP layer        contracts/api/*    (already modular)
        │  (may import ↓ only)
Domain layer      contracts/domain/* (matching, geo, scoring, case_flow — request-free, unit-testable)
        │  (may import ↓ only)
Service layer     provider_matching_service, workflow_state_machine, decision_engine, governance
        │
Data layer        contracts/models.py (+ future split), migrations
```

**Rule:** `api/*` and `views/*` may import `domain/*`; **`domain/*` and `api/*` must never import `views/*`.** A guardrail test should enforce the no-`views`-import rule on `domain/` and `api/`.

### 2.5 Dependencies, import cycles, and workflow risks affecting the refactor

- **Active latent cycle:** `api.matching → views`; `views → models/services`. If any view module ever imports `api`, the cycle closes. The split must move the two shared helpers *down* into `domain/` so both `api` and `views` import downward only.
- **Import-time side effects in `views.py`:** only `logger = logging.getLogger(__name__)` and `User = get_user_model()` — both safe, but `get_user_model()` at import means the package `__init__` must not trigger heavier work at import.
- **Workflow/tenant gates live inside view functions** (`_require_workflow_actor_role`, `TenantScopedQuerysetMixin`, `can_access_case_action`). Moving these requires re-running `test_cross_tenant_isolation` and `test_workflow_foundation_lock` after every step.
- **In-flight branches:** `worktree-agent-*` (with a broken git-worktree registration) and several `copilot/*` branches hold parallel copies — large moves will conflict; sequence the refactor to land in small PRs to minimize conflict surface.

### 2.6 How this relates to other backend / frontend / component problems

The views split is the **keystone** of a broader "one-way layering" standardization (§5). The same principle resolves the parallel-matching duplication (#3) and de-risks the eventual `models.py` split (#4). On the frontend, the equivalent debt is the few 1.5k–2.5k-line components and a 2.5k-line `i18n.ts`; these are independent and lower priority. Doc sprawl (#7) is orthogonal and handled by ongoing consolidation, not a project.

---

## 3. Architecture audit (detail)

### 3.1 Reframing: "extract the seam," not "split the file"

The instinct to split an 8k-line file by size is correct in spirit but wrong in emphasis. The high-value move is to **lift the request-free domain logic out of the HTTP layer** (matching, geo, scoring, flow-sync), which (a) removes the inverted `api → views` dependency, (b) makes the logic unit-testable without Django request plumbing, and (c) shrinks `views.py` as a side effect. The remaining view modules then split cleanly by resource because they are finally thin.

### 3.2 What is already good (preserve it)

- A real **service layer** exists and is partly used by views — the target is to finish the migration onto it, not invent new structure.
- `contracts/api/` is **already decomposed** into `cases`, `intake`, `matching`, `placement`, `evaluation`, `audit`, `auth`, `providers`, `members`, etc. — the proven template for `views/`.
- **CI guardrails** (`platform-guardrails.yml`) already run pytest on 3.12, `compileall`, terminology guard, and a tenant-integrity audit on every PR/push — the reproducible verification backbone already exists (§8).

### 3.3 Standardization gaps

- No enforced **layer-direction rule** (domain/api must not import views).
- No enforced **module-size ceiling** (would have flagged `views.py`/`models.py` years earlier).
- Two matching implementations with no documented "canonical" pointer.
- No containerized dev/test env, so contributor/agent test runs are environment-dependent (§8).

---

## 4. Target architecture & module boundaries

```
contracts/
  views/                     # HTTP only; thin; each module one resource/concern
    __init__.py              # explicit re-exports → import & attribute surface unchanged
    base.py                  # Tenant mixins
    shell.py  ops.py         # SPA shell, health/build-info/ops  (lowest risk)
    clients.py documents.py deadlines.py signals.py tasks.py budgets.py configuration.py
    organization.py reports.py auth.py
    intake.py assessment.py placement.py
    matching_views.py provider_response.py case_actions.py   # workflow-critical (last)
  api/                       # already modular; imports domain/, never views/
  domain/                    # request-free, unit-testable (add __init__.py)
    geo.py                   # haversine, coordinate coercion, case-location
    matching.py              # suggestion building, scoring, explanation, tiebreak,
                             #   _assign_provider_to_intake, _prepare_waitlist_proposal_for_intake
    provider_profile.py      # profile predicates / match-surface
    case_flow.py             # ensure/sync flow state, auto-task/-deadline sync
  (services unchanged)       # provider_matching_service, workflow_state_machine, decision_engine, governance
  models.py                  # untouched in this track
```

**Dependency rule (enforced by a guardrail test):** `domain/*` imports only services/models; `api/*` and `views/*` import `domain/*`; nothing imports `views/*` except `config/urls.py` and Django.

---

## 5. Standardization roadmap (prioritized)

Ordered by value-per-risk. Each item is independently shippable and stays inside the Infrastructure Maturity Phase (no net-new features).

1. **R1 — Reproducible test env (enabler, do first).** Add a `.devcontainer` + `docker compose` test profile and a manually-triggerable CI workflow on branches (§8). Unblocks trustworthy before/after verification for every later item. *Low risk, high leverage.*
2. **R2 — Guardrail tests as the safety net.** Add (a) a URL-contract test (every named route resolves + `reverse` round-trips), (b) a layer-direction test (`domain`/`api` must not import `views`), (c) a module-size ceiling test (warn/fail above an agreed line count for new modules). *These are tests, not refactors — safe to land immediately.*
3. **R3 — Extract the domain seam from `views.py`** into `contracts/domain/{geo,matching,provider_profile,case_flow}.py`, and **repoint `contracts/api/matching.py`** to import from `domain/` instead of `views`. Fixes the inverted dependency (#1). *Medium risk; gated by R1+R2.*
4. **R4 — Thin the views into a package** (`contracts/views/`), low-risk modules first (shell/ops/simple CRUD), workflow-critical last. *Medium risk; the original ADR work, now safer because R3 removed the domain logic.*
5. **R5 — Consolidate matching to one canonical path** (`provider_matching_service` vs the extracted `domain/matching.py`); document the canonical entry point; delete the loser behind tests. *Medium risk; after R3/R4.*
6. **R6 — `models.py` decomposition ADR** (separate track, migration-aware). *Higher risk; later.*
7. **R7 — Ongoing: doc consolidation + frontend large-component triage.** *Low risk, continuous.*

---

## 6. Risks & dependencies (carry-over from recon)

- `config/urls.py` uses `from contracts import views as careon_views` (attribute access) → package `__init__` must expose **all** referenced names.
- Cross-layer private helpers (`_assign_provider_to_intake`, `_prepare_waitlist_proposal_for_intake`) are imported by `api/matching.py` → must remain importable (ideally relocated to `domain/` and re-exported during transition).
- A bare `from .legacy import *` is **unsafe** (skips the four underscore-prefixed contract symbols) → use **explicit re-exports**.
- Avoid import cycles and import-time side effects (only `logger`/`get_user_model()` today).
- The sandbox cannot run a reliable Python/Playwright baseline → verification must run in CI or a container (§8).
- Refactoring without a real test baseline is not yet responsible → R1 precedes R3/R4.

---

## 7. Sharpened execution plan for `contracts/views.py`

This **supersedes the phasing** in `ADR-CONTRACTS-VIEWS-DECOMPOSITION.md` by inserting the enabler and the domain-seam fix first. Every phase: small PR, CI green, no behaviour change, before/after compared in CI.

- **Phase 0 — Enabler (R1).** Containerized test env + branch-triggerable CI. *Deliverable: green run on a throwaway branch with no code change.*
- **Phase 1 — Safety net (R2).** URL-contract test, layer-direction test, size-ceiling test. *No source moved yet.*
- **Phase 2 — Package shell.** Convert `views.py` → `views/__init__.py` verbatim (zero logic change); confirm URLs/imports/SPA shell resolve in CI.
- **Phase 3 — Domain seam (R3).** Move `geo`, `matching` (incl. the two cross-layer helpers), `provider_profile`, `case_flow` into `contracts/domain/`; repoint `api/matching.py`; keep transitional re-exports from `views`. Re-run tenant + workflow + matching suites.
- **Phase 4 — Low-risk views.** Carve out `ops.py`, `shell.py`, `base.py`, then simple CRUD modules. Explicit re-exports in `__init__`.
- **Phase 5 — Workflow-critical views.** One module per PR: `reports → organization → assessment → intake → placement → provider_response → matching_views → case_actions`. Re-verify gates after each.
- **Phase 6 — Close-out.** `__init__` becomes re-exports only; drop transitional shims; update `AGENTS.md` and this audit; open the `models.py` ADR stub (R6).

**Definition of done per PR:** pytest + Playwright + Platform Guardrails green; URLs/view-names/context-keys unchanged; diff dominated by moves; `test_cross_tenant_isolation` + workflow-gate tests unchanged and passing.

---

## 8. Reproducible test infrastructure (so the agent can verify, not guess)

**Problem observed.** The assistant sandbox is Linux + Python 3.10 with **PyPI blocked**; the repo's only installed packages are macOS-built venvs for Python 3.12/3.15. Django (pure Python) imports, but **Pillow** and **psycopg2** are macOS binaries, and **pytest** needs 3.10 backports (`exceptiongroup`) that are absent. Playwright needs a built SPA + browsers + a running server. **Net: no trustworthy local baseline is possible in-sandbox.** Forcing it with stubs would make "green" meaningless — which is exactly why the refactor was paused.

**Recommendation — two complementary mechanisms:**

### 8.1 Containerized dev/test environment (for humans + agents with Docker)

A `.devcontainer` / `docker compose` profile pinning Python 3.12 and the real dependency set, so any environment produces identical results:

```dockerfile
# proposal only — docs/, not yet committed to repo root
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libpq-dev libjpeg-dev zlib1g-dev curl git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements/ requirements/
RUN pip install --upgrade pip && pip install -r requirements/dev.txt
ENV DJANGO_SETTINGS_MODULE=config.settings_test \
    DJANGO_SECRET_KEY=test-not-for-production
# default: full Python suite
CMD ["python", "-m", "pytest", "tests/", "-q"]
```

```yaml
# proposal only — docker-compose.test.yml
services:
  test:
    build: .
    volumes: ["./:/app"]
    # SQLite by default; add a postgres service to mirror deploy-production-check
  e2e:
    build: ./client
    depends_on: [test]
    # vite build + playwright install + playwright test
```

This makes the agent's earlier blocker disappear *in any environment that has Docker + network* — it does not help inside this specific locked sandbox, but it makes verification reproducible everywhere else (your Mac, a CI runner, a future agent host with egress).

### 8.2 Branch-triggerable CI as the authoritative gate (recommended primary)

CI is already the source of truth (`platform-guardrails.yml` runs pytest on 3.12 + a Postgres `deploy-production-check`). Two cheap additions make it agent-drivable:

1. Add **`workflow_dispatch`** (and keep `pull_request`) to `platform-guardrails.yml` so a run can be triggered on any branch on demand — an assistant with the GitHub connector can push a branch, dispatch the workflow, and read the result, closing the verification loop without a human.
2. Add a **Playwright job** (build SPA → `playwright install --with-deps` → `npm run test:e2e`) so the e2e smoke that cannot run in-sandbox runs in CI on the branch.

**Workflow for future refactor PRs:** push small branch → CI (pytest + guards + Playwright) runs → agent reads pass/fail via the GitHub connector → proceed only on green. This is the reproducible, trustworthy substitute for in-sandbox test runs, and it is the precondition (R1/Phase 0) for resuming the `views.py` work.

---

## 9. Recommended immediate next step

Do **R1 + R2 only** (Phase 0 + Phase 1): land the reproducible test env and the three guardrail tests. They are pure additions (no production code moved, no behaviour change), they are independently valuable, and they convert "we can't verify" into "CI verifies every step" — after which the `views.py` decomposition (Phase 2+) can resume safely.
