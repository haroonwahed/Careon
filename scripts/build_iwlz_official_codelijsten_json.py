#!/usr/bin/env python3
"""
Download iWlz-codelijsten (JSON) van de officiële iStandaarden GitHub-mirror en
schrijf contracts/data/iwlz_official_codelijsten.json (stdlib only).

Bron: https://github.com/iStandaarden/iWlz-codelijsten-APiWlz (map codelijsten/).
Let op: README in die repo vermeldt een ontwikkelcontext; codes komen overeen
met de gepubliceerde iWlz-standaard — gebruik uitsluitend als arrangement-hint.
"""
from __future__ import annotations

import argparse
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE_URL = (
    "https://raw.githubusercontent.com/iStandaarden/iWlz-codelijsten-APiWlz/main/codelijsten"
)

# Tabellen met arrangement-/WLZ-relevante codes (compacte set).
TABLE_IDS = (
    "COD001",  # Zorgkantoor (55xx)
    "COD163",  # Zorgzwaartepakket (3 cijfers)
    "COD578",  # Leveringsvorm (1 cijfer; alleen exacte match in lookup)
    "COD732",  # Functie (2 cijfers; alleen exacte match)
    "COD736",  # Grondslag zorg (2 cijfers; exact)
    "COD740",  # Leveringsvoorwaarde (1 cijfer; exact)
    "COD998",  # Financiering (1 cijfer; exact)
)


def _unwrap_codelijst(blob: object) -> dict[str, object] | None:
    if isinstance(blob, dict) and "Codelijst" in blob:
        cl = blob["Codelijst"]
        return cl if isinstance(cl, dict) else None
    if isinstance(blob, list) and blob and isinstance(blob[0], list) and len(blob[0]) == 2:
        inner = blob[0][1]
        if isinstance(inner, dict):
            return inner
    return None


def _fetch_json(url: str) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": "Careon-build-script/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:  # noqa: S310
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--out",
        default=str(
            Path(__file__).resolve().parent.parent / "contracts" / "data" / "iwlz_official_codelijsten.json",
        ),
    )
    parser.add_argument("--base-url", default=BASE_URL)
    args = parser.parse_args()
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    tables: list[dict[str, object]] = []
    for tid in TABLE_IDS:
        url = f"{args.base_url.rstrip('/')}/{tid}/{tid}.json"
        raw = _fetch_json(url)
        cl = _unwrap_codelijst(raw)
        if not cl:
            raise SystemExit(f"Unexpected JSON shape for {tid} ({url})")
        codewaarden = cl.get("Codewaarden") or []
        entries: list[dict[str, str | None]] = []
        for row in codewaarden:
            if not isinstance(row, dict):
                continue
            rid = (row.get("id") or "").strip()
            if not rid:
                continue
            entries.append(
                {
                    "id": rid,
                    "omschrijving": (row.get("omschrijving") or "").strip() or None,
                    "ingangsdatum": (row.get("ingangsdatum") or "").strip() or None,
                },
            )
        tables.append(
            {
                "table_id": tid,
                "naam": (cl.get("Codelijstnaam") or tid).strip(),
                "omschrijving": (cl.get("Codelijstomschrijving") or "").strip() or None,
                "source_json_url": url,
                "entries": entries,
            },
        )

    payload = {
        "meta": {
            "publisher": "iStandaarden (iWlz codelijsten, GitHub-mirror)",
            "source_repo": "https://github.com/iStandaarden/iWlz-codelijsten-APiWlz",
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "tables": len(tables),
            "note": (
                "Alleen voor read-only arrangement hints in CareOn. "
                "Raadpleeg de actuele iWlz-documentatie voor implementatiekeuzes."
            ),
        },
        "tables": tables,
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    n_entries = sum(len(t["entries"]) for t in tables)  # type: ignore[arg-type]
    print(f"Wrote {len(tables)} tables ({n_entries} codewaarden) to {out_path}")


if __name__ == "__main__":
    main()
