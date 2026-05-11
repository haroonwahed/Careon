"""Zorg OS v1.2 — gemeentelijke levenscyclus, zorgvormen, budget en evaluaties.

Helpers houden business rules op één plek (backend blijft bron van waarheid).
"""
from __future__ import annotations

from typing import Any

from contracts.models import CaseIntakeProcess, PlacementRequest

# Zorgvormcodes (CaseIntakeProcess / PlacementRequest CareForm) — strings i.v.m. importvolgorde.
_LIGHT_CARE_FORMS = frozenset({'OUTPATIENT', 'DAY_TREATMENT', 'LOW_THRESHOLD_CONSULT', 'AMBULANT_SUPPORT'})
_GATED_CARE_FORMS = frozenset({'RESIDENTIAL', 'CRISIS', 'VOLUNTARY_OUT_OF_HOME', 'CONTINUATION_PATHWAY'})


class BudgetReviewStatus:
    NOT_REQUIRED = 'NOT_REQUIRED'
    PENDING = 'PENDING'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'
    NEEDS_INFO = 'NEEDS_INFO'
    DEFERRED = 'DEFERRED'


def effective_care_form_code(*, intake: CaseIntakeProcess | None, placement: PlacementRequest | None) -> str:
    """Resolve care form for budget/heavy-flow rules (placement overrides intake)."""
    if placement is not None:
        cf = str(getattr(placement, 'care_form', '') or '').strip()
        if cf:
            return cf
    if intake is None:
        return ''
    return str(
        getattr(intake, 'zorgvorm_gewenst', '') or getattr(intake, 'preferred_care_form', '') or ''
    ).strip()


def care_form_requires_budget_review(care_form_code: str) -> bool:
    """Zware trajecten en doorstroom: gemeente moet budget financieel beoordelen vóór plaatsing."""
    code = str(care_form_code or '').strip().upper()
    if not code:
        return False
    if code in _LIGHT_CARE_FORMS:
        return False
    return code in _GATED_CARE_FORMS


def placement_budget_blocks_confirmation(placement: PlacementRequest | None) -> tuple[bool, str]:
    """Return (blocked, reason_nl) when gemeente plaatsing nog niet mag bevestigen."""
    if placement is None:
        return False, ''
    intake = placement.intake
    code = effective_care_form_code(intake=intake, placement=placement)
    if not care_form_requires_budget_review(code):
        return False, ''
    status = str(getattr(placement, 'budget_review_status', '') or '').strip().upper()
    if status in ('', BudgetReviewStatus.NOT_REQUIRED, BudgetReviewStatus.APPROVED):
        return False, ''
    if status == BudgetReviewStatus.PENDING:
        return True, 'Budgetverzoek beoordelen: wacht op gemeentelijke financiële validatie.'
    if status == BudgetReviewStatus.NEEDS_INFO:
        return True, 'Vraag onderbouwing op: budgetaanvraag is onvolledig.'
    if status == BudgetReviewStatus.DEFERRED:
        return True, 'Budgetbesluit uitgesteld: plaatsing kan pas na nieuwe beslissing.'
    if status == BudgetReviewStatus.REJECTED:
        return True, 'Budget financieel afgewezen: koppel opnieuw aan matchtraject voordat plaatsing wordt bevestigd.'
    return True, 'Budgetverzoek beoordelen voordat plaatsing wordt bevestigd.'


def sync_placement_budget_review_flags(*, intake: CaseIntakeProcess, placement: PlacementRequest) -> list[str]:
    """Zet budget_review_status op basis van zorgvorm; retourneert ORM update_fields."""
    code = effective_care_form_code(intake=intake, placement=placement)
    update_fields: list[str] = []
    if not care_form_requires_budget_review(code):
        if getattr(placement, 'budget_review_status', None) != BudgetReviewStatus.NOT_REQUIRED:
            placement.budget_review_status = BudgetReviewStatus.NOT_REQUIRED
            update_fields.append('budget_review_status')
        return update_fields
    prev = str(getattr(placement, 'budget_review_status', '') or '').strip().upper()
    if prev in ('', BudgetReviewStatus.NOT_REQUIRED, BudgetReviewStatus.REJECTED):
        placement.budget_review_status = BudgetReviewStatus.PENDING
        update_fields.append('budget_review_status')
    return update_fields


def transition_request_blocks_financial_actions(
    intake: CaseIntakeProcess | None,
) -> tuple[bool, str]:
    """Blokkeer budget-impact zolang er een open doorstroomverzoek zonder financieel akkoord is."""
    if intake is None:
        return False, ''
    from contracts.models import ProviderCareTransitionRequest  # lazy import against cycles

    pending = (
        ProviderCareTransitionRequest.objects.filter(
            due_diligence_process=intake,
            status=ProviderCareTransitionRequest.Status.PENDING,
        )
        .exclude(financial_validation_status=ProviderCareTransitionRequest.FinancialValidationStatus.APPROVED)
        .exists()
    )
    if pending:
        return True, 'Doorstroomverzoek wacht op gemeentelijke financiële validatie.'
    return False, ''


def serialize_evaluation(ev: Any) -> dict[str, Any]:
    return {
        'id': str(ev.pk),
        'dueDate': ev.due_date.isoformat() if ev.due_date else '',
        'attendees': list(ev.attendees or []),
        'status': ev.status,
        'outcome': ev.outcome or '',
        'followUpActions': ev.follow_up_actions or '',
        'updatedAt': ev.updated_at.isoformat() if ev.updated_at else '',
    }
