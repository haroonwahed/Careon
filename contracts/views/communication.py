from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.http import HttpResponseForbidden, JsonResponse
from django.urls import reverse
from django.contrib import messages
from django.db.models import Q, Count, Avg
from django.utils import timezone
from django.conf import settings
from datetime import timedelta, date
from collections import defaultdict
import logging

from ..models import (
    CaseIntakeProcess, PlacementRequest, AuditLog, ProviderProfile,
    CaseDecisionLog, OutcomeReasonCode, RegionalConfiguration, CareCase,
)
from ..workflow_bus import (
    emit_placement_status_changed,
    emit_placement_response_status_changed,
    emit_case_phase_changed,
)
from ..middleware import log_action
from ..permissions import CaseAction, can_access_case_action, can_manage_organization
from ..tenancy import get_user_organization, scope_queryset_for_organization
from ..governance import (
    build_matching_recommendation_payload, detect_and_log_sla_transition, log_case_decision_event,
)
from ..case_intelligence import (
    calculate_provider_response_sla, derive_provider_response_ownership, evaluate_case_intelligence,
)
from ..workflow_state_machine import (
    WorkflowAction, WorkflowRole, WorkflowState,
    derive_workflow_state, evaluate_transition, log_transition_event,
    normalize_provider_rejection_states, resolve_actor_role,
    sync_case_phase_from_workflow_state,
)
from ._utils import (
    _coerce_sla_int, _to_bool_filter, _urgency_rank, _resolved_intake_urgency,
    _flow_stage_for_intake_status, _redirect_to_safe_next_or_default, _case_detail_tab_href,
)
from .case_flow import _can_edit_intake, _require_workflow_actor_role, _redirect_if_archived_intake

logger = logging.getLogger(__name__)


def _normalize_provider_response_status_code(status):
    normalized = str(status or '').strip().upper()
    if normalized == 'DECLINED':
        return PlacementRequest.ProviderResponseStatus.REJECTED
    if normalized == 'NO_RESPONSE':
        return PlacementRequest.ProviderResponseStatus.PENDING
    return normalized or PlacementRequest.ProviderResponseStatus.PENDING


def _build_provider_response_governance_context(placement):
    sla = calculate_provider_response_sla(placement, now=timezone.now())
    normalized_status = _normalize_provider_response_status_code(
        placement.provider_response_status
    )
    recommended_actions = []
    if normalized_status in {
        PlacementRequest.ProviderResponseStatus.PENDING,
        PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
    }:
        recommended_actions.append({'action': 'resend_request'})
    if normalized_status == PlacementRequest.ProviderResponseStatus.NEEDS_INFO:
        recommended_actions.append({'action': 'provide_missing_info'})
    if normalized_status in {
        PlacementRequest.ProviderResponseStatus.REJECTED,
        PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
        PlacementRequest.ProviderResponseStatus.WAITLIST,
    } or sla['sla_state'] == 'FORCED_ACTION':
        recommended_actions.append({'action': 'trigger_rematch'})
    if sla['sla_state'] == 'FORCED_ACTION' and normalized_status in {
        PlacementRequest.ProviderResponseStatus.PENDING,
        PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
        PlacementRequest.ProviderResponseStatus.WAITLIST,
    }:
        recommended_actions.append({'action': 'continue_waiting'})

    recommendation_context = {
        'recommended_actions': recommended_actions,
        'hours_waiting': sla['hours_waiting'],
        'next_threshold_hours': sla['next_threshold_hours'],
        'sla_state': sla['sla_state'],
    }
    adaptive_flags = {
        'sla_adjustment': sla.get('sla_adjustment', {}),
    }
    return normalized_status, sla, recommendation_context, adaptive_flags


def _provider_response_status_label(status_code):
    normalized = _normalize_provider_response_status_code(status_code)
    labels = {
        str(PlacementRequest.ProviderResponseStatus.PENDING): 'Nog niet vastgelegd',
        str(PlacementRequest.ProviderResponseStatus.ACCEPTED): 'Geaccepteerd',
        str(PlacementRequest.ProviderResponseStatus.REJECTED): 'Afgewezen',
        str(PlacementRequest.ProviderResponseStatus.NEEDS_INFO): 'Aanvullende info nodig',
        str(PlacementRequest.ProviderResponseStatus.WAITLIST): 'Wachtlijst',
        str(PlacementRequest.ProviderResponseStatus.NO_CAPACITY): 'Geen capaciteit',
    }
    normalized_key = str(normalized)
    return labels.get(normalized_key, normalized_key.title())


def _workflow_stage_label(workflow_stage):
    stage_labels = {
        'aanvraag': 'Intake',
        'matching': 'Matching',
        'intake_aanbieder': 'Plaatsing',
        'plaatsing': 'Plaatsing',
    }
    return stage_labels.get(workflow_stage, 'Intake')


def _communication_type_label(item_type):
    labels = {
        'operational_message': 'Operationeel bericht',
        'internal_note': 'Interne notitie',
        'provider_response': 'Aanbiederreactie',
        'decision_item': 'Besluititem',
        'escalation_item': 'Escalatie',
    }
    return labels.get(item_type, 'Communicatie')


def _decision_item_message(log_entry):
    decision_messages = {
        CaseDecisionLog.EventType.MATCH_RECOMMENDED: 'Matching gestart met nieuwe aanbeveling.',
        CaseDecisionLog.EventType.PROVIDER_SELECTED: 'Aanbieder geselecteerd voor plaatsing.',
        CaseDecisionLog.EventType.RESEND_TRIGGERED: 'Herinnering verstuurd naar aanbieder.',
        CaseDecisionLog.EventType.PROVIDE_MISSING_INFO: 'Aanvullende informatie geregistreerd.',
        CaseDecisionLog.EventType.REMATCH_TRIGGERED: 'Her-match geactiveerd voor deze casus.',
        CaseDecisionLog.EventType.CONTINUE_WAITING: 'Expliciet gekozen om te blijven wachten.',
        CaseDecisionLog.EventType.SLA_ESCALATION: 'SLA-escalatie vastgelegd voor opvolging.',
    }
    if log_entry.optional_reason:
        return log_entry.optional_reason
    if log_entry.event_type == CaseDecisionLog.EventType.SLA_ESCALATION:
        from_state = (log_entry.recommended_value or {}).get('sla_state') or ''
        to_state = (log_entry.actual_value or {}).get('sla_state') or (log_entry.sla_state or '')
        if from_state and to_state:
            return f'SLA wijzigde van {from_state} naar {to_state}.'
    return decision_messages.get(log_entry.event_type, log_entry.user_action or 'Besluit vastgelegd voor deze casus.')


