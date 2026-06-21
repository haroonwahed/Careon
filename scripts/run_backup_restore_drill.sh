#!/usr/bin/env bash
# Local backup / restore drill for pilot readiness evidence.
# Simulates RPO/RTO on the rehearsal SQLite DB; optionally verifies live Postgres counts.
#
# Usage (repo root):
#   ./scripts/run_backup_restore_drill.sh
#   ./scripts/run_backup_restore_drill.sh --verify-live-db   # read-only Supabase/Postgres counts (needs DATABASE_URL)
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERIFY_LIVE=0
for arg in "$@"; do
  case "$arg" in
    --verify-live-db) VERIFY_LIVE=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

PYTHON_BIN="${PYTHON_BIN:-./.venv/bin/python}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings_rehearsal}"
REHEARSAL_DB="$ROOT_DIR/db_rehearsal.sqlite3"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/reports/backup_drill}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="$BACKUP_DIR/rehearsal-${STAMP}.sqlite3"
EVIDENCE_JSON="$BACKUP_DIR/backup_restore_drill_${STAMP}.json"

die() { echo "[backup_restore_drill] ERROR: $*" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"

echo "[backup_restore_drill] Step 1: ensure rehearsal DB is seeded"
if [[ ! -f "$REHEARSAL_DB" ]]; then
  "$PYTHON_BIN" manage.py migrate --noinput
  "$PYTHON_BIN" manage.py reset_pilot_environment
fi

echo "[backup_restore_drill] Step 2: record baseline counts"
read -r BASE_CASES BASE_LOGS <<< "$("$PYTHON_BIN" - <<'PY'
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings_rehearsal")
django.setup()
from contracts.models import CareCase
from contracts.models.governance import CaseDecisionLog
print(CareCase.objects.unscoped().count(), CaseDecisionLog.objects.count())
PY
)"

echo "[backup_restore_drill] Step 3: copy backup → $BACKUP_FILE"
cp "$REHEARSAL_DB" "$BACKUP_FILE"
BACKUP_BYTES="$(wc -c < "$BACKUP_FILE" | tr -d ' ')"

echo "[backup_restore_drill] Step 4: simulate data loss (delete rehearsal DB)"
rm -f "$REHEARSAL_DB"

echo "[backup_restore_drill] Step 5: restore backup"
T0="$(date +%s)"
cp "$BACKUP_FILE" "$REHEARSAL_DB"
T1="$(date +%s)"
RESTORE_SEC=$((T1 - T0))

echo "[backup_restore_drill] Step 6: verify counts + health"
read -r REST_CASES REST_LOGS <<< "$("$PYTHON_BIN" - <<'PY'
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings_rehearsal")
django.setup()
from contracts.models import CareCase
from contracts.models.governance import CaseDecisionLog
print(CareCase.objects.unscoped().count(), CaseDecisionLog.objects.count())
PY
)"

if [[ "$REST_CASES" != "$BASE_CASES" ]] || [[ "$REST_LOGS" != "$BASE_LOGS" ]]; then
  die "count mismatch after restore (cases ${BASE_CASES}→${REST_CASES}, logs ${BASE_LOGS}→${REST_LOGS})"
fi

LIVE_NOTE="skipped"
LIVE_CASES=""
if [[ "$VERIFY_LIVE" -eq 1 ]]; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    set -a
    [[ -f .env ]] && source .env
    set +a
  fi
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "[backup_restore_drill] Step 7: read-only live Postgres verification"
    read -r LIVE_CASES LIVE_LOGS <<< "$(
      DJANGO_SETTINGS_MODULE=config.settings_production \
      DJANGO_DEBUG=0 \
      ALLOWED_HOSTS=localhost \
      CSRF_TRUSTED_ORIGINS=http://localhost \
      DEFAULT_FROM_EMAIL=drill@carelane.nl \
      DJANGO_SECRET_KEY=drill-readonly-not-production \
      DATABASE_URL="$DATABASE_URL" \
      "$PYTHON_BIN" - <<'PY'
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings_production")
django.setup()
from contracts.models import CareCase
from contracts.models.governance import CaseDecisionLog
print(CareCase.objects.unscoped().count(), CaseDecisionLog.objects.count())
PY
    )"
    LIVE_NOTE="ok cases=${LIVE_CASES} decision_logs=${LIVE_LOGS}"
  else
    LIVE_NOTE="DATABASE_URL not set"
  fi
fi

"$PYTHON_BIN" - <<PY
import json
from pathlib import Path
payload = {
    "drill_type": "local_rehearsal_sqlite",
    "timestamp_utc": "${STAMP}",
    "backup_file": "${BACKUP_FILE}",
    "backup_bytes": int("${BACKUP_BYTES}"),
    "baseline": {"care_cases": int("${BASE_CASES}"), "case_decision_logs": int("${BASE_LOGS}")},
    "restored": {"care_cases": int("${REST_CASES}"), "case_decision_logs": int("${REST_LOGS}")},
    "restore_duration_seconds": int("${RESTORE_SEC}"),
    "rpo_observed": "0 (point-in-time file copy)",
    "rto_observed_seconds": int("${RESTORE_SEC}"),
    "live_postgres_readonly": "${LIVE_NOTE}",
    "verification": "pass",
}
Path("${EVIDENCE_JSON}").write_text(json.dumps(payload, indent=2), encoding="utf-8")
print(json.dumps(payload, indent=2))
PY

echo "[backup_restore_drill] PASS — evidence: $EVIDENCE_JSON"
