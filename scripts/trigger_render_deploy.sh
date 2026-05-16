#!/usr/bin/env bash
# P0: trigger Render deploy hook when RENDER_DEPLOY_HOOK_URL is set (local or CI).
set -euo pipefail

if [[ -z "${RENDER_DEPLOY_HOOK_URL:-}" ]]; then
  echo "RENDER_DEPLOY_HOOK_URL not set — configure in Render dashboard or GitHub secrets." >&2
  echo "See docs/RENDER_DEPLOYMENT_SETUP.md" >&2
  exit 1
fi

curl -fsS -X POST "$RENDER_DEPLOY_HOOK_URL"
echo ""
echo "Deploy hook triggered."
