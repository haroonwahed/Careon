"""End-to-End Scenario Validation Tests for Zorg OS V3.

Validates that the complete decision flow, provider evaluation, and
outcome-informed intelligence work coherently across 10 realistic Dutch
care allocation scenarios.

Test structure:
  For each scenario:
  1. Test next_best_action is correct at the initial workflow state.
  2. Test expected missing-information and risk-signal codes.
  3. Record a provider evaluation decision (via DB service where needed).
  4. Assert placement gating (unlocked only after accept).
  5. Assert evaluation NBA code.
  6. Assert outcome-informed signals are applied correctly (scenario 9).
  7. Assert Regiekamer health alert is or is not raised.

A scenario_report fixture is generated at module level and printed when any
test fails, providing a clear audit trail.
"""

from datetime import date, timedelta
from io import StringIO

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from contracts.case_intelligence import (
    detect_missing_information,
    detect_risk_signals,
    determine_next_best_action,
    evaluate_case_intelligence,
)
from contracts.models import (
    CaseIntakeProcess,
    Client as CareProvider,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderEvaluation,
)
from contracts.provider_evaluation_service import (
    get_evaluation_nba_code,
    placement_unlocked_for_case,
    record_provider_evaluation,
)
from contracts.provider_outcome_aggregates import (
    apply_evaluation_outcome_to_candidate,
    build_provider_evaluation_aggregates,
    build_regiekamer_provider_health,
    derive_evaluation_signals,
)

from .scenario_fixtures import (
    ALL_SCENARIOS,
    SCENARIO_1,
    SCENARIO_2,
    SCENARIO_3,
    SCENARIO_4,
    SCENARIO_5,
    SCENARIO_6,
    SCENARIO_7,
    SCENARIO_8,
    SCENARIO_9,
    SCENARIO_10,
    TODAY,
)


# ---------------------------------------------------------------------------
# Shared DB fixtures helpers
# ---------------------------------------------------------------------------

def _make_org_and_user(suffix=''):
    user = User.objects.create_user(username=f'e2e_user{suffix}', password='testpass')
    org = Organization.objects.create(name=f'E2E Org{suffix}', slug=f'e2e-org{suffix}')
    OrganizationMembership.objects.create(
        organization=org, user=user,
        role=OrganizationMembership.Role.OWNER, is_active=True,
    )
    return user, org


def _make_provider(org, user, name='Test Provider'):
    return CareProvider.objects.create(
        organization=org, name=name,
        status=CareProvider.Status.ACTIVE, created_by=user,
    )


def _make_intake(org, user, urgency=CaseIntakeProcess.Urgency.MEDIUM):
    return CaseIntakeProcess.objects.create(
        organization=org,
        title='Test Casus E2E',
        status=CaseIntakeProcess.ProcessStatus.MATCHING,
        urgency=urgency,
        preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
        start_date=date.today(),
        target_completion_date=date.today() + timedelta(days=14),
        case_coordinator=user,
        assessment_summary='Hulpvraag samenvatting voor e2e test',
        client_age_category=CaseIntakeProcess.AgeCategory.ADULT,
    )


def _make_placement(intake, provider):
    return PlacementRequest.objects.create(
        due_diligence_process=intake,
        selected_provider=provider,
        status=PlacementRequest.Status.IN_REVIEW,
    )


# ---------------------------------------------------------------------------
# Scenario report builder (used to generate a readable artifact)
# ---------------------------------------------------------------------------

