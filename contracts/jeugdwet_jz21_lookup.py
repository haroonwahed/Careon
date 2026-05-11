"""
Lookup tegen de Standaardproductcodelijst Jeugdwet (JZ21), geladen uit
`contracts/data/jeugdwet_jz21_productcodes.json` (gegenereerd met
`scripts/build_jeugdwet_jz21_productcodes_json.py`).

Alleen voor read-only arrangement hints; geen tarief- of contractgarantie.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

_DATA_PATH = Path(__file__).resolve().parent / "data" / "jeugdwet_jz21_productcodes.json"


@lru_cache(maxsize=1)
def _load_payload() -> dict[str, Any] | None:
    if not _DATA_PATH.is_file():
        return None
    with _DATA_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def lookup_jz21_product_row(source_display: str) -> dict[str, Any] | None:
    """
    Zoek een officiële JZ21-productrij op basis van vrije tekst.

    Volgorde:
    1. Exacte match op gehele string (na normalisatie) tegen productcode.
    2. Woordgrenzen: langste productcode die als token in de tekst voorkomt.
    """
    payload = _load_payload()
    if not payload:
        return None
    products: list[dict[str, Any]] = payload.get("products") or []
    if not products:
        return None

    normalized = " ".join(source_display.strip().split())
    if not normalized:
        return None

    upper_full = normalized.upper().replace(" ", "")
    by_code = {p["productcode"].upper(): p for p in products if p.get("productcode")}
    if upper_full in by_code:
        return by_code[upper_full]

    n_lower = normalized.lower()
    candidates: list[dict[str, Any]] = []
    for p in products:
        code = (p.get("productcode") or "").strip()
        if not code:
            continue
        esc = re.escape(code)
        if re.search(rf"\b{esc}\b", n_lower, flags=re.I):
            candidates.append(p)
    if not candidates:
        return None
    candidates.sort(key=lambda x: len(x["productcode"]), reverse=True)
    return candidates[0]
