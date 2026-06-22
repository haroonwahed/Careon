"""
Shared private helpers and constants used across API domain sub-modules.
"""
from __future__ import annotations

import json
import logging
import sys
import re
from datetime import date

from django.http import JsonResponse
from django.shortcuts import get_object_or_404

from contracts.domain.contracts import CareCaseData
from contracts.models import (
    CareCase,
    CaseIntakeProcess,
    CaseAssessment,
    PlacementRequest,
    AuditLog,
    Organization,
)
from contracts.middleware import log_action
from contracts.operational_failures import build_operational_failure_payload
from contracts.tenancy import (
    ensure_user_organization,
    get_scoped_object_or_404,
    get_user_organization,
)
from contracts.permissions import ensure_provider_case_visible_or_404
from contracts.workflow_state_machine import (
    WorkflowState,
    derive_workflow_state,
)
from contracts.zorgbehoefte_taxonomy import format_taxonomy_explainability

logger = logging.getLogger(__name__)

# SPA InfoRequestType slugs (client/src/hooks/useProviderEvaluations.ts) — stored in
# PlacementRequest.provider_response_notes for INFO_REQUESTED via ``[INFO_TYPE:slug]`` prefix.
_SPA_INFO_REQUEST_TYPES = frozenset({
    'medische_informatie',
    'woonsituatie',
    'financiele_situatie',
    'gezinssituatie',
    'diagnostiek',
    'andere_informatie',
})
_INFO_TYPE_NOTES_PREFIX = re.compile(r'^\[INFO_TYPE:([a-z0-9_]+)\]\s*\n?', re.IGNORECASE)


_WORKFLOW_STATE_VALUES = {
    WorkflowState.DRAFT_CASE,
    WorkflowState.SUMMARY_READY,
    WorkflowState.MATCHING_READY,
    WorkflowState.GEMEENTE_VALIDATED,
    WorkflowState.PROVIDER_REVIEW_PENDING,
    WorkflowState.PROVIDER_ACCEPTED,
    WorkflowState.PROVIDER_REJECTED,
    WorkflowState.PLACEMENT_CONFIRMED,
    WorkflowState.INTAKE_STARTED,
    WorkflowState.ARCHIVED,
}


def _resolved_intake_urgency(intake) -> str:
    urgency = (getattr(intake, 'urgency', '') or '').strip()
    if urgency:
        return urgency
    try:
        return (intake.derive_operational_urgency() or '').strip()
    except Exception:
        return ''


def _compose_provider_info_request_notes(*, info_type: str, body: str) -> str:
    slug = (info_type or '').strip().lower()
    body = (body or '').strip()
    if slug in _SPA_INFO_REQUEST_TYPES and body:
        return f'[INFO_TYPE:{slug}]\n{body}'
    return body


def _parse_provider_info_request_notes(raw: str) -> tuple[str | None, str]:
    """Split optional ``[INFO_TYPE:slug]`` storage prefix from provider_response_notes."""
    s = (raw or '').strip()
    if not s:
        return None, ''
    m = _INFO_TYPE_NOTES_PREFIX.match(s)
    if not m:
        return None, s
    slug = m.group(1).lower()
    rest = s[m.end():].strip()
    if slug not in _SPA_INFO_REQUEST_TYPES:
        return None, s
    return slug, rest


def _evaluation_client_label(case: CareCase | None) -> str:
    """Pseudonymous label aligned with SPA ``formatClientReference`` (casus id, not free-text naam)."""
    if case is None:
        return 'Aanvrager'
    digits = ''.join(c for c in str(case.pk) if c.isdigit())
    if not digits:
        return 'Aanvrager'
    return f'CLI-{digits.zfill(5)[-5:]}'


