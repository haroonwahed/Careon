from django.views.generic import DetailView, UpdateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, JsonResponse
from django.urls import reverse_lazy, reverse
from django.db.models import Q, Count, Avg
from django.utils import timezone
from django.contrib import messages
from datetime import date, timedelta
from collections import defaultdict
import logging

from ..models import (
    CaseIntakeProcess, CareCase, PlacementRequest, ProviderProfile, Client,
    CaseAssessment, Document, Deadline, CareSignal, AuditLog, MunicipalityConfiguration,
    RegionalConfiguration, Notification, CaseDecisionLog,
)
from ..forms import CaseIntakeProcessForm
from ..middleware import log_action
from ..permissions import CaseAction, can_access_case_action, can_manage_organization
from ..tenancy import get_user_organization, scope_queryset_for_organization
from ..case_intelligence import evaluate_case_intelligence
from ..governance import build_matching_recommendation_payload
from .mixins import TenantScopedQuerysetMixin
from ._utils import (
    _to_bool_filter, _urgency_rank, _case_detail_tab_href, _flow_stage_for_intake_status,
    _resolved_intake_urgency, _extract_document_phase_event, _disable_response_caching, _log_pilot_issue,
)
from ..operational_decision_contract import build_operational_decision_for_intake
from ..operational_decision_presenter import present_operational_decision
from .case_flow import _can_edit_intake, _can_archive_intake, _redirect_if_archived_intake, sync_case_flow_state, _intake_is_archived
from .matching import _build_matching_suggestions_for_intake, _build_case_intelligence_context, _matching_history_for_intake
from .communication import _build_case_communication_context, _build_case_provider_response_context

logger = logging.getLogger(__name__)




