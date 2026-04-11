#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

INTERVAL_MINUTES="${1:-60}"
mkdir -p logs

start_proc() {
  local name="$1"
  local pid_file="$2"
  local log_file="$3"
  shift 3

  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "$name already running (pid $(cat "$pid_file"))."
    return
  fi

  : > "$log_file"
  nohup "$@" >> "$log_file" 2>&1 &
  local pid=$!
  echo "$pid" > "$pid_file"

  if ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$pid_file"
    echo "Failed to start $name. See $log_file for details."
    return 1
  fi

  echo "Started $name (pid $pid)."
}

start_https_server() {
  local pid_file="logs/dev_https.pid"

  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "HTTPS dev server already running (pid $(cat "$pid_file"))."
    return 0
  fi

  bash "$ROOT_DIR/scripts/dev_https.sh" up --background
}

start_https_server

start_proc "reminder scheduler" "logs/reminder_scheduler.pid" "logs/reminder_scheduler.log" \
  "$ROOT_DIR/.venv/bin/python" -u manage.py run_reminder_scheduler --interval-minutes "$INTERVAL_MINUTES"

echo "Services started."
echo "- HTTPS server: https://127.0.0.1:8000/"
echo "- HTTPS log:    logs/dev_https.log"
echo "- Scheduler log: logs/reminder_scheduler.log"
