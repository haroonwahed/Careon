import os
from unittest import TestCase
from unittest.mock import patch

from config import settings


class DatabaseUrlParsingTests(TestCase):
    def test_relative_sqlite_url_resolves_inside_project(self) -> None:
        with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///db.sqlite3'}, clear=False):
            database_config = settings._database_config()

        self.assertEqual(database_config['ENGINE'], 'django.db.backends.sqlite3')
        self.assertEqual(database_config['NAME'], settings.BASE_DIR / 'db.sqlite3')

    def test_absolute_sqlite_url_preserves_absolute_path(self) -> None:
        with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:////tmp/careon.sqlite3'}, clear=False):
            database_config = settings._database_config()

        self.assertEqual(database_config['ENGINE'], 'django.db.backends.sqlite3')
        self.assertEqual(str(database_config['NAME']), '/tmp/careon.sqlite3')

    def test_placeholder_postgres_url_falls_back_to_sqlite(self) -> None:
        placeholder_url = (
            'postgresql://postgres.hdvdeviuncpcqsgopnae:'
            'INSERT_YOUR_SUPABASE_DB_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres'
        )
        with patch.dict(os.environ, {'DATABASE_URL': placeholder_url}, clear=False):
            database_config = settings._database_config()

        self.assertEqual(database_config['ENGINE'], 'django.db.backends.sqlite3')
        self.assertEqual(database_config['NAME'], settings.BASE_DIR / 'db.sqlite3')
