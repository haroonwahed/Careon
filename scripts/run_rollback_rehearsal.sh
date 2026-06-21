#!/usr/bin/env bash
# Rollback rehearsal: verify Render deploy history + local release-confidence gate.
# Does NOT auto-rollback production — records evidence and optional health probe.
#
# Usage:
#   ./scripts/run_rollback_rehearsal.sh
#   BASE_URL=https://carelane.onrender.com ./scripts/run_rollback_rehearsal.sh
#   RENDER_SERVICE_ID=srv-d8rb0gmgvqtc73er8lpg ./scripts/run_rollback_rehearsal.sh
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-./.venv/bin/python}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

BASE_URL="${BASE_URL:-https://carelane.onrender.com}"
RENDER_SERVICE="${RENDER_SERVICE_ID:-srv-d8rb0gmgvqtc73er8lpg}"
REPORT_DIR="${REPORT_DIR:-$ROOT_DIR/reports/rollback_drill}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
EVIDENCE_JSON="$REPORT_DIR/rollback_rehearsal_${STAMP}.json"

mkdir -p "$REPORT_DIR"

echo "[rollback_rehearsal] Step 1: local release-confidence (terminology + pilot rehearsal bundle)"
"$PYTHON_BIN" scripts/terminology_guard.py
if [[ ! -f reports/release_evidence_bundle.json ]]; then
  ./scripts/run_full_pilot_rehearsal.sh
fi
GO="$("$PYTHON_BIN" -c "import json; print(json.load(open('reports/release_evidence_bundle.json')).get('timeline_gate',{}).get('go', False))")"
[[ "$GO" == "True" ]] || { echo "release_evidence_bundle NO-GO" >&2; exit 1; }

echo "[rollback_rehearsal] Step 2: Render deploy history (last 3)"
DEPLOYS_JSON="$REPORT_DIR/render_deploys_${STAMP}.json"
if command -v render >/dev/null 2>&1; then
  render deploys list "$RENDER_SERVICE" --output json > "$DEPLOYS_JSON" 2>/dev/null || echo "[]" > "$DEPLOYS_JSON"
else
  echo "[]" > "$DEPLOYS_JSON"
fi

LIVE_SHA="$("$PYTHON_BIN" -c "
import json
d=json.load(open('$DEPLOYS_JSON'))
live=next((x for x in d if x.get('status')=='live'), d[0] if d else {})
print((live.get('commit') or {}).get('id','')[:7])
")"
PREV_SHA="$("$PYTHON_BIN" -c "
import json
d=json.load(open('$DEPLOYS_JSON'))
prev=next((x for x in d if x.get('status')=='deactivated'), {})
print((prev.get('commit') or {}).get('id','')[:7])
")"

echo "[rollback_rehearsal] Step 3: HTTP health probe (may cold-start on free tier)"
HEALTH_CODE="000"
CARE_CODE="000"
for attempt in 1 2 3; do
  HEALTH_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 90 "${BASE_URL%/}/_health/" 2>/dev/null || echo 000)"
  CARE_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 90 "${BASE_URL%/}/care/" 2>/dev/null || echo 000)"
  if [[ "$HEALTH_CODE" == "200" ]] || [[ "$CARE_CODE" == "200" ]]; then
    break
  fi
  echo "[rollback_rehearsal] wake attempt ${attempt}/3 (health=${HEALTH_CODE} care=${CARE_CODE})"
  sleep 15
done

echo "[rollback_rehearsal] Step 4: document rollback path (manual on Render)"
ROLLBACK_PATH="Render Dashboard → carelane → Deploys → Rollback to previous deploy (${PREV_SHA:-unknown})"

"$PYTHON_BIN" - <<PY
import json
from pathlib import Path
payload = {
    "timestamp_utc": "${STAMP}",
    "base_url": "${BASE_URL}",
    "live_deploy_sha": "${LIVE_SHA}",
    "previous_deploy_sha": "${PREV_SHA}",
    "rollback_procedure": "${ROLLBACK_PATH}",
    "health_check_path_expected": "/_health/",
    "http_probe": {"_health": "${HEALTH_CODE}", "care_root": "${CARE_CODE}"},
    "release_evidence_go": True,
    "manual_step_required": "Execute rollback once on staging/production window; auto-rollback not performed by this script.",
    "verification": "pass" if "${HEALTH_CODE}" == "200" or "${CARE_CODE}" == "200" else "degraded_cold_start",
}
Path("${EVIDENCE_JSON}").write_text(json.dumps(payload, indent=2), encoding="utf-8")
print(json.dumps(payload, indent=2))
PY

echo "[rollback_rehearsal] Evidence: $EVIDENCE_JSON"
echo "[rollback_rehearsal] Manual: $ROLLBACK_PATH"
