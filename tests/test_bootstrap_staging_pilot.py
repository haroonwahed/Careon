from __future__ import annotations

import os
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

User = get_user_model()


class BootstrapStagingPilotTests(TestCase):
    def test_skipped_when_bootstrap_disabled(self):
        out = StringIO()
        with patch.dict(os.environ, {"PILOT_AUTO_BOOTSTRAP": ""}, clear=False):
            call_command("bootstrap_staging_pilot", stdout=out)
        self.assertIn("skipped", out.getvalue())

    @patch("contracts.management.commands.bootstrap_staging_pilot.call_command")
    def test_syncs_passwords_when_demo_user_exists_without_force(self, mock_call):
        User.objects.create_user(username="demo_gemeente", password="unused")
        out = StringIO()
        with patch.dict(
            os.environ,
            {"PILOT_AUTO_BOOTSTRAP": "1", "PILOT_FORCE_RESET": ""},
            clear=False,
        ):
            call_command("bootstrap_staging_pilot", stdout=out)
        self.assertIn("exists", out.getvalue())
        mock_call.assert_called_once_with("seed_pilot_e2e", verbosity=1)

    @patch("contracts.management.commands.bootstrap_staging_pilot.call_command")
    def test_force_reset_when_flag_set(self, mock_call):
        User.objects.create_user(username="demo_gemeente", password="unused")
        out = StringIO()
        with patch.dict(
            os.environ,
            {"PILOT_AUTO_BOOTSTRAP": "1", "PILOT_FORCE_RESET": "1"},
            clear=False,
        ):
            call_command("bootstrap_staging_pilot", stdout=out)
        mock_call.assert_called_once_with("reset_pilot_environment", verbosity=1)