def _derive_aanmelder_actor_profile_for_intake(*, actor_role: str, entry_route: str) -> str:
    """
    Product-hint (cliëntaanbieder-kanaal) voor audit/rapportage; geen permissies.
    """
    from contracts.workflow_state_machine import WorkflowRole
    if actor_role == WorkflowRole.ZORGAANBIEDER:
        return CaseIntakeProcess.AanmelderActorProfile.ZORGAANBIEDER_ORG
    if actor_role == WorkflowRole.ADMIN:
        return CaseIntakeProcess.AanmelderActorProfile.ADMIN
    if actor_role == WorkflowRole.GEMEENTE:
        if entry_route == CaseIntakeProcess.EntryRoute.WIJKTEAM:
            return CaseIntakeProcess.AanmelderActorProfile.WIJKTEAM
        return CaseIntakeProcess.AanmelderActorProfile.GEMEENTE_AMBTELIJK
    return CaseIntakeProcess.AanmelderActorProfile.ONBEKEND

def _active_organization(request):
    """Resolve org for API calls; prefers middleware-cached request.organization when set."""
    user = getattr(request, 'user', None)
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    org = getattr(request, 'organization', None)
    if org is not None:
        return org
    organization = get_user_organization(user)
    if organization is None:
        try:
            organization = ensure_user_organization(user)
        except Exception:
            logger.exception(
                "active_organization_provision_failed user_id=%s",
                getattr(user, "pk", "?"),
            )
            return None
    return organization


def _draft_validation_placement(*, request, intake, provider, validation_context):
    """Persist DRAFT placement after gemeente validatie (vóór verzenden naar aanbieder)."""
    notes_payload = json.dumps(
        {
            'kind': 'gemeente_validatie_concept',
            'provider_id': provider.pk,
            'match': validation_context or {},
        },
        ensure_ascii=False,
    )
    placement, created = PlacementRequest.objects.get_or_create(
        due_diligence_process=intake,
        defaults={
            'status': PlacementRequest.Status.DRAFT,
            'proposed_provider': provider,
            'selected_provider': provider,
            'care_form': intake.preferred_care_form or PlacementRequest.CareForm.OUTPATIENT,
            'decision_notes': notes_payload,
            'provider_response_status': PlacementRequest.ProviderResponseStatus.PENDING,
        },
    )
    if not created:
        placement.proposed_provider = provider
        placement.selected_provider = provider
        placement.status = PlacementRequest.Status.DRAFT
        placement.decision_notes = notes_payload
        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.PENDING
        if not placement.care_form:
            placement.care_form = intake.preferred_care_form or PlacementRequest.CareForm.OUTPATIENT
        placement.save(
            update_fields=[
                'proposed_provider',
                'selected_provider',
                'care_form',
                'status',
                'provider_response_status',
                'decision_notes',
                'updated_at',
            ]
        )
    log_action(
        request.user,
        AuditLog.Action.APPROVE,
        'GemeenteValidatieConcept',
        object_id=placement.id,
        object_repr=f'{intake.title} -> {provider.name} (concept)',
        changes={'intake_id': intake.id, 'provider_id': provider.id},
        request=request,
    )
    return placement


def _internal_server_error(request, *, context: str):
    """Log API failures with traceback (when inside except) and return calm operational JSON (5xx)."""
    cid = getattr(request, "correlation_id", None)
    cid_str = str(cid) if cid else None
    exc_info = sys.exc_info()
    if exc_info[0] is not None:
        logger.error(
            "api_error context=%s correlation_id=%s",
            context,
            cid_str or "-",
            exc_info=exc_info,
        )
    else:
        logger.error(
            "api_error context=%s correlation_id=%s (no active exception — check call site)",
            context,
            cid_str or "-",
        )
    body = build_operational_failure_payload(request, context=context)
    return JsonResponse(body, status=500)


def _case_workflow_state(case):
    """
    Prefer persisted CaseIntakeProcess.workflow_state when set (authoritative for transitions).
    Otherwise derive from intake/placement (same logic as derive_workflow_state).
    API consumers should treat mismatch with placement_request_* as a signal to open the dossier,
    not auto-reconcile persisted workflow_state here (server transitions own writes).
    """
    try:
        intake = case.due_diligence_process
    except CaseIntakeProcess.DoesNotExist:
        intake = None

    persisted_state = str(getattr(intake, 'workflow_state', '') or '').strip() if intake is not None else ''
    if persisted_state in _WORKFLOW_STATE_VALUES:
        return persisted_state
    if intake is not None:
        # Pass prefetched assessment + latest placement so derive_workflow_state does not
        # re-query per case (N+1). Ordering matches the list/detail `indications` prefetch
        # (-updated_at) and derive's own fallback, so the selected rows are identical.
        try:
            assessment = intake.case_assessment
        except CaseAssessment.DoesNotExist:
            assessment = None
        placement_rows = list(intake.indications.all())
        placement = placement_rows[0] if placement_rows else None
        return derive_workflow_state(intake=intake, assessment=assessment, placement=placement)
    if getattr(case, 'lifecycle_stage', '') == 'ARCHIVED':
        return WorkflowState.ARCHIVED
    return WorkflowState.DRAFT_CASE


