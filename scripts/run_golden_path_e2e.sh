#!/usr/bin/env bash
# One ordered flow: prepare rehearsal DB + SPA, verify stack, run Zorg OS golden-path Playwright.
# Usage (repo root):
#   ./scripts/run_golden_path_e2e.sh
#   ./scripts/run_golden_path_e2e.sh --skip-build
#   ./scripts/run_golden_path_e2e.sh --skip-prepare   # skip flush+seed+build (DB already seeded; SPA must exist)
#   ./scripts/run_golden_path_e2e.sh --start-server   # background runserver if nothing listens on E2E_BASE_URL
#
# Requires: .venv Python, Node/npm in client/. See docs/E2E_RUNBOOK.md

set -euo pipefail

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

START_SERVER=0
SKIP_PREPARE=0
PREP_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --start-server) START_SERVER=1 ;;
    --skip-build) PREP_ARGS+=(--skip-build) ;;
    --skip-prepare) SKIP_PREPARE=1 ;;
    *) echo "Unknown option: $arg (use --skip-build, --skip-prepare, --start-server)" >&2; exit 2 ;;
  esac
done

die() {
  echo "[run_golden_path_e2e] ERROR: $*" >&2
  exit 1
}

SPA_INDEX="$ROOT_DIR/theme/static/spa/index.html"
if [[ "$SKIP_PREPARE" -eq 1 ]]; then
  echo "[run_golden_path_e2e] Step 1/4: skipped (--skip-prepare) — using existing DB + SPA shell"
  if [[ ! -f "$SPA_INDEX" ]]; then
    die "Missing SPA bundle at $SPA_INDEX. Run ./scripts/prepare_pilot_e2e.sh or npm run build (client/)."
  fi
else
  echo "[run_golden_path_e2e] Step 1/4: prepare rehearsal DB, seed, build SPA → theme/static/spa"
  # Bash + `set -u`: "${PREP_ARGS[@]}" is unbound when the array is empty; branch avoids that.
  if [[ ${#PREP_ARGS[@]} -eq 0 ]]; then
    ./scripts/prepare_pilot_e2e.sh
  else
    ./scripts/prepare_pilot_e2e.sh "${PREP_ARGS[@]}"
  fi
fi

server_listening() {
  curl -sf -o /dev/null "${E2E_BASE_URL}/login/"
}

echo "[run_golden_path_e2e] Step 2/4: ensure Django is reachable at ${E2E_BASE_URL}"
SERVER_PID=""
cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[run_golden_path_e2e] Stopping background runserver (pid $SERVER_PID)"
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if server_listening; then
  if [[ "$START_SERVER" -eq 1 ]]; then
    die "Something already listens on ${E2E_BASE_URL}. Stop that process (often wrong DJANGO_SETTINGS_MODULE / wrong DB) or use another port:\n  export E2E_PORT=8011 E2E_BASE_URL=http://127.0.0.1:8011\nThen re-run with --start-server."
  fi
  echo "[run_golden_path_e2e] Server already listening — ensure it uses:"
  echo "  DJANGO_SETTINGS_MODULE=config.settings_rehearsal"
  echo "  same db_rehearsal.sqlite3 as this prepare run (restart runserver after ./scripts/prepare_pilot_e2e.sh flush+seed)"
else
  if [[ "$START_SERVER" -eq 1 ]]; then
    echo "[run_golden_path_e2e] Starting runserver in background (same shell exports)…"
    export DJANGO_SETTINGS_MODULE
    "$PYTHON_BIN" manage.py runserver "127.0.0.1:${DEFAULT_PORT}" &
    SERVER_PID=$!
    for _ in $(seq 1 90); do
      server_listening && break
      sleep 1
    done
    server_listening || die "runserver did not become ready at ${E2E_BASE_URL}/login/"
  else
    die "No server at ${E2E_BASE_URL}. In another terminal run:\n  export DJANGO_SETTINGS_MODULE=config.settings_rehearsal\n  $PYTHON_BIN manage.py runserver 127.0.0.1:${DEFAULT_PORT}\nOr re-run with: $0 --start-server"
  fi
fi

echo "[run_golden_path_e2e] Step 3/5: DB + HTTP preflight (scripts/e2e_rehearsal_preflight.py)"
export E2E_BASE_URL E2E_DEMO_PASSWORD E2E_SMOKE_PASSWORD
"$PYTHON_BIN" scripts/e2e_rehearsal_preflight.py

mkdir -p "$ROOT_DIR/reports"
TL_JSON="$ROOT_DIR/reports/rehearsal_timeline_evidence.json"
TL_STEP_LOG="${ROOT_DIR}/reports/rehearsal_timeline_step.log"
# JSON is written only via --json-out; human-readable summary lines go to log (same pattern as run_full_pilot_rehearsal.sh).
echo "[run_golden_path_e2e] Step 4/5: Case Timeline v1 boundary evidence — JSON → ${TL_JSON}, summary → ${TL_STEP_LOG}"
echo "=== $(date -Iseconds) rehearsal_timeline_evidence (golden path) ===" >> "$TL_STEP_LOG"
"$PYTHON_BIN" manage.py rehearsal_timeline_evidence --json-out "$TL_JSON" >>"$TL_STEP_LOG" 2>&1 || die "rehearsal_timeline_evidence failed"

echo "[run_golden_path_e2e] Step 5/5: Playwright golden-path spec"
(
  cd "$ROOT_DIR/client"
  export E2E_BASE_URL E2E_DEMO_PASSWORD E2E_SMOKE_PASSWORD
  npx playwright test tests/e2e/zorg-os-golden-path.spec.ts
)

echo "[run_golden_path_e2e] Done."
