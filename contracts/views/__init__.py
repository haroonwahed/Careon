from ._utils import (  # noqa: F401
    _coerce_coordinate,
    _extract_coordinates,
    _split_csv_tags,
    _extract_document_phase_event,
    _merge_document_context_tags,
    _flow_stage_for_intake_status,
    _redirect_to_safe_next_or_default,
    _case_detail_tab_href,
    _resolve_deadline_case,
    _resolve_signal_case,
    _disable_response_caching,
    _log_pilot_issue,
    _coerce_sla_int,
    _to_bool_filter,
    _urgency_rank,
)

from ._routing import (  # noqa: F401
    case_flow_list_redirect,
    case_flow_create_redirect,
    redirect_case_intake_create_to_spa,
    redirect_casussen_list_to_spa,
    case_flow_detail_redirect,
    case_flow_update_redirect,
)

from .system import (  # noqa: F401
    index,
    health_check,
    build_info,
    ops_system_state,
    favicon,
    workflow_case_spa_shell,
    global_search,
    handler400,
    handler403,
    handler404,
    handler500,
    _render_spa_shell_response,
)

from .auth import (  # noqa: F401
    DESIGN_MODE_SESSION_KEY,
    DESIGN_MODE_SPA,
    VALID_DESIGN_MODES,
    get_or_create_profile,
    _normalize_design_mode,
    SignUpView,
    design_mode_settings,
    profile,
    settings_hub,
)

from .mixins import (  # noqa: F401
    TenantScopedQuerysetMixin,
    TenantAssignCreateMixin,
    _CaseScopedIntakeMixin,
    CaseScopedDeadlineCreateView,
    CaseScopedCareSignalCreateView,
    CaseScopedDocumentCreateView,
)

from .case_flow import (  # noqa: F401
    AUTO_INTAKE_TASKS,
    PHASE_TO_PROCESS_STATUS,
    _intake_is_archived,
    _active_case_intakes_queryset,
    _can_archive_intake,
    _redirect_if_archived_intake,
    _can_edit_intake,
    _require_workflow_actor_role,
    _can_edit_assessment,
    _resolve_task_due_date,
    sync_intake_auto_tasks,
    sync_case_phase_auto_tasks,
    sync_automatic_deadlines_for_organization,
    _coerce_case_process_defaults,
    ensure_case_flow,
    sync_case_flow_state,
    sync_contract_phase_auto_tasks,
    _coerce_contract_process_defaults,
    ensure_contract_flow,
    sync_contract_flow_state,
)

from .matching import (  # noqa: F401
    PROVIDER_AGE_BAND_FILTER_CHOICES,
    PROVIDER_CARE_FORM_FILTER_CHOICES,
    _provider_profile_age_bands,
    _provider_profile_care_forms,
    _provider_profile_match_surface,
    _provider_profile_supports_age_band,
    _provider_profile_supports_care_form,
    _provider_capacity_filter_key,
    _provider_region_fit_key,
    _provider_form_match,
    _resolved_intake_urgency,
    _provider_urgency_match,
    _capacity_status_label,
    _performance_status_label,
    _first_related,
    _haversine_distance_km,
    _provider_specialization_summary,
    _build_matching_explanation,
    _preferred_region_label,
    _build_case_location,
    _build_matching_map_context,
    _behavior_tiebreak_weight,
    _build_provider_outcome_context,
    _build_case_intelligence_context,
    _build_match_context_from_intake,
    _region_pressure_summary,
    _build_canonical_matching_suggestions_for_intake,
    _sync_matching_signals_for_intake,
    _build_matching_suggestions_for_intake,
    _assign_provider_to_intake,
    _prepare_waitlist_proposal_for_intake,
    _matching_history_for_intake,
)

from .org import (  # noqa: F401
    switch_organization,
    _build_invite_url,
    _send_invitation_email,
    organization_team,
    revoke_organization_invite,
    resend_organization_invite,
    update_membership_role,
    deactivate_organization_member,
    reactivate_organization_member,
    _filter_organization_activity_logs,
    organization_activity,
    organization_activity_export,
    accept_organization_invite,
)

from .clients import (  # noqa: F401
    ClientListView,
    ClientDetailView,
    ClientCreateView,
    ClientUpdateView,
)

