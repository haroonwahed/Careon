from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.http import HttpResponseForbidden, JsonResponse
from django.urls import reverse
from django.contrib import messages
from django.db.models import Q, Count, Avg
from django.utils import timezone
from django.conf import settings
from django.core.exceptions import ValidationError
from datetime import date, timedelta
from collections import defaultdict
import logging

from ..models import (
    CareCase, CaseIntakeProcess, PlacementRequest, Client, ProviderProfile,
    AuditLog, RegionalConfiguration, MunicipalityConfiguration, CaseDecisionLog,
    CaseAssessment, OutcomeReasonCode,
)
from ..middleware import log_action
from ..permissions import CaseAction, can_access_case_action, can_manage_organization
from ..tenancy import get_user_organization, scope_queryset_for_organization
from ..workflow_state_machine import (
    WorkflowAction, WorkflowRole, WorkflowState,
    derive_workflow_state, evaluate_transition, log_transition_event,
    normalize_provider_rejection_states, resolve_actor_role,
    sync_case_phase_from_workflow_state,
)
from ..governance import (
    build_matching_recommendation_payload, detect_and_log_sla_transition, log_case_decision_event,
)
from ..case_intelligence import evaluate_case_intelligence
from ..case_timeline import record_gemeente_validation_to_provider_review_boundary
from ..operational_decision_contract import build_operational_decision_for_intake
from ..operational_decision_presenter import present_operational_decision
from contracts.workflow_bus import (
    emit_placement_response_status_changed,
    emit_placement_status_changed,
)
from .matching import (
    _build_matching_suggestions_for_intake, _build_canonical_matching_suggestions_for_intake,
    _assign_provider_to_intake, _prepare_waitlist_proposal_for_intake,
    _build_match_context_from_intake, _region_pressure_summary,
    _build_case_intelligence_context, _build_provider_outcome_context,
    _build_matching_map_context, _provider_profile_match_surface,
    _provider_capacity_filter_key, _provider_region_fit_key,
    _sync_matching_signals_for_intake,
    PROVIDER_AGE_BAND_FILTER_CHOICES, PROVIDER_CARE_FORM_FILTER_CHOICES,
)
from .communication import (
    _build_case_communication_context, _build_case_provider_response_context,
    build_provider_response_monitor, build_provider_response_overview,
    _normalize_provider_response_status_code,
)
from .case_flow import (
    _can_edit_intake, _require_workflow_actor_role, _can_archive_intake,
    _redirect_if_archived_intake, sync_case_flow_state, _intake_is_archived,
)
from ._utils import (
    _redirect_to_safe_next_or_default, _log_pilot_issue, _resolved_intake_urgency,
)

logger = logging.getLogger(__name__)