def _derive_communication_item_from_log(log_entry, *, active_stage, resolved_ids):
    adaptive_flags = log_entry.adaptive_flags or {}
    communication_type = adaptive_flags.get('communication_type')
    status = adaptive_flags.get('communication_status') or 'informational'
    workflow_stage = adaptive_flags.get('workflow_stage') or active_stage
    message = log_entry.optional_reason or ''

    if log_entry.event_type == CaseDecisionLog.EventType.CASE_COMMUNICATION:
        item_type = communication_type or 'operational_message'
        if not message:
            message = log_entry.user_action or 'Communicatie-item toegevoegd.'
    elif log_entry.event_type == CaseDecisionLog.EventType.SLA_ESCALATION:
        item_type = 'escalation_item'
        status = 'open' if status != 'resolved' else status
        message = message or _decision_item_message(log_entry)
    else:
        item_type = 'decision_item'
        message = message or _decision_item_message(log_entry)

    if log_entry.pk in resolved_ids and status == 'open':
        status = 'resolved'

    source_label = 'Systeem'
    if log_entry.actor_id:
        source_label = log_entry.actor.get_full_name() if log_entry.actor else 'Gebruiker'
        source_label = source_label or (log_entry.actor.username if log_entry.actor else 'Gebruiker')

    is_open = status == 'open'
    blocks_progress = bool(adaptive_flags.get('blocks_progress')) and is_open
    blocking_label = ''
    if blocks_progress:
        blocking_label = f'Open vraag blokkeert {_workflow_stage_label(workflow_stage).lower()}.'

    return {
        'id': f'log-{log_entry.pk}',
        'source_id': log_entry.pk,
        'source_kind': 'decision_log',
        'type': item_type,
        'type_label': _communication_type_label(item_type),
        'sender': source_label,
        'timestamp': log_entry.timestamp,
        'message': message,
        'workflow_stage': workflow_stage,
        'workflow_stage_label': _workflow_stage_label(workflow_stage),
        'status': status,
        'status_label': 'Open' if status == 'open' else 'Afgehandeld' if status == 'resolved' else 'Informatief',
        'is_open': is_open,
        'blocks_progress': blocks_progress,
        'blocking_label': blocking_label,
    }


def _build_case_communication_context(*, intake, placement, provider_response_summary, decision_logs, selected_filter):
    active_stage = _flow_stage_for_intake_status(intake.status)

    resolved_ids = set()
    for log_entry in decision_logs:
        flags = log_entry.adaptive_flags or {}
        if flags.get('communication_action') == 'resolve_item':
            target_id = flags.get('resolves_log_id')
            if target_id in {None, ''}:
                continue
            try:
                resolved_ids.add(int(str(target_id)))
            except (TypeError, ValueError):
                continue

    items = []
    for log_entry in decision_logs:
        flags = log_entry.adaptive_flags or {}
        if flags.get('communication_action') == 'resolve_item':
            continue
        items.append(
            _derive_communication_item_from_log(
                log_entry,
                active_stage=active_stage,
                resolved_ids=resolved_ids,
            )
        )

    if provider_response_summary:
        provider_status = provider_response_summary.get('status')
        provider_status_label = provider_response_summary.get('status_label')
        provider_notes = getattr(placement, 'provider_response_notes', '') if placement else ''

        provider_is_open = provider_status in {
            PlacementRequest.ProviderResponseStatus.PENDING,
            PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
            PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            PlacementRequest.ProviderResponseStatus.REJECTED,
        }
        provider_blocks = provider_is_open and (
            provider_response_summary.get('is_overdue')
            or provider_status in {
                PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
                PlacementRequest.ProviderResponseStatus.WAITLIST,
                PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            }
        )

        if provider_status == PlacementRequest.ProviderResponseStatus.NEEDS_INFO:
            provider_blocking_label = 'Aanbiederreactie wacht op opvolging.'
        elif provider_status == PlacementRequest.ProviderResponseStatus.WAITLIST:
            provider_blocking_label = 'Wachtlijststatus vraagt besluit op vervolgroute.'
        elif provider_blocks:
            provider_blocking_label = 'Open vraag blokkeert matching.'
        else:
            provider_blocking_label = ''

        provider_message = provider_notes.strip() if provider_notes else f'Laatste aanbiederreactie: {provider_status_label.lower()}.'

        items.append(
            {
                'id': 'provider-response',
                'source_id': placement.pk if placement else None,
                'source_kind': 'provider_response',
                'type': 'provider_response',
                'type_label': _communication_type_label('provider_response'),
                'sender': 'Aanbieder',
                'timestamp': provider_response_summary.get('requested_at') or provider_response_summary.get('deadline_at') or timezone.now(),
                'message': provider_message,
                'workflow_stage': 'matching',
                'workflow_stage_label': _workflow_stage_label('matching'),
                'status': 'open' if provider_is_open else 'informational',
                'status_label': 'Open' if provider_is_open else 'Informatief',
                'is_open': provider_is_open,
                'blocks_progress': provider_blocks,
                'blocking_label': provider_blocking_label,
                'provider_status_label': provider_status_label,
            }
        )

    items.sort(key=lambda item: item.get('timestamp') or timezone.now(), reverse=True)

    filter_mapping = {
        'alles': lambda item: True,
        'open': lambda item: item.get('is_open'),
        'aanbiederreacties': lambda item: item.get('type') == 'provider_response',
        'interne_notities': lambda item: item.get('type') == 'internal_note',
        'besluiten': lambda item: item.get('type') == 'decision_item',
    }
    selected = selected_filter if selected_filter in filter_mapping else 'alles'
    filtered_items = [item for item in items if filter_mapping[selected](item)]

    open_items = [item for item in items if item.get('is_open')]
    internal_notes = [item for item in items if item.get('type') == 'internal_note']
    provider_items = [item for item in items if item.get('type') == 'provider_response']
    open_questions = [
        item
        for item in open_items
        if item.get('type') in {'operational_message', 'provider_response', 'escalation_item'}
    ]

    latest_provider = provider_items[0] if provider_items else None
    if latest_provider:
        latest_provider_copy = f"Laatste aanbiederreactie: {latest_provider.get('provider_status_label', latest_provider.get('status_label', 'onbekend')).lower()}"
    else:
        latest_provider_copy = 'Geen aanbiederreactie'

    summary_items = [
        f"{len(open_questions)} open vraag" if len(open_questions) == 1 else f"{len(open_questions)} open vragen",
        latest_provider_copy,
        f"{len(internal_notes)} interne notitie" if len(internal_notes) == 1 else f"{len(internal_notes)} interne notities",
        'Geen onbeantwoorde berichten' if not open_items else f"{len(open_items)} communicatie-items open",
    ]

    return {
        'items': items,
        'filtered_items': filtered_items,
        'selected_filter': selected,
        'filter_options': [
            {'key': 'alles', 'label': 'Alles'},
            {'key': 'open', 'label': 'Open'},
            {'key': 'aanbiederreacties', 'label': 'Aanbiederreacties'},
            {'key': 'interne_notities', 'label': 'Interne notities'},
            {'key': 'besluiten', 'label': 'Besluiten'},
        ],
        'summary_items': summary_items,
        'has_blocking_items': any(item.get('blocks_progress') for item in open_items),
        'blocking_items': [item for item in open_items if item.get('blocks_progress')],
    }


