import { apiClient } from "./apiClient";

export type DecisionPriority = "low" | "medium" | "high" | "critical";

export interface NextBestAction {
  action: string;
  label: string;
  priority: DecisionPriority;
  reason: string;
}

export interface DecisionBlocker {
  code: string;
  severity: DecisionPriority;
  message: string;
  blocking_actions: string[];
}

export interface DecisionRisk {
  code: string;
  severity: DecisionPriority;
  message: string;
  evidence: Record<string, unknown>;
}

export interface DecisionAlert {
  code: string;
  severity: DecisionPriority;
  title: string;
  message: string;
  recommended_action: string;
  evidence: Record<string, unknown>;
}

export interface AllowedAction {
  action: string;
  label: string;
  reason?: string;
  allowed: boolean;
}

export interface BlockedAction {
  action: string;
  label: string;
  reason: string;
  allowed: boolean;
}

export interface DecisionEvaluationContext {
  required_data_complete: boolean;
  has_summary: boolean;
  has_matching_result: boolean;
  latest_match_confidence: number | null;
  provider_review_status: string;
  provider_rejection_count: number;
  latest_rejection_reason: string;
  placement_confirmed: boolean;
  intake_started: boolean;
  case_age_hours: number | null;
  hours_in_current_state: number | null;
  urgency: string;
  capacity_signals: Array<Record<string, unknown>>;
}

export interface DecisionTimelineSignals {
  latest_event_type: string;
  latest_event_at: string;
  recent_events: Array<{
    event_type: string;
    user_action: string;
    timestamp: string;
    action_source: string;
  }>;
}

export interface DecisionEvaluation {
  case_id: number | string | null;
  current_state: string;
  phase: string;
  next_best_action: NextBestAction | null;
  blockers: DecisionBlocker[];
  risks: DecisionRisk[];
  alerts: DecisionAlert[];
  allowed_actions: AllowedAction[];
  blocked_actions: BlockedAction[];
  decision_context: DecisionEvaluationContext;
  timeline_signals: DecisionTimelineSignals;
}

export async function fetchCaseDecisionEvaluation(caseId: string | number): Promise<DecisionEvaluation> {
  return apiClient.get<DecisionEvaluation>(`/care/api/cases/${caseId}/decision-evaluation/`);
}
