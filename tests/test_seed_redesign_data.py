import json

from django.core.management import call_command
from django.test import Client, TestCase
from django.urls import reverse

from contracts.decision_engine import evaluate_case
from contracts.models import CareCase, CaseIntakeProcess, MatchResultaat, Organization, OrganizationMembership

from contracts.management.commands.seed_redesign_data import PILOT_CASE_TITLES


class SeedRedesignDataCommandTests(TestCase):
    def test_seed_redesign_data_creates_realistic_case_mix(self):
        call_command('seed_redesign_data', reset=True, verbosity=0)

        org = Organization.objects.get(slug='pilot-careon')
        self.assertEqual(CaseIntakeProcess.objects.filter(organization=org).count(), 7)
        self.assertEqual(CareCase.objects.filter(organization=org).count(), 7)
        self.assertEqual(MatchResultaat.objects.filter(casus__organization=org).count(), 1)

        seeded_titles = set(
            CaseIntakeProcess.objects.filter(organization=org).values_list('title', flat=True)
        )
        self.assertEqual(seeded_titles, set(PILOT_CASE_TITLES))

        expected_cases = {
            PILOT_CASE_TITLES[0]: {
                'current_state': 'MATCHING_READY',
                'blocker_code': None,
                'alert_code': None,
                'next_action': 'SEND_TO_PROVIDER',
            },
            PILOT_CASE_TITLES[1]: {
                'current_state': 'DRAFT_CASE',
                'blocker_code': 'MISSING_SUMMARY',
                'alert_code': 'MISSING_SUMMARY',
                'next_action': 'GENERATE_SUMMARY',
            },
            PILOT_CASE_TITLES[2]: {
                'current_state': 'MATCHING_READY',
                'blocker_code': None,
                'alert_code': 'WEAK_MATCH_NEEDS_VERIFICATION',
                'next_action': 'SEND_TO_PROVIDER',
            },
            PILOT_CASE_TITLES[3]: {
                'current_state': 'PROVIDER_REJECTED',
                'blocker_code': 'PROVIDER_NOT_ACCEPTED',
                'alert_code': 'PROVIDER_REJECTED_CASE',
                'next_action': 'REMATCH_CASE',
            },
            PILOT_CASE_TITLES[4]: {
                'current_state': 'PROVIDER_REVIEW_PENDING',
                'blocker_code': None,
                'alert_code': 'PROVIDER_REVIEW_PENDING_SLA',
                'next_action': 'FOLLOW_UP_PROVIDER',
            },
            PILOT_CASE_TITLES[5]: {
                'current_state': 'PLACEMENT_CONFIRMED',
                'blocker_code': None,
                'alert_code': 'INTAKE_NOT_STARTED',
                'next_action': 'START_INTAKE',
            },
            PILOT_CASE_TITLES[6]: {
                'current_state': 'ARCHIVED',
                'blocker_code': 'CASE_ARCHIVED',
                'alert_code': 'ARCHIVED_CASE',
                'next_action': None,
            },
        }

        for title, expected in expected_cases.items():
            with self.subTest(title=title):
                case = CaseIntakeProcess.objects.get(organization=org, title=title)
                evaluation = evaluate_case(case.contract)
                self.assertEqual(evaluation['current_state'], expected['current_state'])
                self.assertEqual(
                    evaluation['next_best_action']['action'] if evaluation['next_best_action'] else None,
                    expected['next_action'],
                )
                self.assertEqual(
                    evaluation['blockers'][0]['code'] if evaluation['blockers'] else None,
                    expected['blocker_code'],
                )
                self.assertEqual(
                    evaluation['alerts'][0]['code'] if evaluation['alerts'] else None,
                    expected['alert_code'],
                )

        client = Client()
        admin_user = OrganizationMembership.objects.get(organization=org, role=OrganizationMembership.Role.ADMIN).user
        client.force_login(admin_user)
        overview_response = client.get(reverse('careon:regiekamer_decision_overview_api'))
        self.assertEqual(overview_response.status_code, 200)
        overview_payload = json.loads(overview_response.content)

        self.assertEqual(
            [item['title'] for item in overview_payload['items']],
            [
                PILOT_CASE_TITLES[1],
                PILOT_CASE_TITLES[4],
                PILOT_CASE_TITLES[3],
                PILOT_CASE_TITLES[5],
                PILOT_CASE_TITLES[0],
                PILOT_CASE_TITLES[2],
            ],
        )
