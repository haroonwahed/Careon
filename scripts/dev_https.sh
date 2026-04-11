#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CERT_DIR="$ROOT_DIR/.certs"
LOG_DIR="$ROOT_DIR/logs"
PID_FILE="$LOG_DIR/dev_https.pid"
LOG_FILE="$LOG_DIR/dev_https.log"

LEAF_KEY="$CERT_DIR/localhost-leaf-key.pem"
LEAF_CERT="$CERT_DIR/localhost-leaf-cert.pem"

HOST="127.0.0.1"
PORT="8000"
MODE="foreground"

usage() {
  cat <<'EOF'
Usage:
  scripts/dev_https.sh up [--background] [--host 127.0.0.1] [--port 8000]
  scripts/dev_https.sh down

Examples:
  scripts/dev_https.sh up
  scripts/dev_https.sh up --background
  scripts/dev_https.sh down
EOF
}

require_tools() {
  if [[ ! -x "$ROOT_DIR/.venv/bin/python" ]]; then
    echo "Missing Python virtualenv at .venv/bin/python"
    exit 1
  fi
  if ! command -v mkcert >/dev/null 2>&1; then
    echo "mkcert is required. Install it with: brew install mkcert"
    exit 1
  fi
}

stop_existing() {
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    kill "$(cat "$PID_FILE")" || true
    rm -f "$PID_FILE"
  fi

  local pids
  pids="$(lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    for p in $pids; do
      kill "$p" || true
    done
  fi
}

ensure_mkcert_certs() {
  mkdir -p "$CERT_DIR"

  # Install mkcert root CA into macOS keychain + Chrome NSS store (idempotent)
  mkcert -install

  # Regenerate leaf cert if missing or older than 800 days
  if [[ ! -f "$LEAF_CERT" || ! -f "$LEAF_KEY" ]] || \
     ! openssl x509 -checkend $((800 * 86400)) -noout -in "$LEAF_CERT" >/dev/null 2>&1; then
    CAROOT="$(mkcert -CAROOT)"
    mkcert \
      -key-file  "$LEAF_KEY" \
      -cert-file "$LEAF_CERT" \
      127.0.0.1 localhost
  fi
}

start_server() {
  mkdir -p "$LOG_DIR"
  local cmd=(
    "$ROOT_DIR/.venv/bin/python" -m uvicorn config.asgi:application
    --host "$HOST"
    --port "$PORT"
    --ssl-keyfile "$LEAF_KEY"
    --ssl-certfile "$LEAF_CERT"
  )

  if [[ "$MODE" == "background" ]]; then
    : > "$LOG_FILE"
    nohup "${cmd[@]}" >> "$LOG_FILE" 2>&1 &
    local pid=$!
    echo "$pid" > "$PID_FILE"

    local tries=0
    while [[ $tries -lt 20 ]]; do
      if lsof -i "tcp:$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
        break
      fi
      if ! kill -0 "$pid" 2>/dev/null; then
        echo "HTTPS dev server failed to start. See $LOG_FILE"
        rm -f "$PID_FILE"
        return 1
      fi
      sleep 0.2
      tries=$((tries + 1))
    done

    if ! lsof -i "tcp:$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "HTTPS dev server did not open port $PORT in time. See $LOG_FILE"
      rm -f "$PID_FILE"
      return 1
    fi

    echo "HTTPS dev server started in background (pid $pid)."
    echo "URL: https://$HOST:$PORT/"
    echo "Log: $LOG_FILE"
  else
    echo "Starting HTTPS dev server on https://$HOST:$PORT/"
    exec "${cmd[@]}"
  fi
}

ACTION="${1:-up}"
shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --background)
      MODE="background"
      shift
      ;;
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

case "$ACTION" in
  up)
    require_tools
    stop_existing
    ensure_mkcert_certs
    start_server
    ;;
  down)
    stop_existing
    echo "HTTPS dev server stopped (if it was running)."
    ;;
  *)
    echo "Unknown action: $ACTION"
    usage
    exit 1
    ;;
esac
