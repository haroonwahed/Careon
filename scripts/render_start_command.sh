#!/usr/bin/env bash
# Production start for Render (and any host that mirrors this layout).
# Keep in sync with render.yaml — dashboard Start Command can be: bash scripts/render_start_command.sh
set -eu
set -o pipefail

# Render log UI can look "stuck" on Deploying until the first line appears; print immediately.
echo "[render] start_command invoked at $(date -u +%Y-%m-%dT%H:%M:%SZ) pwd=$(pwd)"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REVISION="${RENDER_GIT_COMMIT:-${GIT_COMMIT:-}}"
if [[ -z "$REVISION" ]] && command -v git >/dev/null 2>&1; then
  REVISION="$(git rev-parse --short HEAD 2>/dev/null || true)"
fi
if [[ -z "$REVISION" ]]; then
  REVISION="unknown"
fi
if [[ ${#REVISION} -gt 7 ]]; then
  REVISION="${REVISION:0:7}"
fi

echo "Starting web revision=${REVISION}"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is missing from the Render runtime environment."
  echo "Fix: Dashboard → this Python web service → Environment → add DATABASE_URL (Secret), then redeploy."
  echo "If you use a Blueprint, set it on the service that runs this start command (name may differ from render.yaml)."
  exit 1
fi

python scripts/render_startup_checks.py

if [[ "${PILOT_AUTO_BOOTSTRAP:-}" =~ ^(1|true|yes)$ ]]; then
  echo "[render] PILOT_AUTO_BOOTSTRAP enabled — migrate + bootstrap_staging_pilot"
  python manage.py migrate --noinput
  python manage.py bootstrap_staging_pilot
fi

echo "[render] Startup checks passed; starting gunicorn on port ${PORT:-?}"

WORKERS="${GUNICORN_WORKERS:-${WEB_CONCURRENCY:-2}}"
echo "gunicorn workers=${WORKERS}"
exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:?PORT is required}" --workers "$WORKERS" --timeout 120
