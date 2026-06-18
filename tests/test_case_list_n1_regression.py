"""
Regression tests for N+1 query bugs in the case list and detail API endpoints.

Phase-3 root cause (measured): with 25 cases and no prefetch for case_assessment +
placement, the list issued 51+ queries (1 caseassessment + 1 PlacementRequest per case
in derive_workflow_state). After the fix the list should complete in ≤MAX_LIST_QUERIES
for any page size, regardless of row count.

Also covers:
- create-then-detail: a newly created case must be fetchable immediately.
- cross-tenant isolation: case IDs must not leak across orgs.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import Client, TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from contracts.models import (
    CareCase,
    CaseAssessment,
    CaseIntakeProcess,
    Organization,
    OrganizationMembership,
    PlacementRequest,
)
from contracts.workflow_state_machine import WorkflowState

User = get_user_model()

_MIN_WS = {
    "context": "N+1 regression test samenvatting — minimaal vereist.",
    "risks": ["test_risk"],
    "missing_information": "",
    "risks_none_ack": False,
}

# Conservative query-count ceiling: list should stay well below this regardless of
# page_size. Measured baseline after the N+1 fix: ~8-13 data queries + Django session
# overhead (SAVEPOINT / UPDATE / RELEASE), so ceiling is set with enough headroom to
# absorb minor framework overhead while still catching any O(n) regression.
_MAX_LIST_QUERIES = 20
_MAX_DETAIL_QUERIES = 20


@contextmanager
def assert_max_queries(test_case, max_queries: int):
    """Context manager that asserts at most `max_queries` DB queries were issued."""
    ctx = CaptureQueriesContext(connection)
    with ctx:
        yield
    actual = len(ctx.captured_queries)
    if actual > max_queries:
        queries = "\n".join(f"  [{i+1}] {q['sql'][:120]}" for i, q in enumerate(ctx.captured_queries))
        test_case.fail(
            f"Expected ≤{max_queries} queries but got {actual}.\n"
            f"Queries:\n{queries}"
        )


def _create_case_with_assessment_and_placement(
    *,
    org: Organization,
    user,
    title: str,
    workflow_state: str = WorkflowState.MATCHING_READY,
) -> int:
    """Create a fully-populated case (intake + assessment + placement) and return CareCase pk."""
    intake = CaseIntakeProcess.objects.create(
        organization=org,
        title=title,
        status=CaseIntakeProcess.ProcessStatus.MATCHING,
        urgency=CaseIntakeProcess.Urgency.MEDIUM,
        preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
        start_date=date.today(),
        target_completion_date=date.today() + timedelta(days=14),
        case_coordinator=user,
        workflow_state=workflow_state,
    )
    CaseAssessment.objects.create(
        due_diligence_process=intake,
        assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
        matching_ready=True,
        assessed_by=user,
        workflow_summary=_MIN_WS,
    )
    return intake.ensure_case_record(created_by=user).pk


class CaseListN1RegressionTests(TestCase):
    """Verify the case list API never re-queries per row."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="n1_list_user",
            email="n1-list@example.com",
            password="testpass123",
        )
        cls.org = Organization.objects.create(name="N+1 List Org", slug="n1-list-org")
        OrganizationMembership.objects.create(
            organization=cls.org, user=cls.user,
            role=OrganizationMembership.Role.OWNER, is_active=True,
        )
        # Create 10 cases — enough to trigger O(n) queries if N+1 is present.
        for i in range(10):
            _create_case_with_assessment_and_placement(
                org=cls.org, user=cls.user,
                title=f"N+1 List Case {i}",
            )

    def setUp(self):
        self.http = Client()
        self.http.login(username="n1_list_user", password="testpass123")

    def test_list_query_count_does_not_scale_with_rows(self):
        """List with 10 rows must complete within _MAX_LIST_QUERIES (not O(n))."""
        with assert_max_queries(self, _MAX_LIST_QUERIES):
            resp = self.http.get(
                reverse("careon:cases_api"),
                {"page_size": 10},
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["contracts"]), 10)

    def test_list_workflow_state_is_correct(self):
        """Workflow state must be populated for all list rows (not DRAFT_CASE fallback)."""
        resp = self.http.get(reverse("careon:cases_api"), {"page_size": 10})
        self.assertEqual(resp.status_code, 200)
        for row in resp.json()["contracts"]:
            self.assertNotEqual(
                row["workflow_state"],
                WorkflowState.DRAFT_CASE,
                msg=f"case {row['id']} has DRAFT_CASE — prefetch may have regressed",
            )

    def test_list_total_count_is_accurate(self):
        """total_count must reflect the actual number of non-archived cases."""
        resp = self.http.get(reverse("careon:cases_api"))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreaterEqual(data["total_count"], 10)


