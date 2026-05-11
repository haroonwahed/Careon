export type CanonicalWorkflowRole = "gemeente" | "zorgaanbieder" | "admin";

export type CanonicalWorkflowState =
  | "WIJKTEAM_INTAKE"
  | "ZORGVRAAG_BEOORDELING"
  | "DRAFT_CASE"
  | "SUMMARY_READY"
  | "MATCHING_READY"
  | "GEMEENTE_VALIDATED"
  | "PROVIDER_REVIEW_PENDING"
  | "PROVIDER_ACCEPTED"
  | "BUDGET_REVIEW_PENDING"
  | "PROVIDER_REJECTED"
  | "PLACEMENT_CONFIRMED"
  | "INTAKE_STARTED"
  | "ACTIVE_PLACEMENT"
  | "ARCHIVED";

const canonicalWorkflowStates = new Set<CanonicalWorkflowState>([
  "WIJKTEAM_INTAKE",
  "ZORGVRAAG_BEOORDELING",
  "DRAFT_CASE",
  "SUMMARY_READY",
  "MATCHING_READY",
  "GEMEENTE_VALIDATED",
  "PROVIDER_REVIEW_PENDING",
  "PROVIDER_ACCEPTED",
  "BUDGET_REVIEW_PENDING",
  "PROVIDER_REJECTED",
  "PLACEMENT_CONFIRMED",
  "INTAKE_STARTED",
  "ACTIVE_PLACEMENT",
  "ARCHIVED",
]);

export type CanonicalWorkflowAction =
  | "create_case"
  | "complete_wijkteam_intake"
  | "complete_zorgvraag_assessment"
  | "complete_summary"
  | "start_matching"
  | "validate_matching"
  | "send_to_provider"
  | "provider_accept"
  | "provider_reject"
  | "provider_request_info"
  | "budget_approve"
  | "budget_reject"
  | "budget_request_info"
  | "budget_defer"
  | "confirm_placement"
  | "start_intake"
  | "activate_placement_monitoring"
  | "archive_case"
  | "rematch"
  | "submit_transition_request"
  | "resolve_transition_financial";

const roleActions: Record<CanonicalWorkflowRole, Set<CanonicalWorkflowAction>> = {
  gemeente: new Set([
    "create_case",
    "complete_wijkteam_intake",
    "complete_zorgvraag_assessment",
    "complete_summary",
    "start_matching",
    "validate_matching",
    "send_to_provider",
    "budget_approve",
    "budget_reject",
    "budget_request_info",
    "budget_defer",
    "confirm_placement",
    "activate_placement_monitoring",
    "archive_case",
    "rematch",
    "resolve_transition_financial",
  ]),
  zorgaanbieder: new Set([
    "provider_accept",
    "provider_reject",
    "provider_request_info",
    "start_intake",
    "submit_transition_request",
  ]),
  admin: new Set([
    "create_case",
    "complete_wijkteam_intake",
    "complete_zorgvraag_assessment",
    "complete_summary",
    "start_matching",
    "validate_matching",
    "send_to_provider",
    "budget_approve",
    "budget_reject",
    "budget_request_info",
    "budget_defer",
    "confirm_placement",
    "activate_placement_monitoring",
    "archive_case",
    "rematch",
    "resolve_transition_financial",
  ]),
};

const transitions: Record<CanonicalWorkflowState, Set<CanonicalWorkflowState>> = {
  WIJKTEAM_INTAKE: new Set(["ZORGVRAAG_BEOORDELING"]),
  ZORGVRAAG_BEOORDELING: new Set(["DRAFT_CASE"]),
  DRAFT_CASE: new Set(["SUMMARY_READY"]),
  SUMMARY_READY: new Set(["MATCHING_READY"]),
  MATCHING_READY: new Set(["GEMEENTE_VALIDATED"]),
  GEMEENTE_VALIDATED: new Set(["PROVIDER_REVIEW_PENDING"]),
  PROVIDER_REVIEW_PENDING: new Set(["PROVIDER_ACCEPTED", "BUDGET_REVIEW_PENDING", "PROVIDER_REJECTED", "MATCHING_READY"]),
  PROVIDER_ACCEPTED: new Set(["BUDGET_REVIEW_PENDING", "PLACEMENT_CONFIRMED"]),
  BUDGET_REVIEW_PENDING: new Set(["PROVIDER_ACCEPTED", "MATCHING_READY"]),
  PROVIDER_REJECTED: new Set(["MATCHING_READY"]),
  PLACEMENT_CONFIRMED: new Set(["INTAKE_STARTED"]),
  INTAKE_STARTED: new Set(["ACTIVE_PLACEMENT", "ARCHIVED"]),
  ACTIVE_PLACEMENT: new Set(["ARCHIVED"]),
  ARCHIVED: new Set(),
};

export function canRoleExecuteAction(role: CanonicalWorkflowRole, action: CanonicalWorkflowAction): boolean {
  return roleActions[role].has(action);
}

export function canTransitionWorkflowState(from: CanonicalWorkflowState, to: CanonicalWorkflowState): boolean {
  if (from === to) return true;
  return transitions[from].has(to);
}

export function isCanonicalWorkflowState(value: string | null | undefined): value is CanonicalWorkflowState {
  return Boolean(value) && canonicalWorkflowStates.has(value as CanonicalWorkflowState);
}