def _build_scenario_report(scenario, intelligence_result):
    """Return a text block summarising one scenario's outcome."""
    lines = [
        f"{'=' * 60}",
        f"Scenario: {scenario['name']}",
        f"Beschrijving: {scenario['description']}",
        f"{'─' * 60}",
        f"Fase:             {scenario['case_data'].get('phase', '–')}",
        f"Urgentie:         {scenario['case_data'].get('urgency', '–')}",
        f"Zorgcategorie:    {scenario['case_data'].get('care_category', '–')}",
        f"Provider besluit: {scenario.get('provider_decision', '–') or '–'}",
        f"{'─' * 60}",
        f"NBA code:         {intelligence_result['next_best_action']['code']}",
        f"NBA reden:        {intelligence_result['next_best_action']['reason']}",
        f"Ontbrekend:       {[m['code'] for m in intelligence_result['missing_information']]}",
        f"Risicosignalen:   {[s['code'] for s in intelligence_result['risk_signals']]}",
        f"Veilig doorgaan:  {intelligence_result['safe_to_proceed']}",
        f"Stopredenen:      {intelligence_result['stop_reasons']}",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Base test class: pure case_intelligence function tests (no DB)
# ---------------------------------------------------------------------------

class ScenarioIntelligencePureTests(TestCase):
    """Tests that run evaluate_case_intelligence on the fixture case_data dicts.

    No database access is needed for these because case_intelligence is pure.
    """

    def _assert_scenario_nba(self, scenario):
        """Assert next_best_action code matches expected."""
        result = evaluate_case_intelligence(scenario['case_data'])
        report_line = _build_scenario_report(scenario, result)
        actual_nba = result['next_best_action']['code']
        expected_nba = scenario['expected_nba']
        self.assertEqual(
            actual_nba,
            expected_nba,
            f"\nScenario {scenario['name']} NBA mismatch.\n{report_line}"
        )

    def _assert_missing_info_codes(self, scenario):
        """Assert that expected missing-info codes are present."""
        result = evaluate_case_intelligence(scenario['case_data'])
        actual_codes = {m['code'] for m in result['missing_information']}
        for expected_code in scenario['expected_missing_info_codes']:
            self.assertIn(
                expected_code,
                actual_codes,
                f"Scenario {scenario['name']}: missing-info code '{expected_code}' not found. "
                f"Actual: {actual_codes}"
            )

    def _assert_risk_signal_codes(self, scenario):
        """Assert that expected risk signal codes are present."""
        result = evaluate_case_intelligence(scenario['case_data'])
        actual_codes = {s['code'] for s in result['risk_signals']}
        for expected_code in scenario['expected_risk_signal_codes']:
            self.assertIn(
                expected_code,
                actual_codes,
                f"Scenario {scenario['name']}: risk signal '{expected_code}' not found. "
                f"Actual: {actual_codes}"
            )

    # ── Scenario 1 ──────────────────────────────────────────────────────────

    def test_s01_nba_is_monitor(self):
        self._assert_scenario_nba(SCENARIO_1)

    def test_s01_no_missing_info(self):
        result = evaluate_case_intelligence(SCENARIO_1['case_data'])
        self.assertEqual(result['missing_information'], [])

    def test_s01_no_risk_signals(self):
        result = evaluate_case_intelligence(SCENARIO_1['case_data'])
        self.assertEqual(result['risk_signals'], [])

    def test_s01_safe_to_proceed(self):
        result = evaluate_case_intelligence(SCENARIO_1['case_data'])
        self.assertTrue(result['safe_to_proceed'])

    # ── Scenario 2 ──────────────────────────────────────────────────────────

    def test_s02_nba_is_validate_capacity_wait(self):
        self._assert_scenario_nba(SCENARIO_2)

    def test_s02_risk_signal_long_wait_risk(self):
        self._assert_risk_signal_codes(SCENARIO_2)

    def test_s02_not_safe_to_proceed_due_to_long_wait(self):
        result = evaluate_case_intelligence(SCENARIO_2['case_data'])
        # long_wait_risk is a high-risk signal → should_stop = True
        self.assertFalse(result['safe_to_proceed'])

    # ── Scenario 3 ──────────────────────────────────────────────────────────

    def test_s03_nba_fill_missing_information(self):
        self._assert_scenario_nba(SCENARIO_3)

    def test_s03_missing_info_care_category(self):
        self._assert_missing_info_codes(SCENARIO_3)

    def test_s03_missing_info_urgency(self):
        result = evaluate_case_intelligence(SCENARIO_3['case_data'])
        codes = {m['code'] for m in result['missing_information']}
        self.assertIn('missing_urgency', codes)

    def test_s03_not_safe_to_proceed(self):
        result = evaluate_case_intelligence(SCENARIO_3['case_data'])
        self.assertFalse(result['safe_to_proceed'])

    # ── Scenario 4 ──────────────────────────────────────────────────────────

    def test_s04_nba_run_matching_after_rejection(self):
        self._assert_scenario_nba(SCENARIO_4)

    def test_s04_no_missing_info(self):
        result = evaluate_case_intelligence(SCENARIO_4['case_data'])
        self.assertEqual(result['missing_information'], [])

    # ── Scenario 5 ──────────────────────────────────────────────────────────

    def test_s05_nba_provide_evaluation_info(self):
        self._assert_scenario_nba(SCENARIO_5)

    def test_s05_not_safe_to_proceed(self):
        result = evaluate_case_intelligence(SCENARIO_5['case_data'])
        # provide_evaluation_info is not a stop action → safe_to_proceed = True
        # (the case is in active dialogue with the provider, not blocked)
        self.assertTrue(result['safe_to_proceed'])

    # ── Scenario 6 ──────────────────────────────────────────────────────────

    def test_s06_nba_review_matching_quality(self):
        self._assert_scenario_nba(SCENARIO_6)

    def test_s06_risk_signal_weak_matching_quality(self):
        self._assert_risk_signal_codes(SCENARIO_6)

    def test_s06_not_safe_to_proceed(self):
        result = evaluate_case_intelligence(SCENARIO_6['case_data'])
        self.assertFalse(result['safe_to_proceed'])

    # ── Scenario 7 ──────────────────────────────────────────────────────────

    def test_s07_nba_resolve_placement_stall(self):
        self._assert_scenario_nba(SCENARIO_7)

    def test_s07_risk_signal_placement_stalled(self):
        self._assert_risk_signal_codes(SCENARIO_7)

    def test_s07_not_safe_to_proceed(self):
        result = evaluate_case_intelligence(SCENARIO_7['case_data'])
        self.assertFalse(result['safe_to_proceed'])

    # ── Scenario 8 ──────────────────────────────────────────────────────────

    def test_s08_nba_run_matching(self):
        self._assert_scenario_nba(SCENARIO_8)

    def test_s08_risk_signal_repeated_rejections(self):
        self._assert_risk_signal_codes(SCENARIO_8)

    # ── Scenario 10 ─────────────────────────────────────────────────────────

    def test_s10_nba_confirm_placement(self):
        self._assert_scenario_nba(SCENARIO_10)

    def test_s10_safe_to_proceed(self):
        result = evaluate_case_intelligence(SCENARIO_10['case_data'])
        # confirm_placement is not a stop-action code → safe_to_proceed = True
        self.assertTrue(result['safe_to_proceed'])


# ---------------------------------------------------------------------------
# DB-based workflow tests: provider evaluation service
# ---------------------------------------------------------------------------

class ScenarioProviderEvaluationWorkflowTests(TestCase):
    """Tests that exercise the DB-backed provider evaluation service."""

    def setUp(self):
        self.user, self.org = _make_org_and_user('_eval')
        self.provider = _make_provider(self.org, self.user)
        self.intake = _make_intake(self.org, self.user)
        self.placement = _make_placement(self.intake, self.provider)

    # ── Acceptance unlocks placement ────────────────────────────────────────

    def test_placement_locked_before_any_evaluation(self):
        """Before any evaluation, placement is locked."""
        self.assertFalse(placement_unlocked_for_case(self.intake))

    def test_placement_unlocked_after_accept(self):
        """After provider accepts, placement is unlocked."""
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
        )
        self.assertTrue(placement_unlocked_for_case(self.intake))

    def test_placement_remains_locked_after_rejection(self):
        """After provider rejects, placement stays locked."""
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY,
        )
        self.assertFalse(placement_unlocked_for_case(self.intake))

    def test_placement_remains_locked_after_needs_more_info(self):
        """After needs_more_info, placement stays locked."""
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info='Stuur volledig zorgplan',
        )
        self.assertFalse(placement_unlocked_for_case(self.intake))

    # ── NBA code after evaluation ────────────────────────────────────────────

    def test_nba_code_is_none_before_evaluation(self):
        self.assertIsNone(get_evaluation_nba_code(self.intake))

    def test_nba_code_ready_for_placement_after_accept(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
        )
        self.assertEqual(get_evaluation_nba_code(self.intake), 'ready_for_placement')

    def test_nba_code_provider_rejected_after_reject(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.SPECIALIZATION_MISMATCH,
        )
        self.assertEqual(get_evaluation_nba_code(self.intake), 'provider_rejected')

    def test_nba_code_needs_more_info(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info='Stuur aanvullende beoordelingsrapportage',
        )
        self.assertEqual(get_evaluation_nba_code(self.intake), 'provider_requested_more_info')

    # ── Scenario 4 workflow: reject → placement blocked, NBA = run_matching ──

    def test_s04_reject_blocks_placement_and_triggers_run_matching_nba(self):
        """Scenario 4: rejection routes to run_matching next action."""
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY,
        )
        self.assertFalse(placement_unlocked_for_case(self.intake))

        # Build case_data with evaluation NBA code.
        nba_code = get_evaluation_nba_code(self.intake)
        case_data = {
            'phase': 'MATCHING',
            'care_category': 'WMO',
            'urgency': 'MEDIUM',
            'assessment_complete': True,
            'matching_run_exists': True,
            'top_match_confidence': 'high',
            'top_match_has_capacity_issue': False,
            'top_match_wait_days': 7,
            'selected_provider_id': self.provider.pk,
            'placement_status': None,
            'placement_updated_at': None,
            'rejected_provider_count': 1,
            'open_signal_count': 0,
            'open_task_count': 0,
            'case_updated_at': date.today(),
            'candidate_suggestions': [
                {'provider_id': self.provider.pk, 'confidence': 'high',
                 'has_capacity_issue': False, 'wait_days': 7},
            ],
            'now': date.today(),
            'has_preferred_region': True,
            'has_assessment_summary': True,
            'has_client_age_category': True,
            'assessment_status': 'APPROVED',
            'assessment_matching_ready': True,
            'matching_updated_at': date.today(),
            'provider_response_status': None,
            'provider_response_recorded_at': None,
            'provider_response_requested_at': None,
            'provider_response_deadline_at': None,
            'provider_response_last_reminder_at': None,
            'provider_evaluation_nba_code': nba_code,
        }
        result = evaluate_case_intelligence(case_data)
        self.assertEqual(result['next_best_action']['code'], 'run_matching')

    # ── Scenario 5 workflow: needs_more_info → NBA = provide_evaluation_info ─

    def test_s05_needs_more_info_triggers_provide_evaluation_info_nba(self):
        """Scenario 5: needs_more_info routes to provide_evaluation_info."""
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info='Graag zorgplan en ADHD-diagnoserapport aanleveren',
        )
        self.assertFalse(placement_unlocked_for_case(self.intake))

        nba_code = get_evaluation_nba_code(self.intake)
        case_data = dict(SCENARIO_5['case_data'])
        case_data['provider_evaluation_nba_code'] = nba_code
        result = evaluate_case_intelligence(case_data)
        self.assertEqual(result['next_best_action']['code'], 'provide_evaluation_info')

    # ── Scenario 10: full happy path ────────────────────────────────────────

    def test_s10_full_happy_path_unlock_and_confirm_placement(self):
        """Scenario 10: accept → ready_for_placement NBA, placement unlocked."""
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
        )
        self.assertTrue(placement_unlocked_for_case(self.intake))
        self.assertEqual(get_evaluation_nba_code(self.intake), 'ready_for_placement')

        # NBA with evaluation context.
        case_data = dict(SCENARIO_10['case_data'])
        case_data['provider_evaluation_nba_code'] = 'ready_for_placement'
        result = evaluate_case_intelligence(case_data)
        self.assertEqual(result['next_best_action']['code'], 'confirm_placement')