def _provider_recommended_action_presentation(next_action):
    mapping = {
        'monitor': ('Monitor voortgang', 'medium'),
        'resend': ('Stuur herinnering', 'high'),
        'resend_or_rematch': ('Beslis: herinnering of her-match', 'high'),
        'immediate_decision': ('Neem direct een besluit', 'critical'),
        'rematch_or_override_decision': ('Her-match of expliciete override', 'critical'),
        'rematch': ('Start her-match', 'critical'),
    }
    return mapping.get(next_action, ('Monitor voortgang', 'medium'))


@require_POST
def case_communication_action(request, pk):
    if getattr(settings, 'CARELANE_PILOT_SPA_ONLY', False):
        from django.http import HttpResponseRedirect
        return HttpResponseRedirect('/care/casussen')
    if not request.user.is_authenticated:
        return HttpResponseForbidden('Je moet ingelogd zijn om communicatie te wijzigen.')
    org = get_user_organization(request.user)
    intake = get_object_or_404(
        scope_queryset_for_organization(CaseIntakeProcess.objects.select_related('contract'), org),
        pk=pk,
    )

    if not _can_edit_intake(request.user, intake):
        return HttpResponseForbidden('Je hebt geen rechten om communicatie voor deze casus te wijzigen.')
    archived_redirect = _redirect_if_archived_intake(
        request,
        intake,
        f"{reverse('carelane:case_detail', kwargs={'pk': intake.pk})}?tab=communicatie",
    )
    if archived_redirect:
        return archived_redirect

    normalized_action = (request.POST.get('action') or '').strip().lower()
    next_fallback = f"{reverse('carelane:case_detail', kwargs={'pk': intake.pk})}?tab=communicatie"

    workflow_stage = (request.POST.get('workflow_stage') or _flow_stage_for_intake_status(intake.status)).strip()
    if workflow_stage not in {'aanvraag', 'matching', 'intake_aanbieder', 'plaatsing'}:
        workflow_stage = _flow_stage_for_intake_status(intake.status)

    if normalized_action in {'add_message', 'add_internal_note', 'reply', 'escalate'}:
        content = (request.POST.get('content') or '').strip()
        if not content:
            messages.error(request, 'Voer eerst inhoud in voor het communicatie-item.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        if normalized_action == 'add_internal_note':
            communication_type = 'internal_note'
            communication_status = 'informational'
            user_action = 'internal_note'
            blocks_progress = False
        elif normalized_action == 'escalate':
            communication_type = 'escalation_item'
            communication_status = 'open'
            user_action = 'escalation_item'
            blocks_progress = True
        elif normalized_action == 'reply':
            communication_type = 'operational_message'
            communication_status = 'informational'
            user_action = 'reply'
            blocks_progress = False
        else:
            communication_type = 'operational_message'
            communication_status = 'open'
            user_action = 'operational_message'
            blocks_progress = True

        log_case_decision_event(
            case_id=intake.pk,
            event_type=CaseDecisionLog.EventType.CASE_COMMUNICATION,
            actor_user_id=request.user.id,
            action_source='case_detail',
            user_action=user_action,
            optional_reason=content,
            adaptive_flags={
                'communication_type': communication_type,
                'communication_status': communication_status,
                'workflow_stage': workflow_stage,
                'blocks_progress': blocks_progress,
            },
        )
        messages.success(request, 'Communicatie-item toegevoegd aan de casus.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    if normalized_action == 'mark_resolved':
        target_log_id = (request.POST.get('target_log_id') or '').strip()
        try:
            target_log_id_int = int(target_log_id)
        except (TypeError, ValueError):
            messages.error(request, 'Selecteer een geldig communicatie-item om af te handelen.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        exists = CaseDecisionLog.objects.filter(
            Q(case_id=intake.pk) | Q(case_id_snapshot=intake.pk),
            pk=target_log_id_int,
        ).exists()
        if not exists:
            messages.error(request, 'Communicatie-item niet gevonden voor deze casus.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        log_case_decision_event(
            case_id=intake.pk,
            event_type=CaseDecisionLog.EventType.CASE_COMMUNICATION,
            actor_user_id=request.user.id,
            action_source='case_detail',
            user_action='resolve_item',
            optional_reason='Communicatie-item gemarkeerd als afgehandeld.',
            adaptive_flags={
                'communication_action': 'resolve_item',
                'resolves_log_id': target_log_id_int,
                'communication_status': 'resolved',
                'workflow_stage': workflow_stage,
            },
        )
        messages.success(request, 'Communicatie-item gemarkeerd als afgehandeld.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    messages.error(request, 'Onbekende communicatie-actie.')
    return _redirect_to_safe_next_or_default(request, next_fallback)


def _provider_response_age_days(placement, hours_waiting):
    requested_at = (
        placement.provider_response_requested_at
        or placement.provider_response_last_reminder_at
        or placement.updated_at
    )
    if requested_at:
        return max((timezone.now().date() - requested_at.date()).days, 0)
    return max(int(hours_waiting // 24), 0)


def _provider_response_actions_for_case_detail(*, normalized_status, sla_state):
    if normalized_status == PlacementRequest.ProviderResponseStatus.ACCEPTED:
        return []

    if sla_state == 'FORCED_ACTION':
        return [
            {
                'action': 'trigger_rematch',
                'label': 'Her-match starten',
                'note': 'Her-match is de primaire route.',
                'visual_tone': 'primary',
                'requires_confirmation': False,
            },
            {
                'action': 'provide_missing_info',
                'label': 'Aanvullende informatie aanleveren',
                'note': 'Gebruik dit alleen wanneer ontbrekende info direct de providerreactie kan herstellen.',
                'visual_tone': 'secondary',
                'requires_confirmation': False,
            },
            {
                'action': 'continue_waiting',
                'label': 'Blijf wachten (expliciete override)',
                'note': 'Alleen bij expliciete operationele onderbouwing; keuze wordt geaudit.',
                'visual_tone': 'ghost',
                'requires_confirmation': True,
                'confirm_text': 'Bevestig wachten ondanks SLA FORCED_ACTION.',
                'confirm_field': 'confirm_forced_wait',
                'confirm_value': '1',
            },
        ]

    if normalized_status in {
        PlacementRequest.ProviderResponseStatus.REJECTED,
        PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
    }:
        return [
            {
                'action': 'trigger_rematch',
                'label': 'Her-match starten',
                'note': 'Aanbieder blokkeert voortgang; stuur direct terug naar matching.',
                'visual_tone': 'primary',
                'requires_confirmation': False,
            }
        ]

    if normalized_status == PlacementRequest.ProviderResponseStatus.NEEDS_INFO:
        return [
            {
                'action': 'provide_missing_info',
                'label': 'Aanvullende informatie registreren',
                'note': 'Na registreren wordt de providerreactie opnieuw opengezet.',
                'visual_tone': 'primary',
                'requires_confirmation': False,
            },
            {
                'action': 'resend_request',
                'label': 'Herinnering sturen',
                'note': 'Stuur een extra reminder wanneer aanvullende informatie al gedeeld is.',
                'visual_tone': 'secondary',
                'requires_confirmation': False,
            },
        ]

    if normalized_status == PlacementRequest.ProviderResponseStatus.WAITLIST:
        return [
            {
                'action': 'resend_request',
                'label': 'Herinnering sturen',
                'note': 'Vraag een update op de wachtlijstverwachting en alternatieven.',
                'visual_tone': 'secondary',
                'requires_confirmation': False,
            },
            {
                'action': 'trigger_rematch',
                'label': 'Her-match starten',
                'note': 'Kies her-match wanneer wachttijd niet acceptabel is.',
                'visual_tone': 'primary',
                'requires_confirmation': False,
            },
        ]

    return [
        {
            'action': 'resend_request',
            'label': 'Herinnering sturen',
            'note': 'Stuur een reminder om providerreactie binnen SLA te houden.',
            'visual_tone': 'secondary',
            'requires_confirmation': False,
        }
    ]


def _build_case_provider_response_context(*, intake, placement):
    if not placement:
        return None, [], None

    normalized_status, sla, _, _ = _build_provider_response_governance_context(placement)
    hours_waiting = _coerce_sla_int(sla['hours_waiting'])
    next_threshold_hours = _coerce_sla_int(sla['next_threshold_hours'])
    ownership = derive_provider_response_ownership(
        provider_response_status=normalized_status,
        sla_state=sla['sla_state'],
        hours_waiting=hours_waiting,
        next_threshold_hours=next_threshold_hours,
        now=timezone.now(),
        case_phase=intake.status,
    )

    requested_at = (
        placement.provider_response_requested_at
        or placement.provider_response_last_reminder_at
    )
    summary = {
        'status': normalized_status,
        'status_label': _provider_response_status_label(normalized_status),
        'sla_state': sla['sla_state'],
        'sla_hours_waiting': hours_waiting,
        'sla_escalates_in_hours': max(next_threshold_hours - hours_waiting, 0) if next_threshold_hours else 0,
        'age_days': _provider_response_age_days(placement, hours_waiting),
        'requested_at': requested_at,
        'deadline_at': placement.provider_response_deadline_at,
        'is_overdue': sla['sla_state'] in {'OVERDUE', 'ESCALATED', 'FORCED_ACTION'},
        'sla_forced_action_required': sla['sla_state'] == 'FORCED_ACTION',
        'next_owner': ownership['next_owner'],
        'next_owner_label': ownership['next_owner_label'],
        'next_action': ownership['next_action'],
        'next_action_label': ownership['next_action_label'],
        'action_deadline': ownership['action_deadline'],
        'action_deadline_label': ownership['action_deadline_label'],
        'escalation_level_label': ownership['escalation_level_label'],
        'ownership_reason': ownership['ownership_reason'],
    }

    actions = _provider_response_actions_for_case_detail(
        normalized_status=normalized_status,
        sla_state=sla['sla_state'],
    )

    action_href = reverse('carelane:case_provider_response_action', kwargs={'pk': intake.pk})
    return summary, actions, action_href


def build_provider_response_monitor(org, *, user=None, filters=None, next_url=None):
    filters = filters or {}
    priority_mode = _to_bool_filter(filters.get('priority_mode'))
    search_query = str(filters.get('q') or '').strip()
    urgency_filter = str(filters.get('urgency') or '').strip().upper()
    status_filter = _normalize_provider_response_status_code(filters.get('provider_response_status')) if filters.get('provider_response_status') else ''
    region_filter = str(filters.get('region') or '').strip()
    overdue_only = _to_bool_filter(filters.get('overdue_only'))
    rematch_recommended_only = _to_bool_filter(filters.get('rematch_recommended_only'))

    default_sort = 'urgency' if priority_mode else 'default'
    requested_sort = str(filters.get('sort') or default_sort).strip().lower()
    sort_mode = requested_sort if requested_sort in {'default', 'oldest_waiting', 'urgency'} else default_sort

    placement_qs = (
        PlacementRequest.objects.filter(
            due_diligence_process__organization=org,
            due_diligence_process__isnull=False,
        )
        .select_related(
            'due_diligence_process',
            'due_diligence_process__preferred_region',
            'due_diligence_process__contract',
            'due_diligence_process__contract__client',
            'selected_provider',
            'proposed_provider',
        )
        .order_by('due_diligence_process_id', '-updated_at', '-id')
    )

    latest_by_case = {}
    for placement in placement_qs:
        intake_id = placement.due_diligence_process_id
        if intake_id not in latest_by_case:
            latest_by_case[intake_id] = placement

    can_edit = bool(user) and can_manage_organization(user, org)
    queue_rows = []
    for placement in latest_by_case.values():
        intake = placement.due_diligence_process
        if not intake:
            continue

        normalized_status = _normalize_provider_response_status_code(placement.provider_response_status)
        if normalized_status == PlacementRequest.ProviderResponseStatus.ACCEPTED:
            continue
        if intake.status in {
            CaseIntakeProcess.ProcessStatus.COMPLETED,
            CaseIntakeProcess.ProcessStatus.ARCHIVED,
        }:
            continue

        sla = calculate_provider_response_sla(placement, now=timezone.now())
        hours_waiting = _coerce_sla_int(sla['hours_waiting'])
        next_threshold_hours = _coerce_sla_int(sla['next_threshold_hours'])
        ownership = derive_provider_response_ownership(
            provider_response_status=normalized_status,
            sla_state=sla['sla_state'],
            hours_waiting=hours_waiting,
            next_threshold_hours=next_threshold_hours,
            now=timezone.now(),
            case_phase=intake.status,
        )

        provider = placement.selected_provider or placement.proposed_provider
        provider_name = provider.name if provider else 'Onbekende aanbieder'
        provider_id = provider.id if provider else None
        region = intake.preferred_region
        region_label = region.region_name if region else 'Niet toegewezen'
        client_name = ''
        if intake.contract and intake.contract.client:
            client_name = intake.contract.client.name or ''

        is_overdue = sla['sla_state'] in {'OVERDUE', 'ESCALATED', 'FORCED_ACTION'}
        is_rematch_recommended = normalized_status in {
            PlacementRequest.ProviderResponseStatus.REJECTED,
            PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        } or sla['sla_state'] == 'FORCED_ACTION'

        recommended_action_label, recommended_action_tone = _provider_recommended_action_presentation(
            ownership['next_action']
        )

        age_days = _provider_response_age_days(placement, hours_waiting)
        case_href = _case_detail_tab_href(intake.pk, 'plaatsing')

        resend_action = None
        if can_edit and normalized_status in {
            PlacementRequest.ProviderResponseStatus.PENDING,
            PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        }:
            resend_action = {
                'href': reverse('carelane:case_provider_response_action', kwargs={'pk': intake.pk}),
                'action': 'resend_request',
                'next': next_url or case_href,
                'confirm_text': 'Weet je zeker dat je een herinnering wilt versturen naar deze aanbieder?',
            }

        queue_rows.append(
            {
                'case_id': intake.pk,
                'case_title': intake.title,
                'case_href': case_href,
                'client_name': client_name,
                'provider_id': provider_id,
                'provider_name': provider_name,
                'status': normalized_status,
                'status_label': _provider_response_status_label(normalized_status),
                'sla_state': sla['sla_state'],
                'sla_hours_waiting': hours_waiting,
                'sla_escalates_in_hours': max(next_threshold_hours - hours_waiting, 0) if next_threshold_hours else 0,
                'next_owner': ownership['next_owner'],
                'next_owner_label': ownership['next_owner_label'],
                'escalation_level_label': ownership['escalation_level_label'],
                'region_id': str(region.pk) if region else '',
                'region_label': region_label,
                'phase_label': intake.get_status_display(),
                'urgency_label': intake.get_urgency_display() or _resolved_intake_urgency(intake),
                'urgency_rank': _urgency_rank(_resolved_intake_urgency(intake)),
                'age_days': age_days,
                'requested_at': placement.provider_response_requested_at,
                'deadline_at': placement.provider_response_deadline_at,
                'recommended_action_label': recommended_action_label,
                'recommended_action_detail': ownership['ownership_reason'],
                'recommended_action_tone': recommended_action_tone,
                'action_deadline_label': ownership['action_deadline_label'],
                # Waitlist prioritization fields
                'urgency_validated': intake.urgency_validated,
                'urgency_granted_date': intake.urgency_granted_date,
                'start_date': intake.start_date,
                # 0 = validated urgent (jumps ahead), 1 = normal FCFS
                'waitlist_bucket': 0 if (intake.urgency_validated and intake.urgency_granted_date) else 1,
                'flags': {
                    'is_waiting': normalized_status in {
                        PlacementRequest.ProviderResponseStatus.PENDING,
                        PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
                    },
                    'is_overdue': is_overdue,
                    'is_rematch_recommended': is_rematch_recommended,
                },
                'resend_action': resend_action,
            }
        )

    summary = {
        'total_cases': len(queue_rows),
        'waiting_count': sum(1 for row in queue_rows if row['flags']['is_waiting']),
        'overdue_count': sum(1 for row in queue_rows if row['flags']['is_overdue']),
        'rematch_recommended_count': sum(1 for row in queue_rows if row['flags']['is_rematch_recommended']),
        'waitlist_no_capacity_count': sum(
            1
            for row in queue_rows
            if row['status'] in {
                PlacementRequest.ProviderResponseStatus.WAITLIST,
                PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            }
        ),
        'avg_age_days': round(
            sum(row['age_days'] for row in queue_rows) / len(queue_rows),
            1,
        ) if queue_rows else 0.0,
        'sla_breach_count': sum(1 for row in queue_rows if row['flags']['is_overdue']),
        'escalation_required_count': sum(
            1 for row in queue_rows if row['sla_state'] in {'ESCALATED', 'FORCED_ACTION'}
        ),
        'forced_action_count': sum(1 for row in queue_rows if row['sla_state'] == 'FORCED_ACTION'),
    }

    filtered_rows = list(queue_rows)
    if search_query:
        needle = search_query.lower()
        filtered_rows = [
            row
            for row in filtered_rows
            if (
                needle in row['case_title'].lower()
                or needle in str(row['case_id'])
                or needle in row['provider_name'].lower()
                or needle in row['client_name'].lower()
            )
        ]

    if urgency_filter:
        filtered_rows = [
            row for row in filtered_rows if str(row['urgency_label']).strip().upper() == urgency_filter
            or str(latest_by_case[row['case_id']].due_diligence_process.urgency).strip().upper() == urgency_filter
        ]

    if status_filter:
        filtered_rows = [row for row in filtered_rows if row['status'] == status_filter]

    if region_filter:
        filtered_rows = [row for row in filtered_rows if row['region_id'] == region_filter]

    if overdue_only:
        filtered_rows = [row for row in filtered_rows if row['flags']['is_overdue']]

    if rematch_recommended_only:
        filtered_rows = [row for row in filtered_rows if row['flags']['is_rematch_recommended']]

    if priority_mode:
        filtered_rows = [
            row
            for row in filtered_rows
            if row['sla_state'] in {'FORCED_ACTION', 'ESCALATED', 'OVERDUE'}
            or row['status'] in {
                PlacementRequest.ProviderResponseStatus.REJECTED,
                PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            }
        ]

    def _default_sort_key(row):
        severity_order = {
            'FORCED_ACTION': 0,
            'ESCALATED': 1,
            'OVERDUE': 2,
            'AT_RISK': 3,
            'ON_TRACK': 4,
        }
        rematch_group = 4 if row['flags']['is_rematch_recommended'] else 0
        if row['flags']['is_rematch_recommended'] and row['sla_state'] not in {'FORCED_ACTION', 'ESCALATED', 'OVERDUE'}:
            rematch_group = 5
        return (
            severity_order.get(row['sla_state'], 6),
            rematch_group,
            -row['urgency_rank'],
            -row['age_days'],
            -row['case_id'],
        )

    from datetime import date as _date
    _sentinel = _date(9999, 12, 31)

    def _waitlist_sort_key(row):
        """
        Policy-aligned waitlist sort key.
        1. Validated urgent cases first, sorted by urgency_granted_date ASC
        2. Non-urgent cases sorted by start_date ASC (FCFS / aanmeldingsdatum)
        """
        bucket = row['waitlist_bucket']  # 0 = urgent, 1 = normal
        if bucket == 0:
            return (0, row['urgency_granted_date'] or _sentinel, _sentinel)
        return (1, _sentinel, row['start_date'] or _sentinel)

    if sort_mode == 'oldest_waiting':
        # Primary: waitlist policy order; secondary: age_days as tie-break
        filtered_rows.sort(key=lambda row: (_waitlist_sort_key(row), -row['age_days']))
    elif sort_mode == 'urgency':
        # Primary: waitlist policy order; secondary: urgency_rank as tie-break
        filtered_rows.sort(key=lambda row: (_waitlist_sort_key(row), -row['urgency_rank']))
    else:
        filtered_rows.sort(key=_default_sort_key)

    immediate_action_rows = [
        row for row in filtered_rows if row['sla_state'] in {'OVERDUE', 'ESCALATED', 'FORCED_ACTION'}
    ]

    region_choices = []
    for region in RegionalConfiguration.objects.filter(organization=org).order_by('region_name'):
        region_choices.append({'id': region.pk, 'label': region.region_name})

    return {
        'summary': summary,
        'queue_rows': filtered_rows,
        'immediate_action_rows': immediate_action_rows,
        'filters': {
            'priority_mode': priority_mode,
            'search_query': search_query,
            'urgency': urgency_filter,
            'provider_response_status': status_filter,
            'region': region_filter,
            'overdue_only': overdue_only,
            'rematch_recommended_only': rematch_recommended_only,
            'sort': sort_mode,
        },
        'region_choices': region_choices,
        'status_choices': [
            (PlacementRequest.ProviderResponseStatus.PENDING, 'Nog niet vastgelegd'),
            (PlacementRequest.ProviderResponseStatus.NEEDS_INFO, 'Aanvullende info nodig'),
            (PlacementRequest.ProviderResponseStatus.WAITLIST, 'Wachtlijst'),
            (PlacementRequest.ProviderResponseStatus.REJECTED, 'Afgewezen'),
            (PlacementRequest.ProviderResponseStatus.NO_CAPACITY, 'Geen capaciteit'),
        ],
        'sort_choices': [
            ('default', 'Standaard triage'),
            ('urgency', 'Urgentie eerst'),
            ('oldest_waiting', 'Langst wachtend eerst'),
        ],
    }


def build_provider_response_overview(queue_rows, limit=8):
    grouped_rows = defaultdict(lambda: {
        'provider_id': None,
        'provider_name': 'Onbekende aanbieder',
        'open_response_count': 0,
        'overdue_response_count': 0,
        'avg_response_age_days': 0.0,
        'recent_no_capacity_count': 0,
        'recent_rejection_count': 0,
        '_age_sum': 0,
        'patterns': [],
    })

    for row in queue_rows:
        provider_key = row.get('provider_id') or f"name::{row.get('provider_name', 'onbekend')}"
        bucket = grouped_rows[provider_key]
        bucket['provider_id'] = row.get('provider_id')
        bucket['provider_name'] = row.get('provider_name') or 'Onbekende aanbieder'
        bucket['open_response_count'] += 1
        bucket['_age_sum'] += int(row.get('age_days') or 0)
        if row.get('flags', {}).get('is_overdue'):
            bucket['overdue_response_count'] += 1
        if row.get('status') == PlacementRequest.ProviderResponseStatus.NO_CAPACITY:
            bucket['recent_no_capacity_count'] += 1
        if row.get('status') == PlacementRequest.ProviderResponseStatus.REJECTED:
            bucket['recent_rejection_count'] += 1

    overview_rows = []
    for bucket in grouped_rows.values():
        if bucket['open_response_count']:
            bucket['avg_response_age_days'] = round(
                bucket['_age_sum'] / bucket['open_response_count'],
                1,
            )
        patterns = []
        if bucket['overdue_response_count'] >= 2:
            patterns.append('frequent delays')
        if bucket['recent_no_capacity_count'] >= 2:
            patterns.append('often no capacity')
        if bucket['recent_rejection_count'] >= 2:
            patterns.append('repeated rejections')
        bucket['patterns'] = patterns
        bucket.pop('_age_sum', None)
        overview_rows.append(bucket)

    overview_rows.sort(
        key=lambda row: (
            -row['open_response_count'],
            -row['overdue_response_count'],
            -row['avg_response_age_days'],
            row['provider_name'].lower(),
        )
    )

    return {
        'total_provider_count': len(overview_rows),
        'is_truncated': len(overview_rows) > limit,
        'rows': overview_rows[:limit],
    }


@login_required
def provider_response_monitor(request):
    org = get_user_organization(request.user)
    base_context = {
        'monitor_summary': {
            'total_cases': 0,
            'waiting_count': 0,
            'overdue_count': 0,
            'rematch_recommended_count': 0,
            'waitlist_no_capacity_count': 0,
            'avg_age_days': 0.0,
            'sla_breach_count': 0,
            'escalation_required_count': 0,
            'forced_action_count': 0,
        },
        'monitor_queue_rows': [],
        'monitor_immediate_action_rows': [],
        'monitor_filters': {
            'priority_mode': False,
            'search_query': '',
            'urgency': '',
            'provider_response_status': '',
            'region': '',
            'overdue_only': False,
            'rematch_recommended_only': False,
            'sort': 'default',
        },
        'monitor_region_choices': [],
        'monitor_status_choices': [
            (PlacementRequest.ProviderResponseStatus.PENDING, 'Nog niet vastgelegd'),
            (PlacementRequest.ProviderResponseStatus.NEEDS_INFO, 'Aanvullende info nodig'),
            (PlacementRequest.ProviderResponseStatus.WAITLIST, 'Wachtlijst'),
            (PlacementRequest.ProviderResponseStatus.REJECTED, 'Afgewezen'),
            (PlacementRequest.ProviderResponseStatus.NO_CAPACITY, 'Geen capaciteit'),
        ],
        'monitor_sort_choices': [
            ('default', 'Standaard triage'),
            ('urgency', 'Urgentie eerst'),
            ('oldest_waiting', 'Langst wachtend eerst'),
        ],
        'monitor_provider_overview_rows': [],
        'monitor_provider_overview_total_provider_count': 0,
        'monitor_provider_overview_is_truncated': False,
        'monitor_updated_at': timezone.now(),
        'monitor_has_active_filters': False,
    }

    if not org:
        messages.error(request, 'Geen actieve organisatie gevonden voor provider response monitor.')
        return render(request, 'contracts/provider_response_monitor.html', base_context)

    query_string = request.GET.urlencode()
    next_url = reverse('carelane:provider_response_monitor')
    if query_string:
        next_url = f'{next_url}?{query_string}'

    monitor = build_provider_response_monitor(
        org,
        user=request.user,
        filters=request.GET,
        next_url=next_url,
    )
    provider_overview = build_provider_response_overview(monitor['queue_rows'], limit=8)

    base_context.update(
        {
            'monitor_summary': monitor['summary'],
            'monitor_queue_rows': monitor['queue_rows'],
            'monitor_immediate_action_rows': monitor['immediate_action_rows'],
            'monitor_filters': monitor['filters'],
            'monitor_region_choices': monitor['region_choices'],
            'monitor_status_choices': monitor['status_choices'],
            'monitor_sort_choices': monitor['sort_choices'],
            'monitor_provider_overview_rows': provider_overview['rows'],
            'monitor_provider_overview_total_provider_count': provider_overview['total_provider_count'],
            'monitor_provider_overview_is_truncated': provider_overview['is_truncated'],
            'monitor_updated_at': timezone.now(),
            'monitor_has_active_filters': bool(query_string),
        }
    )

    return render(request, 'contracts/provider_response_monitor.html', base_context)


@login_required
@require_POST
def case_provider_response_action(request, pk):
    if getattr(settings, 'CARELANE_PILOT_SPA_ONLY', False):
        from django.http import HttpResponseRedirect
        return HttpResponseRedirect('/care/casussen')
    org = get_user_organization(request.user)
    intake = get_object_or_404(
        scope_queryset_for_organization(CaseIntakeProcess.objects.select_related('contract'), org),
        pk=pk,
    )

    if not _can_edit_intake(request.user, intake):
        return HttpResponseForbidden('Je hebt geen rechten om providerreacties voor deze casus te wijzigen.')
    archived_redirect = _redirect_if_archived_intake(
        request,
        intake,
        f"{reverse('carelane:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing",
    )
    if archived_redirect:
        return archived_redirect

    placement = PlacementRequest.objects.filter(
        due_diligence_process=intake,
    ).select_related('selected_provider', 'proposed_provider').order_by('-updated_at').first()

    next_fallback = f"{reverse('carelane:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing"

    if not placement:
        messages.error(request, 'Nog geen plaatsing beschikbaar. Start eerst via matching.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    actor_role, role_error_response = _require_workflow_actor_role(
        request,
        intake=intake,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
        failure_message='Alleen gemeente of admin/coördinatie kan providerreactie-orchestratie uitvoeren.',
    )
    if role_error_response is not None:
        return role_error_response

    normalized_action = (request.POST.get('action') or '').strip()
    normalized_action = {
        'resend': 'resend_request',
        'provide_info': 'provide_missing_info',
        'rematch': 'trigger_rematch',
    }.get(normalized_action, normalized_action)

    normalized_status, sla, recommendation_context, adaptive_flags = _build_provider_response_governance_context(placement)
    if normalized_status != placement.provider_response_status:
        _old_prs = placement.provider_response_status
        placement.provider_response_status = normalized_status
        placement.save(update_fields=['provider_response_status', 'updated_at'])
        emit_placement_response_status_changed(
            placement=placement, old_response_status=_old_prs,
            new_response_status=normalized_status, user=request.user,
        )

    provider_id = placement.selected_provider_id or placement.proposed_provider_id
    detect_and_log_sla_transition(
        case_id=intake.pk,
        placement_id=placement.pk,
        provider_id=provider_id,
        current_sla_state=str(sla['sla_state']),
        action_source='case_detail',
        sla_context={
            'hours_waiting': sla['hours_waiting'],
            'next_threshold_hours': sla['next_threshold_hours'],
        },
    )

    now = timezone.now()

    if normalized_action == 'resend_request':
        if normalized_status not in {
            PlacementRequest.ProviderResponseStatus.PENDING,
            PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        }:
            messages.error(request, 'Herinnering is alleen toegestaan voor open providerreacties.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        _old_prs = placement.provider_response_status
        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.PENDING
        placement.provider_response_requested_at = now
        placement.provider_response_last_reminder_at = now
        placement.provider_response_deadline_at = now + timedelta(days=3)
        placement.save(update_fields=[
            'provider_response_status',
            'provider_response_requested_at',
            'provider_response_last_reminder_at',
            'provider_response_deadline_at',
            'updated_at',
        ])
        emit_placement_response_status_changed(
            placement=placement, old_response_status=_old_prs,
            new_response_status=PlacementRequest.ProviderResponseStatus.PENDING, user=request.user,
        )
        log_action(
            request.user,
            AuditLog.Action.UPDATE,
            'PlacementRequest',
            object_id=placement.id,
            object_repr=f'{intake.title} -> provider response resend',
            changes={
                'provider_response_action': 'resend_request',
                'provider_response_due_days': 3,
                'intake_id': intake.id,
                'placement_id': placement.id,
                'source': 'case_detail',
                'sla_state': sla['sla_state'],
            },
            request=request,
        )
        log_case_decision_event(
            case_id=intake.pk,
            placement_id=placement.pk,
            event_type=CaseDecisionLog.EventType.RESEND_TRIGGERED,
            recommendation_context=recommendation_context,
            user_action='resend_request',
            actor_user_id=request.user.id,
            action_source='case_detail',
            provider_id=provider_id,
            adaptive_flags=adaptive_flags,
            sla_state=str(sla['sla_state']),
        )
        messages.success(request, 'Verzoek opnieuw verstuurd naar aanbieder')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    if normalized_action == 'provide_missing_info':
        if normalized_status != PlacementRequest.ProviderResponseStatus.NEEDS_INFO:
            messages.error(request, 'Aanvullende informatie kan alleen worden geregistreerd voor providerreacties die nog extra informatie nodig hebben.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        stamped_note = f"[{now.strftime('%d-%m-%Y %H:%M')}] Aanvullende informatie aangeleverd"
        existing_notes = placement.provider_response_notes or ''
        _old_prs = placement.provider_response_status
        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.PENDING
        placement.provider_response_requested_at = now
        placement.provider_response_deadline_at = now + timedelta(days=3)
        placement.provider_response_notes = f"{existing_notes}\n{stamped_note}".strip()
        placement.save(update_fields=[
            'provider_response_status',
            'provider_response_requested_at',
            'provider_response_deadline_at',
            'provider_response_notes',
            'updated_at',
        ])
        emit_placement_response_status_changed(
            placement=placement, old_response_status=_old_prs,
            new_response_status=PlacementRequest.ProviderResponseStatus.PENDING, user=request.user,
        )
        log_action(
            request.user,
            AuditLog.Action.UPDATE,
            'PlacementRequest',
            object_id=placement.id,
            object_repr=f'{intake.title} -> missing info provided',
            changes={
                'provider_response_action': 'provide_missing_info',
                'intake_id': intake.id,
                'placement_id': placement.id,
                'source': 'case_detail',
                'sla_state': sla['sla_state'],
            },
            request=request,
        )
        log_case_decision_event(
            case_id=intake.pk,
            placement_id=placement.pk,
            event_type=CaseDecisionLog.EventType.PROVIDE_MISSING_INFO,
            recommendation_context=recommendation_context,
            user_action='provide_missing_info',
            actor_user_id=request.user.id,
            action_source='case_detail',
            provider_id=provider_id,
            adaptive_flags=adaptive_flags,
            sla_state=str(sla['sla_state']),
        )
        messages.success(request, 'Aanvullende informatie geregistreerd en providerreactie opnieuw opengezet.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    if normalized_action == 'continue_waiting':
        if normalized_status not in {
            PlacementRequest.ProviderResponseStatus.PENDING,
            PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        } or sla['sla_state'] != 'FORCED_ACTION':
            messages.error(request, 'Alleen beschikbaar bij open reacties met SLA FORCED_ACTION.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        if request.POST.get('confirm_forced_wait') != '1':
            messages.error(request, 'Bevestig wachten ondanks SLA FORCED_ACTION.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        forced_wait_reason = (request.POST.get('forced_wait_reason') or '').strip()
        log_action(
            request.user,
            AuditLog.Action.UPDATE,
            'PlacementRequest',
            object_id=placement.id,
            object_repr=f'{intake.title} -> continue waiting',
            changes={
                'provider_response_action': 'continue_waiting_forced_action',
                'intake_id': intake.id,
                'placement_id': placement.id,
                'source': 'case_detail',
                'sla_state': 'FORCED_ACTION',
                'forced_wait_reason': forced_wait_reason,
            },
            request=request,
        )
        log_case_decision_event(
            case_id=intake.pk,
            placement_id=placement.pk,
            event_type=CaseDecisionLog.EventType.CONTINUE_WAITING,
            recommendation_context=recommendation_context,
            user_action='continue_waiting',
            actor_user_id=request.user.id,
            action_source='case_detail',
            provider_id=provider_id,
            adaptive_flags=adaptive_flags,
            sla_state='FORCED_ACTION',
            override_type='action_override',
            recommended_value={'action': 'trigger_rematch'},
            actual_value={'action': 'continue_waiting'},
            optional_reason=forced_wait_reason,
        )
        messages.success(request, 'Wachten ondanks SLA FORCED_ACTION is gelogd.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    if normalized_action == 'trigger_rematch':
        if normalized_status not in {
            PlacementRequest.ProviderResponseStatus.REJECTED,
            PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        } and sla['sla_state'] != 'FORCED_ACTION':
            messages.error(request, 'Her-match alleen na afwijzing, geen capaciteit, wachtlijst of SLA FORCED_ACTION.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        can_match, match_blocker = intake.can_enter_matching()
        if not can_match:
            messages.error(request, match_blocker or 'Casus kan niet terug naar matching.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        existing = placement.decision_notes or ''
        stamped_note = f"[{now.strftime('%d-%m-%Y %H:%M')}] Her-match gestart vanuit providerreactie-orchestratie."
        _old_pl_status = placement.status
        _old_prs = placement.provider_response_status
        placement.status = PlacementRequest.Status.REJECTED
        placement.provider_response_status = normalized_status
        placement.decision_notes = f"{existing}\n{stamped_note}".strip()
        placement.save(update_fields=['status', 'provider_response_status', 'decision_notes', 'updated_at'])
        emit_placement_status_changed(
            placement=placement, old_status=_old_pl_status,
            new_status=PlacementRequest.Status.REJECTED, user=request.user,
        )
        emit_placement_response_status_changed(
            placement=placement, old_response_status=_old_prs,
            new_response_status=normalized_status, user=request.user,
        )
        if intake.status != CaseIntakeProcess.ProcessStatus.MATCHING:
            intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
        if intake.workflow_state != WorkflowState.MATCHING_READY:
            intake.workflow_state = WorkflowState.MATCHING_READY
        intake.save(update_fields=['status', 'workflow_state', 'updated_at'])
        sync_case_phase_from_workflow_state(intake, user=request.user)
        log_action(
            request.user,
            AuditLog.Action.UPDATE,
            'PlacementRequest',
            object_id=placement.id,
            object_repr=f'{intake.title} -> rematch',
            changes={
                'provider_response_action': 'trigger_rematch',
                'intake_id': intake.id,
                'placement_id': placement.id,
                'intake_status': CaseIntakeProcess.ProcessStatus.MATCHING,
                'source': 'case_detail',
                'sla_state': sla['sla_state'],
            },
            request=request,
        )
        log_case_decision_event(
            case_id=intake.pk,
            placement_id=placement.pk,
            event_type=CaseDecisionLog.EventType.REMATCH_TRIGGERED,
            recommendation_context=recommendation_context,
            user_action='trigger_rematch',
            actor_user_id=request.user.id,
            action_source='case_detail',
            provider_id=provider_id,
            adaptive_flags=adaptive_flags,
            sla_state=str(sla['sla_state']),
        )
        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state=WorkflowState.PROVIDER_REJECTED,
            new_state=WorkflowState.MATCHING_READY,
            action=WorkflowAction.REMATCH,
            placement=placement,
            source='case_provider_response_action',
        )
        messages.success(request, 'Her-match geactiveerd. Casus staat weer in matchingfase.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    messages.error(request, 'Onbekende providerreactie-actie.')
    return _redirect_to_safe_next_or_default(request, next_fallback)
