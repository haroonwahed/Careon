"""
Carelane load test — Locust script.

Simulates the two primary user roles (gemeente, zorgaanbieder) and an anonymous
health-check prober at realistic concurrency for the Render free-tier deployment
(1–2 gunicorn workers, target: 10–25 concurrent users).

Usage:
  pip install -r requirements/loadtest.txt

  # Headless against staging (recommended):
  GEMEENTE_USER=demo_gemeente GEMEENTE_PASS=pilot_demo_pass_123 \\
  PROVIDER_USER=demo_aanbieder1 PROVIDER_PASS=pilot_demo_pass_123 \\
  locust -f scripts/loadtest.py --headless \\
    --host https://carelane-staging.onrender.com \\
    --users 15 --spawn-rate 2 --run-time 3m

  # Interactive UI:
  locust -f scripts/loadtest.py --host http://localhost:8000

  # Against local dev server (uses default demo credentials):
  locust -f scripts/loadtest.py --host http://localhost:8000 --users 5 --spawn-rate 1 --run-time 1m

Environment variables:
  GEMEENTE_USER   gemeente demo username  (default: demo_gemeente)
  GEMEENTE_PASS   gemeente demo password  (default: pilot_demo_pass_123)
  PROVIDER_USER   provider demo username  (default: demo_aanbieder1)
  PROVIDER_PASS   provider demo password  (default: pilot_demo_pass_123)

Thresholds (Render free tier, 1 worker):
  p95 latency: ≤ 2000 ms for read routes
  error rate:  < 1%
  Sustainable: ~10 concurrent gemeente users, ~5 provider users
"""
from __future__ import annotations

import json
import os
import re

from locust import HttpUser, between, task, events


_GEMEENTE_USER = os.getenv("GEMEENTE_USER", "demo_gemeente")
_GEMEENTE_PASS = os.getenv("GEMEENTE_PASS", "pilot_demo_pass_123")
_PROVIDER_USER = os.getenv("PROVIDER_USER", "demo_aanbieder1")
_PROVIDER_PASS = os.getenv("PROVIDER_PASS", "pilot_demo_pass_123")


def _get_csrf_token(client) -> str:
    """Extract csrftoken cookie set by any prior response."""
    cookie = client.cookies.get("csrftoken", "")
    return cookie


def _login(client, username: str, password: str) -> bool:
    """POST to JSON login endpoint, return True on success."""
    # First hit the dashboard to get the CSRF cookie.
    client.get("/care/", name="/care/ [CSRF seed]")
    csrf = _get_csrf_token(client)

    resp = client.post(
        "/care/api/auth/login/",
        json={"username": username, "password": password},
        headers={"X-CSRFToken": csrf},
        name="/care/api/auth/login/",
        catch_response=True,
    )
    if resp.status_code == 200:
        resp.success()
        return True
    resp.failure(f"Login failed: {resp.status_code} — {resp.text[:120]}")
    return False


def _first_case_id(client) -> int | None:
    """Return the first case ID from the cases API, or None."""
    resp = client.get("/care/api/cases/", name="/care/api/cases/", catch_response=True)
    if resp.status_code != 200:
        resp.failure(f"cases_api {resp.status_code}")
        return None
    resp.success()
    data = resp.json()
    cases = data.get("cases") or data.get("contracts") or data.get("results") or []
    if cases and isinstance(cases[0], dict):
        return cases[0].get("id") or cases[0].get("pk")
    return None


