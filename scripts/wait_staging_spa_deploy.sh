#!/usr/bin/env bash
# Poll staging until the live SPA entry matches the repo build (post-Render deploy).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-${STAGING_BASE_URL:-https://careon-web.onrender.com}}"
MAX_WAIT_SEC="${MAX_WAIT_SEC:-900}"
INTERVAL_SEC="${INTERVAL_SEC:-20}"

INDEX="$ROOT_DIR/theme/static/spa/index.html"
if [[ ! -f "$INDEX" ]]; then
  echo "ERROR: missing $INDEX — run: (cd client && npm run build)" >&2
  exit 1
fi

EXPECTED="$(grep -oE 'index-[A-Za-z0-9_-]+\.js' "$INDEX" | head -1)"
echo "[wait_staging_spa_deploy] Expecting $EXPECTED on ${BASE_URL%/}/dashboard/ (max ${MAX_WAIT_SEC}s)"

deadline=$((SECONDS + MAX_WAIT_SEC))
while (( SECONDS < deadline )); do
  LIVE="$(curl -sS -L --max-time 60 "${BASE_URL%/}/dashboard/" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
  if [[ -n "$LIVE" ]]; then
    echo "[wait_staging_spa_deploy] live=$LIVE"
    if [[ "$LIVE" == "$EXPECTED" ]]; then
      echo "[wait_staging_spa_deploy] OK"
      exit 0
    fi
  else
    echo "[wait_staging_spa_deploy] no bundle detected yet"
  fi
  sleep "$INTERVAL_SEC"
done

echo "[wait_staging_spa_deploy] TIMEOUT — still not $EXPECTED" >&2
exit 1
