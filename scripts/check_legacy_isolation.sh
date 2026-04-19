#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

echo "Checking for runtime imports from legacy/archive paths..."

# Frontend runtime should not import legacy/archive snapshots.
frontend_hits=$(rg -n "legacy_archive|archive/|Blueprint and design" client/src --glob '*.{ts,tsx,js,jsx}' || true)
if [[ -n "$frontend_hits" ]]; then
  echo "ERROR: frontend runtime imports legacy/archive paths:"
  echo "$frontend_hits"
  exit 1
fi

# Backend runtime should not import legacy_backend.
backend_hits=$(rg -n "from .*legacy_backend|import .*legacy_backend" contracts config --glob '*.py' --glob '!contracts/legacy_backend/**' || true)
if [[ -n "$backend_hits" ]]; then
  echo "ERROR: backend runtime has unexpected legacy_backend imports:"
  echo "$backend_hits"
  exit 1
fi

echo "Legacy isolation check passed (no runtime imports from legacy folders)."
