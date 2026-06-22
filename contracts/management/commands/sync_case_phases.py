"""
Management command: sync_case_phases

Backfills CareCase.case_phase from CaseIntakeProcess.workflow_state for any
case where the two fields have drifted out of sync.

Dry-run by default. Pass --execute to write changes.

Usage:
    python manage.py sync_case_phases              # dry-run: report drift
    python manage.py sync_case_phases --execute    # apply corrections
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from contracts.models import CaseIntakeProcess
from contracts.workflow_state_machine import (
    _WORKFLOW_STATE_TO_CASE_PHASE,
    sync_case_phase_from_workflow_state,
)


class Command(BaseCommand):
    help = 'Backfill CareCase.case_phase from CaseIntakeProcess.workflow_state where they have drifted.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--execute',
            action='store_true',
            default=False,
            help='Apply corrections. Without this flag the command only reports drift.',
        )

    def handle(self, *args, **options):
        execute = options['execute']
        drifted = 0
        skipped = 0

        intakes = (
            CaseIntakeProcess.objects
            .exclude(workflow_state='')
            .select_related('contract')
        )

        for intake in intakes.iterator(chunk_size=200):
            case = intake.case_record
            if case is None:
                skipped += 1
                continue
            expected_phase = _WORKFLOW_STATE_TO_CASE_PHASE.get(intake.workflow_state)
            if expected_phase is None:
                skipped += 1
                continue
            if case.case_phase == expected_phase:
                continue

            drifted += 1
            self.stdout.write(
                f'  intake={intake.pk} workflow_state={intake.workflow_state} '
                f'case={case.pk} current_phase={case.case_phase} '
                f'→ expected={expected_phase}'
            )
            if execute:
                with transaction.atomic():
                    sync_case_phase_from_workflow_state(intake, case=case)

        if execute:
            self.stdout.write(self.style.SUCCESS(
                f'sync_case_phases: corrected {drifted} case(s), skipped {skipped}.'
            ))
        else:
            self.stdout.write(
                f'sync_case_phases (dry-run): {drifted} drifted case(s) found, '
                f'{skipped} skipped (no case or unknown state). '
                f'Re-run with --execute to apply.'
            )
