"""
Lookup tegen de NZa Zorgproducten-tabel (compacte JSON-export), geladen uit
`contracts/data/nza_zorgproducten_actueel.json` (zie
`scripts/build_nza_zorgproducten_json.py`).

Alleen voor read-only arrangement hints; geen tarief- of contractgarantie.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

_DATA_PATH = Path(__file__).resolve().parent / "data" / "nza_zorgproducten_actueel.json"
_CODE_RE = re.compile(r"\b(\d{9})\b")


@lru_cache(maxsize=1)
def _load_payload() -> dict[str, Any] | None:
    if not _DATA_PATH.is_file():
        return None
    with _DATA_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def lookup_nza_zorgproduct_row(source_display: str) -> dict[str, Any] | None:
    """
    Zoek een zorgproduct op basis van vrije tekst.

    Volgorde:
    1. Exacte match op gehele string (genormaliseerd) tegen Zorgproductcode.
    2. Eerste 9-cijferige code in de tekst die in de tabel voorkomt (woordgrenzen).
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

    by_code = {p["zorgproductcode"]: p for p in products if p.get("zorgproductcode")}
    compact = normalized.replace(" ", "")
    if compact in by_code:
        return dict(by_code[compact])

    nspace = normalized
    for m in _CODE_RE.finditer(nspace):
        code = m.group(1)
        if code in by_code:
            return dict(by_code[code])
    return None