def _get_intake_for_case_api_id(case_id, organization, *, lock=False, select_related=None, user=None):
    """
    URLs under /care/api/cases/<case_id>/ use the CareCase primary key for assessment,
    decision evaluation, and SPA calls. Resolve CaseIntakeProcess via CareCase.contract back-ref,
    not CaseIntakeProcess.pk (which may differ).
    """
    case_record = get_scoped_object_or_404(
        CareCase.objects.all(),
        organization,
        pk=case_id,
    )
    if user is not None:
        ensure_provider_case_visible_or_404(user, case_record)
    base_rel = ('contract', 'organization')
    extra = tuple(select_related) if select_related else ()
    qs = CaseIntakeProcess.objects.select_related(*base_rel, *extra)
    if lock:
        qs = qs.select_for_update(of=('self',))
    return get_scoped_object_or_404(
        qs,
        organization,
        contract=case_record,
    )


def _safe_case_intake(case):
    """Return linked CaseIntakeProcess or None (OneToOne may not exist)."""
    try:
        return case.due_diligence_process
    except CaseIntakeProcess.DoesNotExist:
        return None


def _coerce_case_value_for_api(case) -> float | None:
    if not hasattr(case, "value"):
        return None
    raw = getattr(case, "value", None)
    if raw is None or raw == "":
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _case_owner_display(case) -> str:
    try:
        creator = getattr(case, "created_by", None)
        if creator is None:
            return "System"
        name = creator.get_full_name()
        return name.strip() if name else (getattr(creator, "username", None) or "System")
    except Exception:
        return "System"


def _minimal_case_list_entry(case: CareCase) -> dict:
    """Safe JSON row when full serialization fails (one bad dossier must not 500 the list)."""
    return {
        "id": str(case.pk),
        "title": (getattr(case, "title", None) or "Casus")[:200],
        "status": getattr(case, "status", None) or "DRAFT",
        "preferred_provider": getattr(case, "preferred_provider", "") or "",
        "value": None,
        "start_date": None,
        "end_date": None,
        "owner": _case_owner_display(case),
        "updated_at": case.updated_at.isoformat() if getattr(case, "updated_at", None) else None,
        "created_at": case.created_at.isoformat() if getattr(case, "created_at", None) else None,
        "content": "",
        "case_phase": getattr(case, "case_phase", "intake") or "intake",
        "risk_level": getattr(case, "risk_level", "LOW") or "LOW",
        "service_region": getattr(case, "service_region", "") or "",
        "contract_type": getattr(case, "contract_type", "") or "",
        "lifecycle_stage": getattr(case, "lifecycle_stage", "") or "",
        "workflow_state": WorkflowState.DRAFT_CASE,
        "arrangement_type_code": "",
        "arrangement_provider": "",
        "arrangement_end_date": None,
        "intake_start_date": None,
        "urgency_validated": False,
        "urgency_document_present": False,
        "urgency_granted_date": None,
        "urgency_applied": False,
        "urgency_applied_since": None,
        "placement_pressure_horizon": "",
        "safety_pressure": False,
        "time_sensitive_arrangement": False,
        "escalation_needed": False,
        "placement_pressure_notes": "",
        "placement_pressure_band": None,
        "placement_pressure_label": None,
        "placement_pressure_reason": None,
        "placement_pressure_implication": None,
        "placement_request_status": None,
        "placement_provider_response_status": None,
        "has_case_geo": False,
        "routing": {},
    }


