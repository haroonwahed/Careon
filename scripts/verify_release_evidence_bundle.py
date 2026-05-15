#!/usr/bin/env python3
"""Validate ``release_evidence_bundle.json`` shape (CI / local sanity after pilot rehearsal)."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "reports/release_evidence_bundle.json")
    if not path.is_file():
        print(f"verify_release_evidence_bundle: missing file {path}", file=sys.stderr)
        return 1
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"verify_release_evidence_bundle: invalid JSON {path}: {e}", file=sys.stderr)
        return 1

    missing_top = [k for k in ("sources", "timeline_evidence", "timeline_gate") if k not in data]
    if missing_top:
        print(f"verify_release_evidence_bundle: missing keys {missing_top} in {path}", file=sys.stderr)
        return 1

    tg = data.get("timeline_gate")
    if not isinstance(tg, dict) or "go" not in tg:
        print(f"verify_release_evidence_bundle: invalid timeline_gate in {path}", file=sys.stderr)
        return 1

    print(f"verify_release_evidence_bundle: OK — {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
