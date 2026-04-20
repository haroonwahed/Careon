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