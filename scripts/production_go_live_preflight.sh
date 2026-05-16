#!/usr/bin/env bash
# Production go-live preflight (P2): local evidence before promoting a release.
# Does not deploy — run on the release candidate checkout with production-like env.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-./.venv/bin/python}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings}"
export DATABASE_URL="${DATABASE_URL:-sqlite:///$(pwd)/db_preflight.sqlite3}"

echo "[production_go_live_preflight] Django system check …"
"$PYTHON_BIN" manage.py check

echo "[production_go_live_preflight] Must-band workflow tests …"
"$PYTHON_BIN" manage.py test \
  tests.test_cross_tenant_isolation \
  tests.test_workflow_foundation_lock \
  tests.test_decision_engine \
  tests.test_audit_export_api \
  tests.test_actor_profile_policy \
  tests.test_release_evidence_bundle \
  -v 1

echo "[production_go_live_preflight] Client production build …"
npm ci --prefix client
npm run build --prefix client

echo "[production_go_live_preflight] deploy check (Postgres required for full parity) …"
if [[ -n "${PREFLIGHT_POSTGRES_URL:-}" ]]; then
  DATABASE_URL="$PREFLIGHT_POSTGRES_URL" DJANGO_SETTINGS_MODULE=config.settings_production \
    DJANGO_SECRET_KEY="${DJANGO_SECRET_KEY:-preflight-secret-not-for-prod}" \
    ALLOWED_HOSTS="${ALLOWED_HOSTS:-localhost}" \
    CSRF_TRUSTED_ORIGINS="${CSRF_TRUSTED_ORIGINS:-https://localhost}" \
    DEFAULT_FROM_EMAIL="${DEFAULT_FROM_EMAIL:-ops@careon.local}" \
    "$PYTHON_BIN" manage.py check --deploy
else
  echo "[production_go_live_preflight] skip check --deploy (set PREFLIGHT_POSTGRES_URL for Postgres deploy check)"
fi

echo "[production_go_live_preflight] GO — see docs/PRODUCTION_RUNBOOK.md and docs/RELEASE_ROLLOUT_CHECKLIST.md"
