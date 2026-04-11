#!/usr/bin/env python3
"""Fail CI if banned legacy terminology appears in runtime-facing project files.

This guard is intentionally narrow: it blocks explicit CLM/CMS/Ironclad language
without flagging migration-compatibility symbols that are still present by design.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
import sys


@dataclass(frozen=True)
class Rule:
    name: str
    pattern: re.Pattern[str]


@dataclass(frozen=True)
class AllowlistEntry:
    path_pattern: re.Pattern[str]
    rule_names: frozenset[str]


ROOT = Path(__file__).resolve().parents[1]

# Scan runtime-facing code/docs only.
INCLUDE_DIRS = [
    "contracts",
    "config",
    "theme/templates",
    "docs",
    "ops",
    "landing",
    ".github/workflows",
    "scripts",
    "tests",
    "README.md",
    "DECISIONS.md",
]

SKIP_DIR_PARTS = {
    "theme/static_src/node_modules",
    "client/node_modules",
    ".venv",
    "venv",
    "logs",
    "staticfiles",
    "__pycache__",
}

SKIP_FILES = {
    "scripts/terminology_guard.py",
}

ALLOWED_EXTS = {
    ".py",
    ".md",
    ".html",
    ".js",
    ".yml",
    ".yaml",
    ".txt",
    ".json",
    ".sh",
}

RULES = [
    Rule("cms-aegis", re.compile(r"\bcms[-_ ]aegis\b", re.IGNORECASE)),
    Rule("cms", re.compile(r"\bcms\b", re.IGNORECASE)),
    Rule("clm", re.compile(r"\bclm\b", re.IGNORECASE)),
    Rule("ironclad", re.compile(r"\bironclad\b", re.IGNORECASE)),
    Rule("law-firm", re.compile(r"\blaw\s+firm\b", re.IGNORECASE)),
    Rule("contract-lifecycle", re.compile(r"\bcontract\s+lifecycle\b", re.IGNORECASE)),
    Rule("governing-law", re.compile(r"\bgoverning[_ ]law\b", re.IGNORECASE)),
    Rule("jurisdiction", re.compile(r"\bjurisdiction\b", re.IGNORECASE)),
]

ALLOWLIST: list[AllowlistEntry] = [
    # Historical migration files may legitimately reference legacy field names.
    AllowlistEntry(
        path_pattern=re.compile(r"^contracts/migrations/"),
        rule_names=frozenset({"governing-law", "jurisdiction"}),
    ),
]


def is_allowlisted(rel: str, rule_name: str) -> bool:
    for entry in ALLOWLIST:
        if entry.path_pattern.search(rel) and rule_name in entry.rule_names:
            return True
    return False


def iter_candidate_files() -> list[Path]:
    candidates: list[Path] = []
    for entry in INCLUDE_DIRS:
        path = ROOT / entry
        if not path.exists():
            continue
        if path.is_file():
            if path.suffix in ALLOWED_EXTS or path.name in {"README.md", "DECISIONS.md"}:
                candidates.append(path)
            continue
        for f in path.rglob("*"):
            if not f.is_file() or f.suffix not in ALLOWED_EXTS:
                continue
            rel = f.relative_to(ROOT).as_posix()
            if rel in SKIP_FILES:
                continue
            if any(part in rel for part in SKIP_DIR_PARTS):
                continue
            candidates.append(f)
    return sorted(set(candidates))


def main() -> int:
    violations: list[tuple[str, int, str, str]] = []
    for file_path in iter_candidate_files():
        rel = file_path.relative_to(ROOT).as_posix()
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for idx, line in enumerate(content.splitlines(), start=1):
            for rule in RULES:
                if rule.pattern.search(line):
                    if is_allowlisted(rel, rule.name):
                        continue
                    violations.append((rel, idx, rule.name, line.strip()))

    if not violations:
        print("Terminology guard passed: no banned legacy terms found.")
        return 0

    print("Terminology guard failed. Banned legacy terms detected:")
    for rel, line_no, rule_name, line in violations:
        print(f"- {rel}:{line_no} [{rule_name}] {line}")
        print(f"::error file={rel},line={line_no}::Banned legacy term ({rule_name}) found")
    return 1


if __name__ == "__main__":
    sys.exit(main())
