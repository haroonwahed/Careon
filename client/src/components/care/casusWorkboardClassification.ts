import type { CaseDecisionState, WorkflowCaseView } from "../../lib/workflowUi";

export type CasusWorkboardSection = "attention" | "waiting-provider" | "stable";
export type CasusWorkboardReasonCode = "blocked" | "missing_data" | "current_user_action" | "waiting_provider" | "stable";

export interface CasusWorkboardDebugSignals {
  isBlocked: boolean;
  primaryActionEnabled: boolean;
  missingDataItems: string[];
  requiresCurrentUserAction: boolean;
  responsibleParty: CaseDecisionState["responsibleParty"];
  boardColumn: WorkflowCaseView["boardColumn"];
  providerStatusLabel: WorkflowCaseView["providerStatusLabel"];
}

export interface CasusWorkboardClassification {
  section: CasusWorkboardSection;
  reasonCode: CasusWorkboardReasonCode;
  debug: {
    assignedBucket: CasusWorkboardSection;
    winningRule: CasusWorkboardReasonCode;
    signals: CasusWorkboardDebugSignals;
    nextActionRoute: CaseDecisionState["nextActionRoute"];
  };
}

/**
 * Deterministic workboard classification matrix.
 *
 * Priority order (first match wins):
 * 1) Vraagt aandacht:
 *    - workflow blocked OR primary action disabled OR missing required data
 *    - OR immediate action is required from current role
 * 2) Wacht op aanbieder:
 *    - no immediate/blocking issue
 *    - responsible actor is provider
 *    - case is in provider review/response phase
 * 3) Stabiel:
 *    - no immediate action and not waiting on provider
 */
export function classifyCasusWorkboardState(
  item: WorkflowCaseView,
  decision: CaseDecisionState,
): CasusWorkboardClassification {
  const hasMissingRequiredData = item.missingDataItems.length > 0;
  const hasBlockingIssue = item.isBlocked || !decision.primaryActionEnabled || hasMissingRequiredData;
  const requiresCurrentUserAction = decision.requiresCurrentUserAction;
  const signals: CasusWorkboardDebugSignals = {
    isBlocked: item.isBlocked,
    primaryActionEnabled: decision.primaryActionEnabled,
    missingDataItems: item.missingDataItems,
    requiresCurrentUserAction,
    responsibleParty: decision.responsibleParty,
    boardColumn: item.boardColumn,
    providerStatusLabel: item.providerStatusLabel,
  };

  if (hasBlockingIssue) {
    return {
      section: "attention",
      reasonCode: hasMissingRequiredData ? "missing_data" : "blocked",
      debug: {
        assignedBucket: "attention",
        winningRule: hasMissingRequiredData ? "missing_data" : "blocked",
        signals,
        nextActionRoute: decision.nextActionRoute,
      },
    };
  }

  if (requiresCurrentUserAction) {
    return {
      section: "attention",
      reasonCode: "current_user_action",
      debug: {
        assignedBucket: "attention",
        winningRule: "current_user_action",
        signals,
        nextActionRoute: decision.nextActionRoute,
      },
    };
  }

  const isProviderResponsible = decision.responsibleParty === "Zorgaanbieder";
  const isProviderWorkflowStep = item.boardColumn === "aanbieder-beoordeling" || item.providerStatusLabel === "Verstuurd";

  if (isProviderResponsible && isProviderWorkflowStep) {
    return {
      section: "waiting-provider",
      reasonCode: "waiting_provider",
      debug: {
        assignedBucket: "waiting-provider",
        winningRule: "waiting_provider",
        signals,
        nextActionRoute: decision.nextActionRoute,
      },
    };
  }

  return {
    section: "stable",
    reasonCode: "stable",
    debug: {
      assignedBucket: "stable",
      winningRule: "stable",
      signals,
      nextActionRoute: decision.nextActionRoute,
    },
  };
}

