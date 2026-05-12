from unittest import TestCase

import pytest

from scripts.render_startup_checks import validate_database_url

pytestmark = pytest.mark.no_database


class RenderStartupChecksTests(TestCase):
    def test_rejects_supabase_pooler_url_with_plain_postgres_username(self) -> None:
        ok, message = validate_database_url(
            "postgres://postgres:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
        )

        self.assertFalse(ok)
        self.assertIn("postgres.<project-ref>", message)
        self.assertIn("Current shape: postgres://postgres@aws-0-eu-west-1.pooler.supabase.com:5432/postgres", message)

    def test_accepts_supabase_pooler_url_with_project_username(self) -> None:
        ok, message = validate_database_url(
            "postgres://postgres.example-project:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
        )

        self.assertTrue(ok)
        self.assertIn("DATABASE_URL detected", message)
        self.assertIn("postgres.example-project@aws-0-eu-west-1.pooler.supabase.com:5432/postgres", message)

    def test_accepts_url_wrapped_in_double_quotes(self) -> None:
        ok, message = validate_database_url(
            '"postgresql://postgres.example-project:secret@db.example.com:5432/postgres"'
        )

        self.assertTrue(ok)
        self.assertIn("postgres.example-project@db.example.com:5432/postgres", message)

    def test_scheme_error_hints_when_postgres_url_is_embedded(self) -> None:
        ok, message = validate_database_url(
            ':5432/postgres"postgresql://postgres.example-project:secret@db.example.com:5432/postgres'
        )

        self.assertFalse(ok)
        self.assertIn("not at the start", message)
