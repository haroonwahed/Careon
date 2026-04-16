from pathlib import Path

from django.test import SimpleTestCase
from django.urls import reverse


class AuthStyleIntegrityTests(SimpleTestCase):
    def setUp(self):
        self.repo_root = Path(__file__).resolve().parent.parent
        self.auth_templates = [
            self.repo_root / "theme" / "templates" / "registration" / "login.html",
            self.repo_root / "theme" / "templates" / "registration" / "register.html",
            self.repo_root / "theme" / "templates" / "registration" / "logout.html",
            self.repo_root / "theme" / "templates" / "base_fullscreen.html",
            self.repo_root / "theme" / "templates" / "landing.html",
        ]
        self.ds_css_path = self.repo_root / "theme" / "static" / "css" / "zorgregie-design-system.css"

    def test_auth_templates_do_not_use_hash_class_names(self):
        offenders = []
        for template_path in self.auth_templates:
            content = template_path.read_text(encoding="utf-8")
            if "ds-i-" in content:
                offenders.append(template_path.name)

        self.assertEqual(
            offenders,
            [],
            msg=(
                "Auth templates must not depend on unresolved hash classes. "
                f"Found 'ds-i-' usage in: {', '.join(offenders)}"
            ),
        )

    def test_auth_semantic_selectors_exist_in_design_system_css(self):
        css = self.ds_css_path.read_text(encoding="utf-8")
        required_selectors = [
            ".auth-page-body",
            ".auth-frame",
            ".auth-card-shell",
            ".auth-shell",
            ".login-panel-left",
            ".login-panel-right",
            ".login-input",
            ".glow-btn",
            ".auth-error-box",
            ".auth-sso-btn",
            ".auth-logout-card",
            ".auth-logout-icon-wrap",
            ".landing-shell-bg",
            ".landing-nav",
            ".landing-brand-badge",
            ".landing-gradient-text",
            ".landing-module-icon-box",
            ".landing-security-card",
            ".landing-cta-backdrop",
            ".landing-footer-divider",
        ]

        missing = [selector for selector in required_selectors if selector not in css]
        self.assertEqual(
            missing,
            [],
            msg=(
                "Design system CSS is missing required auth selectors: "
                f"{', '.join(missing)}"
            ),
        )

    def test_landing_page_renders_semantic_class_hooks(self):
        response = self.client.get(reverse("index"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "landing-shell-bg")
        self.assertContains(response, "landing-nav")
        self.assertNotContains(response, "ds-i-")
