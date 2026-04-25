import { apiClient } from "./apiClient";

export type RegiekamerPriorityBand = "critical" | "high" | "medium" | "low";
export type RegiekamerOwnershipRole = "gemeente" | "zorgaanbieder" | "regie";
export type RegiekamerIssueType = "blockers" | "risks" | "alerts" | "SLA" | "rejection" | "intake";

export interface RegiekamerOverviewAction {
  action: string;
  label: string;
  priority: RegiekamerPriorityBand;
  reason: string;
}

export interface RegiekamerOverviewIssue {
  code: string;
  severity: RegiekamerPriorityBand | "warning" | "info";
  message?: string;
  title?: string;
  recommended_action?: string;
  blocking_actions?: string[];
  evidence?: Record<string, unknown>;
}

export interface RegiekamerDecisionOverviewItem {
  case_id: number | string;
  case_reference: string;
  title: string;
  current_state: string;
  phase: string;
  urgency: string;
  assigned_provider: string;
  next_best_action: RegiekamerOverviewAction | null;
  top_blocker: RegiekamerOverviewIssue | null;
  top_risk: RegiekamerOverviewIssue | null;
  top_alert: RegiekamerOverviewIssue | null;
  blocker_count: number;
  risk_count: number;
  alert_count: number;
  priority_score: number;
  age_hours: number | null;
  hours_in_current_state: number | null;
  issue_tags?: RegiekamerIssueType[];
  responsible_role?: RegiekamerOwnershipRole;
}

export interface RegiekamerDecisionOverviewTotals {
  active_cases: number;
  critical_blockers: number;
  high_priority_alerts: number;
  provider_sla_breaches: number;
  repeated_rejections: number;
  intake_delays: number;
}

export interface RegiekamerDecisionOverview {
  generated_at: string;
  totals: RegiekamerDecisionOverviewTotals;
  items: RegiekamerDecisionOverviewItem[];
}

export async function fetchRegiekamerDecisionOverview(): Promise<RegiekamerDecisionOverview> {
  return apiClient.get<RegiekamerDecisionOverview>("/care/api/regiekamer/decision-overview/");
}
