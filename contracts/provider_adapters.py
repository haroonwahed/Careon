"""
Provider Pipeline — Source Adapters.

Each adapter produces an iterable of raw dicts (one per provider record)
from an external data source. The pipeline ingests these dicts verbatim
into staging — no mapping or normalisation happens inside adapters.

Adapters are the ONLY place where external systems are touched.
UI and matching engine never call adapters directly.

Available adapters:
  FixtureAdapter     — deterministic test/dev data; no external calls
  JsonFileAdapter    — reads a local JSON file export
  HttpApiAdapter     — fetches paginated JSON from an HTTP endpoint
"""

from __future__ import annotations

import json
import logging
import csv
from pathlib import Path
from typing import Iterator

logger = logging.getLogger(__name__)


class BaseProviderAdapter:
    """Common interface all adapters must implement."""

    source_system: str = "unknown"
    source_version: str = ""

    def records(self) -> Iterator[dict]:
        raise NotImplementedError  # pragma: no cover


# ---------------------------------------------------------------------------
# Fixture adapter — deterministic records for tests and local development
# ---------------------------------------------------------------------------

_FIXTURE_RECORDS: list[dict] = [
    {
        "source_id": "AGB-00000001",
        "agb_code": "00000001",
        "kvk": "12345678",
        "naam": "Zorgcentrum De Linden",
        "type": "Residentiële zorg",
        "website": "https://delinden.nl",
        "emailadres": "info@delinden.nl",
        "telefoon": "030-1234567",
        "adres": "Lindenstraat 1",
        "stad": "Utrecht",
        "postcode": "3511 AA",
        "regio": "Utrecht",
        "latitude": 52.0907,
        "longitude": 5.1214,
        "beschikbare_plekken": 4,
        "wachtlijst": 2,
        "gemiddelde_wachttijd": 7,
        "maximale_capaciteit": 20,
        "ambulant": False,
        "dagbehandeling": False,
        "residentieel": True,
        "crisis": True,
        "thuisbegeleiding": False,
        "age_0_4": False,
        "age_4_12": True,
        "age_12_18": True,
        "age_18_plus": False,
        "simple": True,
        "multiple": True,
        "severe": True,
        "low_urgency": True,
        "medium_urgency": True,
        "high_urgency": True,
        "crisis_urgency": True,
        "regions": ["Utrecht"],
        "specialties": "GGZ, LVB",
        "contract_type": "STANDAARD",
        "contract_status": "actief",
        "contract_start": "2025-01-01",
    },
    {
        "source_id": "AGB-00000002",
        "agb_code": "00000002",
        "kvk": "87654321",
        "naam": "Ambulante Hulp Midden-Nederland",
        "type": "ambulante begeleiding",
        "emailadres": "info@ambulante-hulp.nl",
        "telefoon": "030-9876543",
        "adres": "Marnixlaan 15",
        "stad": "Utrecht",
        "postcode": "3552 BV",
        "regio": "Utrecht",
        "latitude": 52.1012,
        "longitude": 5.0978,
        "beschikbare_plekken": 8,
        "wachtlijst": 0,
        "gemiddelde_wachttijd": 3,
        "maximale_capaciteit": 30,
        "ambulant": True,
        "dagbehandeling": True,
        "residentieel": False,
        "crisis": False,
        "thuisbegeleiding": True,
        "age_0_4": False,
        "age_4_12": True,
        "age_12_18": True,
        "age_18_plus": True,
        "simple": True,
        "multiple": True,
        "severe": False,
        "low_urgency": True,
        "medium_urgency": True,
        "high_urgency": False,
        "crisis_urgency": False,
        "regions": ["Utrecht", "Amsterdam"],
        "specialties": "Thuisbegeleiding, Jeugdzorg",
        "contract_type": "STANDAARD",
        "contract_status": "actief",
        "contract_start": "2024-07-01",
    },
    {
        "source_id": "AGB-00000003",
        "agb_code": "00000003",
        "naam": "Crisisopvang Noord-Holland",
        "type": "crisisopvang",
        "stad": "Amsterdam",
        "regio": "Amsterdam",
        "latitude": 52.3702,
        "longitude": 4.8952,
        "beschikbare_plekken": 1,
        "wachtlijst": 5,
        "gemiddelde_wachttijd": 21,
        "maximale_capaciteit": 8,
        "ambulant": False,
        "dagbehandeling": False,
        "residentieel": True,
        "crisis": True,
        "thuisbegeleiding": False,
        "age_0_4": False,
        "age_4_12": False,
        "age_12_18": True,
        "age_18_plus": True,
        "simple": False,
        "multiple": True,
        "severe": True,
        "low_urgency": False,
        "medium_urgency": False,
        "high_urgency": True,
        "crisis_urgency": True,
        "regions": ["Amsterdam"],
        "specialties": "Crisis, Forensisch",
        "contract_type": "CRISIS",
        "contract_status": "actief",
    },
]


