import re
from pathlib import Path
from unittest import TestCase


REPO_ROOT = Path(__file__).resolve().parents[1]

_DESIGN_NBA_IMPORT = re.compile(
    r"""^import\s+\{[^}]*\bNextBestAction\b[^}]*\}\s+from\s+['"][^'"]*design/NextBestAction['"]""",
    re.MULTILINE,
)
_DESIGN_TIMELINE_IMPORT = re.compile(
    r"""^import\s+\{[^}]*\bProcessTimeline\b[^}]*\}\s+from\s+['"][^'"]*design/ProcessTimeline['"]""",
    re.MULTILINE,
)


class ProductArchitectureGuardrailTests(TestCase):
    def _read_text(self, relative_path: str) -> str:
        return (REPO_ROOT / relative_path).read_text(encoding='utf-8')

    def _assert_contains_all(self, text: str, expected: list[str]) -> None:
        for needle in expected:
            self.assertIn(needle, text)

    def test_foundation_lock_documents_constitution_v2_canonical_flow(self):
        foundation_lock = self._read_text('docs/FOUNDATION_LOCK.md')
        self._assert_contains_all(
            foundation_lock,
            [
                '## Canonical operational flow (Constitution v2)',
                'Casus → Samenvatting → Matching → Gemeente Validatie → Aanbieder Beoordeling → Plaatsing → Intake',
                'Uitstroom',
                '## Technical implementation mapping',
            ],
        )

    def test_feature_inventory_documents_v1_3_orchestration_evolution(self):
        feature_inventory = self._read_text('FEATURE_INVENTORY.md')
        self._assert_contains_all(
            feature_inventory,
            [
                '### v1.3 product evolution (orchestration layer)',
                'Uitstroom',
            ],
        )

    def test_roadmap_task_three_is_v1_3_strategic_alignment(self):
        roadmap = self._read_text('docs/PRODUCT_COMPLETENESS_ROADMAP.md')
        self._assert_contains_all(
            roadmap,
            [
                '### Task 3: v1.3 strategic alignment (anonymization, uitstroom, arrangement intelligence)',
                'Any future persisted `UITSTROOM` state (if introduced) must define migration, API version, audit, and tests before launch.',
            ],
        )

    def test_arrangement_alignment_contract_requires_human_confirmation(self):
        contract = self._read_text('client/src/lib/arrangementAlignmentContract.ts')
        self._assert_contains_all(
            contract,
            [
                'requires_human_confirmation: true',
                'Advisory only',
            ],
        )

    def test_legacy_doc_paths_redirect_to_constitution_v2(self):
        """Bookmarks and external wikis may still point at v1.3 filenames."""
        needles = ['Careon_Operational_Constitution_v2.md', 'FOUNDATION_LOCK.md']
        for rel in (
            'docs/Zorg_OS_Product_System_Core_v1_3.md',
            'docs/Zorg_OS_Technical_Foundation_v1_3.md',
            'docs/CareOn_Design_Constitution_v1_3.md',
        ):
            text = self._read_text(rel)
            self.assertIn('(Redirect)', text)
            self._assert_contains_all(text, needles)

    def test_design_next_best_action_and_process_timeline_only_on_case_execution_page(self):
        """AGENTS.md UI mode: design NBA + process timeline only on case detail (`CaseExecutionPage`)."""
        violations: list[str] = []
        client_src = REPO_ROOT / 'client' / 'src'
        for path in sorted(client_src.rglob('*.tsx')):
            rel = path.relative_to(REPO_ROOT)
            if path.name in ('NextBestAction.tsx', 'ProcessTimeline.tsx'):
                continue
            if path.name == 'CaseExecutionPage.tsx':
                continue
            text = path.read_text(encoding='utf-8')
            if _DESIGN_NBA_IMPORT.search(text):
                violations.append(f'{rel}: imports design NextBestAction')
            if _DESIGN_TIMELINE_IMPORT.search(text):
                violations.append(f'{rel}: imports design ProcessTimeline')
        self.assertEqual(
            violations,
            [],
            msg='Design NextBestAction / ProcessTimeline must only be used from CaseExecutionPage.tsx — '
            + ('; '.join(violations) if violations else ''),
        )
