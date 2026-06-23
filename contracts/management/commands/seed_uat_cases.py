"""
Seed UAT test data on production:

1. Create a fresh case in PROVIDER_REVIEW_PENDING state linked to Horizon Jeugdzorg
   so the provider account can test accept/decline (steps B3-B5).

2. Fix case #13 matching — re-run the advisory matching engine so providers appear.

Run:
    python manage.py seed_uat_cases
"""
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Seed UAT cases: provider_review test case + fix case #13 matching."

    def handle(self, *args, **options):
        from contracts.models import Client, Organization
        from contracts.models.assessment import CaseAssessment, PlacementRequest
        from contracts.models.care_case import CareCase
        from contracts.models.intake import CaseIntakeProcess

        # ── 1. Find org and provider ────────────────────────────────────────
        org = Organization.objects.filter(is_active=True).order_by('id').first()
        if not org:
            self.stderr.write("No active organization found. Aborting.")
            return
        self.stdout.write(f"Using org: {org.name} ({org.slug})")

        provider_client = (
            Client.objects.filter(zorgaanbieder__name__icontains='Horizon')
            .select_related('zorgaanbieder')
            .first()
        )
        if not provider_client:
            # fallback: any client with a linked zorgaanbieder in this org
            provider_client = (
                Client.objects.filter(organization=org)
                .exclude(zorgaanbieder=None)
                .select_related('zorgaanbieder')
                .first()
            )
        if not provider_client:
            self.stderr.write("No provider (Client with Zorgaanbieder) found. Aborting.")
            return
        self.stdout.write(f"Using provider: {provider_client.zorgaanbieder.name}")

        # ── 2. Create UAT case in provider_review state ─────────────────────
        case = CareCase.objects.create(
            organization=org,
            title='UAT Testcasus — Aanbiederbeoordeling',
            case_phase=CareCase.CasePhase.PROVIDER_BEOORDELING,
        )
        self.stdout.write(f"Created CareCase #{case.pk}")

        intake = CaseIntakeProcess.objects.create(
            organization=org,
            contract=case,
            title='UAT Testcasus — Aanbiederbeoordeling',
            status=CaseIntakeProcess.ProcessStatus.DECISION,
            workflow_state=CaseIntakeProcess.WorkflowState.PROVIDER_REVIEW_PENDING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            complexity=CaseIntakeProcess.Complexity.ENKELVOUDIG,
            start_date=timezone.now().date(),
        )
        self.stdout.write(f"Created CaseIntakeProcess #{intake.pk}")

        assessment = CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        self.stdout.write(f"Created CaseAssessment #{assessment.pk}")

        placement = PlacementRequest.objects.create(
            due_diligence_process=intake,
            proposed_provider=provider_client,
            status=PlacementRequest.Status.IN_REVIEW,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
        )
        self.stdout.write(f"Created PlacementRequest #{placement.pk}")

        self.stdout.write(self.style.SUCCESS(
            f"UAT case #{case.pk} ready — provider {provider_client.zorgaanbieder.name} "
            f"can now accept/decline in Reacties."
        ))

        # ── 3. Fix case #13 matching ─────────────────────────────────────────
        try:
            case13 = CareCase.objects.get(pk=13)
            intake13 = getattr(case13, 'due_diligence_process', None)
            if not intake13:
                self.stdout.write("Case #13 has no intake process — skipping matching fix.")
            else:
                from contracts.api.matching import _persist_advisory_matching_results
                _persist_advisory_matching_results(
                    case_record=case13,
                    intake=intake13,
                    organization=case13.organization,
                )
                self.stdout.write(self.style.SUCCESS("Case #13 matching refreshed."))
        except CareCase.DoesNotExist:
            self.stdout.write("Case #13 not found — skipping.")
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f"Case #13 matching refresh failed: {exc}"))
