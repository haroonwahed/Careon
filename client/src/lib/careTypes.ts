/**
 * Shared domain types for the care coordination app.
 *
 * These were previously scattered across casesData.ts (which also held
 * retail-era mock data). Anything that belongs to the care domain and is
 * shared between multiple components lives here.
 */

export type CaseStatus =
  | "intake"
  | "assessment"
  | "matching"
  | "placement"
  | "active"
  | "completed"
  | "blocked";

export type UrgencyLevel = "critical" | "high" | "medium" | "low";
export type RiskLevel = "high" | "medium" | "low" | "none";

export interface Case {
  id: string;
  clientName: string;
  clientAge: number;
  region: string;
  status: CaseStatus;
  urgency: UrgencyLevel;
  risk: RiskLevel;
  waitingDays: number;
  lastActivity: string;
  assignedTo: string;
  caseType: string;
  signal: string;
  recommendedAction: string;
}

export interface Provider {
  id: string;
  name: string;
  type: string;
  region: string;
  capacity: number;
  availableSpots: number;
  specializations: string[];
  rating: number;
  responseTime: number;
  latitude?: number | null;
  longitude?: number | null;
  hasCoordinates?: boolean;
}