class CaseIntakeDetailView(TenantScopedQuerysetMixin, LoginRequiredMixin, DetailView):
    """Show details of a specific care intake."""
    model = CaseIntakeProcess
    template_name = 'contracts/intake_detail.html'
    context_object_name = 'intake'

    def get_queryset(self):
        org = self.get_organization()
        return scope_queryset_for_organization(
            CaseIntakeProcess.objects.select_related(
                'organization', 'case_coordinator', 'care_category_main', 'care_category_sub', 'contract'
            ).prefetch_related('risk_factors'),
            org,
        )

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        intake = self.object

        assessment = CaseAssessment.objects.filter(due_diligence_process=intake).select_related('assessed_by').first()
        placement = PlacementRequest.objects.filter(due_diligence_process=intake).select_related('selected_provider').order_by('-updated_at').first()
        case_record = intake.case_record
        is_archived_case = _intake_is_archived(intake)
        can_edit_case = _can_edit_intake(self.request.user, intake)
        can_archive_case = _can_archive_intake(self.request.user, intake)

        open_tasks = Deadline.objects.for_organization(self.get_organization()).filter(
            due_diligence_process=intake,
            is_completed=False,
        ).select_related('assigned_to').order_by('due_date')[:5]
        open_signals = CareSignal.objects.for_organization(self.get_organization()).filter(
            due_diligence_process=intake,
            status__in=[CareSignal.SignalStatus.OPEN, CareSignal.SignalStatus.IN_PROGRESS],
        ).select_related('assigned_to').order_by('-updated_at')[:5]
        documents = Document.objects.filter(contract=case_record).order_by('-created_at')[:5] if case_record else Document.objects.none()

        assessment_href = reverse('carelane:assessment_detail', kwargs={'pk': assessment.pk}) if assessment else f"{reverse('carelane:assessment_create')}?intake={intake.pk}"
        assessment_action_label = 'Open beoordeling door aanbieder' if assessment else 'Beoordeling door aanbieder starten'
        assessment_status_label = assessment.get_assessment_status_display() if assessment else 'Nog niet gestart'

        matching_href = f"{reverse('carelane:matching_dashboard')}?intake={intake.pk}"
        matching_allowed, matching_blocker = intake.can_enter_matching()
        matching_status_label = 'Klaar voor matching' if matching_allowed else f'Wacht op beoordeling: {matching_blocker}'

        placement_href = reverse('carelane:placement_detail', kwargs={'pk': placement.pk}) if placement else reverse('carelane:matching_dashboard')
        placement_action_label = 'Open plaatsing' if placement else 'Start via matching'
        placement_status_label = placement.get_status_display() if placement else 'Nog niet gestart'

        if not placement:
            placement_phase_label = 'Nog niet gestart'
        elif placement.status == PlacementRequest.Status.APPROVED:
            placement_phase_label = 'Plaatsing bevestigd'
        elif placement.status == PlacementRequest.Status.IN_REVIEW:
            placement_phase_label = 'Aanbieder beoordeelt'
        elif placement.status == PlacementRequest.Status.REJECTED:
            placement_phase_label = 'Opnieuw matchen'
        else:
            placement_phase_label = 'Indicatie voorbereiding'

        if is_archived_case:
            next_action = {
                'label': 'Gearchiveerde casus',
                'href': reverse('carelane:case_list'),
                'help': 'Deze casus blijft bewaard, maar is alleen-lezen en verdwijnt uit actieve overzichten.',
            }
        elif not can_edit_case:
            next_action = {
                'label': 'Alleen-lezen toegang',
                'href': reverse('carelane:case_list'),
                'help': 'Je kunt deze casus bekijken, maar niet wijzigen. Neem contact op met een beheerder.',
            }
        elif not matching_allowed:
            next_action = {
                'label': 'Rond beoordeling af',
                'href': assessment_href,
                'help': matching_blocker,
            }
        elif not placement:
            next_action = {
                'label': 'Start matching',
                'href': matching_href,
                'help': 'Kies een passende aanbieder via matching.',
            }
        else:
            next_action = {
                'label': 'Bevestig plaatsing',
                'href': placement_href,
                'help': 'Werk de plaatsingsbeslissing af en start opvolging.',
            }

        matching_allowed, matching_blocker = intake.can_enter_matching()
        matching_requirements = [
            {
            'label': 'Beoordeling door aanbieder gereed voor matching',
                'ok': matching_allowed,
            },
        ]
        ready_for_matching = matching_allowed
        matching_missing = [matching_blocker] if not matching_allowed else []

        placement_requirements = [
            {
                'label': 'Aanbieder is toegewezen in matching',
                'ok': bool(placement and placement.selected_provider_id),
            },
            {
                'label': 'Aanbieder heeft acceptatie bevestigd',
                'ok': bool(placement and placement.provider_response_status == PlacementRequest.ProviderResponseStatus.ACCEPTED),
            },
            {
                'label': 'Plaatsing is bevestigd',
                'ok': bool(placement and placement.status == PlacementRequest.Status.APPROVED),
            },
        ]
        ready_for_placement = all(item['ok'] for item in placement_requirements)
        placement_missing = [item['label'] for item in placement_requirements if not item['ok']]

        active_flow_stage = _flow_stage_for_intake_status(intake.status)
        flow_order = ['aanvraag', 'matching', 'intake_aanbieder', 'plaatsing']
        flow_labels = {
            'aanvraag': 'Aanvraag',
            'matching': 'Matching',
            'intake_aanbieder': 'Intake aanbieder',
            'plaatsing': 'Plaatsing',
        }
        active_index = flow_order.index(active_flow_stage)
        flow_rail = []
        for idx, key in enumerate(flow_order):
            flow_rail.append(
                {
                    'key': key,
                    'label': flow_labels[key],
                    'active': key == active_flow_stage,
                    'completed': idx < active_index,
                }
            )

        if not can_edit_case:
            blocker_label = 'Geen bewerkrechten voor deze casus'
        elif not ready_for_matching:
            blocker_label = f"Niet gereed voor matching: {', '.join(matching_missing)}"
        elif not ready_for_placement:
            blocker_label = f"Niet gereed voor plaatsing: {', '.join(placement_missing)}"
        else:
            blocker_label = 'Geen blokkades; casus kan door naar de volgende stap'

        progress_label = (
            f"{open_tasks.count()} open taken · {open_signals.count()} open signalen"
            if (open_tasks.count() or open_signals.count())
            else 'Geen open taken of signalen'
        )

        placement_selected_provider = None
        if placement and placement.selected_provider:
            placement_selected_provider = placement.selected_provider
        elif placement and placement.proposed_provider:
            placement_selected_provider = placement.proposed_provider

        placement_action_href = reverse('carelane:case_placement_action', kwargs={'pk': intake.pk})
        placement_status_actions = []
        if placement and can_edit_case:
            action_specs = [
                (PlacementRequest.Status.IN_REVIEW, 'Markeer: in beoordeling', 'Overdracht loopt, aanbieder beoordeelt intake.'),
                (PlacementRequest.Status.NEEDS_INFO, 'Markeer: info nodig', 'Aanvullende informatie opgevraagd bij ketenpartner.'),
                (PlacementRequest.Status.APPROVED, 'Bevestig plaatsing', 'Plaatsing bevestigd en overdracht afgerond.'),
                (PlacementRequest.Status.REJECTED, 'Markeer: afgewezen', 'Plaatsing afgewezen, terug naar matching.'),
            ]
            for status_code, label, note in action_specs:
                if placement.status != status_code:
                    placement_status_actions.append(
                        {
                            'status': status_code,
                            'label': label,
                            'note': note,
                        }
                    )

        handoff_docs_qs = Document.objects.none()
        if case_record:
            handoff_docs_qs = Document.objects.filter(
                contract=case_record,
                tags__icontains='event:provider_handoff',
            ).order_by('-created_at')
        latest_handoff_doc = handoff_docs_qs.first()

        placement_notification_qs = Notification.objects.filter(recipient=self.request.user)
        if placement:
            placement_notification_qs = placement_notification_qs.filter(
                Q(link__icontains=f'/care/plaatsingen/{placement.pk}/')
                | Q(link__icontains=f'/care/casussen/{intake.pk}/')
            )
        else:
            placement_notification_qs = placement_notification_qs.filter(link__icontains=f'/care/casussen/{intake.pk}/')
        latest_placement_notification = placement_notification_qs.order_by('-created_at').first()

        matching_preview_candidates = []
        if ready_for_matching:
            provider_profiles = (
                ProviderProfile.objects.filter(client__organization=self.get_organization(), client__status='ACTIVE')
                .select_related('client')
                .prefetch_related('target_care_categories')
            )
            matching_preview_candidates = _build_matching_suggestions_for_intake(intake, provider_profiles, limit=5)
            for row in matching_preview_candidates:
                row['capacity'] = f"{row['free_slots']} plekken beschikbaar" if row['free_slots'] > 0 else 'Beperkte capaciteit'
                row['cta_href'] = matching_href
                row['cta_label'] = 'Open matching'

        latest_assignment = PlacementRequest.objects.filter(
            due_diligence_process=intake,
            selected_provider__isnull=False,
        ).select_related('selected_provider').order_by('-updated_at').first()

        matching_history = _matching_history_for_intake(intake, limit=8)
        rejected_options = [entry for entry in matching_history if entry.action == AuditLog.Action.REJECT]
        communication_logs = list(
            CaseDecisionLog.objects.filter(
                Q(case_id=intake.pk) | Q(case_id_snapshot=intake.pk)
            )
            .select_related('actor')
            .order_by('-timestamp', '-id')[:120]
        )

        intelligence_context = _build_case_intelligence_context(
            intake,
            assessment=assessment,
            placement=placement,
            matching_preview_candidates=matching_preview_candidates,
            latest_assignment=latest_assignment,
            open_signals_count=open_signals.count(),
            open_tasks_count=open_tasks.count(),
            rejected_count=len(rejected_options),
        )
        intelligence = intelligence_context['intelligence']
        candidate_hint_map = intelligence_context['candidate_hint_map']
        for row in matching_preview_candidates:
            hint = candidate_hint_map.get(row['provider_id'])
            if not hint:
                continue
            row['decision_hint'] = hint.get('hint')
            row['decision_hint_code'] = hint.get('hint_code')
            row['decision_comparison_to_top'] = hint.get('comparison_to_top') or ''
            row['decision_trade_offs'] = hint.get('trade_offs') or []

        matching_action_href = reverse('carelane:case_matching_action', kwargs={'pk': intake.pk})
        matching_archive_href = f"{reverse('carelane:matching_dashboard')}?intake={intake.pk}"

        selected_tab = (self.request.GET.get('tab') or 'tijdlijn').lower()
        tab_options = {'tijdlijn', 'documenten', 'taken', 'signalen', 'communicatie', 'matching', 'plaatsing'}
        if selected_tab not in tab_options:
            selected_tab = 'tijdlijn'

        anonymized_title = intake.title
        if len(anonymized_title) > 42:
            anonymized_title = f'{anonymized_title[:39]}...'

        region_municipality_label = case_record.service_region if case_record and case_record.service_region else 'Niet ingevuld'

        if assessment and assessment.assessment_status == CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING:
            assessment_interpretation = 'Beoordeling door aanbieder staat op gereed voor matching.'
        elif assessment and assessment.assessment_status == CaseAssessment.AssessmentStatus.NEEDS_INFO:
            assessment_interpretation = 'Aanvullende informatie nodig voordat matching kan starten.'
        elif assessment:
            assessment_interpretation = 'Beoordeling door aanbieder loopt; werk status bij om volgende stap vrij te maken.'
        else:
            assessment_interpretation = 'Start de beoordeling om door te gaan naar matching.'

        can_create_case_document = bool(case_record) and can_edit_case
        case_document_href = reverse('carelane:case_document_create', kwargs={'pk': intake.pk}) if can_create_case_document else reverse('carelane:case_update', kwargs={'pk': intake.pk})
        if can_create_case_document:
            case_document_action_label = 'Document toevoegen'
        elif not case_record:
            case_document_action_label = 'Koppel eerst een casus'
        else:
            case_document_action_label = 'Geen bewerkrechten'

        upload_event = self.request.GET.get('event', 'documenten').strip() or 'documenten'
        case_document_context_href = case_document_href
        if can_create_case_document:
            case_document_context_href = f'{case_document_href}?phase={active_flow_stage}&event={upload_event}'

        # Decision-driven header recommendation for intake detail.
        recommended_action_block = None
        if can_edit_case:
            priority = 'medium'
            icon = 'i'
            resolved_urgency = _resolved_intake_urgency(intake)
            if resolved_urgency == CaseIntakeProcess.Urgency.CRISIS:
                priority = 'critical'
                icon = '!'
            elif resolved_urgency == CaseIntakeProcess.Urgency.HIGH:
                priority = 'high'
                icon = 'H'

            recommended_action_block = {
                'title': 'AANBEVOLEN ACTIE',
                'icon': icon,
                'priority': priority,
                'action': next_action['label'],
                'reasons': [next_action['help']],
                'href': next_action['href'],
                'cta': next_action['label'],
            }

        flow_label_map = {
            'aanvraag': 'Aanvraag',
            'beoordeling': 'Beoordeling door aanbieder',
            'matching': 'Matching',
            'intake_aanbieder': 'Intake aanbieder',
            'plaatsing': 'Plaatsing',
        }

        case_document_rows = []
        for document in documents:
            linked_phase_key, linked_event = _extract_document_phase_event(document.tags)
            case_document_rows.append(
                {
                    'document': document,
                    'linked_phase': flow_label_map.get(linked_phase_key, linked_phase_key),
                    'linked_event': linked_event,
                }
            )

        provider_response_summary, provider_response_actions, provider_response_action_href = _build_case_provider_response_context(
            intake=intake,
            placement=placement,
        )
        communication_filter = (self.request.GET.get('comm_filter') or 'alles').strip().lower()
        communication_context = _build_case_communication_context(
            intake=intake,
            placement=placement,
            provider_response_summary=provider_response_summary,
            decision_logs=communication_logs,
            selected_filter=communication_filter,
        )

        if not can_edit_case:
            provider_response_actions = []

        outcome_action_href = reverse('carelane:case_outcome_action', kwargs={'pk': intake.pk})
        communication_action_href = reverse('carelane:case_communication_action', kwargs={'pk': intake.pk})
        outcome_sections = []

        overview_links = {
            'documents': reverse('carelane:document_list'),
            'tasks': reverse('carelane:task_list'),
            'signals': reverse('carelane:signal_list'),
            'placements': reverse('carelane:placement_list'),
        }

        ctx.update({
            'assessment_list': CaseAssessment.objects.filter(due_diligence_process=intake),
            'has_assessment': bool(assessment),
            'assessment_status': assessment_status_label if assessment else None,
            'assessment_status_label': assessment_status_label,
            'assessment_href': assessment_href,
            'assessment_action_label': assessment_action_label,
            'risk_factors_list': intake.risk_factors.all(),
            'case_record': case_record,
            'can_edit_case': can_edit_case,
            'is_archived_case': is_archived_case,
            'can_archive_case': can_archive_case,
            'matching_status_label': matching_status_label,
            'matching_href': matching_href,
            'placement_status_label': placement_status_label,
            'placement_phase_label': placement_phase_label,
            'placement_href': placement_href,
            'placement_action_label': placement_action_label,
            'has_placement': bool(placement),
            'placement_selected_provider': placement_selected_provider,
            'placement_action_href': placement_action_href,
            'placement_status_actions': placement_status_actions,
            'placement_handoff_docs_count': handoff_docs_qs.count() if case_record else 0,
            'latest_handoff_doc': latest_handoff_doc,
            'placement_notifications_count': placement_notification_qs.count(),
            'latest_placement_notification': latest_placement_notification,
            'open_tasks': open_tasks,
            'open_tasks_count': open_tasks.count(),
            'open_signals': open_signals,
            'open_signals_count': open_signals.count(),
            'documents': documents,
            'documents_count': documents.count(),
            'overview_links': overview_links,
            'next_action': next_action,
            'can_create_case_document': can_create_case_document,
            'can_create_case_task': can_edit_case,
            'can_create_case_signal': can_edit_case,
            'case_document_href': case_document_href,
            'case_document_context_href': case_document_context_href,
            'case_document_action_label': case_document_action_label,
            'case_document_rows': case_document_rows,
            'matching_requirements': matching_requirements,
            'ready_for_matching': ready_for_matching,
            'matching_missing': matching_missing,
            'placement_requirements': placement_requirements,
            'ready_for_placement': ready_for_placement,
            'placement_missing': placement_missing,
            'flow_rail': flow_rail,
            'active_flow_stage': active_flow_stage,
            'blocker_label': blocker_label,
            'progress_label': progress_label,
            'safe_to_proceed': intelligence.get('safe_to_proceed', True),
            'stop_reasons': intelligence.get('stop_reasons', []),
            'system_signals': intelligence.get('risk_signals', []),
            'missing_information_alerts': intelligence.get('missing_information', []),
            'enhanced_next_action': intelligence.get('next_best_action'),
            'intelligence_flags': intelligence_context['intelligence_flags'],
            'can_execute_matching_actions': bool(
                can_edit_case
                and ready_for_matching
                and intelligence.get('safe_to_proceed', True)
            ),
            'matching_preview_candidates': matching_preview_candidates,
            'matching_action_href': matching_action_href,
            'matching_archive_href': matching_archive_href,
            'latest_assignment': latest_assignment,
            'matching_history': matching_history,
            'rejected_options': rejected_options,
            'provider_response_summary': provider_response_summary,
            'provider_response_actions': provider_response_actions,
            'provider_response_action_href': provider_response_action_href,
            'communication_action_href': communication_action_href,
            'communication_items': communication_context['items'],
            'communication_filtered_items': communication_context['filtered_items'],
            'communication_filter_options': communication_context['filter_options'],
            'communication_selected_filter': communication_context['selected_filter'],
            'communication_summary_items': communication_context['summary_items'],
            'communication_has_blocking_items': communication_context['has_blocking_items'],
            'communication_blocking_items': communication_context['blocking_items'],
            'outcome_action_href': outcome_action_href,
            'outcome_sections': outcome_sections,
            'selected_tab': selected_tab,
            'anonymized_title': anonymized_title,
            'region_municipality_label': region_municipality_label,
            'assessment_interpretation': assessment_interpretation,
            'recommended_action_block': recommended_action_block,
            'decision_header': {
                'title': intake.title,
                'status': intake.get_status_display(),
                'urgency': intake.get_urgency_display() or _resolved_intake_urgency(intake),
                'urgency_code': _resolved_intake_urgency(intake),
            },
            'phase_stepper': flow_rail,
        })

        return ctx


class CaseIntakeUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    """Update an existing care intake."""
    model = CaseIntakeProcess
    form_class = CaseIntakeProcessForm
    template_name = 'contracts/intake_form.html'

    def render_to_response(self, context, **response_kwargs):
        response = super().render_to_response(context, **response_kwargs)
        response['X-Carelane-Template-Version'] = 'intake_form'
        return _disable_response_caching(response)

    def get_queryset(self):
        org = self.get_organization()
        return scope_queryset_for_organization(CaseIntakeProcess.objects.all(), org)

    def dispatch(self, request, *args, **kwargs):
        intake = self.get_object()
        if not _can_edit_intake(request.user, intake):
            _log_pilot_issue(
                request,
                category='case_update_forbidden',
                detail=f'intake={intake.pk}',
            )
            return HttpResponseForbidden('Je hebt geen rechten om deze casus te bewerken.')
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update({
            'is_edit': True,
            'page_title': f'Casus bewerken: {self.object.title}',
            'button_text': 'Wijzigingen opslaan',
            'focus_field': self.request.GET.get('field', ''),
            'initial_section': self.request.GET.get('section', ''),
            'guided_flow': self.request.GET.get('guided', ''),
            'guided_step': self.request.GET.get('step', ''),
            'guided_total': self.request.GET.get('total', ''),
        })
        return ctx

    def form_valid(self, form):
        old_target_completion_date = self.object.target_completion_date
        response = super().form_valid(form)
        changes = None
        new_target_completion_date = self.object.target_completion_date
        if old_target_completion_date != new_target_completion_date:
            changes = {
                'target_completion_date': {
                    'from': old_target_completion_date.isoformat() if old_target_completion_date else None,
                    'to': new_target_completion_date.isoformat() if new_target_completion_date else None,
                }
            }
        log_action(
            self.request.user,
            'UPDATE',
            'CaseIntakeProcess',
            self.object.id,
            str(self.object),
            changes=changes,
            request=self.request,
        )
        messages.success(self.request, f'Casus "{self.object.title}" bijgewerkt.')
        return response

    def get_success_url(self):
        return reverse('carelane:case_detail', kwargs={'pk': self.object.pk})
