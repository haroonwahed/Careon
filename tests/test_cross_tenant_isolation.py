"""
Cross-tenant isolation tests.

For every resource that carries an `organization` FK the suite verifies:
  - List views return ONLY the authenticated user's org records
  - Detail / Update views return 404 (not a live object) for another org's records

Models now fixed to filter via related-field org lookups (no direct FK):
    - Deadline  → filtered via related case/configuration ownership
    - CareSignal → filtered via related case/configuration ownership
    - CareTask → filtered via related case/configuration ownership
    - PlacementRequest → filtered via related provider/configuration ownership

Direct organization FK models covered in this suite:
    - Budget
    - CaseIntakeProcess

Run:
  python manage.py test tests.test_cross_tenant_isolation
"""

import datetime

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from tests.test_utils import middleware_without_spa_shell

from contracts.models import (
    CareCase,
    CaseAssessment,
    Organization,
    OrganizationMembership,
    Client,
    CareConfiguration,
    Document,
    Deadline,
    CareTask,
    CareSignal,
    PlacementRequest,
    Budget,
    CaseIntakeProcess,
    UserProfile,
)

User = get_user_model()


_DJANGO_HTML_WS = override_settings(MIDDLEWARE=middleware_without_spa_shell())


# ---------------------------------------------------------------------------
# Base fixture mixin – creates two completely isolated orgs + users
# ---------------------------------------------------------------------------

class CrossTenantFixtureMixin:
    """
    Sets up:
      - org_a / user_a  (owner)
      - org_b / user_b  (owner)

    Both orgs come with their own Client → Configuration → CareCase chain so that
    related-field filtering tests get real FK linkage.
    """

    def setUp(self):
        # ---- Org A ----
        self.org_a = Organization.objects.create(name='Firm Alpha', slug='firm-alpha')
        self.user_a = User.objects.create_user(username='user_a', password='passA1234!')
        OrganizationMembership.objects.create(
            organization=self.org_a, user=self.user_a,
            role=OrganizationMembership.Role.OWNER, is_active=True,
        )

        # ---- Org B ----
        self.org_b = Organization.objects.create(name='Firm Beta', slug='firm-beta')
        self.user_b = User.objects.create_user(username='user_b', password='passB1234!')
        OrganizationMembership.objects.create(
            organization=self.org_b, user=self.user_b,
            role=OrganizationMembership.Role.OWNER, is_active=True,
        )

        # ---- Org A resources ----
        self.client_a = Client.objects.create(
            organization=self.org_a, name='Alpha Client',
        )
        self.matter_a = CareConfiguration.objects.create(
            organization=self.org_a, client=self.client_a,
            title='Alpha Configuration',
            status='ACTIVE', open_date=datetime.date.today(),
        )
        self.contract_a = CareCase.objects.create(
            organization=self.org_a, title='Alpha NDA',
            contract_type='NDA', status='ACTIVE',
            created_by=self.user_a,
        )
        self.document_a = Document.objects.create(
            organization=self.org_a, title='Alpha Doc',
            uploaded_by=self.user_a,
        )
        # Deadline linked to org_a via case FK
        self.deadline_a = Deadline.objects.create(
            title='Alpha Deadline',
            due_date=datetime.date.today() + datetime.timedelta(days=30),
            case_record=self.contract_a,
        )
        self.legal_task_a = CareTask.objects.create(
            title='Alpha Task',
            description='Task A',
            due_date=datetime.date.today() + datetime.timedelta(days=10),
            case_record=self.contract_a,
            assigned_to=self.user_a,
        )
        # CareSignal linked to org_a via case FK
        self.risk_a = CareSignal.objects.create(
            title='Alpha Risk', description='A risk',
            case_record=self.contract_a,
            created_by=self.user_a,
        )
        self.intake_a = CaseIntakeProcess.objects.create(
            organization=self.org_a,
            contract=self.contract_a,
            title='Alpha Intake',
            start_date=datetime.date.today(),
            target_completion_date=datetime.date.today() + datetime.timedelta(days=30),
        )
        # PlacementRequest linked to org_a via client FK
        self.placement_a = PlacementRequest.objects.create(
            due_diligence_process=self.intake_a,
            mark_text='AlphaMark', description='desc',
            goods_services='software', filing_basis='use',
            client=self.client_a,
            proposed_provider=self.client_a,
            selected_provider=self.client_a,
        )

        # ---- Org B resources (parallel set so list queries have data to check) ----
        self.client_b = Client.objects.create(
            organization=self.org_b, name='Beta Client',
        )
        self.matter_b = CareConfiguration.objects.create(
            organization=self.org_b, client=self.client_b,
            title='Beta Configuration',
            status='ACTIVE', open_date=datetime.date.today(),
        )
        self.contract_b = CareCase.objects.create(
            organization=self.org_b, title='Beta NDA',
            contract_type='NDA', status='ACTIVE',
            created_by=self.user_b,
        )
        self.document_b = Document.objects.create(
            organization=self.org_b, title='Beta Doc',
            uploaded_by=self.user_b,
        )
        self.deadline_b = Deadline.objects.create(
            title='Beta Deadline',
            due_date=datetime.date.today() + datetime.timedelta(days=30),
            case_record=self.contract_b,
        )
        self.legal_task_b = CareTask.objects.create(
            title='Beta Task',
            description='Task B',
            due_date=datetime.date.today() + datetime.timedelta(days=10),
            case_record=self.contract_b,
            assigned_to=self.user_b,
        )
        self.risk_b = CareSignal.objects.create(
            title='Beta Risk', description='A risk',
            case_record=self.contract_b,
            created_by=self.user_b,
        )
        self.intake_b = CaseIntakeProcess.objects.create(
            organization=self.org_b,
            contract=self.contract_b,
            title='Beta Intake',
            start_date=datetime.date.today(),
            target_completion_date=datetime.date.today() + datetime.timedelta(days=30),
        )
        self.placement_b = PlacementRequest.objects.create(
            due_diligence_process=self.intake_b,
            mark_text='BetaMark', description='desc',
            goods_services='software', filing_basis='use',
            client=self.client_b,
            proposed_provider=self.client_b,
            selected_provider=self.client_b,
        )


