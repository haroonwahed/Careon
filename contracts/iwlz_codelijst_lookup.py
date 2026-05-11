"""
Lookup tegen officiële iWlz-codelijsten (JSON-bundle), geladen uit
`contracts/data/iwlz_official_codelijsten.json` (zie
`scripts/build_iwlz_official_codelijsten_json.py`).

Alleen voor read-only arrangement hints; zie iStandaarden voor normatieve
implementatie van iWlz-berichten.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

_DATA_PATH = Path(__file__).resolve().parent / "data" / "iwlz_official_codelijsten.json"

_ZK_RE = re.compile(r"\b(55\d{2})\b")
_ZZP_RE = re.compile(r"\b(\d{3})\b")


@lru_cache(maxsize=1)
def _load_payload() -> dict[str, Any] | None:
    if not _DATA_PATH.is_file():
        return None
    with _DATA_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def _table_entries(payload: dict[str, Any], table_id: str) -> list[dict[str, Any]]:
    for t in payload.get("tables") or []:
        if not isinstance(t, dict):
            continue
        if (t.get("table_id") or "").strip() == table_id:
            return [e for e in (t.get("entries") or []) if isinstance(e, dict)]
    return []


def _by_id(entries: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {e["id"]: e for e in entries if e.get("id")}


def lookup_iwlz_codelijst_row(source_display: str) -> dict[str, Any] | None:
    """
    Zoek een codewaarde in de gebundelde iWlz-codelijsten.

    Heuristiek (deterministisch):
    - COD001 (zorgkantoor): eerste token 55xx dat in de lijst voorkomt.
    - COD163 (ZZP): eerste driecijferige token dat in de lijst voorkomt (kan
      valse treffers geven buiten WLZ-context — onzekerheid blijft hoog).
    - Enkele- en tweecijferige lijsten: alleen als de gehele invoer exact gelijk
      is aan de code (na trim / spatienormalisatie).
    """
    payload = _load_payload()
    if not payload:
        return None

    normalized = " ".join(source_display.strip().split())
    if not normalized:
        return None

    tables_meta = {t["table_id"]: t for t in payload.get("tables") or [] if isinstance(t, dict)}

    def hit(table_id: str, entry: dict[str, Any]) -> dict[str, Any]:
        meta = tables_meta.get(table_id) or {}
        return {
            "table_id": table_id,
            "table_naam": (meta.get("naam") or table_id).strip(),
            "id": entry["id"],
            "omschrijving": (entry.get("omschrijving") or "").strip() or None,
        }

    # Exact-only tables (korte codes — geen deelstring-match).
    exact_tables = ("COD578", "COD732", "COD736", "COD740", "COD998")
    for tid in exact_tables:
        entries = _table_entries(payload, tid)
        by_id = _by_id(entries)
        if normalized in by_id:
            out = hit(tid, by_id[normalized])
            return out

    e001 = _by_id(_table_entries(payload, "COD001"))
    for m in _ZK_RE.finditer(normalized):
        zk = m.group(1)
        if zk in e001:
            return hit("COD001", e001[zk])

    e163 = _by_id(_table_entries(payload, "COD163"))
    for m in _ZZP_RE.finditer(normalized):
        zzp = m.group(1)
        if zzp in e163:
            return hit("COD163", e163[zzp])

    return None
