#!/usr/bin/env python3
"""
Guard: block new imports of Forbidden/Deprecated components.

Status source: docs/design/CARELANE_COMPONENT_REGISTER.md
Phase 1 rule: existing importers are grandfathered; NEW imports fail CI.

Exit codes:
  0 — no violations
  1 — new (non-grandfathered) imports found

Usage:
  python scripts/check_component_register_imports.py [--changed-only]

  --changed-only: only scan files listed on stdin (one path per line, e.g.
                  `git diff --name-only HEAD | python scripts/...`).
                  Without the flag, scans all client/src/**/*.{ts,tsx}.
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CLIENT_SRC = REPO_ROOT / 'client' / 'src'

# ---------------------------------------------------------------------------
# Forbidden files — do not extend or import (per component register §5)
# ---------------------------------------------------------------------------
FORBIDDEN_FILES = {
    'CareCommandPrimitives',
    'CasusControlCenter',
    'CoordinationControlCenter',
}

# ---------------------------------------------------------------------------
# Key Deprecated files with 0 current importers (register §4)
# Adding an import of these is always a violation (no allowlist needed).
# ---------------------------------------------------------------------------
DEPRECATED_ZERO_IMPORTER_FILES = {
    'DominantActionPanel',
    'RecommendedActionBlock',
    'EmptyState',
    'PageHeader',
    'SectionHeader',
    'KPICard',
    'StatusBadge',
    'LoadingSkeleton',
    'WorkflowPlaceholder',
}

# ---------------------------------------------------------------------------
# Grandfather allowlist — existing imports allowed until the migration lands.
# Format: frozenset of relative paths from REPO_ROOT (forward slashes).
# ---------------------------------------------------------------------------
_GRANDFATHER = frozenset([
    # CareCommandPrimitives importers (22 files as of Phase 1)
    'client/src/components/care/AanbiederPortaalPage.tsx',
    'client/src/components/care/AanbiederreactiePage.tsx',
    'client/src/components/care/AccessDeniedPage.tsx',
    'client/src/components/care/ActiesPage.tsx',
    'client/src/components/care/AssessmentQueuePage.tsx',
    'client/src/components/care/AudittrailPage.tsx',
    'client/src/components/care/CoordinationControlCenter.tsx',
    'client/src/components/care/DocumentenPage.tsx',
    'client/src/components/care/GebruikersPage.tsx',
    'client/src/components/care/GemeentenPage.tsx',
    'client/src/components/care/IntakeListPage.tsx',
    'client/src/components/care/MatchingQueuePage.tsx',
    'client/src/components/care/PlacementPage.tsx',
    'client/src/components/care/PlacementTrackingPage.tsx',
    'client/src/components/care/ProviderProfilePage.tsx',
    'client/src/components/care/RapportagesPage.tsx',
    'client/src/components/care/RegiosPage.tsx',
    'client/src/components/care/SignalenPage.tsx',
    'client/src/components/care/SystemAwarenessPage.tsx',
    'client/src/components/care/WorkloadPage.tsx',
    'client/src/components/care/ZorgaanbiedersPage.tsx',
    'client/src/components/care/settings/InstellingenSettingsExperience.tsx',
])

# Pattern: import { ... } from ".../ComponentName" or import ".../ComponentName"
_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+|import\s+)['"](.*?)['"]""",
    re.MULTILINE,
)


def _get_component_name(import_path: str) -> str:
    """Extract the basename (without extension) from an import path."""
    return import_path.rstrip('/').rsplit('/', 1)[-1].split('.')[0]


def scan_file(path: Path) -> list[str]:
    """Return list of violation descriptions for the given file."""
    rel = str(path.relative_to(REPO_ROOT)).replace('\\', '/')
    if rel in _GRANDFATHER:
        return []
    text = path.read_text(encoding='utf-8', errors='replace')
    violations = []
    for m in _IMPORT_RE.finditer(text):
        comp = _get_component_name(m.group(1))
        if comp in FORBIDDEN_FILES:
            violations.append(
                f'{rel}: imports Forbidden component {comp!r} — see CARELANE_COMPONENT_REGISTER.md §5'
            )
        elif comp in DEPRECATED_ZERO_IMPORTER_FILES:
            violations.append(
                f'{rel}: imports Deprecated (0-importer) component {comp!r} — see CARELANE_COMPONENT_REGISTER.md §4'
            )
    return violations


def main() -> int:
    changed_only = '--changed-only' in sys.argv

    if changed_only:
        paths = []
        for line in sys.stdin:
            p = REPO_ROOT / line.strip()
            if p.suffix in {'.ts', '.tsx'} and p.exists():
                paths.append(p)
    else:
        paths = list(CLIENT_SRC.rglob('*.ts')) + list(CLIENT_SRC.rglob('*.tsx'))
        # Skip test files — they may legitimately import Forbidden files to assert they aren't used
        paths = [p for p in paths if '.test.' not in p.name and '.spec.' not in p.name]

    violations: list[str] = []
    for path in sorted(paths):
        violations.extend(scan_file(path))

    if violations:
        print('FAIL — new imports of Forbidden/Deprecated components detected:')
        for v in violations:
            print(f'  {v}')
        print()
        print('These components must not be imported in new code.')
        print('See docs/design/CARELANE_COMPONENT_REGISTER.md for the full list and migration path.')
        return 1

    print(f'OK — no new Forbidden/Deprecated component imports ({len(paths)} files scanned)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
