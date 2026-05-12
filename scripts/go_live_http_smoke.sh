#!/usr/bin/env bash
# HTTP smoke for a deployed Careon / Zorg OS instance (staging or production).
#
# Usage:
#   BASE_URL=https://your-host.example.com ./scripts/go_live_http_smoke.sh
#
# Exits non-zero on first non-2xx/3xx response. Follows redirects (-L).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "${BASE_URL:-}" ]]; then
  echo "ERROR: set BASE_URL to the deployed origin, e.g. https://your-app.onrender.com" >&2
  exit 1
fi

# Strip trailing slash for predictable joins
ORIGIN="${BASE_URL%/}"

# `/static/spa/?view=dashboard` may 404 on some Whitenoise/production static setups;
# `/?view=dashboard` and `/static/spa/index.html` are the usual working equivalents.
paths=(
  "/"
  "/care/"
  "/?view=dashboard"
)

echo "== HTTP smoke against ${ORIGIN}"
for path in "${paths[@]}"; do
  url="${ORIGIN}${path}"
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url" || true)"
  if [[ ! "$code" =~ ^(2|3)[0-9]{2}$ ]]; then
    echo "FAIL $url → HTTP $code" >&2
    exit 1
  fi
  echo "OK   $url → HTTP $code"
done

echo "== All checks passed"
