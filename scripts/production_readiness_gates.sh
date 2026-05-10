#!/usr/bin/env bash
# Production readiness gates — exit non-zero blocks deploy (CI / release script).
# Gate order: migrations → workflow law → seed manifest → tenant isolation → escalation → observability → demo seed contract → timeline release evidence.
#
# Usage (repo root):
#   ./scripts/production_readiness_gates.sh
#   DJANGO_SETTINGS_MODULE=config.settings ./scripts/production_readiness_gates.sh
#
# Optional: after gates, run ./scripts/run_full_pilot_rehearsal.sh for live rehearsal confidence.

set -eu
set -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings}"

PYTHON_BIN="${PYTHON_BIN:-./.venv/bin/python}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

die() {
  echo "[production_readiness_gates] FAILED: $*" >&2
  exit 1
}

echo "[production_readiness_gates] Django settings: $DJANGO_SETTINGS_MODULE"

echo "=== Gate 1: migrate --check (no unapplied migrations) ==="
"$PYTHON_BIN" manage.py migrate --check || die "pending migrations — run migrate"

echo "=== Gate 2: workflow integrity + ops build-info JSON contract ==="
"$PYTHON_BIN" manage.py test tests.test_workflow_integrity tests.test_build_info || die "workflow / build-info tests"

echo "=== Gate 3: seed manifest / seed_version present ==="
"$PYTHON_BIN" manage.py shell -c "
from contracts.pilot_universe import PILOT_MANIFEST_VERSION
from contracts.build_info import gather_build_info
assert PILOT_MANIFEST_VERSION and len(str(PILOT_MANIFEST_VERSION).strip()) >= 3
info = gather_build_info()
sv = info.get('seed_version') or ''
assert sv, 'gather_build_info missing seed_version'
print('PILOT_MANIFEST_VERSION=', PILOT_MANIFEST_VERSION)
print('gather_build_info.seed_version=', sv)
" || die "seed manifest gate"

echo "=== Gate 4: tenant visibility (case isolation + unauthenticated API) ==="
"$PYTHON_BIN" manage.py test \
  tests.test_cross_tenant_isolation.CareCaseIsolationTest \
  tests.test_cross_tenant_isolation.UnauthenticatedAccessTest \
  || die "tenant visibility tests"

echo "=== Gate 5: escalation contract (operational decision / escalation flags) ==="
"$PYTHON_BIN" manage.py test tests.test_operational_decision_contract.EscalationTests || die "escalation tests"

echo "=== Gate 6: observability middleware (API failure + correlation path) ==="
"$PYTHON_BIN" manage.py shell -c "
from django.conf import settings
assert 'contracts.middleware.OperationalObservabilityMiddleware' in settings.MIDDLEWARE
print('OperationalObservabilityMiddleware: OK')
" || die "observability middleware missing"

echo "=== Gate 7: seed integrity (seed_demo_data contract) ==="
"$PYTHON_BIN" manage.py test tests.test_seed_demo_data || die "seed_demo_data contract tests"

echo "=== Gate 8: Case Timeline v1 — Gemeente validatie → Aanbieder beoordeling (release evidence GO/NO-GO) ==="
if [[ "${SKIP_TIMELINE_RELEASE_GATE:-0}" == "1" ]]; then
  echo "[production_readiness_gates] Gate 8 skipped (SKIP_TIMELINE_RELEASE_GATE=1)"
elif [[ ! -f "${ROOT_DIR}/reports/rehearsal_timeline_evidence.json" ]] && [[ ! -f "${ROOT_DIR}/reports/rehearsal_report.json" ]]; then
  die "NO-GO: missing reports/rehearsal_timeline_evidence.json and reports/rehearsal_report.json — run manage.py rehearsal_timeline_evidence or ./scripts/run_full_pilot_rehearsal.sh"
else
  "$PYTHON_BIN" manage.py release_evidence_bundle || die "timeline release evidence gate NO-GO (see reports/release_evidence_bundle.json)"
fi

echo "[production_readiness_gates] All gates passed."
