"""
Deterministic, read-only arrangement-alignment hints (v1.3 staging).

Advisory only — not a financial or legal equivalence proof. Intended for GET
payloads consumed by the SPA; no mutations or automatic approvals.

Matching rules and gemeente-style reference rows live in
`contracts/arrangement_alignment_catalog.py` (ordered table; first hit wins).
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

from contracts.arrangement_alignment_catalog import match_catalog_row
from contracts.iwlz_codelijst_lookup import lookup_iwlz_codelijst_row
from contracts.jeugdwet_jz21_lookup import lookup_jz21_product_row
from contracts.models import CaseIntakeProcess
from contracts.nza_zorgproduct_lookup import lookup_nza_zorgproduct_row


def _stable_jitter(case_id: str, source: str) -> float:
    h = hashlib.sha256(f"{case_id}|{source}".encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF * 0.12


def _pick_reference(source: str, case_id: str) -> tuple[str, float, str, str]:
    jz21 = lookup_jz21_product_row(source)
    if jz21 is not None:
        pcode = (jz21.get("productcode") or "").strip()
        oms = (jz21.get("omschrijving") or pcode).strip()
        label = f"{oms} (JZ21: {pcode})"
        base = 0.72
        rationale = (
            f"Match op Standaardproductcodelijst Jeugdwet (officiële productcode {pcode}). "
            "Controleer de actuele lijst op iStandaarden en de eigen productdefinitie van de gemeente; "
            "geen automatische tarief- of contractcorrectheid."
        )
        conf = max(0.45, min(0.82, base + _stable_jitter(case_id, source)))
        return label, conf, rationale, "medium"
    nza = lookup_nza_zorgproduct_row(source)
    if nza is not None:
        zc = (nza.get("zorgproductcode") or "").strip()
        oms = (nza.get("omschrijving") or zc).strip()
        label = f"{oms} (NZa zorgproduct {zc})"
        base = 0.71
        rationale = (
            f"Match op de officiële NZa Zorgproducten-tabel (DBC; code {zc}). "
            "Raadpleeg PUC Overheid / zorgproducten.nza.nl voor geldigheid en tariefcontext; "
            "geen automatische MSZ-declaratiecorrectheid."
        )
        conf = max(0.45, min(0.80, base + _stable_jitter(case_id, source)))
        return label, conf, rationale, "medium"
    iwlz = lookup_iwlz_codelijst_row(source)
    if iwlz is not None:
        tid = (iwlz.get("table_id") or "").strip()
        cid = (iwlz.get("id") or "").strip()
        oms = (iwlz.get("omschrijving") or cid).strip()
        label = f"{oms} (iWlz {tid}: {cid})"
        base = 0.68 if tid == "COD163" else 0.7
        rationale = (
            f"Match op iWlz-codelijst {tid} (codewaarde {cid}). "
            "Bron: iStandaarden GitHub-mirror; controleer de actuele iWlz-publicatie en ketencontext; "
            "vooral driecijferige ZZP-tokens kunnen buiten WLZ-context misleidend zijn."
        )
        uncertainty = "high" if tid == "COD163" else "medium"
        conf = max(0.42, min(0.78, base + _stable_jitter(case_id, source)))
        return label, conf, rationale, uncertainty
    row = match_catalog_row(source)
    if row is not None:
        conf = max(0.35, min(0.78, row.base_confidence + _stable_jitter(case_id, source)))
        return row.label, conf, row.rationale, row.uncertainty
    label = "Zorg-arrangement (algemene referentie)"
    conf = max(0.35, min(0.55, 0.42 + _stable_jitter(case_id, source)))
    rationale = (
        "Geen bekende code in de referentielijst; generieke referentie ter ondersteuning van menselijk oordeel."
    )
    return label, conf, rationale, "high"


def build_arrangement_alignment_payload(*, intake: CaseIntakeProcess, case_id: str) -> dict[str, Any]:
    """Build JSON-serializable dict aligned with `client/src/lib/arrangementAlignmentContract.ts`."""
    raw = (intake.arrangement_type_code or "").strip()
    source = raw if raw else "— (geen arrangementcode vastgelegd)"
    target_label, equivalence_confidence, rationale, uncertainty = _pick_reference(source, case_id)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "case_id": str(case_id),
        "generated_at": generated_at,
        "equivalence_hints": [
            {
                "source_label": source,
                "target_label": target_label,
                "equivalence_confidence": round(equivalence_confidence, 4),
                "rationale": rationale,
                "uncertainty": uncertainty,
            },
        ],
        "tariff_alignment": {
            "estimated_delta_pct": None,
            "notes": (
                "Tarief- en bekostigingsvergelijking is niet geautomatiseerd; inhoudelijk accoord blijft "
                "bij de gemeente. Gebruik dit alleen als gesprekssteun."
            ),
            "uncertainty": "high",
        },
        "requires_human_confirmation": True,
        "staging_deterministic": True,
    }
