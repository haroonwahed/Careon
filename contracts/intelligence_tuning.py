"""
contracts/intelligence_tuning.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Controlled intelligence tuning workflow for the V3 decision intelligence.

Turns calibration diagnostics into human-reviewed TuningProposal records and
provides optional before/after simulation snapshots so reviewers can assess
expected impact before approving.

Design principles
-----------------
- All proposals are *advisory only* — no matching weights are mutated.
- Proposals are generated from calibration_diagnostics() output or manually.
- Simulation is deterministic and read-only: it re-runs confidence scoring
  on representative sample scenarios with the proposed delta applied in-memory.
- No auto-apply path exists.  A staff member must explicitly advance the status.

Public API
----------
proposals_from_calibration_diagnostics(diagnostics, org, actor=None)  -> list[TuningProposal]
simulate_proposal_impact(proposal, sample_rows)                        -> dict
transition_proposal(proposal, new_status, actor, note='')              -> TuningProposal
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Source → FactorType mapping
# ---------------------------------------------------------------------------

# Maps calibration source identifiers to the most appropriate FactorType choice.
_SOURCE_TO_FACTOR = {
    "hoog_vertrouwen_lage_acceptatie": "PROVIDER_RELIABILITY_BOOST",
    "laag_vertrouwen_hoog_succes": "SPECIALIZATION_WEIGHT",
    "categorie_drift": "CATEGORY_CONFIDENCE_THRESHOLD",
    "aanbieder_drift_over_confident": "PROVIDER_RELIABILITY_BOOST",
    "aanbieder_drift_under_confident": "SPECIALIZATION_WEIGHT",
    "afwijzing_cluster_CAPACITY": "CAPACITY_REJECTION_PENALTY",
    "afwijzing_cluster_NO_CAPACITY": "CAPACITY_REJECTION_PENALTY",
    "afwijzing_cluster_REGION_MISMATCH": "REGION_WEIGHT",
    "afwijzing_cluster_SPECIALIZATION_MISMATCH": "SPECIALIZATION_WEIGHT",
    "afwijzing_cluster_COMPLEXITY_TOO_HIGH": "COMPLEXITY_THRESHOLD",
    "afwijzing_cluster": "OTHER",
}

# Default proposed deltas per factor (magnitude only; sign is contextual)
_DEFAULT_DELTA = {
    "SPECIALIZATION_WEIGHT": 0.10,
    "PROVIDER_RELIABILITY_BOOST": 0.05,
    "CAPACITY_REJECTION_PENALTY": 0.10,
    "CATEGORY_CONFIDENCE_THRESHOLD": 0.05,
    "REGION_WEIGHT": 0.10,
    "COMPLEXITY_THRESHOLD": 0.05,
    "OTHER": 0.0,
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _factor_for_source(source: str, dominant_reason: Optional[str] = None) -> str:
    if dominant_reason:
        key = f"{source}_{dominant_reason}"
        if key in _SOURCE_TO_FACTOR:
            return _SOURCE_TO_FACTOR[key]
    return _SOURCE_TO_FACTOR.get(source, "OTHER")


def _delta_for_factor(factor: str) -> float:
    return _DEFAULT_DELTA.get(factor, 0.0)


def _lookup_care_category(org, category_name: Optional[str]):
    """Return a CareCategoryMain instance for the given name, or None."""
    if not category_name or category_name in ("—", "Onbekend"):
        return None
    try:
        from contracts.models import CareCategoryMain  # deferred
        return CareCategoryMain.objects.filter(
            name__iexact=category_name,
        ).first()
    except Exception:
        return None


def _lookup_provider(provider_id):
    """Return a Client (provider) instance for the given pk, or None."""
    if not provider_id:
        return None
    try:
        from contracts.models import Client  # deferred
        return Client.objects.filter(pk=provider_id).first()
    except Exception:
        return None


# ---------------------------------------------------------------------------
# 1. Generate proposals from calibration diagnostics
# ---------------------------------------------------------------------------


def proposals_from_calibration_diagnostics(
    diagnostics: Dict[str, Any],
    org,
    actor=None,
) -> List[Any]:
    """Create (unsaved) TuningProposal instances from calibration diagnostics.

    Does NOT save to the database — callers must call .save() or .bulk_create()
    themselves to preserve control over when/whether proposals are persisted.

    Parameters
    ----------
    diagnostics : dict
        Output of ``calibration_diagnostics()`` from intelligence_calibration.
    org : Organization
        The tenant organisation for the proposals.
    actor : User | None
        The user (or None for system-generated) to attribute proposals to.

    Returns a list of unsaved TuningProposal instances.
    """
    from contracts.models import TuningProposal  # deferred

    proposals: List[Any] = []

    # ── high-confidence / low-acceptance ──────────────────────────────────
    for entry in diagnostics.get("high_confidence_low_acceptance", []):
        category_name = entry.get("care_category")
        factor = _factor_for_source("hoog_vertrouwen_lage_acceptatie")
        delta = -_delta_for_factor(factor)  # negative: reduce the boost
        proposals.append(
            TuningProposal(
                organization=org,
                status=TuningProposal.Status.SUGGESTED,
                source=TuningProposal.Source.HIGH_CONF_LOW_ACCEPT,
                factor_type=factor,
                affected_care_category=_lookup_care_category(org, category_name),
                detected_issue=(
                    f"Hoge confidence-scores voor '{category_name}' leiden tot "
                    f"slechts {(entry.get('acceptance_rate') or 0)*100:.0f}% acceptatie "
                    f"(n={entry.get('total_high_conf', '?')})."
                ),
                recommendation=(
                    f"Verlaag de aanbieder-betrouwbaarheidsbonus voor zorgcategorie "
                    f"'{category_name}'. Voorgestelde delta: {delta:+.2f}."
                ),
                proposed_delta=delta,
                rationale=(
                    "Confidence overschat de kans op acceptatie in dit segment. "
                    "Een lagere betrouwbaarheidsbonus zorgt voor realistischere scores."
                ),
                created_by=actor,
            )
        )

    # ── low-confidence / high-success ─────────────────────────────────────
    for entry in diagnostics.get("low_confidence_high_success", []):
        category_name = entry.get("care_category")
        factor = _factor_for_source("laag_vertrouwen_hoog_succes")
        delta = +_delta_for_factor(factor)  # positive: increase the weight
        proposals.append(
            TuningProposal(
                organization=org,
                status=TuningProposal.Status.SUGGESTED,
                source=TuningProposal.Source.LOW_CONF_HIGH_SUCCESS,
                factor_type=factor,
                affected_care_category=_lookup_care_category(org, category_name),
                detected_issue=(
                    f"Lage confidence-scores voor '{category_name}' ondanks "
                    f"{(entry.get('success_rate') or 0)*100:.0f}% succesvolle plaatsingen "
                    f"(n={entry.get('total_low_conf', '?')})."
                ),
                recommendation=(
                    f"Verhoog het specialisatiegewicht voor zorgcategorie "
                    f"'{category_name}'. Voorgestelde delta: {delta:+.2f}."
                ),
                proposed_delta=delta,
                rationale=(
                    "Confidence onderschat de matchkwaliteit in dit segment. "
                    "Een hoger specialisatiegewicht leidt tot realistischere scores."
                ),
                created_by=actor,
            )
        )

    # ── care category drift ───────────────────────────────────────────────
    for entry in diagnostics.get("care_category_drift", []):
        if not entry.get("drift_detected"):
            continue
        category_name = entry.get("care_category")
        factor = _factor_for_source("categorie_drift")
        gap = entry.get("gap", 0.0) or 0.0
        delta = round(0.20 - gap, 2)  # suggest enough to close the gap
        proposals.append(
            TuningProposal(
                organization=org,
                status=TuningProposal.Status.SUGGESTED,
                source=TuningProposal.Source.CATEGORY_DRIFT,
                factor_type=factor,
                affected_care_category=_lookup_care_category(org, category_name),
                detected_issue=(
                    f"Confidence onderscheidt hoge en lage matches niet voldoende "
                    f"voor '{category_name}' (gap={gap:.2f}, drempel=0.20)."
                ),
                recommendation=entry.get("recommendation", ""),
                proposed_delta=delta,
                rationale=(
                    "Een klein gap suggereert dat de confidence-drempel voor deze "
                    "categorie niet differentiërend genoeg is. Overweeg het drempelgewicht "
                    "aan te passen of aanvullende matching-features toe te voegen."
                ),
                created_by=actor,
            )
        )

    # ── provider drift ────────────────────────────────────────────────────
    for entry in diagnostics.get("provider_drift", []):
        drift_type = entry.get("drift_type")
        if not drift_type:
            continue
        source_key = f"aanbieder_drift_{drift_type}"
        factor = _factor_for_source(source_key)
        mean_conf = entry.get("mean_confidence", 0.0)
        accept_rate = entry.get("acceptance_rate", 0.0)
        delta_magnitude = abs(round(mean_conf - accept_rate, 2))
        delta = -delta_magnitude if drift_type == "over_confident" else +delta_magnitude
        proposals.append(
            TuningProposal(
                organization=org,
                status=TuningProposal.Status.SUGGESTED,
                source=TuningProposal.Source.PROVIDER_DRIFT,
                factor_type=factor,
                affected_provider=_lookup_provider(entry.get("provider_id")),
                detected_issue=(
                    f"Aanbieder '{entry.get('provider_name')}' toont {drift_type}: "
                    f"gem. confidence {mean_conf:.2f} vs werkelijke acceptatie {accept_rate*100:.0f}% "
                    f"(n={entry.get('total', '?')})."
                ),
                recommendation=entry.get("recommendation", ""),
                proposed_delta=delta,
                rationale=(
                    "Provider-specifieke kalibratie-drift suggereert dat de "
                    "confidence-berekening voor deze aanbieder niet goed gekalibreerd is."
                ),
                created_by=actor,
            )
        )

    # ── rejection taxonomy clusters ───────────────────────────────────────
    for entry in diagnostics.get("taxonomy_clusters", []):
        category_name = entry.get("care_category")
        dominant_reason = entry.get("dominant_reason_code", "")
        source_key = "afwijzing_cluster"
        factor = _factor_for_source(source_key, dominant_reason)
        delta = +_delta_for_factor(factor)  # increase penalty / weight
        proposals.append(
            TuningProposal(
                organization=org,
                status=TuningProposal.Status.SUGGESTED,
                source=TuningProposal.Source.TAXONOMY_CLUSTER,
                factor_type=factor,
                affected_care_category=_lookup_care_category(org, category_name),
                detected_issue=(
                    f"'{dominant_reason}' is verantwoordelijk voor "
                    f"{entry.get('dominant_pct', 0)*100:.0f}% van alle afwijzingen "
                    f"in '{category_name}' (n={entry.get('total_rejections', '?')})."
                ),
                recommendation=entry.get("recommendation", ""),
                proposed_delta=delta,
                rationale=(
                    f"Een dominante afwijzingsredencode suggereert een structureel "
                    f"matching-probleem rondom '{dominant_reason}'."
                ),
                created_by=actor,
            )
        )

    return proposals


# ---------------------------------------------------------------------------
# 2. Simulation: before/after confidence snapshot
# ---------------------------------------------------------------------------


def simulate_proposal_impact(
    proposal,
    sample_rows: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Simulate the before/after confidence impact of a TuningProposal.

    Runs a lightweight in-memory confidence adjustment on *sample_rows*
    using the proposal's ``proposed_delta`` and ``factor_type``.  The
    simulation is purely additive: it adds/subtracts the delta from each
    row's ``predicted_confidence`` for the relevant scope, then computes
    summary statistics.

    This is a *what-if* snapshot, not a prediction of the full matching
    engine.  It is stored on the proposal for reviewer context.

    Parameters
    ----------
    proposal : TuningProposal
        The proposal whose delta and scope are used.
    sample_rows : list[dict]
        Row dicts in the same format as PlacementRequest.objects.values().
        Rows outside the proposal's scope are included in totals but not
        adjusted.

    Returns a dict with:
    - total_rows (int)
    - in_scope_rows (int): rows affected by the proposed delta
    - before_mean_confidence (float|None)
    - after_mean_confidence (float|None)
    - before_high_conf_pct (float|None): % of rows with conf ≥ 0.70
    - after_high_conf_pct (float|None)
    - delta_applied (float)
    - scope_description (str)
    """
    if not sample_rows:
        return {
            "total_rows": 0,
            "in_scope_rows": 0,
            "before_mean_confidence": None,
            "after_mean_confidence": None,
            "before_high_conf_pct": None,
            "after_high_conf_pct": None,
            "delta_applied": proposal.proposed_delta or 0.0,
            "scope_description": "Geen voorbeeldgegevens beschikbaar.",
        }

    delta = proposal.proposed_delta or 0.0
    category_name = (
        proposal.affected_care_category.name
        if proposal.affected_care_category
        else None
    )
    provider_id = (
        proposal.affected_provider.pk if proposal.affected_provider else None
    )

    def _in_scope(row: Dict[str, Any]) -> bool:
        if category_name:
            row_cat = (
                row.get("due_diligence_process__care_category_main__name") or ""
            ).lower()
            if row_cat != category_name.lower():
                return False
        if provider_id is not None:
            if row.get("selected_provider_id") != provider_id:
                return False
        return True

    before_confs = []
    after_confs = []
    in_scope = 0

    for row in sample_rows:
        conf = row.get("predicted_confidence")
        if conf is None:
            continue
        before_confs.append(conf)
        if _in_scope(row):
            in_scope += 1
            adjusted = max(0.0, min(1.0, conf + delta))
            after_confs.append(adjusted)
        else:
            after_confs.append(conf)

    def _mean(vals):
        return round(sum(vals) / len(vals), 4) if vals else None

    def _high_conf_pct(vals):
        if not vals:
            return None
        return round(sum(1 for v in vals if v >= 0.70) / len(vals), 4)

    scope_parts = []
    if category_name:
        scope_parts.append(f"categorie '{category_name}'")
    if provider_id:
        scope_parts.append(
            f"aanbieder '{proposal.affected_provider.name if proposal.affected_provider else provider_id}'"
        )
    scope_description = (
        "Scope: " + " + ".join(scope_parts) if scope_parts else "Volledige dataset"
    )

    return {
        "total_rows": len(before_confs),
        "in_scope_rows": in_scope,
        "before_mean_confidence": _mean(before_confs),
        "after_mean_confidence": _mean(after_confs),
        "before_high_conf_pct": _high_conf_pct(before_confs),
        "after_high_conf_pct": _high_conf_pct(after_confs),
        "delta_applied": delta,
        "scope_description": scope_description,
    }


# ---------------------------------------------------------------------------
# 3. Status transition helper
# ---------------------------------------------------------------------------


def transition_proposal(
    proposal,
    new_status: str,
    actor,
    note: str = "",
) -> Any:
    """Advance a TuningProposal to a new status with audit tracking.

    Raises ``ValueError`` if the transition is not allowed.
    Saves the proposal.

    Parameters
    ----------
    proposal : TuningProposal
        The proposal to transition.
    new_status : str
        Target status (use TuningProposal.Status.* constants).
    actor : User
        The user performing the transition.
    note : str
        Optional review note.

    Returns the updated proposal.
    """
    if not proposal.can_transition_to(new_status):
        raise ValueError(
            f"Statusovergang van '{proposal.status}' naar '{new_status}' is niet toegestaan."
        )

    proposal.status = new_status
    proposal.reviewed_by = actor
    proposal.reviewed_at = datetime.now(tz=timezone.utc)
    if note:
        proposal.review_note = note
    if new_status == 'IMPLEMENTED':
        proposal.implemented_at = datetime.now(tz=timezone.utc)
    proposal.save()
    return proposal
