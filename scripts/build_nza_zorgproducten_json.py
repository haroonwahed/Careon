#!/usr/bin/env python3
"""
Download de officiële NZa «Zorgproducten Tabel» (zip met CSV) van PUC Overheid
en schrijf een compacte JSON naar contracts/data/nza_zorgproducten_actueel.json.

Standaard-URL: Dbc-pakket 2025 integraal → Zorgproducten Tabel (PUC_774469_22).
Filter: geen einddatum of einddatum >= --min-geldig-tot (YYYYMMDD); dedupe op
Zorgproductcode (nieuwste ingangsdatum wint).

Stdlib only; cp1252-encoding zoals gangbaar voor NZa-csv's.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import zipfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_ZIP_URL = (
    "https://puc.overheid.nl/PUC/Handlers/DownloadDocument.ashx"
    "?identifier=PUC_774469_22&versienummer=1"
)


def _fetch_zip(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Careon-build-script/1.0"})
    with urllib.request.urlopen(req, timeout=300) as resp:  # noqa: S310
        dest.write_bytes(resp.read())


def _parse_yyyymmdd(s: str) -> int | None:
    s = (s or "").strip()
    if not s or len(s) != 8 or not s.isdigit():
        return None
    return int(s)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=DEFAULT_ZIP_URL)
    parser.add_argument(
        "--out",
        default=str(
            Path(__file__).resolve().parent.parent / "contracts" / "data" / "nza_zorgproducten_actueel.json",
        ),
    )
    parser.add_argument(
        "--min-geldig-tot",
        type=int,
        default=20260101,
        help="Sluit vervallen producten uit (Einddatum < dit, tenzij leeg).",
    )
    args = parser.parse_args()
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_zip = out_path.with_suffix(".zip.download")
    _fetch_zip(args.url, tmp_zip)

    with zipfile.ZipFile(tmp_zip) as zf:
        names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
        if not names:
            raise SystemExit("Geen CSV in zip")
        name = names[0]
        raw = zf.read(name)
    tmp_zip.unlink(missing_ok=True)

    text = raw.decode("cp1252", errors="replace")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    rows = list(reader)

    best: dict[str, tuple[int, dict[str, str | None]]] = {}
    for row in rows:
        code = (row.get("Zorgproductcode") or "").strip()
        if not code:
            continue
        oms = (row.get("Zorgproductomschrijving") or "").strip() or None
        eind = _parse_yyyymmdd(row.get("Einddatum") or "")
        if eind is not None and eind < args.min_geldig_tot:
            continue
        ing = _parse_yyyymmdd(row.get("Ingangsdatum") or "") or 0
        payload: dict[str, str | None] = {"zorgproductcode": code, "omschrijving": oms}
        prev = best.get(code)
        if prev is None or ing >= prev[0]:
            best[code] = (ing, payload)

    products = [v[1] for _, v in sorted(best.items(), key=lambda kv: kv[0])]
    payload_out = {
        "meta": {
            "publisher": "Nederlandse Zorgautoriteit (NZa) — Zorgproducten Tabel",
            "source_zip_url": args.url,
            "source_portal": "https://puc.overheid.nl/nza/doc/PUC_781989_22/2/",
            "source_csv_member": name,
            "min_geldig_tot_filter": args.min_geldig_tot,
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "product_rows": len(products),
            "note": (
                "Compacte export voor arrangement hints; geen tarief- of contractgarantie. "
                "Controleer actuele geldigheid in de NZa-zorgproductapplicatie."
            ),
        },
        "products": products,
    }
    out_path.write_text(json.dumps(payload_out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(products)} zorgproducten to {out_path}")


if __name__ == "__main__":
    main()
