#!/usr/bin/env bash
# Full pilot rehearsal: migrate → deterministic reset → verify → ORM preflight → optional HTTP + Playwright.
# Operational confidence (same clock / same DB shape every run).
#
# Usage (repo root):
#   ./scripts/run_full_pilot_rehearsal.sh
#   ./scripts/run_full_pilot_rehearsal.sh --with-playwright --start-server   # adds golden-path Playwright (SPA built if missing)
#   ./scripts/run_full_pilot_rehearsal.sh --skip-spa-build                     # fail if theme/static/spa missing when Playwright requested
#   ./scripts/run_full_pilot_rehearsal.sh --http-preflight                     # curl live stack at E2E_BASE_URL (same DB/settings required)
#
# Defaults: DJANGO_SETTINGS_MODULE=config.settings_rehearsal, db_rehearsal.sqlite3

set -eu
set -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings_rehearsal}"

PYTHON_BIN="${PYTHON_BIN:-./.venv/bin/python}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

DEFAULT_PORT="${E2E_PORT:-8010}"
export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:${DEFAULT_PORT}}"
export E2E_DEMO_PASSWORD="${E2E_DEMO_PASSWORD:-pilot_demo_pass_123}"
export E2E_SMOKE_PASSWORD="${E2E_SMOKE_PASSWORD:-e2e_pass_123}"

REPORT_DIR="${REPORT_DIR:-$ROOT_DIR/reports}"
REPORT_JSON="${REPORT_JSON:-$REPORT_DIR/rehearsal_report.json}"
VERIFY_LOG="${VERIFY_LOG:-$REPORT_DIR/rehearsal_verify.log}"

WITH_PLAYWRIGHT=0
START_SERVER_GOLDEN=0
SKIP_SPA_BUILD=0
HTTP_PREFLIGHT=0

for arg in "$@"; do
  case "$arg" in
    --with-playwright) WITH_PLAYWRIGHT=1 ;;
    --start-server) START_SERVER_GOLDEN=1 ;;
    --skip-spa-build) SKIP_SPA_BUILD=1 ;;
    --http-preflight) HTTP_PREFLIGHT=1 ;;
    *)
      echo "[run_full_pilot_rehearsal] Unknown option: $arg" >&2
      echo "Usage: $0 [--with-playwright] [--start-server] [--skip-spa-build] [--http-preflight]" >&2
      exit 2
      ;;
  esac
done

if [[ -n "${REHEARSAL_HTTP_PREFLIGHT:-}" ]] && [[ "${REHEARSAL_HTTP_PREFLIGHT}" != "0" ]]; then
  HTTP_PREFLIGHT=1
fi

die() {
  echo "[run_full_pilot_rehearsal] ERROR: $*" >&2
  exit 1
}

mkdir -p "$REPORT_DIR"

echo "[run_full_pilot_rehearsal] Step 1: migrate"
"$PYTHON_BIN" manage.py migrate --noinput || die "migrate failed"

echo "[run_full_pilot_rehearsal] Step 2: reset_pilot_environment (deterministic seed)"
"$PYTHON_BIN" manage.py reset_pilot_environment || die "reset_pilot_environment failed"

echo "[run_full_pilot_rehearsal] Step 3: rehearsal_verify — JSON → ${REPORT_JSON}, human output → ${VERIFY_LOG}"
echo "=== $(date -Iseconds) rehearsal_verify --json ===" >> "$VERIFY_LOG"
if ! "$PYTHON_BIN" manage.py rehearsal_verify --json > "$REPORT_JSON" 2>>"$VERIFY_LOG"; then
  echo "[run_full_pilot_rehearsal] rehearsal_verify failed (see ${VERIFY_LOG})" >> "$VERIFY_LOG"
  die "rehearsal_verify failed"
fi
echo "rehearsal_verify: OK — pure JSON written to $(basename "$REPORT_JSON")" >> "$VERIFY_LOG"

