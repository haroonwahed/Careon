"""
Matching API views: candidates list, matching actions, persistence helpers.
"""
import json
import logging

from django.http import Http404, JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404

from contracts.governance import AuditLoggingError, log_case_decision_event
from contracts.notifications import notify_provider_review_requested
from contracts.throttle import throttle
from contracts.models import (
    CareCase,
    CaseAssessment,
    CaseDecisionLog,
    CaseIntakeProcess,
    Client,
    MatchResultaat,
    PlacementRequest,
)
from contracts.tenancy import get_user_organization
from contracts.workflow_state_machine import (
    WorkflowAction,
    WorkflowRole,
    WorkflowState,
    derive_workflow_state,
    evaluate_transition,
    log_transition_event,
    sync_case_phase_from_workflow_state,
)
from contracts.workflow_summary_gate import workflow_summary_complete
from contracts.legacy_backend.provider_matching_service import MatchContext
from contracts.provider_matching_service import MatchEngine
from contracts.zorgbehoefte_taxonomy import format_taxonomy_explainability
from contracts.views.matching import _assign_provider_to_intake, _prepare_waitlist_proposal_for_intake
from contracts.case_timeline import record_gemeente_validation_to_provider_review_boundary
from contracts.governance import log_case_decision_event

from contracts.api._helpers import (
    _active_organization,
    _draft_validation_placement,
    _get_intake_for_case_api_id,
    _require_workflow_role,
    _resolved_intake_urgency,
)

logger = logging.getLogger(__name__)


def _build_match_context_from_intake(intake, organization):
    region_ref = ''
    if getattr(intake, 'regio', None):
        region_ref = intake.regio.region_code or intake.regio.region_name or ''
    elif getattr(intake, 'preferred_region', None):
        region_ref = intake.preferred_region.region_code or intake.preferred_region.region_name or ''

    contra = [token.strip() for token in str(getattr(intake, 'contra_indicaties', '') or '').split(',') if token.strip()]
    zorgregio = getattr(intake, 'zorgregio', None)
    plaatsingsregio = getattr(intake, 'plaatsingsregio', None)
    contractregio = getattr(intake, 'contractregio', None)
    escalatie_regio = getattr(intake, 'escalatie_regio', None)
    return MatchContext(
        zorgvorm=(getattr(intake, 'zorgvorm_gewenst', '') or intake.preferred_care_form or '').lower(),
        leeftijd=getattr(intake, 'leeftijd', None),
        regio=region_ref,
        gemeente=(intake.gemeente.municipality_name if getattr(intake, 'gemeente', None) else ''),
        herkomst_gemeente=(intake.herkomst_gemeente.municipality_name if getattr(intake, 'herkomst_gemeente', None) else ''),
        verantwoordelijke_gemeente=(
            intake.verantwoordelijke_gemeente.municipality_name if getattr(intake, 'verantwoordelijke_gemeente', None) else ''
        ),
        verblijfsgemeente=(intake.verblijfsgemeente.municipality_name if getattr(intake, 'verblijfsgemeente', None) else ''),
        zorgregio=(zorgregio.region_code or zorgregio.region_name or '') if zorgregio else '',
        plaatsingsregio=(plaatsingsregio.region_code or plaatsingsregio.region_name or '') if plaatsingsregio else '',
        contractregio=(contractregio.region_code or contractregio.region_name or '') if contractregio else '',
        escalatie_regio=(escalatie_regio.region_code or escalatie_regio.region_name or '') if escalatie_regio else '',
        complexiteit=(intake.complexity or '').lower(),
        urgentie=((intake.urgency or '').lower() or _resolved_intake_urgency(intake).lower()),
        problematiek=list(getattr(intake, 'problematiek_types', []) or []),
        crisisopvang_vereist=(_resolved_intake_urgency(intake) == CaseIntakeProcess.Urgency.CRISIS),
        setting_voorkeur=getattr(intake, 'setting_voorkeur', '') or '',
        contra_indicaties=contra,
        max_toelaatbare_wachttijd_dagen=getattr(intake, 'max_toelaatbare_wachttijd_dagen', None),
        requires_revalidation=bool(getattr(intake, 'requires_revalidation', False)),
        organization=organization,
    )


