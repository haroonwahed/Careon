"""
Classification confirmation/override API.
POST /care/api/cases/<intake_id>/classification/confirm/

Rollen: gemeente, admin (niet zorgaanbieder)
Overrides zonder reden worden geweigerd.
Elke actie wordt vastgelegd in CaseTimelineEvent.
"""
from __future__ import annotations

import json
import logging

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from contracts.models import CaseIntakeProcess, CaseTimelineEvent
from contracts.workflow_state_machine import resolve_actor_role

logger = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def confirm_classification(request, intake_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Niet ingelogd.'}, status=401)

    try:
        body = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Ongeldige JSON.'}, status=400)

    try:
        intake = CaseIntakeProcess.objects.select_related('contract', 'organization').get(pk=intake_id)
    except CaseIntakeProcess.DoesNotExist:
        return JsonResponse({'error': 'Casus niet gevonden.'}, status=404)

    actor_role = resolve_actor_role(user=request.user, organization=intake.organization)
    if actor_role not in {'gemeente', 'admin'}:
        return JsonResponse(
            {'error': 'Onvoldoende rechten. Alleen beoordelaars en administrators mogen de classificatie bevestigen.'},
            status=403,
        )

    field = (body.get('field') or '').strip()
    action = (body.get('action') or '').strip()
    value = (body.get('value') or '').strip()
    reason = (body.get('reason') or '').strip()

    if field not in ('complexity', 'care_intensity'):
        return JsonResponse({'error': 'field moet "complexity" of "care_intensity" zijn.'}, status=400)
    if action not in ('confirm', 'override'):
        return JsonResponse({'error': 'action moet "confirm" of "override" zijn.'}, status=400)
    if action == 'override':
        if not value:
            return JsonResponse({'error': 'value is verplicht bij een override.'}, status=400)
        if not reason:
            return JsonResponse({'error': 'Een reden is verplicht bij een handmatige wijziging.'}, status=400)
        valid = {c[0] for c in (
            CaseIntakeProcess.Complexity.choices if field == 'complexity'
            else CaseIntakeProcess.CareIntensity.choices
        )}
        if value not in valid:
            return JsonResponse({'error': f'Ongeldige waarde: {value}.'}, status=400)

    now = timezone.now()
    user_label = request.user.get_full_name() or request.user.username

    if field == 'complexity':
        previous_value = intake.complexity
        new_value = intake.proposed_complexity if action == 'confirm' else value
        intake.complexity = new_value
        intake.complexity_status = (
            CaseIntakeProcess.ClassificationStatus.CONFIRMED if action == 'confirm'
            else CaseIntakeProcess.ClassificationStatus.OVERRIDDEN
        )
        intake.complexity_confirmed_by = request.user
        intake.complexity_confirmed_at = now
        if action == 'override':
            intake.complexity_override_reason = reason
        update_fields = [
            'complexity', 'complexity_status', 'complexity_confirmed_by',
            'complexity_confirmed_at', 'complexity_override_reason',
        ]
        audit_action = 'complexity_confirmed' if action == 'confirm' else 'complexity_overridden'
        display_field = 'Complexiteit'
    else:
        previous_value = intake.care_intensity
        new_value = intake.proposed_care_intensity if action == 'confirm' else value
        intake.care_intensity = new_value
        intake.care_intensity_status = (
            CaseIntakeProcess.ClassificationStatus.CONFIRMED if action == 'confirm'
            else CaseIntakeProcess.ClassificationStatus.OVERRIDDEN
        )
        intake.care_intensity_confirmed_by = request.user
        intake.care_intensity_confirmed_at = now
        if action == 'override':
            intake.care_intensity_override_reason = reason
        update_fields = [
            'care_intensity', 'care_intensity_status', 'care_intensity_confirmed_by',
            'care_intensity_confirmed_at', 'care_intensity_override_reason',
        ]
        audit_action = 'care_intensity_confirmed' if action == 'confirm' else 'care_intensity_overridden'
        display_field = 'Zorgintensiteit'

    intake.save(update_fields=update_fields)

    audit_metadata = {
        'field': field,
        'action': action,
        'previous_value': previous_value,
        'new_value': new_value,
        'actor': user_label,
        'actor_role': actor_role,
    }
    if action == 'override':
        audit_metadata['reason'] = reason
    if intake.classification_rationale:
        audit_metadata['system_proposal_criteria'] = intake.classification_rationale.get('criteria', [])

    if intake.contract_id:
        CaseTimelineEvent.objects.create(
            organization=intake.organization,
            care_case_id=intake.contract_id,
            event_type='STATE_TRANSITION',
            occurred_at=now,
            actor=request.user,
            actor_role=actor_role,
            user_action=audit_action,
            summary=(
                f'{display_field} {"bevestigd" if action == "confirm" else "gewijzigd"}: '
                f'{previous_value or "—"} → {new_value}'
                + (f' (reden: {reason[:100]})' if reason else '')
            ),
            audit_log=audit_metadata,
        )

    new_status = (
        CaseIntakeProcess.ClassificationStatus.CONFIRMED if action == 'confirm'
        else CaseIntakeProcess.ClassificationStatus.OVERRIDDEN
    )
    return JsonResponse({
        'ok': True,
        'field': field,
        'action': action,
        'new_value': new_value,
        'status': new_status,
        'confirmed_by': user_label,
        'confirmed_at': now.isoformat(),
    })
