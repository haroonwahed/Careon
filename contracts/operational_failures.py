"""
Human-readable operational API failures for /care/api/* (calm, action-led, correlation-aware).

Maps internal failure contexts to stable codes and Dutch copy. Never exposes tracebacks.
"""

from __future__ import annotations

from typing import Any

# context string (from api views) -> (code, message_nl, next_best_action_nl)
_FAILURE_CONTEXTS: dict[str, tuple[str, str, str]] = {
    "cases_api_failed": (
        "CASES_LIST_AGGREGATION_FAILURE",
        "De casuslijst kon niet worden geladen.",
        "Controleer uw sessie en actieve organisatie; vernieuw daarna de pagina.",
    ),
    "case_detail_api_failed": (
        "CASE_DETAIL_AGGREGATION_FAILURE",
        "Casusdetail kon niet worden geladen.",
        "Open het dossier opnieuw of controleer of u rechten heeft op deze casus.",
    ),
    "case_timeline_api_failed": (
        "CASE_TIMELINE_AGGREGATION_FAILURE",
        "Casustijdlijn kon niet worden geladen.",
        "Ververs het dossier of controleer uw rechten op deze casus.",
    ),
    "regiekamer_decision_overview_api_failed": (
        "REGIEKAMER_AGGREGATION_FAILURE",
        "Regiekamer kon niet volledig worden opgebouwd.",
        "Controleer organisatiecontext of workflowdata en probeer opnieuw.",
    ),
    "cases_bulk_update_api_failed": (
        "CASES_BULK_UPDATE_FAILURE",
        "Bulkactie op casussen is mislukt.",
        "Herhaal de actie met een kleinere selectie of controleer uitlijning van workflowstatus.",
    ),
    "assessments_api_failed": (
        "ASSESSMENTS_AGGREGATION_FAILURE",
        "Beoordelingsgegevens konden niet worden geladen.",
        "Ververs het dossier of controleer of de casus nog volledig is ingevuld.",
    ),
    "placements_api_failed": (
        "PLACEMENTS_AGGREGATION_FAILURE",
        "Plaatsingsinformatie kon niet worden geladen.",
        "Controleer plaatsing en intakekoppeling in het dossier.",
    ),
    "signals_api_failed": (
        "SIGNALS_AGGREGATION_FAILURE",
        "Signalen konden niet worden geladen.",
        "Controleer regiecontext en probeer opnieuw.",
    ),
    "tasks_api_failed": (
        "TASKS_AGGREGATION_FAILURE",
        "Taken konden niet worden geladen.",
        "Controleer uw organisatiecontext en vernieuw de werkvoorraad.",
    ),
    "documents_api_failed": (
        "DOCUMENTS_AGGREGATION_FAILURE",
        "Documenten konden niet worden geladen.",
        "Controleer toegang tot het dossier en probeer opnieuw.",
    ),
    "audit_log_api_failed": (
        "AUDIT_LOG_AGGREGATION_FAILURE",
        "Audittrail kon niet worden geladen.",
        "Controleer filters en rechten; probeer het later opnieuw.",
    ),
    "providers_api_failed": (
        "PROVIDERS_AGGREGATION_FAILURE",
        "Aanbiedersgegevens konden niet worden geladen.",
        "Controleer organisatiecontext en probeer opnieuw.",
    ),
    "municipalities_api_failed": (
        "MUNICIPALITIES_AGGREGATION_FAILURE",
        "Gemeente-instellingen konden niet worden geladen.",
        "Controleer uw sessie en actieve organisatie.",
    ),
    "regions_api_failed": (
        "REGIONS_AGGREGATION_FAILURE",
        "Regiogegevens konden niet worden geladen.",
        "Controleer netwerk- en regioconfiguratie.",
    ),
    "regions_health_api_failed": (
        "REGIONS_HEALTH_AGGREGATION_FAILURE",
        "Regio-overzicht kon niet worden opgebouwd.",
        "Controleer regio- en aanbiederconfiguratie.",
    ),
    "dashboard_summary_api_failed": (
        "DASHBOARD_SUMMARY_AGGREGATION_FAILURE",
        "Dashboardsamenvatting kon niet worden geladen.",
        "Controleer organisatiecontext en probeer opnieuw.",
    ),
}

_DEFAULT: tuple[str, str, str] = (
    "OPERATIONAL_FAILURE",
    "De actie kon niet worden voltooid. Probeer het opnieuw.",
    "Neem contact op met beheer als dit aanhoudt; vermeld het request_id.",
)


def build_operational_failure_payload(request: Any, *, context: str) -> dict[str, Any]:
    """
    JSON body for 5xx operational responses on /care/api/*.

    Fields: code, message, next_best_action, request_id (when known).
    """
    code, message, next_best_action = _FAILURE_CONTEXTS.get(context, _DEFAULT)
    cid = getattr(request, "correlation_id", None)
    payload: dict[str, Any] = {
        "code": code,
        "message": message,
        "next_best_action": next_best_action,
    }
    if cid:
        payload["request_id"] = str(cid)
    # Backward compatibility for clients that only read `error`.
    payload["error"] = message
    return payload
