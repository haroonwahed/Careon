from pathlib import Path
from unittest import TestCase


REPO_ROOT = Path(__file__).resolve().parents[1]


class ProductArchitectureGuardrailTests(TestCase):
    def _read_text(self, relative_path: str) -> str:
        return (REPO_ROOT / relative_path).read_text(encoding='utf-8')

    def _assert_contains_all(self, text: str, expected: list[str]) -> None:
        for needle in expected:
            self.assertIn(needle, text)

    def test_foundation_lock_documents_v1_3_canonical_flow(self):
        foundation_lock = self._read_text('docs/FOUNDATION_LOCK.md')
        self._assert_contains_all(
            foundation_lock,
            [
                '## Canonical product flow (v1.3)',
                'Aanmelding',
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
