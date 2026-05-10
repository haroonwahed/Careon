"""
Formal escalation semantics for Zorg OS (operational control tower, not notifications).

Each code names a stable operational situation that tooling, logs, and UI can align on.
Related decision-engine alert/risk codes are noted where they overlap today.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import FrozenSet


@dataclass(frozen=True, slots=True)
class EscalationDefinition:
    """Registry entry: stable identifier + calm Dutch copy + owning lane."""

    code: str
    summary_nl: str
    operational_meaning_nl: str
    typical_next_step_nl: str
    owner_lane: str  # gemeente | aanbieder | regie | systeem
    related_engine_codes: FrozenSet[str] = frozenset()


# Canonical registry (extend additively; do not rename codes once shipped).
REGISTRY: dict[str, EscalationDefinition] = {
    "BLOCKER_STALE_72H": EscalationDefinition(
        code="BLOCKER_STALE_72H",
        summary_nl="Blokkade lang ongewijzigd",
        operational_meaning_nl=(
            "Een inhoudelijke blokkade staat te lang open zonder vooruitgang in het dossier."
        ),
        typical_next_step_nl="Leg vast wie eigenaar is en verhoog regie om de blokkade te doorbreken.",
        owner_lane="regie",
    ),
    "PROVIDER_NO_RESPONSE": EscalationDefinition(
        code="PROVIDER_NO_RESPONSE",
        summary_nl="Geen reactie van aanbieder",
        operational_meaning_nl=(
            "Er is geen tijdige reactie van de gekozen aanbieder op het verzoek of de plaatsing."
        ),
        typical_next_step_nl="Volg SLA op; herinner of hermatch conform beleid.",
        owner_lane="aanbieder",
        related_engine_codes=frozenset({"PROVIDER_REVIEW_PENDING_SLA"}),
    ),
    "MATCHING_CAPACITY_EXHAUSTED": EscalationDefinition(
        code="MATCHING_CAPACITY_EXHAUSTED",
        summary_nl="Matching zonder passende capaciteit",
        operational_meaning_nl=(
            "Er is geen passende aanbieder meer beschikbaar binnen de huidige matchruimte."
        ),
        typical_next_step_nl="Verbreed zoekgebied, pas criteria aan of escaleer naar regie voor capaciteit.",
        owner_lane="gemeente",
    ),
    "INTAKE_DELAY_RISK": EscalationDefinition(
        code="INTAKE_DELAY_RISK",
        summary_nl="Risico op vertraging intake",
        operational_meaning_nl=(
            "Plaatsing of intake loopt achter op het verwachte tempo voor deze casus."
        ),
        typical_next_step_nl="Plan intake of maak vertraging zichtbaar met een concrete vervolgstap.",
        owner_lane="aanbieder",
        related_engine_codes=frozenset({"INTAKE_DELAYED", "INTAKE_NOT_STARTED"}),
    ),
    "WORKFLOW_STATE_INCONSISTENT": EscalationDefinition(
        code="WORKFLOW_STATE_INCONSISTENT",
        summary_nl="Workflowstatus niet consistent",
        operational_meaning_nl=(
            "De vastgelegde workflowfase en de feitelijke dossiergegevens wijken van elkaar af."
        ),
        typical_next_step_nl="Open het dossier en herstel status of gegevens conform waarheid.",
        owner_lane="gemeente",
    ),
}


def get_escalation_definition(code: str) -> EscalationDefinition | None:
    return REGISTRY.get(code)


def all_escalation_codes() -> tuple[str, ...]:
    return tuple(sorted(REGISTRY.keys()))


def definitions_as_public_dicts() -> list[dict[str, str]]:
    """Read-only shape for APIs / tooling (no PHI)."""
    out: list[dict[str, str]] = []
    for key in sorted(REGISTRY.keys()):
        d = REGISTRY[key]
        out.append(
            {
                "code": d.code,
                "summary_nl": d.summary_nl,
                "operational_meaning_nl": d.operational_meaning_nl,
                "typical_next_step_nl": d.typical_next_step_nl,
                "owner_lane": d.owner_lane,
            }
        )
    return out