from .config import (  # noqa: F401
    get_configuration_scope_content,
    _SCOPE_QUERY_ALIASES,
    CareConfigurationDetailView,
    CareConfigurationUpdateView,
    MunicipalityConfigurationListView,
    MunicipalityConfigurationDetailView,
    MunicipalityConfigurationCreateView,
    MunicipalityConfigurationUpdateView,
    RegionalConfigurationListView,
    RegionalConfigurationDetailView,
    RegionalConfigurationCreateView,
    RegionalConfigurationUpdateView,
)

from .documents import (  # noqa: F401
    DocumentListView,
    DocumentDetailView,
    DocumentCreateView,
    DocumentUpdateView,
)

from .deadlines import (  # noqa: F401
    DeadlineListView,
    DeadlineCreateView,
    DeadlineUpdateView,
    deadline_complete,
)

from .tasks import (  # noqa: F401
    CareTaskKanbanView,
    task_board_redirect,
    CareTaskCreateView,
    CareTaskUpdateView,
)

from .signals_views import (  # noqa: F401
    signal_update_status,
    CareSignalListView,
    CareSignalDetailView,
    CareSignalCreateView,
    CareSignalUpdateView,
)

from .audit import (  # noqa: F401
    AuditLogListView,
    notification_list,
    mark_notification_read,
    mark_all_notifications_read,
    reports_dashboard,
)

from .budgets import (  # noqa: F401
    BudgetListView,
    BudgetCreateView,
    BudgetDetailView,
    BudgetUpdateView,
    AddExpenseView,
)

from .communication import (  # noqa: F401
    _normalize_provider_response_status_code,
    _build_provider_response_governance_context,
    _provider_response_status_label,
    _workflow_stage_label,
    _communication_type_label,
    _decision_item_message,
    _derive_communication_item_from_log,
    _build_case_communication_context,
    _provider_recommended_action_presentation,
    case_communication_action,
    _provider_response_age_days,
    _provider_response_actions_for_case_detail,
    _build_case_provider_response_context,
    build_provider_response_monitor,
    build_provider_response_overview,
    provider_response_monitor,
    case_provider_response_action,
)

from .dashboard import (  # noqa: F401
    matching_dashboard,
    case_matching_action,
    case_outcome_action,
    case_placement_action,
    case_archive_action,
)

from .intake import (  # noqa: F401
    CaseIntakeDetailView,
    CaseIntakeUpdateView,
)

from .assessment import (  # noqa: F401
    CaseAssessmentListView,
    CaseAssessmentDetailView,
    CaseAssessmentCreateView,
    CaseAssessmentUpdateView,
)

from .wait_times import (  # noqa: F401
    WaitTimeListView,
    WaitTimeDetailView,
    WaitTimeCreateView,
    WaitTimeUpdateView,
)

from .placement import (  # noqa: F401
    _placement_phase_label,
    PlacementRequestListView,
    PlacementRequestDetailView,
    PlacementRequestUpdateView,
)

# Re-import dashboard from .system explicitly after the .dashboard submodule import
# to prevent the submodule binding from shadowing the view function.
from .system import dashboard  # noqa: F401

# Rebuild CaseScopedXxxCreateView classes with correct multiple inheritance.
# In the original monolithic views.py these classes inherited from both _CaseScopedIntakeMixin
# and the concrete CreateView subclass.  In the package layout those concrete views are defined
# in sibling modules that themselves import from mixins.py, which would create circular imports
# if mixins.py tried to import them directly.  We therefore redefine the composite classes here
# in __init__.py, where all submodule symbols are already loaded.

class CaseScopedDeadlineCreateView(  # noqa: F811
    _CaseScopedIntakeMixin,
    DeadlineCreateView,
):
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method in ('POST', 'PUT'):
            data = kwargs.get('data', self.request.POST).copy()
            data['due_diligence_process'] = str(self._load_intake().pk)
            kwargs['data'] = data
        return kwargs

    def get_initial(self):
        initial = super().get_initial()
        initial['due_diligence_process'] = self._load_intake()
        return initial

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        intake = self._load_intake()
        form.initial['due_diligence_process'] = intake.pk
        return form

    def form_valid(self, form):
        from django.contrib import messages
        intake = self._load_intake()
        form.instance.due_diligence_process = intake
        if intake.contract_id:
            form.instance.case_record = intake.case_record
        response = super().form_valid(form)
        messages.success(self.request, f'Taak toegevoegd aan casus "{intake.title}".')
        return response

    def get_success_url(self):
        from django.urls import reverse
        return f"{reverse('carelane:case_detail', kwargs={'pk': self._load_intake().pk})}?tab=taken"


