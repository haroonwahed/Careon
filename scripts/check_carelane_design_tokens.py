#!/usr/bin/env python3
"""Guardrail: detect hardcoded Carelane design-token drift in care UI files.

Scans: client/src/components/care/**/*.ts,tsx

Usage:
  python scripts/check_carelane_design_tokens.py           # scan all care files
  python scripts/check_carelane_design_tokens.py f1 f2...  # scan specific files (CI diff mode)
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

# File-level grandfather — these files are known offenders from before Phase 1.
# They are EXCLUDED from the diff-scoped CI scan so existing violations do not
# block PRs. Remove from this list once the file is refactored onto tokens.
FILE_ALLOWLIST: set[str] = {
    'client/src/components/care/LoginPage.tsx',           # 37 style={{}} / 27 hex — priority refactor
    'client/src/components/care/SystemAwarenessPage.tsx', # 10 inline / 5 hex — SVG phase colors
}


RULES: Sequence[Rule] = (
    # P0: critical token discipline violations
    Rule("hex-color", "P0", re.compile(r"#[0-9a-fA-F]{3,8}\b")),
    Rule("rgba-color", "P0", re.compile(r"rgba\s*\(")),
    Rule("tailwind-white-alpha", "P0", re.compile(r"(?:border|bg|text)-white/\[[^\]]+\]")),
    Rule("arbitrary-shadow", "P0", re.compile(r"shadow-\[[^\]]+\]")),
    # P1: known legacy Carelane classes
    Rule("legacy-text-base", "P1", re.compile(r"\btext-[a-z0-9-]+-base\b")),
    Rule("legacy-bg-light", "P1", re.compile(r"\bbg-[a-z0-9-]+-light\b")),
    Rule("legacy-border-border", "P1", re.compile(r"\bborder-[a-z0-9]{3,}-border\b")),
    Rule("legacy-carelane-alert", "P1", re.compile(r"\bcarelane-alert-[a-z0-9-]+\b")),
    Rule("legacy-carelane-badge", "P1", re.compile(r"\bcarelane-badge-[a-z0-9-]+\b")),
)


def iter_target_files(specific: Sequence[str] | None = None) -> Sequence[Path]:
    if specific:
        paths = []
        for s in specific:
            p = ROOT / s if not s.startswith('/') else Path(s)
            if p.exists() and p.suffix in FILE_EXTENSIONS:
                paths.append(p)
        return sorted(paths)
    if not CARE_DIR.exists():
        return []
    return sorted(
        p
        for p in CARE_DIR.rglob("*")
        if p.is_file() and p.suffix in FILE_EXTENSIONS
    )


def is_allowlisted(relative_path: str, line_no: int) -> bool:
    if relative_path in FILE_ALLOWLIST:
        return True
    return (relative_path, line_no) in ALLOWLIST_EXACT


def main() -> int:
    specific_files = sys.argv[1:] if len(sys.argv) > 1 else None
    files = iter_target_files(specific_files)
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
        print("PASS: No Carelane design-token guardrail violations found.")
        return 0

    print("FAIL: Carelane design-token guardrail violations found.\n")
    for severity in ("P0", "P1", "P2"):
        items = by_severity[severity]
        print(f"{severity}: {len(items)}")
        for item in items:
            print(f"  - {item}")
        print("")

    print("Tip: run this in CI via `npm run check:carelane-design`.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