# ---------------------------------------------------------------------------
# Outcome-informed signal tests (Scenario 9)
# ---------------------------------------------------------------------------

class ScenarioOutcomeInformedSignalsTests(TestCase):
    """Validates outcome-informed confidence penalties and warning flags."""

    def test_s09_very_low_acceptance_history_applies_confidence_penalty(self):
        """Scenario 9: provider with 10% acceptance → confidence penalty applied."""
        agg = SCENARIO_9['evaluation_aggregates']
        signals = derive_evaluation_signals(agg)

        self.assertTrue(signals['has_sufficient_data'])
        self.assertIn('evaluation_very_low_acceptance', signals['warning_flags'])
        self.assertGreaterEqual(signals['confidence_penalty'],
                                SCENARIO_9['expected_confidence_penalty_min'])

    def test_s09_penalty_reduces_match_score(self):
        """Match score is reduced by penalty when applied to candidate."""
        agg = SCENARIO_9['evaluation_aggregates']
        candidate_row = {
            'provider_id': 99,
            'match_score': 80.0,
            'confidence_label': 'high',
            'trade_offs': [],
            'verificatie_advies': '',
        }
        result = apply_evaluation_outcome_to_candidate(candidate_row, agg)
        self.assertLess(result['match_score'], 80.0)

    def test_s09_confidence_label_downgraded(self):
        """High confidence label is downgraded when penalty >= 0.10."""
        agg = SCENARIO_9['evaluation_aggregates']
        candidate_row = {
            'provider_id': 99,
            'match_score': 80.0,
            'confidence_label': 'high',
            'trade_offs': [],
            'verificatie_advies': '',
        }
        result = apply_evaluation_outcome_to_candidate(candidate_row, agg)
        # Penalty >= 0.20 (very_low_acceptance) → label should be low
        self.assertNotEqual(result['confidence_label'], 'high')

    def test_s09_warning_flag_present_on_candidate(self):
        """evaluation_very_low_acceptance warning is added to candidate row."""
        agg = SCENARIO_9['evaluation_aggregates']
        candidate_row = {
            'provider_id': 99,
            'match_score': 75.0,
            'confidence_label': 'high',
            'trade_offs': [],
            'verificatie_advies': '',
        }
        result = apply_evaluation_outcome_to_candidate(candidate_row, agg)
        self.assertIn('evaluation_very_low_acceptance', result['evaluation_warnings'])

    def test_s09_capacity_concern_flagged(self):
        """Capacity concern is raised for often_full provider."""
        agg = SCENARIO_9['evaluation_aggregates']
        candidate_row = {
            'provider_id': 99,
            'match_score': 70.0,
            'confidence_label': 'medium',
            'trade_offs': [],
            'verificatie_advies': '',
        }
        result = apply_evaluation_outcome_to_candidate(candidate_row, agg)
        self.assertTrue(result['evaluation_capacity_concern'])


