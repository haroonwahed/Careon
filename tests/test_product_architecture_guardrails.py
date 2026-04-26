from pathlib import Path

from django.test import SimpleTestCase


REPO_ROOT = Path(__file__).resolve().parents[1]


class ProductArchitectureGuardrailTests(SimpleTestCase):
    def _read_text(self, relative_path: str) -> str:
        return (REPO_ROOT / relative_path).read_text(encoding='utf-8')

    def _assert_contains_all(self, text: str, expected: list[str]) -> None:
        for needle in expected:
            self.assertIn(needle, text)

    def _assert_active_sources_do_not_contain(self, needles: list[str]) -> None:
        active_roots = [
            REPO_ROOT / 'contracts',
            REPO_ROOT / 'client' / 'src' / 'components',
            REPO_ROOT / 'theme' / 'templates' / 'contracts',
            REPO_ROOT / 'config',
        ]
        ignored_suffixes = {'.pyc', '.png', '.jpg', '.jpeg', '.gif', '.svg'}

        for root in active_roots:
            for path in root.rglob('*'):
                if not path.is_file() or path.suffix in ignored_suffixes:
                    continue
                if path.suffix not in {'.py', '.tsx', '.ts', '.html'}:
                    continue
                content = path.read_text(encoding='utf-8')
                for needle in needles:
                    self.assertNotIn(
                        needle,
                        content,
                        msg=f'Unexpected active surface leak for "{needle}" in {path}',
                    )

    def test_foundation_lock_defers_ai_and_uitstroom_by_design(self):
        foundation_lock = self._read_text('docs/FOUNDATION_LOCK.md')
        self._assert_contains_all(
            foundation_lock,
            [
                '## Deferred By Design',
                '### AI-based anonymization',
                '### Uitstroom',
                'Do not introduce a dedicated AI anonymization route, action, or UX surface',
                'Do not create a separate first-class uitstroom model or surface',
            ],
        )

    def test_feature_inventory_marks_ai_and_uitstroom_deferred(self):
        feature_inventory = self._read_text('FEATURE_INVENTORY.md')
        self._assert_contains_all(
            feature_inventory,
            [
                '### Deferred by design',
                'AI-based anonymization',
                'Outcome handling stays in the existing placement, intake, completion, and archive flow',
                'Any future surface for either item must be added deliberately',
            ],
        )

    def test_roadmap_task_three_is_explicitly_deferred_by_design(self):
        roadmap = self._read_text('docs/PRODUCT_COMPLETENESS_ROADMAP.md')
        self._assert_contains_all(
            roadmap,
            [
                '### Task 3: Defer AI and uitstroom work',
                'AI anonymization remains deferred by design',
                'A separate uitstroom model or surface is not created',
                'Any future AI or uitstroom surface must define its route, permission, audit trail, and tests before launch.',
            ],
        )

    def test_active_user_facing_sources_do_not_expose_ai_anonymization_or_uitstroom(self):
        self._assert_active_sources_do_not_contain(
            [
                'AI anonymization',
                'anonimiseer',
                'anonimisatie',
                'uitstroom',
            ]
        )
