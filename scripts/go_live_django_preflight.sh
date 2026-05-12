#!/usr/bin/env bash
# Django preflight against production-style settings (no network deploy).
# Run from repo root with a real PostgreSQL DATABASE_URL when checking migrations.
#
# Required for full pass:
#   DJANGO_SETTINGS_MODULE=config.settings_production
#   DJANGO_SECRET_KEY          (non-insecure value)
#   ALLOWED_HOSTS              comma-separated
#   CSRF_TRUSTED_ORIGINS       comma-separated HTTPS origins
#   DEFAULT_FROM_EMAIL         real sender, not noreply@careon.local
#   DATABASE_URL               postgresql://... (required by settings_production)
#
# Usage:
#   set -a && source /path/to/prod.env && set +a
#   ./scripts/go_live_django_preflight.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PY="${PYTHON:-./.venv/bin/python}"
if [[ ! -x "$PY" ]]; then
  PY="python3"
fi

: "${DJANGO_SETTINGS_MODULE:=config.settings_production}"

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: unset $name — export it (see script header)." >&2
    exit 1
  fi
}

require_var DJANGO_SETTINGS_MODULE
require_var DJANGO_SECRET_KEY
require_var ALLOWED_HOSTS
require_var CSRF_TRUSTED_ORIGINS
require_var DEFAULT_FROM_EMAIL
require_var DATABASE_URL

echo "== Django migrate --plan ($DJANGO_SETTINGS_MODULE)"
"$PY" manage.py migrate --plan

echo "== Django check --deploy"
"$PY" manage.py check --deploy

echo "== Preflight OK"
