/**
 * Canonical TypeScript types for all CareOn API responses.
 * Source of truth for hook return types and component props.
 * Derived from contracts/api/ domain modules — update here when backend response shapes change.
 */

// ---- Shared ----------------------------------------------------------------

export type WorkflowRole = "gemeente" | "zorgaanbieder" | "admin";

export type WorkflowState =
  | "DRAFT_CASE"
  | "SUMMARY_READY"
  | "MATCHING_READY"
  | "GEMEENTE_VALIDATED"
  | "PROVIDER_REVIEW_PENDING"
  | "PROVIDER_ACCEPTED"
  | "PROVIDER_REJECTED"
  | "PLACEMENT_CONFIRMED"
  | "INTAKE_STARTED"
  | "ACTIVE_PLACEMENT"
  | "ARCHIVED";

export type PlacementPressureBand = "low" | "normal" | "high" | "critical";

export interface PaginatedResponse<T> {
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  items?: T[];
}

// ---- Auth / Session --------------------------------------------------------

export interface CurrentUserOrganization {
  id: number;
  slug: string;
  name: string;
}

export interface CurrentUser {
  id: number;
  email: string;
  fullName: string;
  username: string;
  workflowRole: WorkflowRole;
  organization: CurrentUserOrganization | null;
  permissions: {
    allowRoleSwitch: boolean;
  };
  flags: {
    pilotUi: boolean;
    spaOnlyWorkflow: boolean;
  };
}

// ---- Cases -----------------------------------------------------------------

export interface ApiCase {
  id: string;
  title: string;
  status: string;
  case_phase: string;
  risk_level: string;
  service_region: string;
  contract_type: string;
  preferred_provider: string;
  content: string;
  owner: string;
  created_at: string | null;
  updated_at: string | null;
  lifecycle_stage: string;
  workflow_state: WorkflowState;
  // Urgency
  urgency?: string;
  urgency_validated?: boolean;
  urgency_document_present?: boolean;
  urgency_granted_date?: string | null;
  urgency_applied?: boolean;
  urgency_applied_since?: string | null;
  // Placement pressure
  placement_pressure_horizon?: string;
  safety_pressure?: boolean;
  time_sensitive_arrangement?: boolean;
  escalation_needed?: boolean;
  placement_pressure_notes?: string;
  placement_pressure_band?: PlacementPressureBand | null;
  placement_pressure_label?: string | null;
  placement_pressure_reason?: string | null;
  placement_pressure_implication?: string | null;
  // Intake
  intake_start_date?: string | null;
  // Arrangement
  arrangement_type_code?: string;
  arrangement_provider?: string;
  arrangement_end_date?: string | null;
  // Taxonomy
  zorgbehoefte_categorie?: string;
  zorgbehoefte_categorie_code?: string;
  zorgbehoefte_specifiek?: string;
  zorgbehoefte_specifiek_code?: string;
  taxonomie_lijn?: string;
  taxonomie_code_lijn?: string;
  // Placement
  placement_request_status?: string | null;
  placement_provider_response_status?: string | null;
  // Geo
  has_case_geo?: boolean;
  case_geo?: {
    postcode: string;
    latitude: number | null;
    longitude: number | null;
    has_coordinates: boolean;
  };
  // Routing
  routing?: Record<string, unknown>;
  // Regions
  primary_region_label?: string;
  secondary_region_labels?: string[];
  all_region_labels?: string[];
  // Classification
  complexity?: string;
  care_intensity?: string;
  proposed_complexity?: string;
  proposed_care_intensity?: string;
  complexity_status?: string;
  care_intensity_status?: string;
  classification_rationale?: {
    criteria: Array<{ label: string; value: string; signal: string; toelichting: string }>;
    explanation: string;
    proposed_at?: string;
  };
  complexity_confirmed_by?: string | null;
  complexity_confirmed_at?: string | null;
  care_intensity_confirmed_by?: string | null;
  care_intensity_confirmed_at?: string | null;
  complexity_override_reason?: string;
  care_intensity_override_reason?: string;
  // Decision evaluation (detail only)
  decision_evaluation?: Record<string, unknown>;
}

export interface CaseListResponse {
  contracts: ApiCase[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ---- Assessment ------------------------------------------------------------

export interface ApiAssessment {
  id: number;
  case_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

// ---- Placement -------------------------------------------------------------

export interface ApiPlacement {
  id: number;
  case_id: string;
  status: string;
  provider_response_status: string | null;
  care_form: string;
  proposed_provider?: number | null;
  selected_provider?: number | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

// ---- Providers -------------------------------------------------------------

export interface ApiProvider {
  id: number;
  name: string;
  slug?: string;
  care_forms?: string[];
  primary_region_label?: string;
  secondary_region_labels?: string[];
  all_region_labels?: string[];
  latitude?: number | null;
  longitude?: number | null;
  [key: string]: unknown;
}

export interface ProviderListResponse {
  providers: ApiProvider[];
  total_count?: number;
}

// ---- Members ---------------------------------------------------------------

export interface ApiMember {
  id: number;
  user: {
    id: number;
    email: string;
    fullName: string;
    username: string;
  };
  role: string;
  is_active: boolean;
  joined_at: string;
}

// ---- Documents -------------------------------------------------------------

export interface ApiDocument {
  id: number;
  filename: string;
  document_type: string;
  uploaded_at: string;
  case_id?: string | null;
  download_url?: string;
}

// ---- Dashboard -------------------------------------------------------------

export interface DashboardSummary {
  total_active_cases: number;
  critical_blockers: number;
  pending_provider_decisions: number;
  [key: string]: unknown;
}

// ---- Audit -----------------------------------------------------------------

export interface ApiAuditEntry {
  id: number;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
  changes?: Record<string, unknown>;
}

// ---- Signals / Tasks -------------------------------------------------------

export interface ApiSignal {
  id: number;
  signal_type: string;
  case_id: string;
  created_at: string;
  [key: string]: unknown;
}

export interface ApiTask {
  id: number;
  title: string;
  status: string;
  case_id: string;
  assigned_to?: number | null;
  due_date?: string | null;
  [key: string]: unknown;
}

// ---- Regions / Municipalities -----------------------------------------------

export interface ApiRegion {
  id: number;
  region_name: string;
  region_code?: string;
  region_type?: string;
}

export interface ApiMunicipality {
  id: number;
  municipality_name: string;
  urgency_document_request_url?: string;
}