TL_JSON="${REPORT_DIR}/rehearsal_timeline_evidence.json"
TL_STEP_LOG="${REPORT_DIR}/rehearsal_timeline_step.log"
echo "[run_full_pilot_rehearsal] Step 4: Case Timeline v1 boundary evidence — JSON → ${TL_JSON}, summary → ${TL_STEP_LOG}"
echo "=== $(date -Iseconds) rehearsal_timeline_evidence ===" >> "$TL_STEP_LOG"
if ! "$PYTHON_BIN" manage.py rehearsal_timeline_evidence --json-out "$TL_JSON" >>"$TL_STEP_LOG" 2>&1; then
  die "rehearsal_timeline_evidence failed (see ${TL_STEP_LOG})"
fi

"$PYTHON_BIN" -c "
import json
from pathlib import Path
report = Path(r'''${REPORT_DIR}''') / 'rehearsal_report.json'
tl = Path(r'''${REPORT_DIR}''') / 'rehearsal_timeline_evidence.json'
if report.exists() and tl.exists():
    data = json.loads(report.read_text(encoding='utf-8'))
    data['timeline_boundary_evidence'] = json.loads(tl.read_text(encoding='utf-8'))
    report.write_text(json.dumps(data, indent=2), encoding='utf-8')
"

echo "[run_full_pilot_rehearsal] Step 5: release_evidence_bundle → ${REPORT_DIR}/release_evidence_bundle.json"
"$PYTHON_BIN" manage.py release_evidence_bundle || die "release_evidence_bundle NO-GO"

echo "[run_full_pilot_rehearsal] Step 6: e2e_rehearsal_preflight (ORM + Django test client, --no-http)"
"$PYTHON_BIN" scripts/e2e_rehearsal_preflight.py --no-http || die "preflight ORM failed"

echo "[run_full_pilot_rehearsal] Step 7: HTTP live stack (optional)"
if [[ "$HTTP_PREFLIGHT" -eq 1 ]]; then
  curl -sf -o /dev/null "${E2E_BASE_URL}/login/" || die "No HTTP listener at ${E2E_BASE_URL}/login/ — start runserver with rehearsal DB"
  "$PYTHON_BIN" scripts/e2e_rehearsal_preflight.py || die "HTTP preflight failed (wrong DB/settings or login mismatch)"
else
  echo "[run_full_pilot_rehearsal] Skip HTTP live checks (TestClient already validated APIs)."
  echo "  For curl/session verification against a running server: REHEARSAL_HTTP_PREFLIGHT=1 or pass --http-preflight"
fi

if [[ "$WITH_PLAYWRIGHT" -eq 1 ]]; then
  SPA_INDEX="$ROOT_DIR/theme/static/spa/index.html"
  if [[ ! -f "$SPA_INDEX" ]]; then
    if [[ "$SKIP_SPA_BUILD" -eq 1 ]]; then
      die "Missing $SPA_INDEX — run npm run build in client/ or omit --skip-spa-build"
    fi
    echo "[run_full_pilot_rehearsal] Building SPA (theme/static/spa)…"
    (cd "$ROOT_DIR/client" && (npm ci 2>/dev/null || npm install) && npm run build) || die "SPA build failed"
  fi
  GP_ARGS=(--skip-prepare)
  [[ "$START_SERVER_GOLDEN" -eq 1 ]] && GP_ARGS+=(--start-server)
  echo "[run_full_pilot_rehearsal] Step 8: Playwright golden path (./scripts/run_golden_path_e2e.sh ${GP_ARGS[*]})"
  ./scripts/run_golden_path_e2e.sh "${GP_ARGS[@]}"
else
  echo "[run_full_pilot_rehearsal] Step 8: skipped (pass --with-playwright for Playwright golden path)"
fi

"$PYTHON_BIN" -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', '${DJANGO_SETTINGS_MODULE}')
django.setup()
from contracts.observability import record_rehearsal_run
record_rehearsal_run(command='run_full_pilot_rehearsal')
" || die "record_rehearsal_run failed"

echo "[run_full_pilot_rehearsal] Done. JSON report: $REPORT_JSON"
