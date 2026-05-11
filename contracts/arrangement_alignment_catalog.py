"""
Gemeentelijke / sector-typische arrangement-termen → referentielabel (staging).

Bron: samenstelling uit gangbare Nederlandse jeugdhulp- en bekostigingswoordenschat
(PGB, ZIN, ambulant, pleegzorg, trajectfunctie, enz.). Dit is **geen** officiële
iWlz-/gemeentelijke codering en geen juridische equivalentie.

Gebruik: deterministische substring- en regex-matching, **eerste treffer wint**
(specifiekere regels staan eerst in `REFERENCE_ROWS`).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable


def _norm(s: str) -> str:
    return " ".join(s.lower().split())


@dataclass(frozen=True)
class ArrangementRefRow:
    """Eén regel in de referentietabel."""

    row_id: str
    label: str
    base_confidence: float
    rationale: str
    uncertainty: str
    match: Callable[[str], bool]


def _any_fragment(fragments: tuple[str, ...]) -> Callable[[str], bool]:
    def inner(normalized: str) -> bool:
        return any(f in normalized for f in fragments)

    return inner


# Eerste match wint — zet specifieke combinaties bovenaan.
REFERENCE_ROWS: tuple[ArrangementRefRow, ...] = (
    ArrangementRefRow(
        row_id="gesloten_jeugd",
        label="Verblijf jeugdhulp (gesloten / hoog intensief, referentie)",
        base_confidence=0.5,
        rationale=(
            "Combinatie wijst op verblijfsmatige jeugdhulp; tarief en indicatie "
            "verschillen sterk per gemeente en instelling — altijd inhoudelijk toetsen."
        ),
        uncertainty="high",
        match=_any_fragment(("gesloten jeugd", "gesloten jeugdhulp", "gesloten jeugdzorg", "gesloten jeugdinstelling")),
    ),
    ArrangementRefRow(
        row_id="justitiele_jeugd",
        label="Justitiële jeugdinrichting / forensisch kader (referentie)",
        base_confidence=0.48,
        rationale=(
            "Forensisch of justitieel kader heeft eigen bekostigingsroutes; "
            "niet gelijkstellen aan reguliere jeugd-ambulant."
        ),
        uncertainty="high",
        match=_any_fragment(("justitiële", "justitiele", "forensisch", "jji")),
    ),
    ArrangementRefRow(
        row_id="pgb",
        label="PGB-achtige jeugdondersteuning (referentie)",
        base_confidence=0.58,
        rationale="PGB-route heeft eigen verantwoordings- en vergoedingslogica; niet automatisch gelijk aan ZIN-tarief.",
        uncertainty="high",
        match=_any_fragment(("pgb", "persoonsgebonden budget")),
    ),
    ArrangementRefRow(
        row_id="zin",
        label="ZIN-nabijheidsarrangement (referentie)",
        base_confidence=0.55,
        rationale=(
            "Zorg in natura (ZIN) wordt per gemeente anders benoemd; "
            "controleer lokale product- en tariefkoppeling."
        ),
        uncertainty="high",
        match=lambda s: ("zorg in natura" in s) or (re.search(r"\bzin\b", s) is not None),
    ),
    ArrangementRefRow(
        row_id="pleegzorg",
        label="Pleegzorg / gezinsvervangend wonen (referentie)",
        base_confidence=0.56,
        rationale=(
            "Pleegzorg valt onder andere bekostigingsregels dan ambulant; "
            "check gemeentelijke vergoeding en pleegzorgvergoeding."
        ),
        uncertainty="medium",
        match=_any_fragment(("pleegzorg", "gezinsvervangend", "pleegouder")),
    ),
    ArrangementRefRow(
        row_id="intensieve_gezinsinterventie",
        label="Intensieve gezinsinterventie (MST/FFT-achtig, referentie)",
        base_confidence=0.54,
        rationale=(
            "Programmatische gezinsinterventies worden per regio anders gecodeerd; "
            "vergelijk doelgroep en duur met contract."
        ),
        uncertainty="medium",
        match=_any_fragment(("mst", "multisystem", "fft", "functionele gezinstherapie", "gezinsbehandeling")),
    ),
    ArrangementRefRow(
        row_id="dagbehandeling",
        label="Deeltijd / dagbehandeling jeugd (referentie)",
        base_confidence=0.53,
        rationale="Dagbehandeling situeert zich tussen ambulant en verblijf; tarieven zijn vaak dagtarief-gedreven.",
        uncertainty="medium",
        match=_any_fragment(("dagbehandeling", "deeltijdbehandeling", "dagtherapie")),
    ),
    ArrangementRefRow(
        row_id="ambulant",
        label="Ambulante jeugdzorg (referentie)",
        base_confidence=0.52,
        rationale="Overlap met thuis/nabij; tariefstructuur verschilt per gemeente en aanbieder.",
        uncertainty="medium",
        match=_any_fragment(("ambulant", "thuisbegeleiding", "begeleid wonen jeugd")),
    ),
    ArrangementRefRow(
        row_id="trajectfunctie",
        label="Trajectfunctie / trajectzorg (referentie)",
        base_confidence=0.51,
        rationale="Trajectfunctie wordt regionaal verschillend ingevuld; check looptijd en bekostigingsbasis.",
        uncertainty="medium",
        match=_any_fragment(("trajectfunctie", "traject functie", "trajectzorg", "casemanager jeugd")),
    ),
    ArrangementRefRow(
        row_id="opp",
        label="Orthopedagogisch / OPP-dagelijks (referentie)",
        base_confidence=0.52,
        rationale="OPP en orthopedagogische trajecten lopen uiteen in intensiteit en tariefniveau.",
        uncertainty="medium",
        match=_any_fragment(("orthopedagog", "orthopedagoog", " opp ", " opp-", "(opp)", "opp jeugd")),
    ),
    ArrangementRefRow(
        row_id="crisis",
        label="Crisisopvang / acute jeugdplek (referentie)",
        base_confidence=0.49,
        rationale="Crisisplaatsen hebben vaak afwijkende tarieven en duur; geen structurele verblijfsaannames.",
        uncertainty="high",
        match=_any_fragment(("crisis", "crisisplaats", "acute", "spoedplaats")),
    ),
    ArrangementRefRow(
        row_id="jb_hulp",
        label="Jeugdbescherming / maatschappelijke opvang (referentie)",
        base_confidence=0.47,
        rationale="Beschermings- en hulpverleningsroutes kruisen met zorgarrangementen; eigenaar traject expliciet bevestigen.",
        uncertainty="high",
        match=_any_fragment(("jeugdbescherming", "jspoed", "maatschappelijke opvang")),
    ),
    ArrangementRefRow(
        row_id="lvb",
        label="LVB / Lichte ondersteuning (referentie)",
        base_confidence=0.5,
        rationale="LVB-termen overlappen met onderwijs en zorg; tarief niet afleiden uit label alleen.",
        uncertainty="high",
        match=_any_fragment(("lvb", "licht verstandelijk", "lichte ondersteuning")),
    ),
)


def match_catalog_row(source_display: str) -> ArrangementRefRow | None:
    """Return eerste passende referentierij, of `None` voor generieke fallback."""
    normalized = _norm(source_display)
    if not normalized or normalized == "— (geen arrangementcode vastgelegd)".lower():
        return None
    for row in REFERENCE_ROWS:
        if row.match(normalized):
            return row
    return None
