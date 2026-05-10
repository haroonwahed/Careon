"""
Locked pilot universe for Gemeente Demo (gemeente-demo).

Single source of truth for rehearsal screenshots, E2E, and ATC-style demos.
No randomness: orchestration is explicit in seed_demo_data case specs + roles below.

Tenancy model (frozen):
  • 1 gemeente organisation — PILOT_ORG_SLUG
  • 3 aanbieders (Client + Zorgaanbieder) — PILOT_PROVIDER_CLIENT_NAMES
  • 12 casussen (Demo Casus A–L) — PILOT_CASE_TITLES

Simulation clock:
  • PILOT_LOCK_ANCHOR — when seed_demo_data runs with --locked-time, “now” and
    contract-relative dates are derived from this instant instead of wall clock.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

PILOT_TIMEZONE = ZoneInfo("Europe/Amsterdam")

# Fixed instant for deterministic timestamps (screenshots, SLA math, “laatst bijgewerkt”).
PILOT_LOCK_ANCHOR = datetime(2026, 5, 12, 9, 0, 0, tzinfo=PILOT_TIMEZONE)

PILOT_ORG_SLUG = "gemeente-demo"
PILOT_ORG_NAME = "Gemeente Demo"

# Bumped when demo/pilot seed semantics change (see /build-info seed_version).
PILOT_MANIFEST_VERSION = "2026.05.pilot-lock-v1"

# Canonical gemeente login used by seed_demo_data (documented; not a production secret).
PILOT_GEMEENTE_EMAIL = "test@gemeente-demo.nl"
PILOT_GEMEENTE_PASSWORD = "DemoTest123!"

PILOT_CASE_TITLES: tuple[str, ...] = tuple(f"Demo Casus {chr(65 + i)}" for i in range(12))

PILOT_PROVIDER_CLIENT_NAMES: tuple[str, ...] = (
    "Horizon Jeugdzorg",
    "Kompas Zorg",
    "Groei & Co",
)


# Air-traffic-control narrative: each row = one blip on the board (fixed order A→L).
PILOT_CASE_FLOW_MATRIX: tuple[dict[str, str], ...] = (
    {"title": "Demo Casus A", "lane": "casus", "signal": "Intake — dossier onvolledig"},
    {"title": "Demo Casus B", "lane": "matching", "signal": "Matchadvies klaar — wacht op gemeente"},
    {"title": "Demo Casus C", "lane": "aanbieder", "signal": "Bij aanbieder — reactie open"},
    {"title": "Demo Casus D", "lane": "matching", "signal": "Afwijzing capaciteit — her-match"},
    {"title": "Demo Casus E", "lane": "samenvatting", "signal": "Samenvatting / dossier geblokkeerd"},
    {"title": "Demo Casus F", "lane": "matching", "signal": "Gemeente gevalideerd — klaar om te sturen"},
    {"title": "Demo Casus G", "lane": "aanbieder", "signal": "Aanbieder accepteert — plaatsing volgt"},
    {"title": "Demo Casus H", "lane": "plaatsing", "signal": "Plaatsing bevestigd — intake plannen"},
    {"title": "Demo Casus I", "lane": "intake", "signal": "Intake gestart — uitvoering loopt"},
    {"title": "Demo Casus J", "lane": "matching", "signal": "Crisis urgent — escalatie"},
    {"title": "Demo Casus K", "lane": "plaatsing", "signal": "Plaatsing vast — intake vertraagd"},
    {"title": "Demo Casus L", "lane": "aanbieder", "signal": "SLA aanbieder overschreden"},
)


PILOT_ROLE_MATRIX: tuple[dict[str, str], ...] = (
    {"username_key": "gemeente", "profile_role": "ASSOCIATE", "actor": "gemeente_coordinator"},
    {"username_key": "provider_horizon", "profile_role": "CLIENT", "actor": "zorgaanbieder_horizon"},
    {"username_key": "provider_kompas", "profile_role": "CLIENT", "actor": "zorgaanbieder_kompas"},
    {"username_key": "provider_groei", "profile_role": "CLIENT", "actor": "zorgaanbieder_groei"},
)