class GemeenteUser(HttpUser):
    """
    Simulates a gemeente regisseur browsing their caseload.
    Most frequent real pattern: dashboard → cases list → case detail → assessment.
    Wait between tasks mirrors human reading time.
    """
    weight = 3
    wait_time = between(1, 4)

    def on_start(self):
        self._logged_in = _login(self.client, _GEMEENTE_USER, _GEMEENTE_PASS)
        self._case_id = None

    @task(5)
    def dashboard(self):
        self.client.get("/care/", name="/care/ [SPA shell]")

    @task(8)
    def cases_list_api(self):
        resp = self.client.get("/care/api/cases/", name="/care/api/cases/")
        if resp.status_code == 200 and self._case_id is None:
            data = resp.json()
            cases = data.get("cases") or data.get("contracts") or data.get("results") or []
            if cases and isinstance(cases[0], dict):
                self._case_id = cases[0].get("id") or cases[0].get("pk")

    @task(4)
    def case_detail_api(self):
        if self._case_id is None:
            self._case_id = _first_case_id(self.client)
        if self._case_id:
            self.client.get(
                f"/care/api/cases/{self._case_id}/summary/",
                name="/care/api/cases/<id>/summary/",
            )

    @task(3)
    def casussen_spa_route(self):
        self.client.get("/care/casussen/", name="/care/casussen/ [redirect]")

    @task(2)
    def coordination_spa(self):
        self.client.get("/coordination/", name="/coordination/ [SPA shell]")

    @task(1)
    def health_check(self):
        with self.client.get("/_health/", name="/_health/", catch_response=True) as resp:
            if resp.status_code == 200 and resp.text.strip() == "OK":
                resp.success()
            else:
                resp.failure(f"health {resp.status_code}: {resp.text[:40]}")


class ProviderUser(HttpUser):
    """
    Simulates a zorgaanbieder reviewing their assigned cases.
    Lighter read pattern: evaluations list + placement detail.
    """
    weight = 2
    wait_time = between(2, 6)

    def on_start(self):
        self._logged_in = _login(self.client, _PROVIDER_USER, _PROVIDER_PASS)
        self._case_id = None

    @task(5)
    def dashboard(self):
        self.client.get("/care/", name="/care/ [SPA shell]")

    @task(6)
    def cases_list_api(self):
        resp = self.client.get("/care/api/cases/", name="/care/api/cases/")
        if resp.status_code == 200 and self._case_id is None:
            data = resp.json()
            cases = data.get("cases") or data.get("contracts") or data.get("results") or []
            if cases and isinstance(cases[0], dict):
                self._case_id = cases[0].get("id") or cases[0].get("pk")

    @task(3)
    def case_evaluations(self):
        if self._case_id is None:
            self._case_id = _first_case_id(self.client)
        if self._case_id:
            self.client.get(
                f"/care/api/cases/{self._case_id}/evaluations/",
                name="/care/api/cases/<id>/evaluations/",
            )

    @task(2)
    def provider_workspace_spa(self):
        self.client.get("/care/beoordelingen/", name="/care/beoordelingen/ [SPA]")

    @task(1)
    def health_check(self):
        self.client.get("/_health/", name="/_health/")


@events.quitting.add_listener
def _summarise(environment, **_kwargs):
    """Print a pass/fail summary against the defined thresholds."""
    stats = environment.runner.stats.total
    if stats.num_requests == 0:
        print("\n[loadtest] No requests recorded — check credentials and host.")
        return

    p95 = stats.get_response_time_percentile(0.95) or 0
    error_pct = (stats.num_failures / stats.num_requests) * 100 if stats.num_requests else 0

    print("\n" + "=" * 60)
    print("Carelane load test — summary")
    print(f"  Requests:      {stats.num_requests}")
    print(f"  Failures:      {stats.num_failures}  ({error_pct:.1f}%)")
    print(f"  p95 latency:   {p95:.0f} ms")
    print(f"  RPS (avg):     {stats.total_rps:.1f}")

    threshold_p95_ms = 2000
    threshold_error_pct = 1.0
    ok = True
    if p95 > threshold_p95_ms:
        print(f"  ⚠ p95 {p95:.0f} ms exceeds threshold {threshold_p95_ms} ms")
        ok = False
    if error_pct > threshold_error_pct:
        print(f"  ⚠ error rate {error_pct:.1f}% exceeds threshold {threshold_error_pct}%")
        ok = False
    if ok:
        print(f"  ✓ p95 ≤ {threshold_p95_ms} ms, error rate < {threshold_error_pct}%")
    print("=" * 60)

    if not ok:
        environment.process_exit_code = 1
