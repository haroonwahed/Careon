#!/usr/bin/env bash
# Canonical pilot E2E environment preparation (rehearsal DB + SPA build + seed).
# Usage: ./scripts/prepare_pilot_e2e.sh [--preflight] [--skip-build]
# See docs/E2E_RUNBOOK.md

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings_rehearsal}"

PYTHON_BIN="${PYTHON_BIN:-./.venv/bin/python}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

SKIP_BUILD=0
RUN_PREFLIGHT=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    --preflight) RUN_PREFLIGHT=1 ;;
    "") ;;
    *) echo "Unknown option: $arg (use --preflight, --skip-build)" >&2; exit 2 ;;
  esac
done

# Explicit passwords (preferred). Legacy E2E_PASSWORD applies to both when set alone.
export E2E_DEMO_PASSWORD="${E2E_DEMO_PASSWORD:-pilot_demo_pass_123}"
export E2E_SMOKE_PASSWORD="${E2E_SMOKE_PASSWORD:-e2e_pass_123}"
if [[ -n "${E2E_PASSWORD:-}" ]]; then
  export E2E_DEMO_PASSWORD="${E2E_DEMO_PASSWORD:-$E2E_PASSWORD}"
  export E2E_SMOKE_PASSWORD="${E2E_SMOKE_PASSWORD:-$E2E_PASSWORD}"
fi

DEFAULT_PORT="${E2E_PORT:-8010}"
export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:${DEFAULT_PORT}}"
SPA_INDEX="$ROOT_DIR/theme/static/spa/index.html"

die() {
  echo "[prepare_pilot_e2e] ERROR: $*" >&2
  exit 1
}

echo "[prepare_pilot_e2e] Repo: $ROOT_DIR"
echo "[prepare_pilot_e2e] Django settings: $DJANGO_SETTINGS_MODULE"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "[prepare_pilot_e2e] Installing client deps (npm ci or npm install)..."
  if ! (cd "$ROOT_DIR/client" && npm ci 2>/dev/null); then
    (cd "$ROOT_DIR/client" && npm install)
  fi

  echo "[prepare_pilot_e2e] Building SPA → theme/static/spa ..."
  (cd "$ROOT_DIR/client" && npm run build) || die "Vite build failed. Fix client build errors."

  if [[ ! -f "$SPA_INDEX" ]]; then
    die "SPA bundle/static shell did not mount: missing $SPA_INDEX. Build SPA (npm run build in client) before running pilot E2E."
  fi
  echo "[prepare_pilot_e2e] OK: $SPA_INDEX exists"
else
  if [[ ! -f "$SPA_INDEX" ]]; then
    die "SPA bundle missing at $SPA_INDEX (re-run without --skip-build)."
  fi
fi

echo "[prepare_pilot_e2e] Playwright browsers (chromium)..."
(cd "$ROOT_DIR/client" && npx playwright install chromium) || die "playwright install chromium failed"

echo "[prepare_pilot_e2e] Migrating rehearsal database..."
"$PYTHON_BIN" manage.py migrate --noinput || die "migrate failed"

echo "[prepare_pilot_e2e] Flushing rehearsal database (destructive)..."
"$PYTHON_BIN" manage.py flush --noinput || die "flush failed"

echo "[prepare_pilot_e2e] Seeding canonical pilot E2E dataset..."
export E2E_DEMO_PASSWORD E2E_SMOKE_PASSWORD
[[ -n "${E2E_PASSWORD:-}" ]] && export E2E_PASSWORD
"$PYTHON_BIN" manage.py seed_pilot_e2e || die "seed_pilot_e2e failed"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Pilot E2E preparation complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Database:     db_rehearsal.sqlite3 (settings_rehearsal)"
echo "  E2E_BASE_URL: $E2E_BASE_URL"
echo ""
echo "  Demo tier (pilot-demo.spec.ts):"
echo "    Users:     demo_gemeente, demo_provider_brug, demo_provider_kompas"
echo "    Password:  $E2E_DEMO_PASSWORD"
echo ""
echo "  Smoke tier (pilot-smoke.spec.ts):"
echo "    User:      ${E2E_USERNAME:-e2e_owner}"
echo "    Password:  $E2E_SMOKE_PASSWORD"
echo ""
echo "  Env overrides: E2E_DEMO_PASSWORD, E2E_SMOKE_PASSWORD, E2E_USERNAME"
echo "  Legacy:      E2E_PASSWORD sets both tiers if explicit vars unset"
echo ""
echo "  Start (or restart) Django with the SAME settings module, then run Playwright:"
echo "    export DJANGO_SETTINGS_MODULE=config.settings_rehearsal"
echo "    $PYTHON_BIN manage.py runserver 127.0.0.1:${DEFAULT_PORT}"
echo "  If runserver was already running: stop and start again so new settings and SPA chunks load."
echo "  Rehearsal defaults DEBUG=True so new /static/spa/assets/*.js is served (see docs/E2E_RUNBOOK.md)."
echo ""
echo "  Playwright (from client/):"
echo "    export E2E_BASE_URL=$E2E_BASE_URL"
echo "    export E2E_DEMO_PASSWORD=$E2E_DEMO_PASSWORD"
echo "    export E2E_SMOKE_PASSWORD=$E2E_SMOKE_PASSWORD"
echo "    npx playwright test tests/e2e/pilot-stack-preflight.spec.ts"
echo "    npx playwright test tests/e2e/pilot-smoke.spec.ts tests/e2e/pilot-demo.spec.ts"
echo ""
echo "  Stack check (after server is up — same DB/password as seed):"
echo "    $PYTHON_BIN scripts/e2e_rehearsal_preflight.py"
echo ""
echo "  Golden path (prepare + preflight + Playwright): ./scripts/run_golden_path_e2e.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ "$RUN_PREFLIGHT" -eq 1 ]]; then
  if curl -sf -o /dev/null "${E2E_BASE_URL}/login/"; then
    echo "[prepare_pilot_e2e] Running preflight (E2E_PROFILE=all)..."
    (
      cd "$ROOT_DIR/client"
      E2E_BASE_URL="$E2E_BASE_URL" \
      E2E_DEMO_PASSWORD="$E2E_DEMO_PASSWORD" \
      E2E_SMOKE_PASSWORD="$E2E_SMOKE_PASSWORD" \
      E2E_PROFILE="${E2E_PROFILE:-all}" \
      npx playwright test tests/e2e/pilot-stack-preflight.spec.ts
    ) || die "preflight failed — fix server or credentials"
  else
    die "preflight requested but server not reachable at ${E2E_BASE_URL}/login/ — start Django first (see above)."
  fi
fi