def _persist_advisory_matching_results(*, case_record: CareCase, intake: CaseIntakeProcess, organization) -> None:
    """Run advisory matching and persist ranked candidates for decision-engine read models."""
    ctx = _build_match_context_from_intake(intake, organization)
    MatchResultaat.objects.filter(casus=case_record).delete()
    MatchEngine.run(ctx=ctx, casus=intake, max_results=20, persist=True)


@login_required
@throttle(rate=15, period=60)
@require_http_methods(["GET"])
def matching_candidates_api(request, case_id):
    organization = _active_organization(request)
    if organization is None:
        return JsonResponse({'error': 'Geen actieve organisatie'}, status=400)

    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        # A staffed zorgaanbieder (one with placement-scoped Client access) could
        # otherwise enumerate case ids via this gemeente-only endpoint, so hide
        # existence with 404. A non-staffed member just gets the plain 403 denial.
        from contracts.permissions import provider_client_ids_for_user
        if actor_role == WorkflowRole.ZORGAANBIEDER and provider_client_ids_for_user(request.user, organization):
            return JsonResponse({'error': 'Casus niet gevonden'}, status=404)
        return role_error

    try:
        intake = _get_intake_for_case_api_id(
            case_id,
            organization,
            lock=False,
            select_related=('regio', 'preferred_region', 'gemeente'),
            user=request.user,
        )
    except Http404:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)
    if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
        return JsonResponse({'error': 'Casus is gearchiveerd.'}, status=400)

    assessment = getattr(intake, 'case_assessment', None)
    ok, err = workflow_summary_complete(assessment=assessment, intake=intake)
    if not ok:
        return JsonResponse({'error': err, 'code': 'SUMMARY_INCOMPLETE'}, status=400)

    ctx = _build_match_context_from_intake(intake, organization)
    limit = int(request.GET.get('limit', 10) or 10)
    results = MatchEngine.run(ctx=ctx, casus=intake, max_results=max(limit, 10), persist=False)
    taxonomie_lijn, taxonomie_code_lijn = format_taxonomy_explainability(
        ctx.zorgbehoefte_categorie,
        ctx.zorgbehoefte_categorie_code,
        ctx.zorgbehoefte_specifiek,
        ctx.zorgbehoefte_specifiek_code,
    )

    payload = []
    for rank, row in enumerate(results, start=1):
        trade_offs = []
        for item in list(row.trade_offs or []):
            if isinstance(item, dict):
                detail = item.get('toelichting') or item.get('factor') or ''
                if detail:
                    trade_offs.append(str(detail))
            elif item:
                trade_offs.append(str(item))

        _za = getattr(row, 'zorgaanbieder', None)
        _provider_client_id = _za.client_id if _za else None

        payload.append({
            'casus_id': intake.pk,
            'zorgprofiel_id': row.zorgprofiel_id,
            'zorgaanbieder_id': row.zorgaanbieder_id,
            'provider_client_id': _provider_client_id,
            'provider_unlinked': _provider_client_id is None,
            'aanbiederName': _za.name if _za else '',
            'totaalscore': float(row.totaalscore or 0.0),
            'score_inhoudelijke_fit': float(row.score_inhoudelijke_fit or 0.0),
            'score_regio_contract_fit': float(row.score_regio_contract_fit or row.score_contract_regio or 0.0),
            'score_capaciteit_wachttijd_fit': float(row.score_capaciteit_wachttijd_fit or row.score_capaciteit or 0.0),
            'score_complexiteit_veiligheid_fit': float(row.score_complexiteit_veiligheid_fit or row.score_complexiteit or 0.0),
            'score_performance_fit': float(row.score_performance_fit or row.score_performance or 0.0),
            'confidence_label': (row.confidence_label or '').lower(),
            'fit_samenvatting': row.fit_samenvatting or '',
            'trade_offs': trade_offs,
            'verificatie_advies': row.verificatie_advies or '',
            'zorgbehoefte_categorie': ctx.zorgbehoefte_categorie or '',
            'zorgbehoefte_categorie_code': ctx.zorgbehoefte_categorie_code or '',
            'zorgbehoefte_specifiek': ctx.zorgbehoefte_specifiek or '',
            'zorgbehoefte_specifiek_code': ctx.zorgbehoefte_specifiek_code or '',
            'taxonomie_lijn': taxonomie_lijn,
            'taxonomie_code_lijn': taxonomie_code_lijn,
            'uitgesloten': bool(row.uitgesloten),
            'uitsluitreden': row.uitsluitreden or '',
            'ranking': row.ranking or rank,
            'region_pressure_signal': 'Beste inhoudelijke match, maar capaciteit in regio staat onder druk' if (row.score_capaciteit_wachttijd_fit or row.score_capaciteit or 0) < 10 else '',
        })

    return JsonResponse({
        'caseId': intake.pk,
        'count': len(payload),
        'matches': payload[:limit],
    })


