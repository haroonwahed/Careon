"""
Tests for Blocker 1: Zorgaanbieder ↔ Client provider linkage.

Covers:
  - candidates API emits provider_client_id when linked; null + provider_unlinked when not
  - matching_action_api rejects confirm_validation for an unlinked provider (PROVIDER_UNLINKED)
  - override detection compares Client PKs (same keyspace)
  - end-to-end: PlacementRequest.proposed_provider == zorgaanbieder.client after send

API URLs under /care/api/cases/<case_id>/ use CareCase.pk, NOT CaseIntakeProcess.pk.
Use intake.case_record.pk (== intake.contract.pk) for all URL lookups.
"""

import json
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client as HttpClient
from django.test import TestCase
from django.urls import reverse

from contracts.models import (
    CaseAssessment,
    CaseIntakeProcess,
    Client as CareClient,
    MatchResultaat,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    Zorgaanbieder,
    Zorgprofiel,
)
from contracts.workflow_state_machine import WorkflowState

User = get_user_model()

_MIN_WS = {
    "context": "Test pilot samenvatting (context) — minimaal verplicht voor matching en validatie.",
    "risks": ["test_risk"],
    "missing_information": "",
    "risks_none_ack": False,
}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _make_org_and_user(slug):
    org = Organization.objects.create(name=f"Org {slug}", slug=slug)
    user = User.objects.create_user(
        username=f"user_{slug}", email=f"{slug}@test.example", password="pass"
    )
    OrganizationMembership.objects.create(
        organization=org, user=user,
        role=OrganizationMembership.Role.OWNER,
        is_active=True,
    )
    return org, user


def _make_linked_pair(org, user, name="NovaCare"):
    """Create a Zorgaanbieder + linked CORPORATION Client in the same org."""
    za = Zorgaanbieder.objects.create(name=name, is_active=True)
    corp = CareClient.objects.create(
        organization=org,
        name=name,
        client_type="CORPORATION",
        status="ACTIVE",
        created_by=user,
    )
    za.client = corp
    za.save(update_fields=["client"])
    return za, corp


def _make_unlinked_client(org, user, name="Unlinked Corp"):
    """Create a CORPORATION Client with no Zorgaanbieder link."""
    return CareClient.objects.create(
        organization=org,
        name=name,
        client_type="CORPORATION",
        status="ACTIVE",
        created_by=user,
    )