@login_required
def matching_dashboard(request):
    """Show actionable assessment-to-provider matching suggestions and assignments."""
    org = get_user_organization(request.user)
    if not org:
        messages.error(request, 'Geen actieve organisatie gevonden voor matching.')
        return render(request, 'contracts/matching_dashboard.html', {'rows': [], 'total_ready': 0})

    from django.db.models import Case as DBCase, IntegerField as DBInt, Value, When
    _urgency_bucket_expr = DBCase(
        When(
            due_diligence_process__urgency_validated=True,
            due_diligence_process__urgency_granted_date__isnull=False,
            then=Value(0),
        ),
        default=Value(1),
        output_field=DBInt(),
    )
    approved_assessments_qs = (
        CaseAssessment.objects.filter(
            due_diligence_process__organization=org,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
        ).exclude(due_diligence_process__status=CaseIntakeProcess.ProcessStatus.ARCHIVED)
        .select_related('due_diligence_process', 'due_diligence_process__care_category_main', 'assessed_by')
        .annotate(_wl_bucket=_urgency_bucket_expr)
        # Waitlist order: validated urgent (by urgency_granted_date) first,
        # then non-urgent by start_date ascending (aanmeldingsdatum / FCFS).
        .order_by(
            '_wl_bucket',
            'due_diligence_process__urgency_granted_date',
            'due_diligence_process__start_date',
        )
    )

    selected_intake = None
    selected_intake_raw = (request.GET.get('intake') or '').strip()
    if selected_intake_raw.isdigit():
        selected_intake = CaseIntakeProcess.objects.filter(organization=org, pk=int(selected_intake_raw)).exclude(
            status=CaseIntakeProcess.ProcessStatus.ARCHIVED
        ).first()
        if selected_intake:
            approved_assessments_qs = approved_assessments_qs.filter(due_diligence_process=selected_intake)
        else:
            messages.warning(request, 'De gekozen casus is niet gevonden. Alle matchingitems worden getoond.')
            _log_pilot_issue(
                request,
                category='matching_invalid_intake_filter',
                detail=f'intake={selected_intake_raw}',
            )

    if request.method == 'POST' and request.POST.get('action') == 'assign':
        assessment = get_object_or_404(approved_assessments_qs, pk=request.POST.get('assessment_id'))
        intake = assessment.intake
        if not _can_edit_intake(request.user, intake):
            _log_pilot_issue(
                request,
                category='matching_forbidden',
                detail=f'intake={getattr(intake, "pk", "-")}',
            )
            return HttpResponseForbidden('Je hebt geen rechten om matching voor deze casus bij te werken.')

        messages.info(request, 'Toewijzen verloopt vanuit de casuswerkruimte.')
        return redirect(f"{reverse('carelane:case_detail', kwargs={'pk': intake.pk})}?tab=matching")

    provider_profiles = list(
        ProviderProfile.objects.filter(client__organization=org, client__status='ACTIVE')
        .select_related('client')
        .prefetch_related('target_care_categories', 'served_regions')
    )
    provider_profiles_by_id = {profile.client_id: profile for profile in provider_profiles}
    provider_query = (request.GET.get('provider_q') or '').strip().lower()
    provider_age_band = (request.GET.get('provider_age_band') or '').strip()
    provider_care_form = (request.GET.get('provider_care_form') or '').strip()
    provider_region_fit = (request.GET.get('provider_region_fit') or '').strip().lower()
    provider_capacity = (request.GET.get('provider_capacity') or '').strip().lower()

    assessments = list(approved_assessments_qs)
    assessments_by_intake = {assessment.due_diligence_process_id: assessment for assessment in assessments}
    assigned_by_intake = {
        placement.due_diligence_process_id: placement
        for placement in PlacementRequest.objects.filter(
            due_diligence_process_id__in=assessments_by_intake.keys(),
            selected_provider__isnull=False,
        ).select_related('selected_provider')
    }

    capacity_failure_labels = {
        'no_capacity': 'Geen capaciteit',
        'waitlist': 'Wachtlijst',
        'rejection': 'Afwijzing',
    }

    rows = []
    no_match_count = 0
    capacity_pressure_count = 0
    for assessment in assessments:
        intake = assessment.intake
        can_assign = _can_edit_intake(request.user, intake)
        canonical_suggestions, excluded_candidates = _build_canonical_matching_suggestions_for_intake(
            intake,
            org,
            limit=5,
        )
        suggestions = canonical_suggestions or _build_matching_suggestions_for_intake(intake, provider_profiles, limit=5)
        _sync_matching_signals_for_intake(intake, suggestions, excluded_candidates)
        decision = build_operational_decision_for_intake(intake.pk)
        decision_payload = decision.to_dict() if decision else {}

        blocker_label = decision_payload.get('blocker_label') or ''
        failure_reason = blocker_label or (decision_payload.get('recommended_action') or {}).get('reason') or 'Geen passende aanbieder'
        presented_decision = present_operational_decision(
            decision_payload,
            action_defaults={
                'label': 'Vraag aanvullende regio-opties op',
                'reason': failure_reason,
                'url': reverse('carelane:assessment_detail', kwargs={'pk': assessment.pk}),
            },
            impact_defaults={
                'text': 'Vergroot kans op match',
                'type': 'positive',
            },
            fallback_reason=failure_reason,
        )

        normalized_suggestions = []
        pressure_context = _region_pressure_summary(
            intake=intake,
            provider_profiles=provider_profiles,
            region_id=(intake.regio_id or intake.preferred_region_id),
        )
        for suggestion in suggestions[:5]:
            provider_profile = provider_profiles_by_id.get(suggestion.get('provider_id'))
            provider_surface = _provider_profile_match_surface(provider_profile)
            provider_name = suggestion.get('provider_name') or 'Onbekende aanbieder'
            free_slots_raw = suggestion.get('free_slots')
            wait_days_raw = suggestion.get('avg_wait_days')
            free_slots = free_slots_raw if isinstance(free_slots_raw, (int, float)) else None
            wait_days = wait_days_raw if isinstance(wait_days_raw, (int, float)) else None
            region_match = suggestion.get('region_match')
            region_type_match = bool(suggestion.get('region_type_match'))
            capacity_filter_key = _provider_capacity_filter_key({'free_slots': free_slots, 'avg_wait_days': wait_days})
            region_fit_key = _provider_region_fit_key({'region_match': region_match, 'region_type_match': region_type_match})

            if free_slots is not None and free_slots <= 0:
                matching_status = 'Geen directe capaciteit'
                local_failure_reason = 'Capaciteitstekort in regio'
            elif wait_days is not None and wait_days > 28:
                matching_status = 'Wachtlijstrisico'
                local_failure_reason = 'Wachttijd loopt op'
            elif wait_days is None and free_slots is None:
                matching_status = 'Onvoldoende capaciteitsdata'
                local_failure_reason = 'Capaciteitscontext ontbreekt'
            else:
                matching_status = 'Matchbaar'
                local_failure_reason = failure_reason

            operational_signals = []
            if free_slots is not None:
                if free_slots <= 0:
                    operational_signals.append({'label': 'Geen capaciteit', 'chip_tone': 'red'})
                elif free_slots <= 2:
                    operational_signals.append({'label': f'Capaciteit beperkt ({int(free_slots)})', 'chip_tone': 'amber'})
                else:
                    operational_signals.append({'label': 'Capaciteit beschikbaar', 'chip_tone': 'green'})

            if wait_days is not None and len(operational_signals) < 2:
                if wait_days >= 35:
                    operational_signals.append({'label': 'Wachtlijst', 'chip_tone': 'red'})
                elif wait_days > 21:
                    operational_signals.append({'label': f'{int(wait_days)}d wachttijd', 'chip_tone': 'amber'})
                else:
                    operational_signals.append({'label': f'{int(wait_days)}d wachttijd', 'chip_tone': 'green'})

            if region_match is False and len(operational_signals) < 2:
                operational_signals.append({'label': 'Regio: afwijking', 'chip_tone': 'amber'})

            if any(signal['label'] in ['Geen capaciteit', 'Wachtlijst'] for signal in operational_signals):
                capacity_pressure_count += 1

            search_blob = ' '.join(
                part for part in [
                    provider_name,
                    suggestion.get('specialization_summary') or '',
                    provider_surface['age_summary'],
                    provider_surface['care_form_summary'],
                    provider_surface['gender_summary'],
                    suggestion.get('region_context') or '',
                ]
                if part
            ).lower()

            normalized_suggestion = dict(suggestion)
            normalized_suggestion.update({
                'provider_name': provider_name,
                'match_score': suggestion.get('match_score') if isinstance(suggestion.get('match_score'), (int, float)) else 0,
                'fit_score': suggestion.get('fit_score') if isinstance(suggestion.get('fit_score'), (int, float)) else 0,
                'free_slots': free_slots,
                'avg_wait_days': wait_days,
                'operational_signals': operational_signals[:2],
                'matching_status': matching_status,
                'failure_reason': local_failure_reason,
                'region_type_match': region_type_match,
                'capacity_filter_key': capacity_filter_key,
                'region_fit_key': region_fit_key,
                'age_bands': provider_surface['age_bands'],
                'age_summary': provider_surface['age_summary'],
                'care_forms': provider_surface['care_forms'],
                'care_form_summary': provider_surface['care_form_summary'],
                'gender_restriction': provider_surface['gender_restriction'],
                'gender_summary': provider_surface['gender_summary'],
                'specialization_summary': provider_surface['specialization_summary'],
                'contra_summary': provider_surface['contra_summary'],
                'profile_summary': provider_surface['profile_summary'],
                'provider_search_blob': search_blob,
                'capacity_context': (
                    'Capaciteit onbekend'
                    if free_slots is None
                    else 'Geen vrije plekken'
                    if free_slots <= 0
                    else f'{int(free_slots)} vrije plekken'
                ),
                'wait_context': (
                    'Wachttijd onbekend'
                    if wait_days is None
                    else f'{int(wait_days)} dagen wachttijd'
                ),
                'region_context': 'Regio match' if region_match else 'Regio-afwijking',
                'region_pressure_status': pressure_context['status'],
                'region_pressure_note': (
                    'Alternatieve aanbieder beschikbaar in aangrenzende dekking met snellere intake'
                    if (not region_match and wait_days is not None and wait_days <= 14)
                    else pressure_context['message']
                ),
            })
            normalized_suggestions.append(normalized_suggestion)

        if provider_query or provider_age_band or provider_care_form or provider_region_fit or provider_capacity:
            normalized_suggestions = [
                suggestion
                for suggestion in normalized_suggestions
                if (
                    (not provider_query or provider_query in suggestion['provider_search_blob'])
                    and (not provider_age_band or provider_age_band in suggestion['age_bands'])
                    and (not provider_care_form or provider_care_form in suggestion['care_forms'])
                    and (
                        not provider_region_fit
                        or (
                            provider_region_fit == 'exact' and suggestion['region_fit_key'] == 'exact'
                        )
                        or (
                            provider_region_fit == 'compatible' and suggestion['region_fit_key'] in {'exact', 'compatible'}
                        )
                        or (
                            provider_region_fit == 'review' and suggestion['region_fit_key'] == 'review'
                        )
                    )
                    and (
                        not provider_capacity
                        or (
                            provider_capacity == 'direct' and suggestion['capacity_filter_key'] == 'direct'
                        )
                        or (
                            provider_capacity == 'limited' and suggestion['capacity_filter_key'] == 'limited'
                        )
                        or (
                            provider_capacity == 'full' and suggestion['capacity_filter_key'] == 'full'
                        )
                        or (
                            provider_capacity == 'unknown' and suggestion['capacity_filter_key'] == 'unknown'
                        )
                    )
                )
            ]

        if not normalized_suggestions:
            no_match_count += 1

        _assignment = assigned_by_intake.get(intake.id)
        selected_provider_id = _assignment.selected_provider_id if _assignment else (normalized_suggestions[0].get('provider_id') if normalized_suggestions else None)
        if normalized_suggestions:
            recommendation, recommendation_context, adaptive_flags = build_matching_recommendation_payload(
                normalized_suggestions,
                limit=3,
            )
            recommendation_context['source_view'] = 'matching_dashboard'
            log_case_decision_event(
                case_id=intake.pk,
                placement_id=_assignment.pk if _assignment else None,
                event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
                system_recommendation=recommendation,
                recommendation_context=recommendation_context,
                action_source='system',
                provider_id=recommendation.get('provider_id') if recommendation else None,
                adaptive_flags=adaptive_flags,
            )

        failure_states = decision_payload.get('capacity_failure_states') or []
        capacity_failure_signals = [
            capacity_failure_labels[state]
            for state in failure_states
            if state in capacity_failure_labels
        ]

        rows.append(
            {
                'assessment': assessment,
                'intake': intake,
                'can_assign': can_assign,
                'assigned_provider': _assignment.selected_provider if _assignment else None,
                'placement_pk': _assignment.pk if _assignment else None,
                'suggestions': normalized_suggestions,
                'has_provider_filters': bool(provider_query or provider_age_band or provider_care_form or provider_region_fit or provider_capacity),
                'active_provider_filters': {
                    'provider_q': provider_query,
                    'provider_age_band': provider_age_band,
                    'provider_care_form': provider_care_form,
                    'provider_region_fit': provider_region_fit,
                    'provider_capacity': provider_capacity,
                },
                'matching_map': _build_matching_map_context(intake, normalized_suggestions, selected_provider_id=selected_provider_id),
                'matching_status': 'Toegewezen' if _assignment else ('Geen passende aanbieder' if not normalized_suggestions else 'Matchkandidaten beschikbaar'),
                'failure_reason': failure_reason,
                'primary_signal': presented_decision['primary_signal'],
                'secondary_signal': presented_decision['secondary_signal'],
                'action_block': presented_decision['action_block'],
                'priority_indicator': presented_decision['priority_indicator'],
                'badges': presented_decision['badges'],
                'recommended_action': presented_decision['recommended_action'],
                'impact_summary': presented_decision['impact_summary'],
                'attention_band': presented_decision['attention_band'],
                'bottleneck_badge': presented_decision['bottleneck_badge'],
                'capacity_failure_signals': capacity_failure_signals,
                'decision_data_integrity_ok': bool(presented_decision['recommended_action'].get('label')) and bool(presented_decision['impact_summary'].get('text')),
            }
        )

    matching_operational_strip = None
    if no_match_count > 0:
        matching_operational_strip = {
            'severity': 'critical',
            'message': f'{no_match_count} casussen hebben geen match door capaciteitsdruk',
        }
    elif capacity_pressure_count > 0:
        matching_operational_strip = {
            'severity': 'warning',
            'message': f'{capacity_pressure_count} matchkandidaten tonen capaciteitsdruk of wachtlijstrisico',
        }

    context = {
        'rows': rows,
        'total_ready': len(rows),
        'assigned_count': len(assigned_by_intake),
        'selected_intake': selected_intake,
        'matching_operational_strip': matching_operational_strip,
        'decision_data_integrity_ok': all(row['decision_data_integrity_ok'] for row in rows),
        'has_provider_filters': bool(provider_query or provider_age_band or provider_care_form or provider_region_fit or provider_capacity),
        'selected_provider_q': provider_query,
        'selected_provider_age_band': provider_age_band,
        'selected_provider_care_form': provider_care_form,
        'selected_provider_region_fit': provider_region_fit,
        'selected_provider_capacity': provider_capacity,
        'provider_age_band_choices': PROVIDER_AGE_BAND_FILTER_CHOICES,
        'provider_care_form_choices': PROVIDER_CARE_FORM_FILTER_CHOICES,
        'provider_region_fit_choices': [
            ('', 'Alle regio-fit'),
            ('exact', 'Exacte regio'),
            ('compatible', 'Compatibel'),
            ('review', 'Te verifiëren'),
        ],
        'provider_capacity_choices': [
            ('', 'Alle capaciteit'),
            ('direct', 'Direct inzetbaar'),
            ('limited', 'Beperkt'),
            ('full', 'Vol'),
            ('unknown', 'Onbekend'),
        ],
    }
    return render(request, 'contracts/matching_dashboard.html', context)


