import type { DecisionEvaluation, CaseDecisionRole } from "./decisionEvaluation";
import { toCareCaseEdit, toCareMatching } from "./routes";

export type CaseDecisionActionCode =
  | "COMPLETE_CASE_DATA"
  | "GENERATE_SUMMARY"
  | "START_MATCHING"
  | "VALIDATE_MATCHING"
  | "SEND_TO_PROVIDER"
  | "WAIT_PROVIDER_RESPONSE"
  | "FOLLOW_UP_PROVIDER"
  | "REMATCH_CASE"
  | "CONFIRM_PLACEMENT"
  | "START_INTAKE"
  | "MONITOR_CASE"
  | "ARCHIVE_CASE"
  | "PROVIDER_ACCEPT"
  | "PROVIDER_REJECT"
  | "PROVIDER_REQUEST_INFO"
  | "BUDGET_APPROVE"
  | "BUDGET_REJECT"
  | "BUDGET_REQUEST_INFO"
  | "BUDGET_DEFER"
  | "COMPLETE_WIJKTEAM_INTAKE"
  | "COMPLETE_ZORGVRAAG_ASSESSMENT"
  | "ACTIVATE_PLACEMENT_MONITORING";

export type CaseDecisionActionKind = "mutation" | "navigate" | "noop";

export interface CaseDecisionActionResult {
  kind: CaseDecisionActionKind;
  message: string;
  href?: string;
}