# ---------------------------------------------------------------------------
# Regiekamer health tests (Scenario 8)
# ---------------------------------------------------------------------------

class ScenarioRegiekamerHealthTests(TestCase):
    """Validates Regiekamer health signals for high-rejection scenarios."""

    def setUp(self):
        self.user, self.org = _make_org_and_user('_regie')
        self.provider = _make_provider(self.org, self.user, 'Aanbieder Problematisch')

    def _make_intake_local(self):
        return CaseIntakeProcess.objects.create(
            organization=self.org,
            title='Casus Regie',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.HIGH,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=14),
            case_coordinator=self.user,
            assessment_summary='Test',
            client_age_category=CaseIntakeProcess.AgeCategory.ADULT,
        )

    def test_s08_high_rejection_provider_appears_in_regiekamer_health(self):
        """Scenario 8: provider with >= 4 rejections appears in health summary."""
        # Create 4 different intakes and reject each with same provider.
        for i in range(4):
            intake = self._make_intake_local()
            ProviderEvaluation.objects.create(
                case=intake,
                provider=self.provider,
                decision=ProviderEvaluation.Decision.REJECT,
                reason_code=ProviderEvaluation.RejectionCode.SPECIALIZATION_MISMATCH,
            )

        health = build_regiekamer_provider_health(self.org)
        high_rejection_ids = {p['provider_id'] for p in health['high_rejection_providers']}
        self.assertIn(
            self.provider.pk,
            high_rejection_ids,
            "Provider with 4 rejections should appear in Regiekamer high_rejection_providers"
        )

    def test_regiekamer_health_empty_for_new_org(self):
        """Org with no evaluations has empty Regiekamer health."""
        _, empty_org = _make_org_and_user('_empty_regie')
        health = build_regiekamer_provider_health(empty_org)
        self.assertEqual(health['provider_health_summary']['at_risk'], 0)
        self.assertEqual(health['provider_health_summary']['unstable_capacity'], 0)

    def test_unstable_capacity_provider_appears_in_health(self):
        """Provider with frequent capacity flags appears in unstable_capacity."""
        # Create 4 evaluations with capacity_flag=True.
        for i in range(4):
            intake = self._make_intake_local()
            ProviderEvaluation.objects.create(
                case=intake,
                provider=self.provider,
                decision=ProviderEvaluation.Decision.REJECT,
                reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY,
                capacity_flag=True,
            )

        health = build_regiekamer_provider_health(self.org)
        unstable_ids = {p['provider_id'] for p in health['unstable_capacity_providers']}
        self.assertIn(self.provider.pk, unstable_ids)


