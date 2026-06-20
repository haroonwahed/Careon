#!/usr/bin/env bash
# scripts/verify.sh — canonical local verification suite.
#
# Reproduces the CI gate locally. Run this before pushing a branch.
# Also callable via: make verify
#
# Exit code: 0 = all green, non-zero = first failing step.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$REPO_ROOT/.venv"
PYTHON="$VENV/bin/python"

echo "==> [1/7] Python tests (pytest)"
"$PYTHON" -m pytest tests/ -q --no-header

echo "==> [2/7] Python compile smoke (compileall)"
"$PYTHON" -m compileall config contracts -q

echo "==> [3/7] Terminology guard"
"$PYTHON" scripts/terminology_guard.py

echo "==> [4/7] Pyright (backend type check)"
"$PYTHON" -m pyright contracts config

echo "==> [5/7] Frontend type check (tsc)"
npm --prefix "$REPO_ROOT/client" run typecheck

echo "==> [6/7] Forbidden/Deprecated component import guard"
"$PYTHON" scripts/check_component_register_imports.py

echo "==> [7/7] Design-token governance (full scan, informational)"
"$PYTHON" scripts/check_carelane_design_tokens.py || {
  echo "  Note: full-scan token violations exist. CI only gates on changed files."
}

echo ""
echo "All steps passed."