# ===========================================================================
# 1. Direct org-FK models: CareCase, Document, Client, CareConfiguration
# ===========================================================================

@_DJANGO_HTML_WS
class CareCaseIsolationTest(CrossTenantFixtureMixin, TestCase):
    """CareCase records carry organization FK and must stay tenant-scoped."""

    def test_list_shows_only_own_org(self):
        self.client.login(username='user_b', password='passB1234!')
        response = self.client.get(reverse('careon:case_list'))
        self.assertEqual(response.status_code, 200)
        body = response.content.decode('utf-8')
        self.assertIn('Intake', body)
        self.assertNotIn('Alpha NDA', body)

    def test_cases_api_excludes_other_org_contracts(self):
        """API is source of truth for pilot workspace; must not leak other-tenant cases."""
        self.client.login(username='user_b', password='passB1234!')
        response = self.client.get(reverse('careon:cases_api'))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        ids = {row['id'] for row in payload.get('contracts', [])}
        self.assertNotIn(str(self.contract_a.pk), ids)
        self.assertIn(str(self.contract_b.pk), ids)

    def test_case_detail_api_cross_org_returns_404(self):
        """Dossier HTML may be SPA-shelled; API must still return 404 for wrong tenant."""
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:case_detail_api', kwargs={'case_id': self.contract_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_update_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:configuration_update', kwargs={'pk': self.matter_a.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404,
                         'Accessing another org configuration update must return 404')