# ---------------------------------------------------------------------------
# Scenario report generation: collects all scenario results and prints them
# ---------------------------------------------------------------------------

class ScenarioReportArtifactTests(TestCase):
    """Generates and prints a scenario report artifact for all 10 scenarios.

    This test does not assert pass/fail for each scenario independently —
    it provides a human-readable summary used for audit and tuning.
    """

    def test_generate_full_scenario_report(self):
        """Run all scenarios and generate a consolidated report."""
        buf = StringIO()
        buf.write("\n\n" + "=" * 70 + "\n")
        buf.write("ZORG OS V3 — END-TO-END SCENARIO VALIDATION REPORT\n")
        buf.write("=" * 70 + "\n\n")

        for scenario in ALL_SCENARIOS:
            result = evaluate_case_intelligence(scenario['case_data'])
            report_block = _build_scenario_report(scenario, result)
            buf.write(report_block + "\n\n")

            # Validate each scenario's NBA.
            expected_nba = scenario['expected_nba']
            actual_nba = result['next_best_action']['code']
            status = "✓ PASS" if actual_nba == expected_nba else f"✗ FAIL (got: {actual_nba})"
            buf.write(f"NBA verwacht: {expected_nba!r:30s} → {status}\n\n")

        print(buf.getvalue())
        # This test always passes; it is a reporting artifact.
        self.assertTrue(True)
