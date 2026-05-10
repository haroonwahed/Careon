import os
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

User = get_user_model()


class BuildInfoTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.staff = User.objects.create_user(
            username="staff_buildinfo",
            password="pw-test-build-info",
            email="staff_buildinfo@example.com",
            is_staff=True,
        )
        self.regular = User.objects.create_user(
            username="user_buildinfo",
            password="pw-test-build-info",
            email="user_buildinfo@example.com",
            is_staff=False,
        )

    def test_anonymous_redirects_to_login(self):
        response = self.client.get(reverse("build_info"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/login/", response.url)

    def test_non_staff_forbidden(self):
        self.client.login(username="user_buildinfo", password="pw-test-build-info")
        response = self.client.get(reverse("build_info"))
        self.assertEqual(response.status_code, 403)

    @patch.dict(os.environ, {"CAREON_GIT_SHA": "deadbeefcafe"}, clear=False)
    def test_staff_receives_json_payload(self):
        self.client.login(username="staff_buildinfo", password="pw-test-build-info")
        response = self.client.get(reverse("build_info"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "private, no-store")
        payload = response.json()
        self.assertEqual(payload["schema"], 2)
        self.assertEqual(payload["commit_sha"], "deadbeefcafe")
        self.assertIn("deploy_timestamp", payload)
        self.assertIn("environment", payload)
        self.assertIn("seed_version", payload)
        self.assertIn("migration_version", payload)
        self.assertIn("contracts", payload["migration_version"])
        self.assertIsNotNone(payload["migration_version"]["contracts"])
        self.assertGreater(payload["migrations_applied_total"], 0)
        self.assertTrue(payload["django_settings_module"])
        self.assertIn(payload["feature_freeze_phase"], ("active", "lifted"))
        self.assertIn("latest_rehearsal_run", payload)
        self.assertIn("latest_failed_request", payload)