@login_required
@require_http_methods(["POST"])
def matching_action_api(request, case_id):
    try:
        return _matching_action_api_inner(request, case_id)
    except Http404:
        return JsonResponse({'ok': False, 'error': 'Casus niet gevonden.'}, status=404)
    except AuditLoggingError as exc:
        return JsonResponse({'ok': False, 'error': str(exc)}, status=503)


def _matching_action_api_inner(request, case_id):
    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        return role_error

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        payload = {}

    action = (payload.get('action') or '').strip().lower()
    override_reason = (payload.get('override_reason') or '').strip()

    with transaction.atomic():
        intake = _get_intake_for_case_api_id(case_id, organization, lock=True, user=request.user)
        if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
            return JsonResponse({'ok': False, 'error': 'Casus is gearchiveerd.'}, status=400)

        provider = get_object_or_404(
            Client.objects.filter(organization=organization, status='ACTIVE'),
            pk=payload.get('provider_id'),
        )

        assessment = getattr(intake, 'case_assessment', None)
        previous_state = derive_workflow_state(intake=intake, assessment=assessment)

        # Validate that the chosen provider has a linked Zorgaanbieder.
        # Without this link the placement would reference an unscored, unverified provider.
        if action in ('confirm_validation', 'send_to_provider', 'assign'):
            try:
                _ = provider.zorgaanbieder
            except ObjectDoesNotExist:
                return JsonResponse({
                    'ok': False,
                    'error': 'Aanbieder is niet gekoppeld aan een bekende zorgaanbieder. Controleer de aanbiedersconfiguratie.',
                    'code': 'PROVIDER_UNLINKED',
                }, status=400)

        # Detect manual override: provider is not the top-ranked match for this case.
        # Compare Client PKs (both sides of the link) so the keyspaces match.
        # MatchResultaat.casus is FK to CareCase, not CaseIntakeProcess.
        _case_record = getattr(intake, 'case_record', None)
        top_match = (
            MatchResultaat.objects
            .filter(casus=_case_record, uitgesloten=False)
            .order_by('ranking', '-totaalscore')
            .select_related('zorgaanbieder')
            .first()
        ) if _case_record is not None else None
        _top_client_id = (
            top_match.zorgaanbieder.client_id
            if top_match is not None and getattr(top_match, 'zorgaanbieder', None)
            else None
        )
        is_provider_override = (
            action in ('send_to_provider', 'assign')
            and _top_client_id is not None
            and _top_client_id != provider.pk
        )

        actions_need_summary = {'prepare_waitlist_proposal', 'confirm_validation', 'send_to_provider', 'assign'}
        if action in actions_need_summary:
            ok_s, err_s = workflow_summary_complete(assessment=assessment, intake=intake)
            if not ok_s:
                return JsonResponse({'ok': False, 'error': err_s, 'code': 'SUMMARY_INCOMPLETE'}, status=400)

        if action == 'prepare_waitlist_proposal':
            active_for_block = (
                PlacementRequest.objects.filter(due_diligence_process=intake)
                .order_by('-updated_at', '-created_at')
                .first()
            )
            if active_for_block and active_for_block.status == PlacementRequest.Status.IN_REVIEW:
                return JsonResponse(
                    {'ok': False, 'error': 'Deze casus is al naar de aanbieder verstuurd; wachtlijstvoorstel kan niet meer als concept worden vastgelegd.'},
                    status=400,
                )

            if previous_state == WorkflowState.MATCHING_READY:
                validation_transition = evaluate_transition(
                    current_state=WorkflowState.MATCHING_READY,
                    target_state=WorkflowState.GEMEENTE_VALIDATED,
                    actor_role=actor_role,
                    action=WorkflowAction.VALIDATE_MATCHING,
                )
                if not validation_transition.allowed:
                    return JsonResponse({'ok': False, 'error': validation_transition.reason}, status=400)
            elif previous_state == WorkflowState.GEMEENTE_VALIDATED:
                pass
            else:
                return JsonResponse(
                    {'ok': False, 'error': 'Wachtlijstvoorstel kan alleen worden vastgelegd tijdens matching of na eerdere gemeente-validatie zonder verzending naar aanbieder.'},
                    status=400,
                )

            match_score = payload.get('match_score')
            try:
                placement = _prepare_waitlist_proposal_for_intake(
                    request=request,
                    intake=intake,
                    provider=provider,
                    source='matching_action_api_prepare_waitlist',
                    match_score=match_score,
                )
            except ValidationError as exc:
                return JsonResponse({'ok': False, 'error': '; '.join(exc.messages) or 'Wachtlijstvoorstel mislukt.'}, status=400)

            intake.workflow_state = WorkflowState.GEMEENTE_VALIDATED
            if intake.status != CaseIntakeProcess.ProcessStatus.DECISION:
                intake.status = CaseIntakeProcess.ProcessStatus.DECISION
            intake.save(update_fields=['workflow_state', 'status', 'updated_at'])
            sync_case_phase_from_workflow_state(intake)

            if previous_state == WorkflowState.MATCHING_READY:
                log_transition_event(
                    intake=intake,
                    actor_user=request.user,
                    actor_role=actor_role,
                    old_state=previous_state,
                    new_state=WorkflowState.GEMEENTE_VALIDATED,
                    action=WorkflowAction.VALIDATE_MATCHING,
                    placement=placement,
                    source='matching_action_api_prepare_waitlist',
                )

            return JsonResponse({
                'ok': True,
                'matchingOutcome': 'WAITLIST_PROPOSAL',
                'nextPage': 'case_detail',
                'providerId': str(provider.pk),
                'placementId': str(placement.pk),
                'caseId': str(intake.pk),
            })

        if action == 'confirm_validation':
            active_in_review = (
                PlacementRequest.objects.filter(
                    due_diligence_process=intake,
                    status=PlacementRequest.Status.IN_REVIEW,
                ).exists()
            )
            if active_in_review:
                return JsonResponse({'ok': False, 'error': 'Deze casus staat al bij de aanbieder in beoordeling.'}, status=400)
            if previous_state != WorkflowState.MATCHING_READY:
                return JsonResponse({'ok': False, 'error': 'Gemeente-validatie is alleen mogelijk wanneer matching gereed is.'}, status=400)
            validation_transition = evaluate_transition(
                current_state=WorkflowState.MATCHING_READY,
                target_state=WorkflowState.GEMEENTE_VALIDATED,
                actor_role=actor_role,
                action=WorkflowAction.VALIDATE_MATCHING,
            )
            if not validation_transition.allowed:
                return JsonResponse({'ok': False, 'error': validation_transition.reason}, status=400)
            validation_context = payload.get('validation_context')
            if not isinstance(validation_context, dict):
                validation_context = {}
            placement = _draft_validation_placement(
                request=request,
                intake=intake,
                provider=provider,
                validation_context=validation_context,
            )
            intake.workflow_state = WorkflowState.GEMEENTE_VALIDATED
            intake.save(update_fields=['workflow_state', 'updated_at'])
            sync_case_phase_from_workflow_state(intake)
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=previous_state,
                new_state=WorkflowState.GEMEENTE_VALIDATED,
                action=WorkflowAction.VALIDATE_MATCHING,
                placement=placement,
                source='matching_action_api_confirm_validation',
            )
            log_case_decision_event(
                case_id=intake.pk,
                placement_id=placement.pk,
                event_type=CaseDecisionLog.EventType.GEMEENTE_VALIDATION,
                recommendation_context={
                    'validation_context': validation_context,
                    'actor_role': actor_role,
                },
                user_action='gemeente_validate_matching',
                actor_user_id=request.user.id,
                action_source='matching_action_api_confirm_validation',
                provider_id=provider.pk,
                strict=True,
            )
            return JsonResponse({
                'ok': True,
                'step': 'gemeente_validatie',
                'nextPage': 'matching',
                'providerId': str(provider.pk),
                'placementId': str(placement.pk),
                'caseId': str(intake.pk),
            })

        if action == 'send_to_provider':
            if is_provider_override and not override_reason:
                return JsonResponse({
                    'ok': False,
                    'error': 'Handmatige overschrijving vereist een toelichting (override_reason).',
                    'code': 'OVERRIDE_REASON_REQUIRED',
                }, status=400)
            if previous_state != WorkflowState.GEMEENTE_VALIDATED:
                return JsonResponse({'ok': False, 'error': 'Bevestig eerst de gemeente-validatie (stap vóór verzenden).'}, status=400)
            placement_row = (
                PlacementRequest.objects.filter(due_diligence_process=intake)
                .order_by('-updated_at')
                .first()
            )
            if placement_row is None or placement_row.status != PlacementRequest.Status.DRAFT:
                return JsonResponse({'ok': False, 'error': 'Geen gevalideerde concept-plaatsing; voer validatie opnieuw uit.'}, status=400)
            if placement_row.proposed_provider_id != provider.pk:
                return JsonResponse({'ok': False, 'error': 'Aanbieder komt niet overeen met de gevalideerde keuze.'}, status=400)
            send_to_provider_transition = evaluate_transition(
                current_state=WorkflowState.GEMEENTE_VALIDATED,
                target_state=WorkflowState.PROVIDER_REVIEW_PENDING,
                actor_role=actor_role,
                action=WorkflowAction.SEND_TO_PROVIDER,
            )
            if not send_to_provider_transition.allowed:
                return JsonResponse({'ok': False, 'error': send_to_provider_transition.reason}, status=400)
            try:
                placement = _assign_provider_to_intake(request=request, intake=intake, provider=provider, source='matching_api_send')
            except ValidationError as exc:
                return JsonResponse({'ok': False, 'error': '; '.join(exc.messages) or 'Verzenden mislukt.'}, status=400)
            update_fields = ['updated_at']
            if intake.status != CaseIntakeProcess.ProcessStatus.DECISION:
                intake.status = CaseIntakeProcess.ProcessStatus.DECISION
                update_fields.append('status')
            if intake.workflow_state != WorkflowState.PROVIDER_REVIEW_PENDING:
                intake.workflow_state = WorkflowState.PROVIDER_REVIEW_PENDING
                update_fields.append('workflow_state')
            intake.save(update_fields=list(dict.fromkeys(update_fields)))
            sync_case_phase_from_workflow_state(intake)
            new_state = derive_workflow_state(intake=intake, assessment=assessment, placement=placement)
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=WorkflowState.GEMEENTE_VALIDATED,
                new_state=new_state,
                action=WorkflowAction.SEND_TO_PROVIDER,
                placement=placement,
                source='matching_action_api_send_to_provider',
            )
            record_gemeente_validation_to_provider_review_boundary(
                intake=intake,
                placement=placement,
                request=request,
                actor_role=actor_role,
                workflow_state_before_action=previous_state,
                source='matching_action_api_send_to_provider',
            )
            log_case_decision_event(
                case_id=intake.pk,
                placement_id=placement.pk,
                event_type=CaseDecisionLog.EventType.PROVIDER_SELECTED,
                recommendation_context={
                    'actor_role': actor_role,
                    'is_override': is_provider_override,
                    'recommended_provider_id': _top_client_id,
                },
                user_action='send_to_provider_override' if is_provider_override else 'send_to_provider',
                actor_user_id=request.user.id,
                action_source='matching_action_api_send_to_provider',
                provider_id=provider.pk,
                override_type='MANUAL' if is_provider_override else '',
                recommended_value={'provider_id': top_match.zorgaanbieder_id} if top_match else None,
                actual_value={'provider_id': provider.pk},
                optional_reason=override_reason if is_provider_override else '',
                strict=True,
            )
            notify_provider_review_requested(
                intake=intake,
                placement=placement,
                organization=organization,
            )
            return JsonResponse({
                'ok': True,
                'nextPage': 'casussen',
                'providerId': str(provider.pk),
                'placementId': str(placement.pk),
                'caseId': str(intake.pk),
            })

        if action == 'assign':
            if is_provider_override and not override_reason:
                return JsonResponse({
                    'ok': False,
                    'error': 'Handmatige overschrijving vereist een toelichting (override_reason).',
                    'code': 'OVERRIDE_REASON_REQUIRED',
                }, status=400)
            validation_transition = evaluate_transition(
                current_state=previous_state,
                target_state=WorkflowState.GEMEENTE_VALIDATED,
                actor_role=actor_role,
                action=WorkflowAction.VALIDATE_MATCHING,
            )
            if not validation_transition.allowed:
                return JsonResponse({'ok': False, 'error': validation_transition.reason}, status=400)

            send_to_provider_transition = evaluate_transition(
                current_state=WorkflowState.GEMEENTE_VALIDATED,
                target_state=WorkflowState.PROVIDER_REVIEW_PENDING,
                actor_role=actor_role,
                action=WorkflowAction.SEND_TO_PROVIDER,
            )
            if not send_to_provider_transition.allowed:
                return JsonResponse({'ok': False, 'error': send_to_provider_transition.reason}, status=400)

            if intake.workflow_state != WorkflowState.GEMEENTE_VALIDATED:
                intake.workflow_state = WorkflowState.GEMEENTE_VALIDATED
                intake.save(update_fields=['workflow_state', 'updated_at'])

            try:
                placement = _assign_provider_to_intake(request=request, intake=intake, provider=provider, source='matching_api')
            except ValidationError as exc:
                return JsonResponse({'ok': False, 'error': '; '.join(exc.messages) or 'Matching kan nog niet worden gestart.'}, status=400)

            update_fields = ['updated_at']
            if intake.status != CaseIntakeProcess.ProcessStatus.DECISION:
                intake.status = CaseIntakeProcess.ProcessStatus.DECISION
                update_fields.append('status')
            if intake.workflow_state != WorkflowState.PROVIDER_REVIEW_PENDING:
                intake.workflow_state = WorkflowState.PROVIDER_REVIEW_PENDING
                update_fields.append('workflow_state')

            intake.save(update_fields=list(dict.fromkeys(update_fields)))
            sync_case_phase_from_workflow_state(intake)
            new_state = derive_workflow_state(intake=intake, assessment=assessment, placement=placement)
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=previous_state,
                new_state=WorkflowState.GEMEENTE_VALIDATED,
                action=WorkflowAction.VALIDATE_MATCHING,
                source='matching_action_api',
            )
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=WorkflowState.GEMEENTE_VALIDATED,
                new_state=new_state,
                action=WorkflowAction.SEND_TO_PROVIDER,
                placement=placement,
                source='matching_action_api',
            )
            record_gemeente_validation_to_provider_review_boundary(
                intake=intake,
                placement=placement,
                request=request,
                actor_role=actor_role,
                workflow_state_before_action=previous_state,
                source='matching_action_api',
            )
            log_case_decision_event(
                case_id=intake.pk,
                placement_id=placement.pk,
                event_type=CaseDecisionLog.EventType.PROVIDER_SELECTED,
                recommendation_context={
                    'actor_role': actor_role,
                    'is_override': is_provider_override,
                    'recommended_provider_id': _top_client_id,
                },
                user_action='assign_override' if is_provider_override else 'assign',
                actor_user_id=request.user.id,
                action_source='matching_action_api_assign',
                provider_id=provider.pk,
                override_type='MANUAL' if is_provider_override else '',
                recommended_value={'provider_id': top_match.zorgaanbieder_id} if top_match else None,
                actual_value={'provider_id': provider.pk},
                optional_reason=override_reason if is_provider_override else '',
                strict=True,
            )
            notify_provider_review_requested(
                intake=intake,
                placement=placement,
                organization=organization,
            )
            return JsonResponse({
                'ok': True,
                'nextPage': 'casussen',
                'providerId': str(provider.pk),
                'placementId': str(placement.pk),
                'caseId': str(intake.pk),
            })

        return JsonResponse({'ok': False, 'error': 'Unsupported action.'}, status=400)