class FixtureAdapter(BaseProviderAdapter):
    """
    Returns deterministic fixture records for local development and tests.
    Does not make any external calls.
    """

    source_system = "fixture_v1"
    source_version = "1.0"

    def records(self) -> Iterator[dict]:
        for record in _FIXTURE_RECORDS:
            yield record


# ---------------------------------------------------------------------------
# JSON file adapter — reads a local export file
# ---------------------------------------------------------------------------

class JsonFileAdapter(BaseProviderAdapter):
    """
    Reads provider records from a local JSON file.
    Expected format: a JSON array of objects, or a dict with a 'records' key.
    """

    source_system = "jsonfile"
    source_version = "1.0"

    def __init__(self, path: str | Path, source_system: str = "jsonfile") -> None:
        self.path = Path(path)
        self.source_system = source_system

    def records(self) -> Iterator[dict]:
        if not self.path.exists():
            logger.error("JsonFileAdapter: file not found: %s", self.path)
            return

        with open(self.path, encoding="utf-8") as fh:
            data = json.load(fh)

        items = data if isinstance(data, list) else data.get("records", [])
        logger.info("JsonFileAdapter: loaded %d records from %s", len(items), self.path)
        for item in items:
            yield item


# ---------------------------------------------------------------------------
# CSV file adapter — reads a local CSV export
# ---------------------------------------------------------------------------

class CsvFileAdapter(BaseProviderAdapter):
    """
    Reads provider records from a local CSV file.

    Expected format:
      - First row is header
      - Each subsequent row maps to a dict using header keys
      - Must include either 'source_id' or 'id' column
    """

    source_system = "csv_import"
    source_version = "1.0"

    def __init__(self, path: str | Path, source_system: str = "csv_import") -> None:
        self.path = Path(path)
        self.source_system = source_system

    def records(self) -> Iterator[dict]:
        if not self.path.exists():
            logger.error("CsvFileAdapter: file not found: %s", self.path)
            return

        with open(self.path, encoding="utf-8", newline="") as fh:
            reader = csv.DictReader(fh)
            rows = list(reader)

        logger.info("CsvFileAdapter: loaded %d records from %s", len(rows), self.path)
        for row in rows:
            # Keep payload as plain dict with string values; normalization layer coerces types.
            yield dict(row)


class AGBRegistryCsvAdapter(CsvFileAdapter):
    """
    Adapter for real provider registry CSV exports (AGB/Vektis-oriented).

    Expected columns are source-dependent; this adapter guarantees:
      - a stable source_id is present
      - agb_code is forwarded when available
      - payload stays raw for downstream normalization/mapping
    """

    source_system = "agb_registry_csv"
    source_version = "1.0"

    def __init__(self, path: str | Path, source_system: str = "agb_registry_csv") -> None:
        super().__init__(path=path, source_system=source_system)

    def records(self) -> Iterator[dict]:
        for row in super().records() or []:
            payload = dict(row)
            agb = (
                payload.get("agb_code")
                or payload.get("agb")
                or payload.get("AGB")
                or ""
            )
            source_id = (
                payload.get("source_id")
                or payload.get("id")
                or payload.get("external_id")
                or payload.get("vestiging_code")
                or agb
            )
            payload["source_id"] = str(source_id).strip()
            if agb:
                payload["agb_code"] = str(agb).strip()
            yield payload


# ---------------------------------------------------------------------------
# HTTP API adapter — fetches paginated JSON from a REST endpoint
# ---------------------------------------------------------------------------

class HttpApiAdapter(BaseProviderAdapter):
    """
    Fetches provider records from a paginated HTTP JSON API.
    Pagination: assumes 'next' link in response or page-based pagination.
    """

    source_system = "http_api"
    source_version = "1.0"

    def __init__(
        self,
        base_url: str,
        source_system: str = "http_api",
        headers: dict | None = None,
        records_key: str = "results",
        page_size: int = 100,
        timeout: int = 30,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.source_system = source_system
        self.headers = headers or {}
        self.records_key = records_key
        self.page_size = page_size
        self.timeout = timeout

    def records(self) -> Iterator[dict]:
        try:
            import urllib.request
            import urllib.parse
        except ImportError:  # pragma: no cover
            logger.error("urllib not available")
            return

        page = 1
        fetched = 0

        while True:
            url = f"{self.base_url}?page={page}&page_size={self.page_size}"
            logger.debug("HttpApiAdapter: fetching %s", url)

            try:
                req = urllib.request.Request(url, headers=self.headers)
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:  # noqa: S310
                    body = json.loads(resp.read().decode("utf-8"))
            except Exception as exc:  # noqa: BLE001
                logger.error("HttpApiAdapter: request failed for %s: %s", url, exc)
                break

            items = body if isinstance(body, list) else body.get(self.records_key, [])
            if not items:
                break

            for item in items:
                yield item
                fetched += 1

            # If the response was a list or has no 'next', stop
            if isinstance(body, list) or not body.get("next"):
                break

            page += 1

        logger.info("HttpApiAdapter: fetched %d records from %s", fetched, self.base_url)