@login_required
@require_POST
def case_matching_action(request, pk):
    if getattr(settings, 'CARELANE_PILOT_SPA_ONLY', False):
        from django.http import HttpResponseRedirect

        return HttpResponseRedirect('/care/matching')
    org = get_user_organization(request.user)
    intake = get_object_or_404(
        scope_queryset_for_organization(CaseIntakeProcess.objects.select_related('contract'), org),
        pk=pk,
    )

    if not _can_edit_intake(request.user, intake):
        return HttpResponseForbidden('Je hebt geen rechten om matching voor deze casus bij te werken.')
    archived_redirect = _redirect_if_archived_intake(
        request,
        intake,
        f"{reverse('carelane:case_detail', kwargs={'pk': intake.pk})}?tab=matching",
    )
    if archived_redirect:
        return archived_redirect

    actor_role, role_error_response = _require_workflow_actor_role(
        request,
        intake=intake,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
        failure_message='Alleen gemeente of admin/coördinatie kan matching doorzetten naar beoordeling door aanbieder.',
    )
    if role_error_response is not None:
        return role_error_response

    action = (request.POST.get('action') or '').strip()
    phase = (request.POST.get('phase') or '').strip()
    next_fallback = f"{reverse('carelane:case_detail', kwargs={'pk': intake.pk})}?tab=matching"
    if phase:
        next_fallback += f'&phase={phase}'

    if action == 'assign':
        provider = get_object_or_404(
            Client.objects.filter(organization=org, status='ACTIVE'),
            pk=request.POST.get('provider_id'),
        )
        try:
            provider_profiles = (
                ProviderProfile.objects.filter(client__organization=org, client__status='ACTIVE')
                .select_related('client')
                .prefetch_related('target_care_categories', 'served_regions')
            )
            suggestions = _build_matching_suggestions_for_intake(intake, provider_profiles, limit=5)
            recommended_value, recommendation_context, adaptive_flags = build_matching_recommendation_payload(
                suggestions,
                limit=3,
            )
            placement = _assign_provider_to_intake(request=request, intake=intake, provider=provider, source='case_detail')
        except ValidationError as exc:
            messages.error(request, '; '.join(exc.messages) or 'Matching kan nog niet worden gestart.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        previous_state = derive_workflow_state(intake=intake)
        validation_transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.GEMEENTE_VALIDATED,
            actor_role=actor_role,
            action=WorkflowAction.VALIDATE_MATCHING,
        )
        if not validation_transition.allowed:
            messages.error(request, validation_transition.reason)
            return _redirect_to_safe_next_or_default(request, next_fallback)

        transition = evaluate_transition(
            current_state=WorkflowState.GEMEENTE_VALIDATED,
            target_state=WorkflowState.PROVIDER_REVIEW_PENDING,
            actor_role=actor_role,
            action=WorkflowAction.SEND_TO_PROVIDER,
        )
        if not transition.allowed:
            messages.error(request, transition.reason)
            return _redirect_to_safe_next_or_default(request, next_fallback)

        if intake.workflow_state != WorkflowState.GEMEENTE_VALIDATED:
            intake.workflow_state = WorkflowState.GEMEENTE_VALIDATED
            intake.save(update_fields=['workflow_state', 'updated_at'])

        if intake.status != CaseIntakeProcess.ProcessStatus.DECISION:
            intake.status = CaseIntakeProcess.ProcessStatus.DECISION
            intake.workflow_state = WorkflowState.PROVIDER_REVIEW_PENDING
            intake.save(update_fields=['status', 'workflow_state', 'updated_at'])
        elif intake.workflow_state != WorkflowState.PROVIDER_REVIEW_PENDING:
            intake.workflow_state = WorkflowState.PROVIDER_REVIEW_PENDING
            intake.save(update_fields=['workflow_state', 'updated_at'])
        sync_case_phase_from_workflow_state(intake, user=request.user)

        log_case_decision_event(
            case_id=intake.pk,
            placement_id=placement.pk,
            event_type=CaseDecisionLog.EventType.PROVIDER_SELECTED,
            recommendation_context=recommendation_context,
            user_action='assign_provider',
            actor_user_id=request.user.id,
            action_source='case_detail',
            provider_id=provider.id,
            adaptive_flags=adaptive_flags,
            override_type='provider_selection' if recommended_value and recommended_value.get('provider_id') != provider.id else None,
            recommended_value=recommended_value,
            actual_value={
                'provider_id': provider.id,
                'provider_name': provider.name,
            },
        )
        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state=previous_state,
            new_state=WorkflowState.GEMEENTE_VALIDATED,
            action=WorkflowAction.VALIDATE_MATCHING,
            source='case_matching_action',
        )
        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state=WorkflowState.GEMEENTE_VALIDATED,
            new_state=WorkflowState.PROVIDER_REVIEW_PENDING,
            action=WorkflowAction.SEND_TO_PROVIDER,
            placement=placement,
            source='case_matching_action',
        )
        record_gemeente_validation_to_provider_review_boundary(
            intake=intake,
            placement=placement,
            request=request,
            actor_role=actor_role,
            workflow_state_before_action=previous_state,
            source='case_matching_action',
        )
        messages.success(request, f'Aanbieder {provider.name} gekoppeld aan casus "{intake.title}".')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    if action == 'prepare_waitlist_proposal':
        provider = get_object_or_404(
            Client.objects.filter(organization=org, status='ACTIVE'),
            pk=request.POST.get('provider_id'),
        )
        assessment = getattr(intake, 'case_assessment', None)
        active_for_block = (
            PlacementRequest.objects.filter(due_diligence_process=intake)
            .order_by('-updated_at', '-created_at')
            .first()
        )
        if active_for_block and active_for_block.status == PlacementRequest.Status.IN_REVIEW:
            messages.error(
                request,
                'Deze casus is al naar de aanbieder verstuurd; wachtlijstvoorstel kan niet meer als concept worden vastgelegd.',
            )
            return _redirect_to_safe_next_or_default(request, next_fallback)

        previous_state = derive_workflow_state(intake=intake, assessment=assessment)
        if previous_state == WorkflowState.MATCHING_READY:
            validation_transition = evaluate_transition(
                current_state=WorkflowState.MATCHING_READY,
                target_state=WorkflowState.GEMEENTE_VALIDATED,
                actor_role=actor_role,
                action=WorkflowAction.VALIDATE_MATCHING,
            )
            if not validation_transition.allowed:
                messages.error(request, validation_transition.reason)
                return _redirect_to_safe_next_or_default(request, next_fallback)
        elif previous_state == WorkflowState.GEMEENTE_VALIDATED:
            pass
        else:
            messages.error(
                request,
                'Wachtlijstvoorstel kan alleen worden vastgelegd tijdens matching of na eerdere gemeente-validatie zonder verzending naar aanbieder.',
            )
            return _redirect_to_safe_next_or_default(request, next_fallback)

        raw_score = (request.POST.get('match_score') or '').strip()
        match_score = None
        if raw_score:
            try:
                match_score = int(raw_score)
            except ValueError:
                match_score = None

        try:
            placement = _prepare_waitlist_proposal_for_intake(
                request=request,
                intake=intake,
                provider=provider,
                source='case_matching_action_prepare_waitlist',
                match_score=match_score,
            )
        except ValidationError as exc:
            messages.error(request, '; '.join(exc.messages) or 'Wachtlijstvoorstel mislukt.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        intake.workflow_state = WorkflowState.GEMEENTE_VALIDATED
        if intake.status != CaseIntakeProcess.ProcessStatus.DECISION:
            intake.status = CaseIntakeProcess.ProcessStatus.DECISION
        intake.save(update_fields=['workflow_state', 'status', 'updated_at'])
        sync_case_phase_from_workflow_state(intake, user=request.user)

        if previous_state == WorkflowState.MATCHING_READY:
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=previous_state,
                new_state=WorkflowState.GEMEENTE_VALIDATED,
                action=WorkflowAction.VALIDATE_MATCHING,
                placement=placement,
                source='case_matching_action_prepare_waitlist',
            )

        case_detail_url = reverse('carelane:case_detail', kwargs={'pk': intake.pk})
        messages.success(
            request,
            f'Wachtlijstvoorstel (concept) vastgelegd voor {provider.name}. Controleer de casus voordat u naar de aanbieder verzendt.',
        )
        return _redirect_to_safe_next_or_default(request, case_detail_url)

    if action == 'reject':
        provider = get_object_or_404(
            Client.objects.filter(organization=org, status='ACTIVE'),
            pk=request.POST.get('provider_id'),
        )
        rejection_reason = (request.POST.get('reason') or '').strip() or 'Afgewezen in casusdetail.'
        log_action(
            request.user,
            AuditLog.Action.REJECT,
            'MatchingRecommendation',
            object_id=provider.id,
            object_repr=f'{intake.title} -> {provider.name}',
            changes={
                'intake_id': intake.id,
                'provider_id': provider.id,
                'provider_name': provider.name,
                'reason': rejection_reason,
                'phase': phase,
                'source': 'case_detail',
            },
            request=request,
        )
        messages.success(request, f'Aanbieder {provider.name} gemarkeerd als afgewezen voor deze casus.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    messages.error(request, 'Onbekende matching-actie.')
    return _redirect_to_safe_next_or_default(request, next_fallback)


@login_required
@require_POST
def case_outcome_action(request, pk):
    if getattr(settings, 'CARELANE_PILOT_SPA_ONLY', False):
        from django.http import HttpResponseRedirect
        return HttpResponseRedirect('/care/casussen')
    org = get_user_organization(request.user)
    intake = get_object_or_404(
        scope_queryset_for_organization(CaseIntakeProcess.objects.select_related('contract'), org),
        pk=pk,
    )

    if not _can_edit_intake(request.user, intake):
        return HttpResponseForbidden('Je hebt geen rechten om uitkomstregistratie voor deze casus te wijzigen.')
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
        allowed_roles={WorkflowRole.ZORGAANBIEDER},
        failure_message='Alleen een zorgaanbieder kan een beoordeling door aanbieder registreren.',
    )
    if role_error_response is not None:
        return role_error_response

    outcome_type = str(request.POST.get('outcome_type') or '').strip().lower()
    now = timezone.now()

    if outcome_type == 'provider_response':
        raw_status = request.POST.get('status')
        normalized_status = _normalize_provider_response_status_code(raw_status)
        valid_statuses = {choice[0] for choice in PlacementRequest.ProviderResponseStatus.choices}
        if normalized_status not in valid_statuses:
            messages.error(request, 'Ongeldige providerreactie-status.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        reason_code = str(request.POST.get('reason_code') or OutcomeReasonCode.NONE).strip().upper()
        valid_reason_codes = {choice[0] for choice in OutcomeReasonCode.choices}
        if reason_code not in valid_reason_codes:
            reason_code = OutcomeReasonCode.NONE
        if normalized_status == PlacementRequest.ProviderResponseStatus.REJECTED and reason_code == OutcomeReasonCode.NONE:
            messages.error(request, 'Afwijzing vereist een reden.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        notes = (request.POST.get('notes') or '').strip()
        previous_state = derive_workflow_state(intake=intake, placement=placement)
        if normalized_status == PlacementRequest.ProviderResponseStatus.ACCEPTED:
            target_state = WorkflowState.PROVIDER_ACCEPTED
            action_name = WorkflowAction.PROVIDER_ACCEPT
        elif normalized_status in normalize_provider_rejection_states():
            target_state = WorkflowState.PROVIDER_REJECTED
            action_name = WorkflowAction.PROVIDER_REJECT
        else:
            target_state = WorkflowState.PROVIDER_REVIEW_PENDING
            action_name = WorkflowAction.PROVIDER_REQUEST_INFO

        transition = evaluate_transition(
            current_state=previous_state,
            target_state=target_state,
            actor_role=actor_role,
            action=action_name,
        )
        if not transition.allowed:
            messages.error(request, transition.reason)
            return _redirect_to_safe_next_or_default(request, next_fallback)

        _old_prs = placement.provider_response_status
        placement.provider_response_status = normalized_status
        placement.provider_response_reason_code = reason_code
        placement.provider_response_notes = notes
        placement.provider_response_recorded_at = now
        placement.provider_response_recorded_by = request.user
        if normalized_status in {
            PlacementRequest.ProviderResponseStatus.PENDING,
            PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        } and placement.provider_response_requested_at is None:
            placement.provider_response_requested_at = now
        placement.save(
            update_fields=[
                'provider_response_status',
                'provider_response_reason_code',
                'provider_response_notes',
                'provider_response_recorded_at',
                'provider_response_recorded_by',
                'provider_response_requested_at',
                'updated_at',
            ]
        )
        emit_placement_response_status_changed(
            placement=placement, old_response_status=_old_prs,
            new_response_status=normalized_status, user=request.user,
        )

        log_action(
            request.user,
            AuditLog.Action.UPDATE,
            'PlacementRequest',
            object_id=placement.id,
            object_repr=f'{intake.title} -> provider response outcome',
            changes={
                'outcome_type': 'provider_response',
                'status': normalized_status,
                'reason_code': reason_code,
                'intake_id': intake.id,
                'placement_id': placement.id,
                'source': 'case_detail',
            },
            request=request,
        )

        new_state = target_state
        if intake.workflow_state != new_state:
            intake.workflow_state = new_state
            intake.save(update_fields=['workflow_state', 'updated_at'])
            sync_case_phase_from_workflow_state(intake, user=request.user)
        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state=previous_state,
            new_state=new_state,
            action=action_name,
            placement=placement,
            reason=notes,
            source='case_outcome_action',
        )
        messages.success(request, 'Providerreactie-uitkomst opgeslagen.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    messages.error(request, 'Onbekend uitkomsttype.')
    return _redirect_to_safe_next_or_default(request, next_fallback)


@login_required
@require_POST
def case_placement_action(request, pk):
    if getattr(settings, 'CARELANE_PILOT_SPA_ONLY', False):
        from django.http import HttpResponseRedirect
        return HttpResponseRedirect('/care/casussen')
    org = get_user_organization(request.user)
    intake = get_object_or_404(
        scope_queryset_for_organization(CaseIntakeProcess.objects.select_related('contract'), org),
        pk=pk,
    )

    if not _can_edit_intake(request.user, intake):
        return HttpResponseForbidden('Je hebt geen rechten om plaatsing voor deze casus te wijzigen.')
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
        failure_message='Alleen gemeente of admin/coördinatie kan een plaatsing bevestigen of terugzetten.',
    )
    if role_error_response is not None:
        return role_error_response

    status = (request.POST.get('status') or '').strip()
    valid_statuses = {choice[0] for choice in PlacementRequest.Status.choices}
    if status not in valid_statuses:
        messages.error(request, 'Ongeldige plaatsingsstatus.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    previous_state = derive_workflow_state(intake=intake, placement=placement)
    if status == PlacementRequest.Status.APPROVED:
        allowed_for_status, status_blocker = placement.can_transition_to_status(PlacementRequest.Status.APPROVED)
        if not allowed_for_status:
            messages.error(request, status_blocker or 'Deze plaatsing kan nog niet naar de gevraagde status.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        target_state = WorkflowState.PLACEMENT_CONFIRMED
        action_name = WorkflowAction.CONFIRM_PLACEMENT
    elif status == PlacementRequest.Status.REJECTED:
        target_state = WorkflowState.MATCHING_READY
        action_name = WorkflowAction.REMATCH
    else:
        target_state = previous_state
        action_name = WorkflowAction.CONFIRM_PLACEMENT

    transition = evaluate_transition(
        current_state=previous_state,
        target_state=target_state,
        actor_role=actor_role,
        action=action_name,
    )
    if not transition.allowed:
        messages.error(request, transition.reason)
        return _redirect_to_safe_next_or_default(request, next_fallback)

    if status == PlacementRequest.Status.REJECTED and placement.provider_response_status not in normalize_provider_rejection_states():
        messages.error(request, 'Rematch is alleen toegestaan na afwijzing, wachtlijst of geen capaciteit.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    allowed, blocker = placement.can_transition_to_status(status)
    if not allowed:
        messages.error(request, blocker or 'Deze plaatsing kan nog niet naar de gevraagde status.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    update_fields = ['updated_at']
    changes = {'status': status}

    if placement.status != status:
        placement.status = status
        update_fields.append('status')

    note = (request.POST.get('note') or '').strip()
    if note:
        existing = placement.decision_notes or ''
        stamped_note = f"[{timezone.now().strftime('%d-%m-%Y %H:%M')}] {note}"
        placement.decision_notes = f"{existing}\n{stamped_note}".strip()
        update_fields.append('decision_notes')
        changes['note'] = note

    if placement.status == PlacementRequest.Status.APPROVED and not placement.start_date:
        start_date = date.today()
        placement.start_date = start_date
        update_fields.append('start_date')
        changes['start_date'] = start_date.isoformat()

    if status == PlacementRequest.Status.REJECTED and intake.status != CaseIntakeProcess.ProcessStatus.MATCHING:
        intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
        intake.workflow_state = WorkflowState.MATCHING_READY
        intake.save(update_fields=['status', 'workflow_state', 'updated_at'])
        sync_case_phase_from_workflow_state(intake, user=request.user)

    if status == PlacementRequest.Status.APPROVED:
        intake.workflow_state = WorkflowState.PLACEMENT_CONFIRMED
        intake.save(update_fields=['workflow_state', 'updated_at'])
        sync_case_phase_from_workflow_state(intake, user=request.user)

    placement.save(update_fields=list(dict.fromkeys(update_fields)))
    log_action(
        request.user,
        AuditLog.Action.UPDATE,
        'PlacementRequest',
        object_id=placement.id,
        object_repr=str(placement),
        changes=changes,
        request=request,
    )
    provider_id = placement.selected_provider_id or placement.proposed_provider_id
    if provider_id and status in {PlacementRequest.Status.APPROVED, PlacementRequest.Status.REJECTED}:
        log_case_decision_event(
            case_id=intake.pk,
            placement_id=placement.pk,
            event_type=(
                CaseDecisionLog.EventType.PROVIDER_SELECTED
                if status == PlacementRequest.Status.APPROVED
                else CaseDecisionLog.EventType.REMATCH_TRIGGERED
            ),
            recommendation_context={
                'placement_status': status,
                'case_id': intake.pk,
                'placement_id': placement.pk,
            },
            user_action='approve_placement' if status == PlacementRequest.Status.APPROVED else 'reject_placement',
            actor_user_id=request.user.id,
            action_source='case_detail',
            provider_id=provider_id,
            override_type='placement_confirmation' if status == PlacementRequest.Status.APPROVED else 'placement_rejection',
            actual_value={
                'status': status,
                'note_present': bool(note),
            },
            optional_reason=note or None,
        )

    new_state = target_state
    if intake.workflow_state != new_state:
        intake.workflow_state = new_state
        intake.save(update_fields=['workflow_state', 'updated_at'])
    log_transition_event(
        intake=intake,
        actor_user=request.user,
        actor_role=actor_role,
        old_state=previous_state,
        new_state=new_state,
        action=action_name,
        placement=placement,
        reason=note,
        source='case_placement_action',
    )
    messages.success(request, 'Plaatsing bijgewerkt vanuit de casuswerkruimte.')
    return _redirect_to_safe_next_or_default(request, next_fallback)


@login_required
@require_POST
def case_archive_action(request, pk):
    if getattr(settings, 'CARELANE_PILOT_SPA_ONLY', False):
        from django.http import HttpResponseRedirect
        return HttpResponseRedirect('/care/casussen')
    org = get_user_organization(request.user)
    intake = get_object_or_404(
        scope_queryset_for_organization(CaseIntakeProcess.objects.select_related('contract'), org),
        pk=pk,
    )

    if not can_manage_organization(request.user, org):
        return HttpResponseForbidden('Je hebt geen rechten om deze casus te archiveren.')

    actor_role = resolve_actor_role(user=request.user, organization=org)

    next_fallback = f"{reverse('carelane:case_detail', kwargs={'pk': intake.pk})}"
    if _intake_is_archived(intake):
        messages.info(request, 'Deze casus is al gearchiveerd.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    if intake.status != CaseIntakeProcess.ProcessStatus.COMPLETED:
        messages.error(request, 'Casus archiveren kan pas nadat de casus is afgerond.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    placement = (
        PlacementRequest.objects
        .filter(due_diligence_process=intake)
        .order_by('-updated_at')
        .first()
    )
    previous_state = derive_workflow_state(intake=intake, placement=placement)
    transition = evaluate_transition(
        current_state=previous_state,
        target_state=WorkflowState.ARCHIVED,
        actor_role=actor_role,
        action=WorkflowAction.ARCHIVE_CASE,
    )
    if not transition.allowed:
        messages.error(request, transition.reason)
        return _redirect_to_safe_next_or_default(request, next_fallback)

    case_record = intake.case_record
    update_fields = ['status', 'workflow_state', 'updated_at']
    intake.status = CaseIntakeProcess.ProcessStatus.ARCHIVED
    intake.workflow_state = WorkflowState.ARCHIVED
    intake.save(update_fields=update_fields)

    if case_record is not None and case_record.lifecycle_stage != 'ARCHIVED':
        case_record.lifecycle_stage = 'ARCHIVED'
        case_record.save(update_fields=['lifecycle_stage', 'updated_at'])

    log_action(
        request.user,
        AuditLog.Action.UPDATE,
        'CaseIntakeProcess',
        object_id=intake.id,
        object_repr=str(intake),
        changes={
            'action': 'archive_case',
            'intake_status': CaseIntakeProcess.ProcessStatus.ARCHIVED,
            'case_lifecycle_stage': 'ARCHIVED' if case_record else None,
        },
        request=request,
    )
    log_transition_event(
        intake=intake,
        actor_user=request.user,
        actor_role=actor_role,
        old_state=previous_state,
        new_state=WorkflowState.ARCHIVED,
        action=WorkflowAction.ARCHIVE_CASE,
        placement=placement,
        source='case_archive_action',
    )
    messages.success(
        request,
        'Deze casus blijft bewaard, maar verdwijnt uit actieve overzichten.',
    )
    return _redirect_to_safe_next_or_default(request, next_fallback)
