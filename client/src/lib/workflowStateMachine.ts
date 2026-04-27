export type CanonicalWorkflowRole = "gemeente" | "zorgaanbieder" | "admin";

export type CanonicalWorkflowState =
  | "DRAFT_CASE"
  | "SUMMARY_READY"
  | "MATCHING_READY"
  | "GEMEENTE_VALIDATED"
  | "PROVIDER_REVIEW_PENDING"
  | "PROVIDER_ACCEPTED"
  | "PROVIDER_REJECTED"
  | "PLACEMENT_CONFIRMED"
  | "INTAKE_STARTED"
  | "ARCHIVED";

const canonicalWorkflowStates = new Set<CanonicalWorkflowState>([
  "DRAFT_CASE",
  "SUMMARY_READY",
  "MATCHING_READY",
  "GEMEENTE_VALIDATED",
  "PROVIDER_REVIEW_PENDING",
  "PROVIDER_ACCEPTED",
  "PROVIDER_REJECTED",
  "PLACEMENT_CONFIRMED",
  "INTAKE_STARTED",
  "ARCHIVED",
]);

export type CanonicalWorkflowAction =
  | "create_case"
  | "complete_summary"
  | "start_matching"
  | "validate_matching"
  | "send_to_provider"
  | "provider_accept"
  | "provider_reject"
  | "provider_request_info"
  | "confirm_placement"
  | "start_intake"
  | "archive_case"
  | "rematch";

const roleActions: Record<CanonicalWorkflowRole, Set<CanonicalWorkflowAction>> = {
  gemeente: new Set([
    "create_case",
    "complete_summary",
    "start_matching",
    "validate_matching",
    "send_to_provider",
    "confirm_placement",
    "archive_case",
    "rematch",
  ]),
  zorgaanbieder: new Set([
    "provider_accept",
    "provider_reject",
    "provider_request_info",
    "start_intake",
  ]),
  admin: new Set([
    "create_case",
    "complete_summary",
    "start_matching",
    "validate_matching",
    "send_to_provider",
    "confirm_placement",
    "archive_case",
    "rematch",
  ]),
};

const transitions: Record<CanonicalWorkflowState, Set<CanonicalWorkflowState>> = {
  DRAFT_CASE: new Set(["SUMMARY_READY"]),
  SUMMARY_READY: new Set(["MATCHING_READY"]),
  MATCHING_READY: new Set(["GEMEENTE_VALIDATED"]),
  GEMEENTE_VALIDATED: new Set(["PROVIDER_REVIEW_PENDING"]),
  PROVIDER_REVIEW_PENDING: new Set(["PROVIDER_ACCEPTED", "PROVIDER_REJECTED", "MATCHING_READY"]),
  PROVIDER_ACCEPTED: new Set(["PLACEMENT_CONFIRMED"]),
  PROVIDER_REJECTED: new Set(["MATCHING_READY"]),
  PLACEMENT_CONFIRMED: new Set(["INTAKE_STARTED"]),
  INTAKE_STARTED: new Set(["ARCHIVED"]),
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