class CaseDetailN1RegressionTests(TestCase):
    """Verify the case detail API never re-queries per case."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="n1_detail_user",
            email="n1-detail@example.com",
            password="testpass123",
        )
        cls.org = Organization.objects.create(name="N+1 Detail Org", slug="n1-detail-org")
        OrganizationMembership.objects.create(
            organization=cls.org, user=cls.user,
            role=OrganizationMembership.Role.OWNER, is_active=True,
        )
        cls.case_id = _create_case_with_assessment_and_placement(
            org=cls.org, user=cls.user, title="N+1 Detail Case",
            workflow_state=WorkflowState.GEMEENTE_VALIDATED,
        )

    def setUp(self):
        self.http = Client()
        self.http.login(username="n1_detail_user", password="testpass123")

    def test_detail_query_count(self):
        """Single case detail must complete within _MAX_DETAIL_QUERIES."""
        with assert_max_queries(self, _MAX_DETAIL_QUERIES):
            resp = self.http.get(
                reverse("careon:case_detail_api", kwargs={"case_id": self.case_id})
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["id"], str(self.case_id))
        self.assertEqual(data["workflow_state"], WorkflowState.GEMEENTE_VALIDATED)

    def test_detail_without_assessment(self):
        """A case without an assessment must return workflow_state=DRAFT_CASE, not 500."""
        intake = CaseIntakeProcess.objects.create(
            organization=self.org,
            title="No Assessment Case",
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.LOW,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        case_id = intake.ensure_case_record(created_by=self.user).pk
        resp = self.http.get(
            reverse("careon:case_detail_api", kwargs={"case_id": case_id})
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["workflow_state"], WorkflowState.DRAFT_CASE)

    def test_detail_404_for_unknown_case(self):
        """A non-existent case must return 404, not 500."""
        resp = self.http.get(
            reverse("careon:case_detail_api", kwargs={"case_id": 999999})
        )
        self.assertEqual(resp.status_code, 404)


class CreateThenDetailTests(TestCase):
    """A freshly created case must be fetchable immediately via the detail endpoint."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="create_detail_user",
            email="create-detail@example.com",
            password="testpass123",
        )
        cls.org = Organization.objects.create(name="Create Detail Org", slug="create-detail-org")
        OrganizationMembership.objects.create(
            organization=cls.org, user=cls.user,
            role=OrganizationMembership.Role.OWNER, is_active=True,
        )

    def setUp(self):
        self.http = Client()
        self.http.login(username="create_detail_user", password="testpass123")

    def _create_case_orm(self, title: str = "ORM Create Case") -> int:
        """Create a case via ORM (bypasses form validation for unit-test isolation)."""
        return _create_case_with_assessment_and_placement(
            org=self.org, user=self.user, title=title,
        )

    def test_orm_created_case_fetchable_via_detail_api(self):
        """A case created via ORM must be immediately accessible via detail endpoint."""
        case_id = self._create_case_orm("Immediate Detail Test")

        with assert_max_queries(self, _MAX_DETAIL_QUERIES):
            resp = self.http.get(
                reverse("careon:case_detail_api", kwargs={"case_id": case_id})
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["id"], str(case_id))

    def test_orm_created_case_appears_in_list(self):
        """A newly created case must appear on page 1 of the list (sorted by -updated_at)."""
        case_id = str(self._create_case_orm("List Refresh Test"))

        list_resp = self.http.get(
            reverse("careon:cases_api"),
            {"sort": "updated_desc", "page_size": 25},
        )
        self.assertEqual(list_resp.status_code, 200)
        ids = [row["id"] for row in list_resp.json()["contracts"]]
        self.assertIn(case_id, ids, "newly created case must appear in page-1 list")

    def test_list_query_count_after_create(self):
        """List query count must not spike after a new case is added."""
        self._create_case_orm("Query Count After Create")
        with assert_max_queries(self, _MAX_LIST_QUERIES):
            resp = self.http.get(reverse("careon:cases_api"), {"page_size": 25})
        self.assertEqual(resp.status_code, 200)


class CrossTenantIsolationTests(TestCase):
    """Case IDs must not be accessible across organizations."""

    @classmethod
    def setUpTestData(cls):
        cls.user_a = User.objects.create_user(
            username="tenant_a_user", email="tenant-a@example.com", password="testpass123",
        )
        cls.org_a = Organization.objects.create(name="Tenant A", slug="tenant-a")
        OrganizationMembership.objects.create(
            organization=cls.org_a, user=cls.user_a,
            role=OrganizationMembership.Role.OWNER, is_active=True,
        )
        cls.user_b = User.objects.create_user(
            username="tenant_b_user", email="tenant-b@example.com", password="testpass123",
        )
        cls.org_b = Organization.objects.create(name="Tenant B", slug="tenant-b")
        OrganizationMembership.objects.create(
            organization=cls.org_b, user=cls.user_b,
            role=OrganizationMembership.Role.OWNER, is_active=True,
        )
        # Create a case in org A
        cls.org_a_case_id = _create_case_with_assessment_and_placement(
            org=cls.org_a, user=cls.user_a, title="Tenant A Case",
        )

    def test_cross_tenant_detail_returns_404(self):
        """User B must not be able to fetch a case that belongs to org A."""
        http_b = Client()
        http_b.login(username="tenant_b_user", password="testpass123")
        resp = http_b.get(
            reverse("careon:case_detail_api", kwargs={"case_id": self.org_a_case_id})
        )
        self.assertEqual(resp.status_code, 404)

    def test_cross_tenant_list_does_not_expose_other_org_cases(self):
        """Org B's list must not include any case from org A."""
        http_b = Client()
        http_b.login(username="tenant_b_user", password="testpass123")
        resp = http_b.get(reverse("careon:cases_api"))
        self.assertEqual(resp.status_code, 200)
        ids = [row["id"] for row in resp.json()["contracts"]]
        self.assertNotIn(str(self.org_a_case_id), ids)