class CaseScopedCareSignalCreateView(  # noqa: F811
    _CaseScopedIntakeMixin,
    CareSignalCreateView,
):
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method in ('POST', 'PUT'):
            data = kwargs.get('data', self.request.POST).copy()
            data['due_diligence_process'] = str(self._load_intake().pk)
            kwargs['data'] = data
        return kwargs

    def get_initial(self):
        initial = super().get_initial()
        initial['due_diligence_process'] = self._load_intake()
        return initial

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        intake = self._load_intake()
        form.initial['due_diligence_process'] = intake.pk
        return form

    def form_valid(self, form):
        from django.contrib import messages
        intake = self._load_intake()
        form.instance.due_diligence_process = intake
        if intake.contract_id:
            form.instance.case_record = intake.case_record
        response = super().form_valid(form)
        messages.success(self.request, f'Signaal toegevoegd aan casus "{intake.title}".')
        return response

    def get_success_url(self):
        from django.urls import reverse
        return f"{reverse('carelane:case_detail', kwargs={'pk': self._load_intake().pk})}?tab=signalen"


class CaseScopedDocumentCreateView(  # noqa: F811
    _CaseScopedIntakeMixin,
    DocumentCreateView,
):
    def dispatch(self, request, *args, **kwargs):
        from django.contrib import messages
        from django.shortcuts import redirect
        intake = self._load_intake()
        if not intake.contract_id:
            messages.error(request, 'Koppel eerst een casusrecord voordat je documenten toevoegt.')
            return redirect('carelane:case_detail', pk=intake.pk)
        return super().dispatch(request, *args, **kwargs)

    def get_initial(self):
        from ._utils import _merge_document_context_tags
        initial = super().get_initial()
        intake = self._load_intake()
        phase = (self.request.GET.get('phase') or '').strip()
        event = (self.request.GET.get('event') or '').strip()
        if intake.contract_id:
            initial['contract'] = intake.case_record
        if phase or event:
            initial['tags'] = _merge_document_context_tags(initial.get('tags', ''), phase=phase, event=event)
        return initial

    def get_context_data(self, **kwargs):
        from django.urls import reverse
        ctx = super().get_context_data(**kwargs)
        intake = self._load_intake()
        phase = (self.request.GET.get('phase') or '').strip()
        event = (self.request.GET.get('event') or '').strip()
        phase_label = {
            'aanvraag': 'Aanvraag',
            'beoordeling': 'Beoordeling door aanbieder',
            'matching': 'Matching',
            'intake_aanbieder': 'Intake aanbieder',
            'plaatsing': 'Plaatsing',
        }.get(phase, phase)
        ctx['intake'] = intake
        ctx['document_context_phase'] = phase_label
        ctx['document_context_event'] = event
        ctx['cancel_href'] = f"{reverse('carelane:case_detail', kwargs={'pk': intake.pk})}?tab=documenten"
        return ctx

    def form_valid(self, form):
        from django.contrib import messages
        from ._utils import _merge_document_context_tags
        intake = self._load_intake()
        phase = (self.request.GET.get('phase') or '').strip()
        event = (self.request.GET.get('event') or '').strip()
        form.instance.contract = intake.case_record
        if phase or event:
            form.instance.tags = _merge_document_context_tags(form.instance.tags, phase=phase, event=event)
        response = super().form_valid(form)
        messages.success(self.request, f'Document toegevoegd aan casus "{intake.title}".')
        return response

    def get_success_url(self):
        from django.urls import reverse
        intake = self._load_intake()
        phase = (self.request.GET.get('phase') or '').strip()
        event = (self.request.GET.get('event') or '').strip()
        url = f"{reverse('carelane:case_detail', kwargs={'pk': intake.pk})}?tab=documenten"
        if phase:
            url += f'&phase={phase}'
        if event:
            url += f'&event={event}'
        return url