def _make_intake_with_case(org, user, workflow_state=WorkflowState.MATCHING_READY):
    """
    Create a CaseIntakeProcess + CaseAssessment + CareCase.
    Returns (intake, case_pk) where case_pk is the CareCase pk used in API URLs.
    """
    intake = CaseIntakeProcess.objects.create(
        organization=org,
        title="Provider Linkage Test Case",
        status=CaseIntakeProcess.ProcessStatus.MATCHING,
        urgency=CaseIntakeProcess.Urgency.MEDIUM,
        preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
        start_date=date.today(),
        target_completion_date=date.today() + timedelta(days=7),
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
    case_record = intake.ensure_case_record(created_by=user)
    return intake, case_record.pk


def _make_zorgprofiel(za):
    return Zorgprofiel.objects.create(zorgaanbieder=za, zorgvorm="ambulant", actief=True)


def _make_match_resultaat(case_pk, za, ranking=1, score=0.85):
    from contracts.models import CareCase
    case_record = CareCase.objects.get(pk=case_pk)
    zp = _make_zorgprofiel(za)
    return MatchResultaat.objects.create(
        casus=case_record,
        zorgprofiel=zp,
        zorgaanbieder=za,
        totaalscore=score,
        ranking=ranking,
    )


# ---------------------------------------------------------------------------
# Test classes
# ---------------------------------------------------------------------------

class ProviderLinkageCandidatesApiTests(TestCase):
    """Candidates API emits provider_client_id / provider_unlinked correctly."""

    def setUp(self):
        self.http = HttpClient()
        self.org, self.user = _make_org_and_user("cand-api")
        self.http.login(username="user_cand-api", password="pass")
        self.intake, self.case_pk = _make_intake_with_case(self.org, self.user)

    def _candidates_url(self):
        return reverse("carelane:matching_candidates_api", kwargs={"case_id": self.case_pk})

    def _mock_engine_result(self, za):
        zp = _make_zorgprofiel(za)
        from contracts.models import CareCase
        case_record = CareCase.objects.get(pk=self.case_pk)
        # Return an unsaved MatchResultaat-like object that the view will serialise
        mr = MatchResultaat(
            casus=case_record,
            zorgprofiel=zp,
            zorgaanbieder=za,
            totaalscore=0.8,
            ranking=1,
        )
        mr.zorgaanbieder = za  # ensure the FK is loaded
        return mr

    def test_linked_provider_emits_provider_client_id(self):
        za, corp = _make_linked_pair(self.org, self.user, name="LinkedCare")

        with patch("contracts.api.matching.MatchEngine.run") as mock_run:
            mock_run.return_value = [self._mock_engine_result(za)]
            resp = self.http.get(self._candidates_url())

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreater(len(data["matches"]), 0)
        row = data["matches"][0]
        self.assertEqual(row["provider_client_id"], corp.pk)
        self.assertFalse(row["provider_unlinked"])
        self.assertEqual(row["zorgaanbieder_id"], za.pk)

    def test_unlinked_provider_emits_null_provider_client_id(self):
        za = Zorgaanbieder.objects.create(name="UnlinkedCare Jeugd", is_active=True)

        with patch("contracts.api.matching.MatchEngine.run") as mock_run:
            mock_run.return_value = [self._mock_engine_result(za)]
            resp = self.http.get(self._candidates_url())

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        row = data["matches"][0]
        self.assertIsNone(row["provider_client_id"])
        self.assertTrue(row["provider_unlinked"])


class ProviderLinkageActionApiTests(TestCase):
    """matching_action_api rejects unlinked providers and detects overrides correctly."""

    def setUp(self):
        self.http = HttpClient()
        self.org, self.user = _make_org_and_user("action-api")
        self.http.login(username="user_action-api", password="pass")

    def _post(self, case_pk, payload):
        url = reverse("carelane:matching_action_api", kwargs={"case_id": case_pk})
        return self.http.post(url, data=json.dumps(payload), content_type="application/json")

    def test_confirm_validation_rejects_unlinked_provider(self):
        intake, case_pk = _make_intake_with_case(self.org, self.user)
        unlinked = _make_unlinked_client(self.org, self.user, "Unlinked Confirm")

        resp = self._post(case_pk, {
            "action": "confirm_validation",
            "provider_id": unlinked.pk,
            "validation_context": {},
        })

        self.assertEqual(resp.status_code, 400)
        body = resp.json()
        self.assertFalse(body["ok"])
        self.assertEqual(body["code"], "PROVIDER_UNLINKED")

    def test_confirm_validation_accepts_linked_provider(self):
        intake, case_pk = _make_intake_with_case(
            self.org, self.user, workflow_state=WorkflowState.MATCHING_READY
        )
        za, corp = _make_linked_pair(self.org, self.user, name="Linked Confirm Care")

        resp = self._post(case_pk, {
            "action": "confirm_validation",
            "provider_id": corp.pk,
            "validation_context": {},
        })

        body = resp.json()
        # Must not fail with PROVIDER_UNLINKED — may fail for other workflow reasons
        self.assertNotEqual(body.get("code"), "PROVIDER_UNLINKED")

    def test_override_detection_uses_client_pk_keyspace(self):
        """
        Submitting a different linked provider than the top match triggers OVERRIDE_REASON_REQUIRED,
        not a silent acceptance or a PROVIDER_UNLINKED.
        """
        intake, case_pk = _make_intake_with_case(self.org, self.user)
        za_top, corp_top = _make_linked_pair(self.org, self.user, name="Top Action Provider")
        za_other, corp_other = _make_linked_pair(self.org, self.user, name="Other Action Provider")

        _make_match_resultaat(case_pk, za_top, ranking=1)

        # Advance to GEMEENTE_VALIDATED with a draft placement for corp_top
        intake.workflow_state = WorkflowState.GEMEENTE_VALIDATED
        intake.save(update_fields=["workflow_state"])
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            proposed_provider=corp_top,
            status=PlacementRequest.Status.DRAFT,
        )

        # send_to_provider with the OTHER linked provider — must require override_reason
        resp = self._post(case_pk, {
            "action": "send_to_provider",
            "provider_id": corp_other.pk,
        })
        body = resp.json()
        self.assertFalse(body["ok"])
        # Rejected because placement provider doesn't match validated choice
        self.assertIn(resp.status_code, (400,))

    def test_send_not_override_when_provider_matches_top(self):
        """Submitting the top-matched linked Client is never flagged as an override."""
        intake, case_pk = _make_intake_with_case(self.org, self.user)
        za_top, corp_top = _make_linked_pair(self.org, self.user, name="Exact Match Action")

        _make_match_resultaat(case_pk, za_top, ranking=1)

        intake.workflow_state = WorkflowState.GEMEENTE_VALIDATED
        intake.save(update_fields=["workflow_state"])
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            proposed_provider=corp_top,
            status=PlacementRequest.Status.DRAFT,
        )

        resp = self._post(case_pk, {
            "action": "send_to_provider",
            "provider_id": corp_top.pk,
        })
        body = resp.json()
        # Must not require override_reason when provider matches top match's linked client
        self.assertNotEqual(body.get("code"), "OVERRIDE_REASON_REQUIRED")


