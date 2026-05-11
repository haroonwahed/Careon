#!/usr/bin/env python3
"""
Herbouw alle gebundelde officiële arrangement-codebronnen (Jeugdwet JZ21,
iWlz-codelijsten, NZa zorgproducten). Roept de afzonderlijke build-scripts aan.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable


def _run(script: str) -> None:
    path = ROOT / "scripts" / script
    subprocess.check_call([PY, str(path)], cwd=str(ROOT))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--only",
        choices=("jz21", "iwlz", "nza", "all"),
        default="all",
    )
    args = parser.parse_args()
    if args.only in ("jz21", "all"):
        _run("build_jeugdwet_jz21_productcodes_json.py")
    if args.only in ("iwlz", "all"):
        _run("build_iwlz_official_codelijsten_json.py")
    if args.only in ("nza", "all"):
        _run("build_nza_zorgproducten_json.py")


if __name__ == "__main__":
    main()