@_DJANGO_HTML_WS
class ProviderSameOrganizationCaseVisibilityTest(CrossTenantFixtureMixin, TestCase):
    """
    When gemeente and zorgaanbieder share an organization, list/detail APIs must not
    expose all org cases to the provider—only those with a placement row pointing at
    the provider's staffed Client (responsible_coordinator).
    """

    def setUp(self):
        super().setUp()
        self.provider_user = User.objects.create_user(
            username='provider_same_org', password='passP1234!',
        )
        OrganizationMembership.objects.create(
            organization=self.org_a,
            user=self.provider_user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        UserProfile.objects.create(user=self.provider_user, role=UserProfile.Role.CLIENT)

        self.provider_client = Client.objects.create(
            organization=self.org_a,
            name='Staffed Provider',
            client_type=Client.ClientType.CORPORATION,
            responsible_coordinator=self.provider_user,
        )
        self.other_provider = Client.objects.create(
            organization=self.org_a,
            name='Other Provider Same Org',
            client_type=Client.ClientType.CORPORATION,
        )

        self.contract_linked = CareCase.objects.create(
            organization=self.org_a,
            title='Placement-linked Case',
            contract_type='NDA',
            status='ACTIVE',
            created_by=self.user_a,
        )
        self.intake_linked = CaseIntakeProcess.objects.create(
            organization=self.org_a,
            contract=self.contract_linked,
            title='Linked Intake',
            start_date=datetime.date.today(),
            target_completion_date=datetime.date.today() + datetime.timedelta(days=30),
        )
        PlacementRequest.objects.create(
            due_diligence_process=self.intake_linked,
            mark_text='L',
            description='d',
            goods_services='s',
            filing_basis='f',
            client=self.client_a,
            proposed_provider=self.provider_client,
            selected_provider=self.provider_client,
        )

        self.contract_other = CareCase.objects.create(
            organization=self.org_a,
            title='Same-org Other-provider Case',
            contract_type='NDA',
            status='ACTIVE',
            created_by=self.user_a,
        )
        self.intake_other = CaseIntakeProcess.objects.create(
            organization=self.org_a,
            contract=self.contract_other,
            title='Other Intake',
            start_date=datetime.date.today(),
            target_completion_date=datetime.date.today() + datetime.timedelta(days=30),
        )
        PlacementRequest.objects.create(
            due_diligence_process=self.intake_other,
            mark_text='O',
            description='d',
            goods_services='s',
            filing_basis='f',
            client=self.client_a,
            proposed_provider=self.other_provider,
            selected_provider=self.other_provider,
        )

    def test_provider_cases_api_lists_only_placement_linked_cases(self):
        self.client.login(username='provider_same_org', password='passP1234!')
        response = self.client.get(reverse('careon:cases_api'))
        self.assertEqual(response.status_code, 200)
        ids = {row['id'] for row in response.json().get('contracts', [])}
        self.assertIn(str(self.contract_linked.pk), ids)
        self.assertNotIn(str(self.contract_other.pk), ids)

    def test_gemeente_owner_cases_api_still_lists_all_org_cases(self):
        self.client.login(username='user_a', password='passA1234!')
        response = self.client.get(reverse('careon:cases_api'))
        self.assertEqual(response.status_code, 200)
        ids = {row['id'] for row in response.json().get('contracts', [])}
        self.assertIn(str(self.contract_linked.pk), ids)
        self.assertIn(str(self.contract_other.pk), ids)
        self.assertIn(str(self.contract_a.pk), ids)

    def test_provider_case_detail_blocked_for_unlinked_same_org_case(self):
        self.client.login(username='provider_same_org', password='passP1234!')
        url = reverse('careon:case_detail_api', kwargs={'case_id': self.contract_other.pk})
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_provider_case_detail_allowed_when_placement_targets_provider(self):
        self.client.login(username='provider_same_org', password='passP1234!')
        url = reverse('careon:case_detail_api', kwargs={'case_id': self.contract_linked.pk})
        self.assertEqual(self.client.get(url).status_code, 200)

    def test_cross_tenant_cases_api_unchanged(self):
        """Other-tenant isolation remains strict (existing behaviour)."""
        self.client.login(username='user_b', password='passB1234!')
        response = self.client.get(reverse('careon:cases_api'))
        self.assertEqual(response.status_code, 200)
        ids = {row['id'] for row in response.json().get('contracts', [])}
        self.assertNotIn(str(self.contract_linked.pk), ids)


@_DJANGO_HTML_WS
class DocumentsApiProviderVisibilityTest(ProviderSameOrganizationCaseVisibilityTest):
    """documents_api / document_detail_api placement-scope matches cases_api for zorgaanbieder."""

    def setUp(self):
        super().setUp()
        self.doc_linked = Document.objects.create(
            organization=self.org_a,
            title='Provider Visible Doc',
            contract=self.contract_linked,
            uploaded_by=self.user_a,
        )
        self.doc_other = Document.objects.create(
            organization=self.org_a,
            title='Provider Hidden Doc',
            contract=self.contract_other,
            uploaded_by=self.user_a,
        )
        self.doc_orphan = Document.objects.create(
            organization=self.org_a,
            title='Org Doc No Case',
            uploaded_by=self.user_a,
        )

    def test_provider_documents_api_lists_only_placement_linked_case_documents(self):
        self.client.login(username='provider_same_org', password='passP1234!')
        response = self.client.get(reverse('careon:documents_api'))
        self.assertEqual(response.status_code, 200)
        ids = {row['id'] for row in response.json().get('documents', [])}
        self.assertIn(str(self.doc_linked.id), ids)
        self.assertNotIn(str(self.doc_other.id), ids)
        self.assertNotIn(str(self.doc_orphan.id), ids)
        self.assertNotIn(str(self.document_a.id), ids)

    def test_gemeente_documents_api_lists_all_org_documents(self):
        self.client.login(username='user_a', password='passA1234!')
        response = self.client.get(reverse('careon:documents_api'))
        self.assertEqual(response.status_code, 200)
        ids = {row['id'] for row in response.json().get('documents', [])}
        self.assertIn(str(self.doc_linked.id), ids)
        self.assertIn(str(self.doc_other.id), ids)
        self.assertIn(str(self.doc_orphan.id), ids)
        self.assertIn(str(self.document_a.id), ids)

    def test_documents_api_cross_tenant_excludes_other_org(self):
        self.client.login(username='user_b', password='passB1234!')
        response = self.client.get(reverse('careon:documents_api'))
        self.assertEqual(response.status_code, 200)
        ids = {row['id'] for row in response.json().get('documents', [])}
        self.assertNotIn(str(self.doc_linked.id), ids)
        self.assertNotIn(str(self.doc_other.id), ids)
        self.assertIn(str(self.document_b.id), ids)

    def test_provider_document_detail_404_for_unlinked_case_document(self):
        self.client.login(username='provider_same_org', password='passP1234!')
        url = reverse('careon:document_detail_api', kwargs={'document_id': self.doc_other.pk})
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_provider_document_detail_200_for_linked_case_document(self):
        self.client.login(username='provider_same_org', password='passP1234!')
        url = reverse('careon:document_detail_api', kwargs={'document_id': self.doc_linked.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get('name'), 'Provider Visible Doc')

    def test_provider_document_detail_404_for_org_only_document(self):
        self.client.login(username='provider_same_org', password='passP1234!')
        url = reverse('careon:document_detail_api', kwargs={'document_id': self.doc_orphan.pk})
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_document_detail_api_cross_tenant_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:document_detail_api', kwargs={'document_id': self.doc_linked.pk})
        self.assertEqual(self.client.get(url).status_code, 404)


@_DJANGO_HTML_WS
class ProviderListApisVisibilityTest(ProviderSameOrganizationCaseVisibilityTest):
    """assessments_api, placements_api, signals_api, tasks_api, audit_log_api — placement scope."""

    def setUp(self):
        super().setUp()
        self.assessment_linked = CaseAssessment.objects.create(
            due_diligence_process=self.intake_linked,
            assessment_status=CaseAssessment.AssessmentStatus.UNDER_REVIEW,
            matching_ready=False,
            notes='assessment linked',
            assessed_by=self.user_a,
            workflow_summary={},
        )
        self.assessment_other = CaseAssessment.objects.create(
            due_diligence_process=self.intake_other,
            assessment_status=CaseAssessment.AssessmentStatus.UNDER_REVIEW,
            matching_ready=False,
            notes='assessment other',
            assessed_by=self.user_a,
            workflow_summary={},
        )
        self.signal_linked = CareSignal.objects.create(
            title='Signal Linked',
            description='d',
            case_record=self.contract_linked,
            created_by=self.user_a,
        )
        self.signal_other = CareSignal.objects.create(
            title='Signal Other',
            description='d',
            case_record=self.contract_other,
            created_by=self.user_a,
        )
        self.task_linked = CareTask.objects.create(
            title='Task Linked',
            description='d',
            due_date=datetime.date.today(),
            case_record=self.contract_linked,
            assigned_to=self.user_a,
        )
        self.task_other = CareTask.objects.create(
            title='Task Other',
            description='d',
            due_date=datetime.date.today(),
            case_record=self.contract_other,
            assigned_to=self.user_a,
        )
        self.placement_linked = PlacementRequest.objects.filter(
            due_diligence_process=self.intake_linked,
        ).order_by('-updated_at').first()
        self.placement_other = PlacementRequest.objects.filter(
            due_diligence_process=self.intake_other,
        ).order_by('-updated_at').first()

    def test_provider_assessments_api_only_linked_case(self):
        self.client.login(username='provider_same_org', password='passP1234!')
        r = self.client.get(reverse('careon:assessments_api'))
        self.assertEqual(r.status_code, 200)
        ids = {row['id'] for row in r.json().get('assessments', [])}
        self.assertIn(str(self.assessment_linked.id), ids)
        self.assertNotIn(str(self.assessment_other.id), ids)

    def test_provider_placements_api_only_linked_case(self):
        self.client.login(username='provider_same_org', password='passP1234!')
        r = self.client.get(reverse('careon:placements_api'))
        self.assertEqual(r.status_code, 200)
        ids = {row['id'] for row in r.json().get('placements', [])}
        self.assertIn(str(self.placement_linked.id), ids)
        self.assertNotIn(str(self.placement_other.id), ids)

    def test_provider_signals_api_only_linked_case(self):
        self.client.login(username='provider_same_org', password='passP1234!')
        r = self.client.get(reverse('careon:signals_api'))
        self.assertEqual(r.status_code, 200)
        ids = {row['id'] for row in r.json().get('signals', [])}
        self.assertIn(str(self.signal_linked.id), ids)
        self.assertNotIn(str(self.signal_other.id), ids)

    def test_provider_tasks_api_only_linked_case(self):
        self.client.login(username='provider_same_org', password='passP1234!')
        r = self.client.get(reverse('careon:tasks_api'))
        self.assertEqual(r.status_code, 200)
        ids = {row['id'] for row in r.json().get('tasks', [])}
        self.assertIn(str(self.task_linked.id), ids)
        self.assertNotIn(str(self.task_other.id), ids)

    def test_gemeente_assessments_and_list_apis_org_wide(self):
        self.client.login(username='user_a', password='passA1234!')
        a = self.client.get(reverse('careon:assessments_api')).json()
        a_ids = {row['id'] for row in a.get('assessments', [])}
        self.assertIn(str(self.assessment_linked.id), a_ids)
        self.assertIn(str(self.assessment_other.id), a_ids)
        p = self.client.get(reverse('careon:placements_api')).json()
        p_ids = {row['id'] for row in p.get('placements', [])}
        self.assertIn(str(self.placement_linked.id), p_ids)
        self.assertIn(str(self.placement_other.id), p_ids)
        s = self.client.get(reverse('careon:signals_api')).json()
        s_ids = {row['id'] for row in s.get('signals', [])}
        self.assertIn(str(self.signal_linked.id), s_ids)
        self.assertIn(str(self.signal_other.id), s_ids)
        t = self.client.get(reverse('careon:tasks_api')).json()
        t_ids = {row['id'] for row in t.get('tasks', [])}
        self.assertIn(str(self.task_linked.id), t_ids)
        self.assertIn(str(self.task_other.id), t_ids)

    def test_provider_audit_log_api_forbidden(self):
        self.client.login(username='provider_same_org', password='passP1234!')
        r = self.client.get(reverse('careon:audit_log_api'))
        self.assertEqual(r.status_code, 403)
        self.assertFalse(r.json().get('ok', True))

    def test_gemeente_audit_log_api_allowed(self):
        self.client.login(username='user_a', password='passA1234!')
        r = self.client.get(reverse('careon:audit_log_api'))
        self.assertEqual(r.status_code, 200)
        self.assertIn('entries', r.json())

    def test_list_apis_cross_tenant_no_org_a_leak(self):
        self.client.login(username='user_b', password='passB1234!')
        a = self.client.get(reverse('careon:assessments_api')).json()
        self.assertNotIn(str(self.assessment_linked.id), {x['id'] for x in a.get('assessments', [])})
        p = self.client.get(reverse('careon:placements_api')).json()
        self.assertNotIn(str(self.placement_linked.id), {x['id'] for x in p.get('placements', [])})
        s = self.client.get(reverse('careon:signals_api')).json()
        self.assertNotIn(str(self.signal_linked.id), {x['id'] for x in s.get('signals', [])})
        t = self.client.get(reverse('careon:tasks_api')).json()
        self.assertNotIn(str(self.task_linked.id), {x['id'] for x in t.get('tasks', [])})


@_DJANGO_HTML_WS
class DocumentIsolationTest(CrossTenantFixtureMixin, TestCase):
    """Documents carry organization FK."""

    def test_list_shows_only_own_org(self):
        self.client.login(username='user_b', password='passB1234!')
        response = self.client.get(reverse('careon:document_list'))
        self.assertEqual(response.status_code, 200)
        ids = [d.id for d in response.context.get('documents', [])]
        self.assertNotIn(self.document_a.id, ids)
        self.assertIn(self.document_b.id, ids)

    def test_detail_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:document_detail', kwargs={'pk': self.document_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_update_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:document_update', kwargs={'pk': self.document_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)


@_DJANGO_HTML_WS
class ClientIsolationTest(CrossTenantFixtureMixin, TestCase):
    """Clients carry organization FK."""

    def test_list_shows_only_own_org(self):
        self.client.login(username='user_b', password='passB1234!')
        response = self.client.get(reverse('careon:client_list'))
        self.assertEqual(response.status_code, 200)
        ids = [c.id for c in response.context.get('clients', [])]
        self.assertNotIn(self.client_a.id, ids)
        self.assertIn(self.client_b.id, ids)

    def test_detail_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:client_detail', kwargs={'pk': self.client_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_update_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:client_update', kwargs={'pk': self.client_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)


@_DJANGO_HTML_WS
class CareConfigurationIsolationTest(CrossTenantFixtureMixin, TestCase):
    """CareConfiguration records carry organization FK."""

    def test_municipality_list_scoped_to_own_org(self):
        self.client.login(username='user_b', password='passB1234!')
        response = self.client.get(reverse('careon:municipality_list'))
        self.assertEqual(response.status_code, 200)

    def test_detail_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:configuration_detail', kwargs={'pk': self.matter_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_update_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:configuration_update', kwargs={'pk': self.matter_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)


@_DJANGO_HTML_WS
class GlobalSearchIsolationTest(CrossTenantFixtureMixin, TestCase):
    """Global search must only return organization-scoped records for the active user."""

    def setUp(self):
        super().setUp()
        self.contract_a.title = 'Shared Search Alpha Case'
        self.contract_a.save(update_fields=['title'])
        self.contract_b.title = 'Shared Search Beta Case'
        self.contract_b.save(update_fields=['title'])

        self.client_a.name = 'Shared Search Alpha Provider'
        self.client_a.save(update_fields=['name'])
        self.client_b.name = 'Shared Search Beta Provider'
        self.client_b.save(update_fields=['name'])

        self.matter_a.title = 'Shared Search Alpha Region'
        self.matter_a.save(update_fields=['title'])
        self.matter_b.title = 'Shared Search Beta Region'
        self.matter_b.save(update_fields=['title'])

        self.document_a.title = 'Shared Search Alpha Document'
        self.document_a.save(update_fields=['title'])
        self.document_b.title = 'Shared Search Beta Document'
        self.document_b.save(update_fields=['title'])

    def test_global_search_excludes_other_org_records(self):
        self.client.login(username='user_b', password='passB1234!')

        response = self.client.get(reverse('careon:global_search'), {'q': 'Shared Search'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Shared Search Beta Case')
        self.assertContains(response, 'Shared Search Beta Provider')
        self.assertContains(response, 'Shared Search Beta Region')
        self.assertContains(response, 'Shared Search Beta Document')
        self.assertNotContains(response, 'Shared Search Alpha Case')
        self.assertNotContains(response, 'Shared Search Alpha Provider')
        self.assertNotContains(response, 'Shared Search Alpha Region')
        self.assertNotContains(response, 'Shared Search Alpha Document')


# ===========================================================================
# 2. Related-field isolated models (no direct org FK – filtered via FK chain)
# ===========================================================================

@_DJANGO_HTML_WS
class DeadlineIsolationTest(CrossTenantFixtureMixin, TestCase):
    """
    Deadline has no direct organization FK. Isolation is enforced in
    DeadlineListView / DeadlineUpdateView via related case/configuration ownership.
    """

    def test_list_excludes_other_org(self):
        self.client.login(username='user_b', password='passB1234!')
        response = self.client.get(reverse('careon:deadline_list') + '?show=all')
        self.assertEqual(response.status_code, 200)
        ids = [d.id for d in response.context.get('deadlines', [])]
        self.assertNotIn(self.deadline_a.id, ids,
                         'deadline_a (via case_a of Org A) must not appear for Org B')
        self.assertIn(self.deadline_b.id, ids)

    def test_update_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:deadline_update', kwargs={'pk': self.deadline_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_complete_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:deadline_complete', kwargs={'pk': self.deadline_a.pk})
        self.assertEqual(self.client.post(url).status_code, 404)


@_DJANGO_HTML_WS
class CareTaskIsolationTest(CrossTenantFixtureMixin, TestCase):
    """
    CareTask has no direct organization FK. Isolation enforced via
    related case/configuration ownership.
    """

    def test_list_excludes_other_org(self):
        self.client.login(username='user_b', password='passB1234!')
        response = self.client.get(reverse('careon:care_task_kanban'))
        self.assertEqual(response.status_code, 200)
        ids = [t.id for t in response.context.get('care_tasks', [])]
        self.assertNotIn(self.legal_task_a.id, ids)
        self.assertIn(self.legal_task_b.id, ids)

    def test_update_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:task_update', kwargs={'pk': self.legal_task_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)


@_DJANGO_HTML_WS
class CareSignalIsolationTest(CrossTenantFixtureMixin, TestCase):
    """
    CareSignal has no direct organization FK. Isolation enforced via
    related case/configuration ownership.
    """

    def test_list_excludes_other_org(self):
        self.client.login(username='user_b', password='passB1234!')
        response = self.client.get(reverse('careon:risk_log_list'))
        self.assertEqual(response.status_code, 200)
        ids = [signal.id for signal in response.context.get('signals', [])]
        self.assertNotIn(self.risk_a.id, ids,
                         'risk_a (Org A) must not appear for Org B')
        self.assertIn(self.risk_b.id, ids)

    def test_update_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:risk_log_update', kwargs={'pk': self.risk_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)


@_DJANGO_HTML_WS
class PlacementRequestIsolationTest(CrossTenantFixtureMixin, TestCase):
    """
    PlacementRequest has no direct organization FK. Isolation enforced via
    related provider/configuration ownership.
    """

    def test_list_excludes_other_org(self):
        self.client.login(username='user_b', password='passB1234!')
        response = self.client.get(reverse('careon:placement_list'))
        self.assertEqual(response.status_code, 200)
        ids = [placement.id for placement in response.context.get('placements', [])]
        self.assertNotIn(self.placement_a.id, ids)
        self.assertIn(self.placement_b.id, ids)

    def test_detail_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:placement_detail', kwargs={'pk': self.placement_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_update_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:placement_update', kwargs={'pk': self.placement_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)


# ===========================================================================
# 3. Unauthenticated access must redirect to login (never expose data)
# ===========================================================================

class UnauthenticatedAccessTest(TestCase):
    """All resource endpoints must redirect anonymous users to the login page."""

    URLS = [
        ('careon:case_list', {}),
        ('careon:document_list', {}),
        ('careon:client_list', {}),
        ('careon:municipality_list', {}),
        ('careon:task_kanban', {}),
        ('careon:risk_log_list', {}),
        ('careon:deadline_list', {}),
        ('careon:placement_list', {}),
        ('careon:budget_list', {}),
        ('careon:intake_list', {}),
    ]

    def test_all_list_endpoints_redirect_anonymous(self):
        for name, kwargs in self.URLS:
            with self.subTest(url_name=name):
                response = self.client.get(reverse(name, kwargs=kwargs))
                self.assertIn(
                    response.status_code, [302, 301],
                    f'{name} should redirect unauthenticated users',
                )
                self.assertIn(
                    '/login/', response['Location'],
                    f'{name} must redirect to login page',
                )


# ===========================================================================
# 4. Previously-known gaps — now fixed via migration 0005
# ===========================================================================

@_DJANGO_HTML_WS
class BudgetIsolationTest(CrossTenantFixtureMixin, TestCase):
    """Budget cross-tenant isolation – enforced via organization FK (migration 0005)."""

    def setUp(self):
        super().setUp()
        self.budget_a = Budget.objects.create(
            organization=self.org_a,
            year=2025, quarter='Q1',
            department='AlphaDept',
            allocated_amount='50000.00',
            created_by=self.user_a,
        )
        self.budget_b = Budget.objects.create(
            organization=self.org_b,
            year=2025, quarter='Q1',
            department='BetaDept',
            allocated_amount='50000.00',
            created_by=self.user_b,
        )

    def test_list_excludes_other_org(self):
        self.client.login(username='user_b', password='passB1234!')
        response = self.client.get(reverse('careon:budget_list'))
        self.assertEqual(response.status_code, 200)
        ids = [b.id for b in response.context.get('budgets', [])]
        self.assertNotIn(self.budget_a.id, ids)
        self.assertIn(self.budget_b.id, ids)

    def test_detail_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:budget_detail', kwargs={'pk': self.budget_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_update_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:budget_update', kwargs={'pk': self.budget_a.pk})
        self.assertEqual(self.client.get(url).status_code, 404)


@_DJANGO_HTML_WS
class CaseIntakeProcessIsolationTest(CrossTenantFixtureMixin, TestCase):
    """CaseIntakeProcess cross-tenant isolation via organization FK (migration 0005)."""

    def setUp(self):
        super().setUp()
        self.dd_a = CaseIntakeProcess.objects.create(
            organization=self.org_a,
            title='Alpha DD', transaction_type='ACQUISITION',
            target_company='Target A',
            start_date=datetime.date.today(),
            target_completion_date=datetime.date.today() + datetime.timedelta(days=90),
            case_coordinator=self.user_a,
        )
        self.dd_b = CaseIntakeProcess.objects.create(
            organization=self.org_b,
            title='Beta DD', transaction_type='MERGER',
            target_company='Target B',
            start_date=datetime.date.today(),
            target_completion_date=datetime.date.today() + datetime.timedelta(days=90),
            case_coordinator=self.user_b,
        )

    def test_list_excludes_other_org(self):
        self.client.login(username='user_b', password='passB1234!')
        response = self.client.get(reverse('careon:intake_list'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('flow=intake', response['Location'])

    def test_detail_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:intake_detail', kwargs={'pk': self.dd_a.pk})
        self.assertEqual(self.client.get(url).status_code, 302)

    def test_update_cross_org_returns_404(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:intake_update', kwargs={'pk': self.dd_a.pk})
        self.assertEqual(self.client.get(url).status_code, 302)


# ===========================================================================
# Regiekamer overview endpoint (list-shaped response, must be tenant-scoped)
# ===========================================================================

@_DJANGO_HTML_WS
class RegiekamerDecisionOverviewIsolationTest(CrossTenantFixtureMixin, TestCase):
    """
    `regiekamer_decision_overview_api` returns a list of operational items
    across the user's organization. A regression here would not be caught by
    case-detail 404 tests (this is a list endpoint), so we explicitly verify
    that:
      - logged in as user_b, only org_b items are returned
      - org_a case titles never appear in the response
    """

    def test_overview_excludes_other_org_items(self):
        self.client.login(username='user_b', password='passB1234!')
        url = reverse('careon:regiekamer_decision_overview_api')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        items = payload.get('items', [])
        titles = {item.get('title') for item in items}
        case_ids = {item.get('case_id') for item in items}

        self.assertNotIn('Alpha NDA', titles,
                         'Regiekamer overview must not leak other-tenant case titles')
        self.assertNotIn(self.contract_a.pk, case_ids,
                         'Regiekamer overview must not leak other-tenant case IDs')
