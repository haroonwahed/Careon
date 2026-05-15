#!/usr/bin/env bash
# Staging pilot sign-off: shell smoke, SPA bundle check, optional remote seed, Playwright.
#
# Usage (from repo root):
#   BASE_URL=https://careon-web.onrender.com ./scripts/staging_pilot_signoff.sh
#
# Remote seed (staging Postgres — requires network + credentials):
#   STAGING_DATABASE_URL='postgresql://...' \
#   DJANGO_SECRET_KEY='...' ALLOWED_HOSTS='careon-web.onrender.com' \
#   CSRF_TRUSTED_ORIGINS='https://careon-web.onrender.com' \
#   DEFAULT_FROM_EMAIL='noreply@careon.nl' \
#   ./scripts/staging_pilot_signoff.sh --seed
#
# @see docs/V1_SHIP_CHECKLIST.md §3, docs/NORTH_STAR_V1_STATUS.md
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="${BASE_URL:-${STAGING_BASE_URL:-https://careon-web.onrender.com}}"
export BASE_URL
export E2E_BASE_URL="${E2E_BASE_URL:-$BASE_URL}"
export E2E_DEMO_PASSWORD="${E2E_DEMO_PASSWORD:-pilot_demo_pass_123}"

RUN_SEED=0
for arg in "$@"; do
  case "$arg" in
    --seed) RUN_SEED=1 ;;
    "") ;;
    *) echo "Unknown option: $arg (use --seed)" >&2; exit 2 ;;
  esac
done

PYTHON_BIN="${PYTHON_BIN:-./.venv/bin/python}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

die() {
  echo "[staging_pilot_signoff] ERROR: $*" >&2
  exit 1
}

expected_spa_js() {
  local index="$ROOT_DIR/theme/static/spa/index.html"
  if [[ ! -f "$index" ]]; then
    die "Missing $index — run: (cd client && npm run build)"
  fi
  grep -oE 'index-[A-Za-z0-9_-]+\.js' "$index" | head -1
}

echo "[staging_pilot_signoff] Origin: $BASE_URL"

if [[ "$RUN_SEED" -eq 1 ]]; then
  if [[ -z "${STAGING_DATABASE_URL:-}" ]]; then
    die "Set STAGING_DATABASE_URL to seed staging Postgres (or enable PILOT_AUTO_BOOTSTRAP on Render and redeploy)."
  fi
  export DATABASE_URL="$STAGING_DATABASE_URL"
  export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings_production}"
  : "${DJANGO_SECRET_KEY:?Set DJANGO_SECRET_KEY for production settings}"
  : "${ALLOWED_HOSTS:?Set ALLOWED_HOSTS (e.g. careon-web.onrender.com)}"
  : "${CSRF_TRUSTED_ORIGINS:?Set CSRF_TRUSTED_ORIGINS (e.g. https://careon-web.onrender.com)}"
  : "${DEFAULT_FROM_EMAIL:?Set DEFAULT_FROM_EMAIL}"
  echo "[staging_pilot_signoff] migrate + bootstrap_staging_pilot (remote) …"
  "$PYTHON_BIN" manage.py migrate --noinput
  export PILOT_AUTO_BOOTSTRAP=1
  export E2E_DEMO_PASSWORD
  "$PYTHON_BIN" manage.py bootstrap_staging_pilot
fi

echo "[staging_pilot_signoff] HTTP shell smoke …"
./scripts/staging_v1_shell_smoke.sh

EXPECTED="$(expected_spa_js)"
echo "[staging_pilot_signoff] Expected SPA entry (from repo build): $EXPECTED"
LIVE="$(curl -sS -L --max-time 60 "${BASE_URL%/}/dashboard/" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
if [[ -z "$LIVE" ]]; then
  die "Could not detect SPA bundle on ${BASE_URL}/dashboard/"
fi
echo "[staging_pilot_signoff] Live SPA entry: $LIVE"
if [[ "$LIVE" != "$EXPECTED" ]]; then
  die "SPA bundle mismatch (deploy stale?). Expected $EXPECTED, got $LIVE. Redeploy Render after main build."
fi

echo "[staging_pilot_signoff] Playwright (staging-shell + provider-review) …"
if ! (cd "$ROOT_DIR/client" && npx playwright install chromium >/dev/null 2>&1); then
  die "playwright install chromium failed"
fi
(
  cd "$ROOT_DIR/client"
  npx playwright test \
    tests/e2e/staging-shell-smoke.spec.ts \
    tests/e2e/provider-review-smoke.spec.ts \
    --workers=1
)

echo "[staging_pilot_signoff] GO — shell, SPA hash, and Playwright passed."