export interface ExecuteCaseActionOptions {
  decisionEvaluation: DecisionEvaluation;
  role?: CaseDecisionRole;
  payload?: Record<string, unknown>;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function extractErrorMessage(text: string, fallback: string): string {
  if (!text) {
    return fallback;
  }

  try {
    const payload = JSON.parse(text) as Record<string, unknown>;
    const message = payload.error ?? payload.message ?? payload.detail;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  } catch {
    // Non-JSON response. Fall through to the raw text.
  }

  return text.trim() || fallback;
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const method = (init.method || "GET").toUpperCase();
  const isMutating = !["GET", "HEAD", "OPTIONS"].includes(method);

  if (isMutating) {
    headers.set("X-CSRFToken", getCsrfToken());
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: "same-origin",
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(extractErrorMessage(text, `Actie mislukt (${response.status}).`));
  }

  return { response, text };
}

async function requestJson(path: string, body: unknown) {
  const { text } = await request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  try {
    return text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function requestForm(path: string, formData: Record<string, string>) {
  const body = new URLSearchParams(formData);
  body.set("csrfmiddlewaretoken", getCsrfToken());

  return request(path, {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
  });
}

export async function executeCaseAction(
  caseId: string | number,
  action: CaseDecisionActionCode,
  options: ExecuteCaseActionOptions,
): Promise<CaseDecisionActionResult> {
  const caseIdString = String(caseId);
  const selectedProviderId = options.decisionEvaluation.decision_context.selected_provider_id ?? null;

  switch (action) {
    case "COMPLETE_CASE_DATA":
      return {
        kind: "navigate",
        message: "Casusgegevens worden geopend.",
        href: toCareCaseEdit(caseIdString),
      };

    case "GENERATE_SUMMARY":
      await requestJson(`/care/api/cases/${caseIdString}/assessment-decision/`, {
        decision: "",
        shortDescription: options.decisionEvaluation.decision_context.has_summary ? "Samenvatting herbeoordeeld vanuit casusdetail." : "Samenvatting aangemaakt vanuit casusdetail.",
      });
      return { kind: "mutation", message: "Samenvatting bijgewerkt." };

    case "START_MATCHING":
      await requestJson(`/care/api/cases/${caseIdString}/assessment-decision/`, {
        decision: "matching",
        shortDescription: "Casus doorgestuurd naar matching vanuit casusdetail.",
      });
      return {
        kind: "navigate",
        message: "Matching gestart.",
        href: toCareMatching(caseIdString),
      };

    case "VALIDATE_MATCHING":
      return {
        kind: "navigate",
        message: "Matching wordt geopend.",
        href: toCareMatching(caseIdString),
      };

    case "SEND_TO_PROVIDER":
      if (!selectedProviderId) {
        throw new Error("Geen geselecteerde aanbieder beschikbaar om te versturen.");
      }
      await requestJson(`/care/api/cases/${caseIdString}/matching/action/`, {
        action: "confirm_validation",
        provider_id: selectedProviderId,
        validation_context:
          (options.decisionEvaluation.decision_context as { matching_validation_context?: Record<string, unknown> })
            ?.matching_validation_context ?? {},
      });
      await requestJson(`/care/api/cases/${caseIdString}/matching/action/`, {
        action: "send_to_provider",
        provider_id: selectedProviderId,
      });
      return { kind: "mutation", message: "Casus verstuurd naar aanbieder." };

    case "WAIT_PROVIDER_RESPONSE":
      return { kind: "noop", message: "Aanbiederreactie wordt afgewacht." };

    case "FOLLOW_UP_PROVIDER":
      await requestForm(`/care/casussen/${caseIdString}/provider-response/action/`, {
        action: "resend_request",
      });
      return { kind: "mutation", message: "Aanbieder opgevolgd." };

    case "REMATCH_CASE":
      await requestForm(`/care/casussen/${caseIdString}/provider-response/action/`, {
        action: "trigger_rematch",
      });
      return { kind: "mutation", message: "Casus opnieuw gematcht." };

    case "CONFIRM_PLACEMENT":
      await requestJson(`/care/api/cases/${caseIdString}/placement-action/`, {
        status: "APPROVED",
      });
      return { kind: "mutation", message: "Plaatsing bevestigd." };

    case "START_INTAKE":
      await requestJson(`/care/api/cases/${caseIdString}/intake-action/`, {});
      return { kind: "mutation", message: "Intake gestart; actieve plaatsing geactiveerd." };

    case "BUDGET_APPROVE":
      await requestJson(`/care/api/cases/${caseIdString}/budget-decision/`, {
        decision: "APPROVED",
        note: String(options.payload?.note ?? "").trim(),
      });
      return { kind: "mutation", message: "Budget financieel akkoord vastgelegd." };

    case "BUDGET_REJECT":
      await requestJson(`/care/api/cases/${caseIdString}/budget-decision/`, {
        decision: "REJECTED",
        note: String(options.payload?.note ?? "").trim(),
      });
      return { kind: "mutation", message: "Budget afgewezen; casus terug naar matching." };

    case "BUDGET_REQUEST_INFO":
      await requestJson(`/care/api/cases/${caseIdString}/budget-decision/`, {
        decision: "NEEDS_INFO",
        note: String(options.payload?.note ?? "").trim(),
      });
      return { kind: "mutation", message: "Onderbouwing budget gevraagd." };

    case "BUDGET_DEFER":
      await requestJson(`/care/api/cases/${caseIdString}/budget-decision/`, {
        decision: "DEFERRED",
        note: String(options.payload?.note ?? "").trim(),
      });
      return { kind: "mutation", message: "Budgetbesluit uitgesteld." };

    case "COMPLETE_WIJKTEAM_INTAKE":
      await requestJson(`/care/api/cases/${caseIdString}/early-lifecycle/`, { action: "complete_wijkteam" });
      return { kind: "mutation", message: "Wijkteam intake afgerond." };

    case "COMPLETE_ZORGVRAAG_ASSESSMENT":
      await requestJson(`/care/api/cases/${caseIdString}/early-lifecycle/`, { action: "open_casus_from_zorgvraag" });
      return { kind: "mutation", message: "Casus geopend vanuit zorgvraagbeoordeling." };

    case "ACTIVATE_PLACEMENT_MONITORING":
      await requestJson(`/care/api/cases/${caseIdString}/activate-monitoring/`, {});
      return { kind: "mutation", message: "Actieve plaatsing geactiveerd." };

    case "MONITOR_CASE":
      return { kind: "noop", message: "Casus ververst." };

    case "ARCHIVE_CASE":
      await requestForm(`/care/casussen/${caseIdString}/archive/`, {});
      return { kind: "mutation", message: "Casus gearchiveerd." };

    case "PROVIDER_ACCEPT":
      await requestJson(`/care/api/cases/${caseIdString}/provider-decision/`, {
        status: "ACCEPTED",
        provider_comment: String(options.payload?.provider_comment ?? "").trim(),
      });
      return { kind: "mutation", message: "Aanbieder heeft de casus geaccepteerd." };

    case "PROVIDER_REJECT": {
      const rejectionReason = String(options.payload?.rejection_reason_code ?? "").trim();
      const providerComment = String(options.payload?.provider_comment ?? "").trim();
      if (!rejectionReason) {
        throw new Error("Selecteer een afwijsreden.");
      }
      if (providerComment.length < 10) {
        throw new Error("Voeg minimaal 10 tekens toe als toelichting.");
      }
      await requestJson(`/care/api/cases/${caseIdString}/provider-decision/`, {
        status: "REJECTED",
        rejection_reason_code: rejectionReason,
        provider_comment: providerComment,
      });
      return { kind: "mutation", message: "Aanbieder heeft de casus afgewezen." };
    }

    case "PROVIDER_REQUEST_INFO": {
      const infoType = String(options.payload?.information_request_type ?? "").trim();
      const infoComment = String(options.payload?.information_request_comment ?? "").trim();
      if (!infoType) {
        throw new Error("Selecteer een informatietype.");
      }
      if (infoComment.length < 10) {
        throw new Error("Voeg minimaal 10 tekens toe als toelichting.");
      }
      await requestJson(`/care/api/cases/${caseIdString}/provider-decision/`, {
        status: "INFO_REQUESTED",
        information_request_type: infoType,
        information_request_comment: infoComment,
      });
      return { kind: "mutation", message: "Aanvullende informatie gevraagd." };
    }

    default:
      throw new Error(`Actie ${action} wordt niet ondersteund.`);
  }
}
