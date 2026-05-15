#!/usr/bin/env bash
# V1 staging shell smoke — HTTP 200 checks for routes in docs/V1_SHIP_CHECKLIST.md §3.
#
# Usage:
#   BASE_URL=https://careon-web.onrender.com ./scripts/staging_v1_shell_smoke.sh
#
# Does not authenticate; confirms SPA shell / Django routes respond. For full role
# flows use Playwright after deploy with rehearsal or pilot demo users.
set -euo pipefail

if [[ -z "${BASE_URL:-}" ]]; then
  echo "ERROR: set BASE_URL (e.g. https://careon-web.onrender.com)" >&2
  exit 1
fi

ORIGIN="${BASE_URL%/}"
paths=(
  "/"
  "/care/"
  "/login/"
  "/?view=dashboard"
  "/care/casussen"
  "/care/matching"
  "/care/beoordelingen"
  "/dashboard/"
)

echo "== V1 staging shell smoke: ${ORIGIN}"
failed=0
for path in "${paths[@]}"; do
  url="${ORIGIN}${path}"
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' --max-time 60 "$url" || true)"
  if [[ ! "$code" =~ ^(2|3)[0-9]{2}$ ]]; then
    echo "FAIL $url → HTTP $code"
    failed=1
  else
    echo "OK   $url → HTTP $code"
  fi
done

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi
echo "== All shell routes returned 2xx/3xx"