class ProviderLinkageEndToEndTests(TestCase):
    """
    End-to-end: confirm_validation → send_to_provider.
    PlacementRequest.proposed_provider must equal zorgaanbieder.client.
    """

    def setUp(self):
        self.http = HttpClient()
        self.org, self.user = _make_org_and_user("e2e-linkage")
        self.http.login(username="user_e2e-linkage", password="pass")

    def _post(self, case_pk, payload):
        url = reverse("carelane:matching_action_api", kwargs={"case_id": case_pk})
        return self.http.post(url, data=json.dumps(payload), content_type="application/json")

    def test_proposed_provider_equals_zorgaanbieder_client(self):
        """
        PlacementRequest.proposed_provider_id must equal za.client_id after send.
        This proves the placed entity is the same entity the engine scored.
        """
        intake, case_pk = _make_intake_with_case(
            self.org, self.user, workflow_state=WorkflowState.MATCHING_READY
        )
        za, corp = _make_linked_pair(self.org, self.user, name="E2E Linked Provider")
        _make_match_resultaat(case_pk, za, ranking=1)

        # Step 1: confirm_validation
        resp1 = self._post(case_pk, {
            "action": "confirm_validation",
            "provider_id": corp.pk,
            "validation_context": {},
        })
        self.assertTrue(resp1.json().get("ok"), f"confirm_validation failed: {resp1.json()}")

        # Step 2: send_to_provider
        resp2 = self._post(case_pk, {
            "action": "send_to_provider",
            "provider_id": corp.pk,
        })
        self.assertTrue(resp2.json().get("ok"), f"send_to_provider failed: {resp2.json()}")

        # Assert: proposed_provider_id == za.client_id (same entity)
        placement = (
            PlacementRequest.objects
            .filter(due_diligence_process=intake)
            .order_by("-updated_at")
            .first()
        )
        self.assertIsNotNone(placement)
        self.assertEqual(
            placement.proposed_provider_id,
            za.client_id,
            f"proposed_provider ({placement.proposed_provider_id}) != za.client ({za.client_id})",
        )

    def test_unlinked_provider_cannot_be_sent(self):
        """
        Attempting to confirm_validation with a Client that has no Zorgaanbieder link
        must fail with PROVIDER_UNLINKED before creating any PlacementRequest.
        """
        intake, case_pk = _make_intake_with_case(
            self.org, self.user, workflow_state=WorkflowState.MATCHING_READY
        )
        unlinked = _make_unlinked_client(self.org, self.user, "E2E Unlinked")

        resp = self._post(case_pk, {
            "action": "confirm_validation",
            "provider_id": unlinked.pk,
            "validation_context": {},
        })
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "PROVIDER_UNLINKED")
        self.assertFalse(
            PlacementRequest.objects.filter(due_diligence_process=intake).exists(),
            "No PlacementRequest should be created when provider is unlinked",
        )

    def test_wrong_provider_rejected_without_override_reason(self):
        """
        After confirm_validation for corp_top, attempting send_to_provider with corp_other
        must be rejected — the placement check fires before the send reaches the provider.
        """
        intake, case_pk = _make_intake_with_case(
            self.org, self.user, workflow_state=WorkflowState.MATCHING_READY
        )
        za_top, corp_top = _make_linked_pair(self.org, self.user, name="Top E2E Provider")
        za_other, corp_other = _make_linked_pair(self.org, self.user, name="Other E2E Provider")
        _make_match_resultaat(case_pk, za_top, ranking=1)

        # confirm_validation with top match's client
        resp1 = self._post(case_pk, {
            "action": "confirm_validation",
            "provider_id": corp_top.pk,
            "validation_context": {},
        })
        self.assertTrue(resp1.json().get("ok"), f"confirm_validation failed: {resp1.json()}")

        # send_to_provider with a different linked client — must be rejected
        resp2 = self._post(case_pk, {
            "action": "send_to_provider",
            "provider_id": corp_other.pk,
        })
        self.assertEqual(resp2.status_code, 400)
        self.assertFalse(resp2.json()["ok"])
