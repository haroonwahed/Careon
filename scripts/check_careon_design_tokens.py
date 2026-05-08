#!/usr/bin/env python3
"""Guardrail: detect hardcoded CareOn design-token drift in care UI files.

Scans: client/src/components/care/**/*.ts,tsx
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Pattern, Sequence, Tuple


ROOT = Path(__file__).resolve().parents[1]
CARE_DIR = ROOT / "client" / "src" / "components" / "care"
FILE_EXTENSIONS = {".ts", ".tsx"}


@dataclass(frozen=True)
class Rule:
    name: str
    severity: str
    pattern: Pattern[str]


# Default is strict. Add precise allowlist entries only when justified.
# Each tuple is (relative_file_path, 1-based line_number).
ALLOWLIST_EXACT: set[Tuple[str, int]] = set()


RULES: Sequence[Rule] = (
    # P0: critical token discipline violations
    Rule("hex-color", "P0", re.compile(r"#[0-9a-fA-F]{3,8}\b")),
    Rule("rgba-color", "P0", re.compile(r"rgba\s*\(")),
    Rule("tailwind-white-alpha", "P0", re.compile(r"(?:border|bg|text)-white/\[[^\]]+\]")),
    Rule("arbitrary-shadow", "P0", re.compile(r"shadow-\[[^\]]+\]")),
    # P1: known legacy CareOn classes
    Rule("legacy-text-base", "P1", re.compile(r"\btext-[a-z0-9-]+-base\b")),
    Rule("legacy-bg-light", "P1", re.compile(r"\bbg-[a-z0-9-]+-light\b")),
    Rule("legacy-border-border", "P1", re.compile(r"\bborder-[a-z0-9]{3,}-border\b")),
    Rule("legacy-careon-alert", "P1", re.compile(r"\bcareon-alert-[a-z0-9-]+\b")),
    Rule("legacy-careon-badge", "P1", re.compile(r"\bcareon-badge-[a-z0-9-]+\b")),
)


def iter_target_files() -> Sequence[Path]:
    if not CARE_DIR.exists():
        return []
    return sorted(
        p
        for p in CARE_DIR.rglob("*")
        if p.is_file() and p.suffix in FILE_EXTENSIONS
    )


def is_allowlisted(relative_path: str, line_no: int) -> bool:
    return (relative_path, line_no) in ALLOWLIST_EXACT


def main() -> int:
    files = iter_target_files()
    if not files:
        print(f"No files found under {CARE_DIR}")
        return 0

    by_severity: Dict[str, List[str]] = {"P0": [], "P1": [], "P2": []}
    counts: Dict[str, int] = {"P0": 0, "P1": 0, "P2": 0}

    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            print(f"Skipping non-utf8 file: {relative}")
            continue

        for idx, line in enumerate(lines, start=1):
            for rule in RULES:
                for match in rule.pattern.finditer(line):
                    if is_allowlisted(relative, idx):
                        continue
                    matched_text = match.group(0)
                    message = f"{relative}:{idx} [{rule.severity}] {rule.name}: {matched_text}"
                    by_severity[rule.severity].append(message)
                    counts[rule.severity] += 1

    total = sum(counts.values())
    if total == 0:
        print("PASS: No CareOn design-token guardrail violations found.")
        return 0

    print("FAIL: CareOn design-token guardrail violations found.\n")
    for severity in ("P0", "P1", "P2"):
        items = by_severity[severity]
        print(f"{severity}: {len(items)}")
        for item in items:
            print(f"  - {item}")
        print("")

    print("Tip: run this in CI via `npm run check:careon-design`.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
