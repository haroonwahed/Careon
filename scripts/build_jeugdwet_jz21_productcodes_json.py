#!/usr/bin/env python3
"""
Download en parse de Standaardproductcodelijst Jeugdwet (JZ21) van iStandaarden
naar contracts/data/jeugdwet_jz21_productcodes.json (stdlib only).

Bron (feb 2025): https://www.istandaarden.nl/ijw/over-ijw/productcodelijst-jeugdwet
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

DEFAULT_URL = (
    "https://www.istandaarden.nl/binaries/content/assets/istandaarden/ijw/"
    "productcodelijst-jw/standaardproductcodelijst-jeugdwet-.xlsx"
)

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
CODE_RE = re.compile(r"^[0-9]{2}[A-Za-z][0-9]{2}[A-Za-z0-9-]*$")


def col_letters(ref: str) -> str:
    return "".join(ch for ch in ref if ch.isalpha())


def parse_shared_strings(z: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    out: list[str] = []
    for si in root.findall("m:si", NS):
        texts: list[str] = []
        for t in si.findall(".//m:t", NS):
            if t.text:
                texts.append(t.text)
        out.append("".join(texts))
    return out


def cell_value(c: ET.Element, ss: list[str]) -> str | None:
    t = c.get("t")
    v = c.find("m:v", NS)
    if v is None or v.text is None:
        return None
    if t == "s":
        return ss[int(v.text)]
    return v.text


def parse_products(xlsx_path: Path) -> list[dict[str, str | None]]:
    z = zipfile.ZipFile(xlsx_path)
    ss = parse_shared_strings(z)
    sheet = ET.fromstring(z.read("xl/worksheets/sheet3.xml"))
    out: list[dict[str, str | None]] = []
    for row in sheet.findall(".//m:sheetData/m:row", NS):
        r = int(row.get("r", "0"))
        if r < 4:
            continue
        cells: dict[str, str | None] = {}
        for c in row.findall("m:c", NS):
            ref = c.get("r")
            if not ref:
                continue
            cells[col_letters(ref)] = cell_value(c, ss)
        code = (cells.get("A") or "").strip()
        if not code or code == "-":
            continue
        if not CODE_RE.match(code):
            continue
        out.append(
            {
                "productcode": code,
                "omschrijving": (cells.get("B") or "").strip() or None,
                "productcategorie_code": (cells.get("E") or "").strip() or None,
                "productcategorie_omschrijving": (cells.get("F") or "").strip() or None,
                "uitvoeringsvariant": (cells.get("G") or "").strip() or None,
                "dimensie_hulpvorm_code": (cells.get("H") or "").strip() or None,
                "dimensie_hulpvorm_omschrijving": (cells.get("I") or "").strip() or None,
                "nza_declaratiecode": (cells.get("J") or "").strip() or None,
            },
        )
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument(
        "--out",
        default=str(
            Path(__file__).resolve().parent.parent / "contracts" / "data" / "jeugdwet_jz21_productcodes.json",
        ),
    )
    args = parser.parse_args()
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_suffix(".xlsx.download")

    if args.url.startswith("file://"):
        src = Path(args.url.replace("file://", "", 1))
        shutil.copyfile(src, tmp)
    elif Path(args.url).is_file():
        shutil.copyfile(Path(args.url), tmp)
    else:
        urllib.request.urlretrieve(args.url, tmp)  # noqa: S310 — intentional fixed URL
    products = parse_products(tmp)
    tmp.unlink(missing_ok=True)

    payload = {
        "meta": {
            "source_xlsx_url": args.url,
            "source_portal": "https://www.istandaarden.nl/ijw/over-ijw/productcodelijst-jeugdwet",
            "publisher": "Zorginstituut Nederland (iStandaarden — Jeugdwet / JZ21)",
            "note": (
                "Machine-leesbare export voor CareOn arrangement hints. "
                "Gemeenten mogen afwijkende eigen codes gebruiken; zie iStandaarden-pagina."
            ),
            "product_rows": len(products),
        },
        "products": products,
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(products)} products to {out_path}")


if __name__ == "__main__":
    main()