def _require_workflow_role(*, user, organization, allowed_roles: set[str]):
    from contracts.workflow_state_machine import resolve_actor_role
    # strict=True: if the role cannot be resolved (e.g. DB error) this returns the
    # UNRESOLVED sentinel, which is never in allowed_roles, so the gate fails closed
    # (403) instead of degrading to the privileged GEMEENTE role.
    actor_role = resolve_actor_role(user=user, organization=organization, strict=True)
    if actor_role not in allowed_roles:
        return actor_role, JsonResponse(
            {
                'ok': False,
                'error': 'Deze rol mag deze workflow-actie niet uitvoeren.',
                'actor_role': actor_role,
            },
            status=403,
        )
    return actor_role, None


def _build_case_data(case, *, include_geo=False):
    data = CareCaseData(
        id=str(case.id),
        title=case.title,
        status=case.status,
        preferred_provider=getattr(case, 'preferred_provider', ''),
        value=_coerce_case_value_for_api(case),
        start_date=case.start_date.isoformat() if hasattr(case, 'start_date') and case.start_date else None,
        end_date=case.end_date.isoformat() if hasattr(case, 'end_date') and case.end_date else None,
        owner=_case_owner_display(case),
        updated_at=case.updated_at.isoformat() if hasattr(case, 'updated_at') and case.updated_at else None,
        created_at=case.created_at.isoformat() if case.created_at else None,
        content=case.content or "",
    )
    # Extend with SPA-required fields not in CareCaseData dataclass
    result = data.to_dict()
    result['case_phase'] = getattr(case, 'case_phase', 'intake') or 'intake'
    result['risk_level'] = getattr(case, 'risk_level', 'LOW') or 'LOW'
    result['service_region'] = getattr(case, 'service_region', '') or ''
    result['contract_type'] = getattr(case, 'contract_type', '') or ''
    result['lifecycle_stage'] = getattr(case, 'lifecycle_stage', '') or ''
    try:
        result['workflow_state'] = _case_workflow_state(case)
    except Exception:
        logger.exception("case_workflow_state_failed case_id=%s", getattr(case, "pk", "?"))
        result['workflow_state'] = WorkflowState.DRAFT_CASE
    intake = _safe_case_intake(case)
    # Intake-backed fields for SPA (placement inference + urgency) when older clients omit workflow_state.
    if intake is not None:
        placement_pressure = intake.placement_pressure_assessment()
        result['arrangement_type_code'] = (getattr(intake, 'arrangement_type_code', '') or '').strip()
        result['arrangement_provider'] = (getattr(intake, 'arrangement_provider', '') or '').strip()
        result['arrangement_end_date'] = (
            intake.arrangement_end_date.isoformat() if getattr(intake, 'arrangement_end_date', None) else None
        )
        result['intake_start_date'] = intake.start_date.isoformat() if getattr(intake, 'start_date', None) else None
        result['intake_appointment_at'] = (
            intake.intake_appointment_at.isoformat() if getattr(intake, 'intake_appointment_at', None) else None
        )
        result['intake_appointment_location'] = getattr(intake, 'intake_appointment_location', '') or ''
        result['intake_appointment_notes'] = getattr(intake, 'intake_appointment_notes', '') or ''
        result['intake_appointment_conducted_by'] = getattr(intake, 'intake_appointment_conducted_by_id', None)
        result['urgency_validated'] = bool(getattr(intake, 'urgency_validated', False))
        result['urgency_document_present'] = bool(getattr(intake, 'urgency_document', None))
        result['urgency_granted_date'] = (
            intake.urgency_granted_date.isoformat() if getattr(intake, 'urgency_granted_date', None) else None
        )
        result['urgency_applied'] = bool(getattr(intake, 'urgency_applied', False))
        result['urgency_applied_since'] = (
            intake.urgency_applied_since.isoformat() if getattr(intake, 'urgency_applied_since', None) else None
        )
        result['placement_pressure_horizon'] = getattr(intake, 'placement_pressure_horizon', '') or ''
        result['safety_pressure'] = bool(getattr(intake, 'safety_pressure', False))
        result['time_sensitive_arrangement'] = bool(getattr(intake, 'time_sensitive_arrangement', False))
        result['escalation_needed'] = bool(getattr(intake, 'escalation_needed', False))
        result['placement_pressure_notes'] = (getattr(intake, 'placement_pressure_notes', '') or '').strip()
        result['placement_pressure_band'] = placement_pressure['band']
        result['placement_pressure_label'] = placement_pressure['label']
        result['placement_pressure_reason'] = placement_pressure['reason']
        result['placement_pressure_implication'] = placement_pressure['implication']
        # Latest placement row (same signals as derive_workflow_state) for SPA when workflow_state is absent/stale.
        try:
            placement_rows = list(intake.indications.all())
            placement = placement_rows[0] if placement_rows else None
            result['placement_request_status'] = placement.status if placement is not None else None
            result['placement_provider_response_status'] = (
                placement.provider_response_status if placement is not None else None
            )
        except Exception:
            logger.exception("case_placement_snapshot_failed case_id=%s", getattr(case, "pk", "?"))
            result['placement_request_status'] = None
            result['placement_provider_response_status'] = None
        care_category_main = getattr(intake, 'care_category_main', None)
        care_category_sub = getattr(intake, 'care_category_sub', None)
        result['routing'] = intake.routing_summary if hasattr(intake, 'routing_summary') else {}
        taxonomie_lijn, taxonomie_code_lijn = format_taxonomy_explainability(
            getattr(care_category_main, 'name', '') or '',
            getattr(care_category_main, 'code', '') or '',
            getattr(care_category_sub, 'name', '') or '',
            getattr(care_category_sub, 'code', '') or '',
        )
        result['zorgbehoefte_categorie'] = getattr(care_category_main, 'name', '') or ''
        result['zorgbehoefte_categorie_code'] = getattr(care_category_main, 'code', '') or ''
        result['zorgbehoefte_specifiek'] = getattr(care_category_sub, 'name', '') or ''
        result['zorgbehoefte_specifiek_code'] = getattr(care_category_sub, 'code', '') or ''
        result['taxonomie_lijn'] = taxonomie_lijn
        result['taxonomie_code_lijn'] = taxonomie_code_lijn
    else:
        result['arrangement_type_code'] = ''
        result['arrangement_provider'] = ''
        result['arrangement_end_date'] = None
        result['intake_start_date'] = None
        result['intake_appointment_at'] = None
        result['intake_appointment_location'] = ''
        result['intake_appointment_notes'] = ''
        result['intake_appointment_conducted_by'] = None
        result['urgency_validated'] = False
        result['urgency_document_present'] = False
        result['urgency_granted_date'] = None
        result['urgency_applied'] = False
        result['urgency_applied_since'] = None
        result['placement_pressure_horizon'] = ''
        result['safety_pressure'] = False
        result['time_sensitive_arrangement'] = False
        result['escalation_needed'] = False
        result['placement_pressure_notes'] = ''
        result['placement_pressure_band'] = None
        result['placement_pressure_label'] = None
        result['placement_pressure_reason'] = None
        result['placement_pressure_implication'] = None
        result['placement_request_status'] = None
        result['placement_provider_response_status'] = None
        result['routing'] = {}
        result['zorgbehoefte_categorie'] = ''
        result['zorgbehoefte_categorie_code'] = ''
        result['zorgbehoefte_specifiek'] = ''
        result['zorgbehoefte_specifiek_code'] = ''
        result['taxonomie_lijn'] = ''
        result['taxonomie_code_lijn'] = ''
    has_case_geo = bool(
        intake and getattr(intake, 'latitude', None) is not None and getattr(intake, 'longitude', None) is not None
    )
    result['has_case_geo'] = has_case_geo
    if include_geo and intake is not None:
        controlled_link_states = {
            WorkflowState.PLACEMENT_CONFIRMED,
            WorkflowState.INTAKE_STARTED,
            WorkflowState.ACTIVE_PLACEMENT,
            WorkflowState.ARCHIVED,
        }
        if getattr(intake, 'workflow_state', '') in controlled_link_states:
            result['case_geo'] = {
                'postcode': str(getattr(intake, 'postcode', '') or ''),
                'latitude': getattr(intake, 'latitude', None),
                'longitude': getattr(intake, 'longitude', None),
                'has_coordinates': has_case_geo,
            }
    return result
