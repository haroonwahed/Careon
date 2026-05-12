#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

echo "Checking for runtime imports from legacy/archive paths..."

# Frontend runtime should not import legacy/archive snapshots.
frontend_hits=$(rg -n "legacy_archive|Blueprint and design" client/src --glob '*.{ts,tsx,js,jsx}' || true)
if [[ -n "$frontend_hits" ]]; then
  echo "ERROR: frontend runtime imports legacy/archive paths:"
  echo "$frontend_hits"
  exit 1
fi

# Backend runtime should not import legacy_backend.
# Backend: block stray legacy_backend imports except the known transitional callsite in api/views.py
# (see TECH_DEBT.md — matching ownership split).
backend_hits=$(rg -n "from contracts\.legacy_backend|import contracts\.legacy_backend" contracts config --glob '*.py' --glob '!contracts/legacy_backend/**' --glob '!contracts/api/views.py' || true)
if [[ -n "$backend_hits" ]]; then
  echo "ERROR: backend runtime has unexpected legacy_backend imports:"
  echo "$backend_hits"
  exit 1
fi

echo "Legacy isolation check passed (no runtime imports from legacy folders)."
