import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  Home,
  Mail,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { cn } from "../ui/utils";
import { CareInfoPopover } from "./CareUnifiedPage";
import {
  CareOperationalSelect,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import { useCoordinationDecisionOverview } from "../../hooks/useCoordinationDecisionOverview";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useRailCollapsed } from "../../hooks/useRailCollapsed";
import { CoordinationNotesPanel } from "./CoordinationNotesPanel";
import { getShortReasonLabel } from "../../lib/uxCopy";
import { imperativeLabelForActionCode } from "./nbaImperativeLabels";
import type {
  CoordinationDecisionOverviewItem,
  CoordinationOwnershipRole,
  CoordinationPriorityBand,
} from "../../lib/coordinationDecisionOverview";
import {
  computeCoordinationNextBestAction,
  formatCoordinationDominantDescription,
  type CoordinationNbaActionKey,
  type CoordinationNbaUiMode,
} from "../../lib/coordinationNextBestAction";
import {
  derivePhaseBoard,
  getDominantPhaseColumn,
  type CoordinationListFilter,
  type CoordinationFlowPhase,
} from "../../lib/coordinationCommandCenter";
import {
  buildCoordinationNbaInstrumentationPayload,
  emitCoordinationNbaEvent,
  shouldEmitCoordinationNbaShown,
} from "../../lib/coordinationNbaInstrumentation";
import { setCasussenPreferredFocus } from "../../lib/casussenNavigation";
import {
  DECISION_UI_PHASE_IDS,
  DECISION_UI_PHASE_LABELS,
  isDecisionUiPhaseId,
  mapApiPhaseToDecisionUiPhase,
  normalizeApiPhaseId,
  normalizeCoordinationPhaseQueryParam,
  type DecisionUiPhaseId,
} from "../../lib/decisionPhaseUi";
import { CARE_PATHS } from "../../lib/routes";

interface SystemAwarenessPageProps {
  onCaseClick: (caseId: string) => void;
  /** Shell navigation (e.g. metric strip → Casussen). Optional in standalone demos/tests. */
  onAppNavigate?: (path: string) => void;
  /** Same rules as Casussen werkvoorraad — shows “Nieuwe casus” on empty Coordination when true. */
  canCreateCase?: boolean;
  onCreateCase?: () => void;
}

type PriorityFilter = "all" | "critical" | "high" | "medium";
type IssueFilter = "all" | "blockers" | "risks" | "alerts" | "SLA" | "rejection" | "intake";
type TaxonomyFilter = "all" | string;
type PhaseFilter = "all" | DecisionUiPhaseId;
type OwnershipFilter = "all" | CoordinationOwnershipRole;

const PRIORITY_PARAM_VALUES = new Set<PriorityFilter>(["all", "critical", "high", "medium"]);
const ISSUE_PARAM_VALUES = new Set<IssueFilter>(["all", "blockers", "risks", "alerts", "SLA", "rejection", "intake"]);
const PHASE_PARAM_VALUES = new Set<string>([
  "all",
  ...DECISION_UI_PHASE_IDS,
  "casus",
  "samenvatting",
  "matching",
  "gemeente_validatie",
  "wacht_op_validatie",
  "aanbieder_beoordeling",
  "plaatsing",
  "intake",
]);
const OWNERSHIP_PARAM_VALUES = new Set<OwnershipFilter>(["all", "gemeente", "zorgaanbieder", "coordinatie"]);

function pathWithoutTrailingSlash(path: string): string {
  const p = path.split("?")[0]?.split("#")[0] ?? "/";
  if (p.length > 1 && p.endsWith("/")) {
    return p.slice(0, -1);
  }
  return p || "/";
}

function isCoordinationPath(pathname: string): boolean {
  const normalized = pathWithoutTrailingSlash(pathname);
  return normalized === CARE_PATHS.COORDINATION;
}

function filtersFromSearchString(search: string): {
  searchQuery: string;
  priorityFilter: PriorityFilter;
  issueFilter: IssueFilter;
  phaseFilter: PhaseFilter;
  ownershipFilter: OwnershipFilter;
  categoryFilter: TaxonomyFilter;
  subcategoryFilter: TaxonomyFilter;
} {
  const params = new URLSearchParams(search);
  const searchQuery = (params.get("q") ?? "").trim();
  const pr = params.get("priority") as PriorityFilter;
  const priorityFilter = PRIORITY_PARAM_VALUES.has(pr) ? pr : "all";
  const ir = params.get("issue") as IssueFilter;
  const issueFilter = ISSUE_PARAM_VALUES.has(ir) ? ir : "all";
  const phaseKey = normalizeCoordinationPhaseQueryParam(params.get("phase"));
  const phaseFilter: PhaseFilter =
    phaseKey && PHASE_PARAM_VALUES.has(phaseKey as PhaseFilter)
      ? (phaseKey as PhaseFilter)
      : "all";
  const ow = params.get("ownership") as OwnershipFilter;
  const ownershipFilter = OWNERSHIP_PARAM_VALUES.has(ow) ? ow : "all";
  const categoryFilter = (params.get("care_category") ?? "all").trim() || "all";
  const subcategoryFilter = (params.get("care_subcategory") ?? "all").trim() || "all";
  return { searchQuery, priorityFilter, issueFilter, phaseFilter, ownershipFilter, categoryFilter, subcategoryFilter };
}

function readFiltersFromUrl(): {
  searchQuery: string;
  priorityFilter: PriorityFilter;
  issueFilter: IssueFilter;
  phaseFilter: PhaseFilter;
  ownershipFilter: OwnershipFilter;
  categoryFilter: TaxonomyFilter;
  subcategoryFilter: TaxonomyFilter;
} {
  if (typeof window === "undefined") {
    return {
      searchQuery: "",
      priorityFilter: "all",
      issueFilter: "all",
      phaseFilter: "all",
      ownershipFilter: "all",
      categoryFilter: "all",
      subcategoryFilter: "all",
    };
  }
  if (!isCoordinationPath(window.location.pathname)) {
    return {
      searchQuery: "",
      priorityFilter: "all",
      issueFilter: "all",
      phaseFilter: "all",
      ownershipFilter: "all",
      categoryFilter: "all",
      subcategoryFilter: "all",
    };
  }
  return filtersFromSearchString(window.location.search);
}

function buildCoordinationUrl(parts: {
  searchQuery: string;
  priorityFilter: PriorityFilter;
  issueFilter: IssueFilter;
  phaseFilter: PhaseFilter;
  ownershipFilter: OwnershipFilter;
  categoryFilter: TaxonomyFilter;
  subcategoryFilter: TaxonomyFilter;
}): string {
  const params = new URLSearchParams();
  if (parts.searchQuery.trim()) {
    params.set("q", parts.searchQuery.trim());
  }
  if (parts.priorityFilter !== "all") {
    params.set("priority", parts.priorityFilter);
  }
  if (parts.issueFilter !== "all") {
    params.set("issue", parts.issueFilter);
  }
  if (parts.phaseFilter !== "all") {
    params.set("phase", parts.phaseFilter);
  }
  if (parts.ownershipFilter !== "all") {
    params.set("ownership", parts.ownershipFilter);
  }
  if (parts.categoryFilter !== "all") {
    params.set("care_category", parts.categoryFilter);
  }
  if (parts.subcategoryFilter !== "all") {
    params.set("care_subcategory", parts.subcategoryFilter);
  }
  const qs = params.toString();
  return qs ? `${CARE_PATHS.COORDINATION}?${qs}` : CARE_PATHS.COORDINATION;
}

function itemMatchesPhaseFilter(itemPhase: string, phaseFilter: PhaseFilter): boolean {
  if (phaseFilter === "all") {
    return true;
  }
  if (isDecisionUiPhaseId(phaseFilter)) {
    return mapApiPhaseToDecisionUiPhase(itemPhase) === phaseFilter;
  }
  return itemPhase === phaseFilter;
}

/** NBA action codes from API → korte Nederlandse label voor Coordination (alleen weergave). */
const NBA_ACTION_CODE_LABELS: Record<string, string> = {
  COMPLETE_CASE_DATA: "Vul casus aan",
  GENERATE_SUMMARY: "Vul casus aan",
  START_MATCHING: "Matching starten",
  VALIDATE_MATCHING: "Matching valideren",
  SEND_TO_PROVIDER: "Naar aanbieder sturen",
  WAIT_PROVIDER_RESPONSE: "Wachten op aanbiederreactie",
  FOLLOW_UP_PROVIDER: "Aanbieder opvolgen",
  REMATCH_CASE: "Casus her-matchen",
  CONFIRM_PLACEMENT: "Plaatsing bevestigen",
  START_INTAKE: "Intake starten",
  MONITOR_CASE: "Casus monitoren",
  ARCHIVE_CASE: "Casus archiveren",
  PROVIDER_ACCEPT: "Aanbieder accepteert",
  PROVIDER_REJECT: "Aanbieder wijst af",
  PROVIDER_REQUEST_INFO: "Aanvullende info opvragen",
};

const PRIORITY_LABELS: Record<PriorityFilter, string> = {
  all: "Alles",
  critical: "Kritiek",
  high: "Hoog",
  medium: "Gemiddeld",
};

const ISSUE_LABELS: Record<IssueFilter, string> = {
  all: "Alles",
  blockers: "Blokkades",
  risks: "Risico's",
  alerts: "Alerts",
  SLA: "SLA",
  rejection: "Afwijzing",
  intake: "Intake",
};

const REGIEKAMER_COORDINATION_LIST_CAP = 12;

function itemNeedsCoordinationAttention(item: CoordinationDecisionOverviewItem): boolean {
  if (item.top_blocker || item.top_alert) {
    return true;
  }
  if (item.priority_score >= 70) {
    return true;
  }
  const riskSeverity = (item.top_risk?.severity ?? "").toLowerCase();
  return riskSeverity === "high" || riskSeverity === "critical";
}

const OWNERSHIP_LABELS: Record<OwnershipFilter, string> = {
  all: "Alles",
  gemeente: "Gemeente",
  zorgaanbieder: "Zorgaanbieder",
  coordinatie: "Coördinatie",
};

function priorityBand(score: number): CoordinationPriorityBand {
  if (score >= 100) {
    return "critical";
  }
  if (score >= 70) {
    return "high";
  }
  if (score >= 30) {
    return "medium";
  }
  return "low";
}

function priorityLabel(score: number): string {
  switch (priorityBand(score)) {
    case "critical":
      return "Kritiek";
    case "high":
      return "Hoog";
    case "medium":
      return "Gemiddeld";
    default:
      return "Laag";
  }
}

function priorityBadgeClasses(score: number) {
  switch (priorityBand(score)) {
    case "critical":
      return "border bg-care-urgent-bg text-care-urgent-text border-care-urgent-border";
    case "high":
      return "border bg-care-warning-bg text-care-warning-text border-care-warning-border";
    case "medium":
      return "border-border bg-muted/30 text-foreground";
    default:
      return "border-border bg-muted/15 text-muted-foreground";
  }
}

function severityBadgeClasses(severity?: string | null) {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return "border bg-care-urgent-bg text-care-urgent-text border-care-urgent-border";
    case "high":
    case "warning":
      return "border bg-care-warning-bg text-care-warning-text border-care-warning-border";
    case "medium":
      return "border-border bg-muted/30 text-foreground";
    default:
      return "border-border bg-muted/20 text-muted-foreground";
  }
}

function phaseCardIcon(phase: CoordinationFlowPhase) {
  switch (phase) {
    case "aanmelding":
      return FolderOpen;
    case "matching":
      return Users;
    case "aanbiederreactie":
      return UserCheck;
    case "plaatsing":
      return Home;
    case "intake":
      return Clock3;
    default:
      return FileText;
  }
}

function imperativeCtaLabel(item: CoordinationDecisionOverviewItem): string | null {
  const nba = item.next_best_action;
  if (!nba) {
    return null;
  }
  return imperativeLabelForActionCode(nba.action, nba.label);
}

function summaryWorkflowState(item: CoordinationDecisionOverviewItem): {
  statusLabel: string;
  actionLabel: string | null;
  processing: boolean;
} | null {
  const blockerCode = item.top_blocker?.code?.toUpperCase() ?? "";
  const actionCode = item.next_best_action?.action?.toUpperCase() ?? "";
  const summaryRelated =
    blockerCode === "MISSING_SUMMARY" ||
    actionCode === "GENERATE_SUMMARY" ||
    actionCode === "VIEW_SUMMARY";
  if (!summaryRelated) {
    return null;
  }

  const summaryText = [
    item.top_blocker?.message,
    item.top_blocker?.title,
    item.top_alert?.message,
    item.top_alert?.title,
    item.next_best_action?.reason,
    item.next_best_action?.label,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  const processing = /(wordt|wacht op).*(gemaakt|verwerkt)|automatisch|verwerking/.test(summaryText);
  if (processing) {
    return {
      statusLabel: "Zorgvraag wordt automatisch verwerkt",
      actionLabel: null,
      processing: true,
    };
  }

  if (actionCode === "VIEW_SUMMARY") {
    return {
      statusLabel: "Zorgvraag vastgelegd",
      actionLabel: null,
      processing: false,
    };
  }

    return {
      statusLabel: "Casus onvolledig",
      actionLabel: "Vul casus aan",
      processing: false,
    };
}

function normalizeWorklistActionLabel(item: CoordinationDecisionOverviewItem, label: string | null): string | null {
  if (!label) {
    return null;
  }
  const actionCode = (item.next_best_action?.action ?? "").toUpperCase();
  const summaryState = summaryWorkflowState(item);
  const lower = label.toLowerCase();
  const summaryRelated = lower.includes("samenvatting") || actionCode === "GENERATE_SUMMARY";

  if (summaryState?.processing) {
    return null;
  }
  if (summaryState) {
    if (summaryState.actionLabel == null) {
      return null;
    }
    return summaryState.actionLabel;
  }
  if (actionCode === "START_MATCHING") {
    return imperativeLabelForActionCode("START_MATCHING", item.next_best_action?.label) ?? "Zoek zorgcapaciteit";
  }
  if (actionCode === "VALIDATE_MATCHING") {
    return imperativeLabelForActionCode("VALIDATE_MATCHING", item.next_best_action?.label) ?? "Controleer matchvoorstel";
  }
  if (actionCode === "SEND_TO_PROVIDER") {
    return imperativeLabelForActionCode("SEND_TO_PROVIDER", item.next_best_action?.label) ?? "Vraag reactie aanbieder";
  }
  if (actionCode === "WAIT_PROVIDER_RESPONSE" || actionCode === "FOLLOW_UP_PROVIDER") {
    return imperativeLabelForActionCode(actionCode, item.next_best_action?.label) ?? "Herinner aanbieder";
  }
  if (actionCode === "PROVIDER_REQUEST_INFO") {
    return "Vraag informatie op";
  }
  if (actionCode === "CONFIRM_PLACEMENT") {
    return "Rond plaatsing af";
  }
  if (actionCode === "START_INTAKE") {
    return "Plan intake";
  }
  if (actionCode === "MONITOR_CASE") {
    return "Bekijk status";
  }
  if (summaryRelated) {
    return "Vul casus aan";
  }

  if (lower.includes("samenvatting")) {
    return "Vul casus aan";
  }
  if (lower.includes("intake") || lower.includes("matching") || lower.includes("start")) {
    return `Start ${label.replace(/^(start|starten)\s+/i, "").trim()}`.trim();
  }
  if (lower.includes("beoord")) {
    return "Beoordeel casus";
  }
  if (lower.startsWith("stuur") || lower.startsWith("volg")) {
    return "Geef opvolging";
  }
  return `Bekijk ${label.replace(/^bekijk\s+/i, "").trim()}`.trim();
}

function actionableProblemLabel(item: CoordinationDecisionOverviewItem): string {
  const nbaReason = item.next_best_action?.reason?.trim();
  if (nbaReason) {
    return getShortReasonLabel(nbaReason, 72);
  }
  const code = item.top_blocker?.code ?? item.top_alert?.code ?? item.top_risk?.code ?? "";
  const nextAction = (item.next_best_action?.action ?? "").toUpperCase();
  const summaryState = summaryWorkflowState(item);
  if (summaryState) {
    return summaryState.statusLabel;
  }
  switch (code) {
    case "MISSING_SUMMARY":
      return "Casus onvolledig";
    case "GEMEENTE_VALIDATION_REQUIRED":
      return "Matching wacht op gemeente";
    case "NO_MATCH_AVAILABLE":
      if (nextAction === "START_MATCHING") {
        return "Klaar voor matching";
      }
      return "Geen aanbieder toegewezen";
    case "PROVIDER_REVIEW_PENDING_SLA":
      return "Wacht op aanbieder";
    case "REPEATED_PROVIDER_REJECTIONS":
      return "Herhaalde afwijzingen";
    case "INTAKE_NOT_STARTED":
    case "INTAKE_DELAYED":
      return "Wacht op intake";
    default:
      return getShortReasonLabel(primaryProblemText(item), 72);
  }
}

function formatHours(hours: number | null) {
  if (hours === null || Number.isNaN(hours)) {
    return "Geen recente activiteit";
  }
  if (hours < 24) {
    return `${Math.round(hours)} uur`;
  }
  return `${Math.round(hours / 24)} dagen`;
}

function issueTone(item: CoordinationDecisionOverviewItem) {
  if (item.top_blocker) {
    return item.top_blocker.severity;
  }
  if (item.top_alert) {
    return item.top_alert.severity;
  }
  if (item.top_risk) {
    return item.top_risk.severity;
  }
  return "low";
}

function primaryProblemText(item: CoordinationDecisionOverviewItem): string {
  if (item.top_blocker?.message) {
    if (/gemeentevalidatie/i.test(item.top_blocker.message)) {
      return "Goedkeuring nodig vóór versturen naar aanbieder.";
    }
    return item.top_blocker.message;
  }
  if (item.top_blocker?.title) {
    return item.top_blocker.title;
  }
  if (item.top_alert?.title && item.top_alert?.message) {
    return `${item.top_alert.title}: ${item.top_alert.message}`;
  }
  if (item.top_alert?.message) {
    return item.top_alert.message;
  }
  if (item.top_alert?.title) {
    return item.top_alert.title;
  }
  if (item.top_risk?.message) {
    return item.top_risk.message;
  }
  if (item.top_risk?.title) {
    return item.top_risk.title;
  }
  return "Geen signaal vastgelegd — open de casus.";
}

function ownerLabel(item: CoordinationDecisionOverviewItem): string {
  const role = (item.responsible_role ?? "coordinatie") as OwnershipFilter;
  return OWNERSHIP_LABELS[role] ?? "Coördinatie";
}

function matchesIssueFilter(item: CoordinationDecisionOverviewItem, filter: IssueFilter) {
  if (filter === "all") {
    return true;
  }
  return (item.issue_tags ?? []).includes(filter);
}

function matchesOwnershipFilter(item: CoordinationDecisionOverviewItem, filter: OwnershipFilter) {
  if (filter === "all") {
    return true;
  }
  const role = (item.responsible_role ?? "coordinatie") as OwnershipFilter;
  return role === filter;
}

/** UI-only Coordination modes — computed via `computeCoordinationNextBestAction` (deterministic). */
export type CoordinationUiMode = CoordinationNbaUiMode;

function searchText(item: CoordinationDecisionOverviewItem) {
  return [
    item.case_reference,
    item.title,
    item.current_state,
    item.phase,
    item.assigned_provider,
    item.zorgbehoefte_categorie,
    item.zorgbehoefte_categorie_code,
    item.zorgbehoefte_specifiek,
    item.zorgbehoefte_specifiek_code,
    item.taxonomie_lijn,
    item.taxonomie_code_lijn,
    item.next_best_action?.label,
    item.next_best_action?.reason,
    item.top_blocker?.message,
    item.top_risk?.message,
    item.top_alert?.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function collectTaxonomyCategoryOptions(items: CoordinationDecisionOverviewItem[]) {
  const map = new Map<string, string>();
  for (const item of items) {
    const code = (item.zorgbehoefte_categorie_code ?? "").trim();
    const label = (item.zorgbehoefte_categorie ?? "").trim();
    if (!code || !label) {
      continue;
    }
    if (!map.has(code)) {
      map.set(code, label);
    }
  }
  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, "nl"));
}

function collectTaxonomySubcategoryOptions(items: CoordinationDecisionOverviewItem[], categoryFilter: TaxonomyFilter) {
  const map = new Map<string, string>();
  for (const item of items) {
    const categoryCode = (item.zorgbehoefte_categorie_code ?? "").trim();
    const code = (item.zorgbehoefte_specifiek_code ?? "").trim();
    const label = (item.zorgbehoefte_specifiek ?? "").trim();
    if (!code || !label) {
      continue;
    }
    if (categoryFilter !== "all" && categoryCode !== categoryFilter) {
      continue;
    }
    if (!map.has(code)) {
      map.set(code, label);
    }
  }
  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, "nl"));
}

function buildTaxonomySummaryLabel(item: CoordinationDecisionOverviewItem): string {
  const category = (item.zorgbehoefte_categorie ?? "").trim();
  const specific = (item.zorgbehoefte_specifiek ?? "").trim();
  if (category && specific) {
    return `${category} · ${specific}`;
  }
  return category || specific || "";
}

type RegiekamerFlowStepId =
  | "aanmelding"
  | "matching"
  | "aanbiederreactie"
  | "plaatsing"
  | "intake";

const REGIEKAMER_FLOW_STEPS: Array<{
  id: RegiekamerFlowStepId;
  label: string;
  subtitle: string;
}> = [
  { id: "aanmelding", label: "Aanmelding", subtitle: "Wacht op aanmelder" },
  { id: "matching", label: "Matching", subtitle: "Klaar om te starten" },
  { id: "aanbiederreactie", label: "Aanbiederreactie", subtitle: "Wacht op reactie" },
  { id: "plaatsing", label: "Plaatsing", subtitle: "Klaar voor plaatsing" },
  { id: "intake", label: "Intake", subtitle: "Intake gepland" },
];

function normalizeInspectableItem(item: CoordinationDecisionOverviewItem): Record<string, unknown> {
  return item as unknown as Record<string, unknown>;
}

function pickItemString(item: CoordinationDecisionOverviewItem, keys: string[]): string {
  const source = normalizeInspectableItem(item);
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
  }
  return "";
}

function pickItemDate(item: CoordinationDecisionOverviewItem): Date | null {
  const source = normalizeInspectableItem(item);
  const candidates = [
    source.updated_at,
    source.updatedAt,
    source.last_action_at,
    source.lastActionAt,
    source.last_activity_at,
    source.lastActivityAt,
    source.case_updated_at,
    source.caseUpdatedAt,
    source.generated_at,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) {
      continue;
    }
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

function formatRegiekamerDate(date: Date | null): string {
  if (!date) {
    return "Geen recente activiteit";
  }
  const datePart = new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${datePart}, ${timePart}`;
}

function formatRegiekamerRelativeTime(hours: number | null): string {
  if (hours === null || Number.isNaN(hours)) {
    return "Geen recente activiteit";
  }
  if (hours < 24) {
    return `${Math.max(1, Math.round(hours))} uur geleden`;
  }
  const days = Math.max(1, Math.round(hours / 24));
  return `${days} dag${days === 1 ? "" : "en"} geleden`;
}

function phaseMatchesFlowStep(item: CoordinationDecisionOverviewItem, stepId: RegiekamerFlowStepId): boolean {
  const phase = normalizeApiPhaseId(item.phase);
  switch (stepId) {
    case "aanmelding":
      return phase === "casus" || phase === "samenvatting";
    case "matching":
      return phase === "matching" || phase === "gemeente_validatie" || phase === "wacht_op_validatie";
    case "aanbiederreactie":
      return phase === "aanbieder_beoordeling";
    case "plaatsing":
      return phase === "plaatsing";
    case "intake":
      return phase === "intake";
  }
}

function priorityDotLabel(item: CoordinationDecisionOverviewItem): string {
  if (item.priority_score >= 100 || item.urgency === "critical") {
    return "Spoed";
  }
  if (item.priority_score >= 70 || item.urgency === "high") {
    return "Hoog";
  }
  if (item.priority_score >= 30 || item.urgency === "medium") {
    return "Normaal";
  }
  return "Laag";
}

function rowStatusLabel(item: CoordinationDecisionOverviewItem): string {
  const actionCode = (item.next_best_action?.action ?? "").toUpperCase();
  const phase = normalizeApiPhaseId(item.phase);
  if (
    phase === "casus" ||
    phase === "samenvatting" ||
    actionCode === "COMPLETE_CASE_DATA" ||
    actionCode === "GENERATE_SUMMARY" ||
    actionCode === "VIEW_SUMMARY"
  ) {
    return "Wacht op aanmelder";
  }
  if (phase === "matching" || phase === "gemeente_validatie" || actionCode === "START_MATCHING" || actionCode === "VALIDATE_MATCHING") {
    return "Wacht op gemeente";
  }
  if (phase === "aanbieder_beoordeling" || actionCode === "SEND_TO_PROVIDER" || actionCode === "WAIT_PROVIDER_RESPONSE" || actionCode === "FOLLOW_UP_PROVIDER") {
    return "Wacht op reactie";
  }
  if (phase === "plaatsing") {
    return "Plaatsing";
  }
  if (phase === "intake") {
    return "Intake";
  }
  return "In behandeling";
}

function rowStatusReason(item: CoordinationDecisionOverviewItem): string {
  const actionCode = (item.next_best_action?.action ?? "").toUpperCase();
  if (
    item.top_blocker?.code === "GEMEENTE_VALIDATION_REQUIRED" ||
    actionCode === "VALIDATE_MATCHING"
  ) {
    return "Goedkeuring nodig vóór versturen naar aanbieder.";
  }
  return (
    item.next_best_action?.reason?.trim() ||
    item.top_blocker?.message?.trim() ||
    item.top_alert?.message?.trim() ||
    item.top_risk?.message?.trim() ||
    "Aanvullende informatie nodig"
  );
}

function rowNextActionLabel(item: CoordinationDecisionOverviewItem): string {
  const actionCode = (item.next_best_action?.action ?? "").toUpperCase();
  switch (actionCode) {
    case "COMPLETE_CASE_DATA":
    case "GENERATE_SUMMARY":
      return "Maak casus compleet";
    case "START_MATCHING":
      return "Start matching";
    case "VALIDATE_MATCHING":
      return "Controleer voorstel";
    case "SEND_TO_PROVIDER":
      return "Vraag reactie aan";
    case "WAIT_PROVIDER_RESPONSE":
      return "Wacht op reactie";
    case "FOLLOW_UP_PROVIDER":
      return "Herinner aanbieder";
    case "CONFIRM_PLACEMENT":
      return "Bevestig plaatsing";
    case "START_INTAKE":
      return "Plan intake";
    default:
      break;
  }
  const actionLabel = imperativeLabelForActionCode(
    item.next_best_action?.action ?? "",
    item.next_best_action?.label ?? undefined,
  );
  return actionLabel?.trim() || item.next_best_action?.label?.trim() || "Bekijk casus";
}

function rowRegionLabel(item: CoordinationDecisionOverviewItem): string {
  return (
    pickItemString(item, [
      "region",
      "regio",
      "region_label",
      "regionLabel",
      "region_name",
      "regionName",
      "municipality",
      "municipality_label",
      "municipalityLabel",
      "municipality_name",
      "municipalityName",
    ]) || "Regio ontbreekt"
  );
}

function rowLastActionLabel(item: CoordinationDecisionOverviewItem): string {
  return formatRegiekamerRelativeTime(item.hours_in_current_state ?? item.age_hours ?? null);
}

function rowLastActionDateLabel(item: CoordinationDecisionOverviewItem): string {
  return formatRegiekamerDate(pickItemDate(item));
}

function buildRegiekamerFlowCounts(items: CoordinationDecisionOverviewItem[]): Record<RegiekamerFlowStepId, number> {
  const counts: Record<RegiekamerFlowStepId, number> = {
    aanmelding: 0,
    matching: 0,
    aanbiederreactie: 0,
    plaatsing: 0,
    intake: 0,
  };
  for (const item of items) {
    for (const step of REGIEKAMER_FLOW_STEPS) {
      if (phaseMatchesFlowStep(item, step.id)) {
        counts[step.id] += 1;
      }
    }
  }
  return counts;
}

function regiekamerFlowStepIcon(stepId: RegiekamerFlowStepId) {
  switch (stepId) {
    case "aanmelding":
      return FolderOpen;
    case "matching":
      return Users;
    case "aanbiederreactie":
      return UserCheck;
    case "plaatsing":
      return Home;
    case "intake":
      return Clock3;
  }
}

type RegiekamerPhaseTab = "alle" | RegiekamerFlowStepId | "hoog-urgent";

function getPriorityDotClass(item: CoordinationDecisionOverviewItem): string {
  if (item.priority_score >= 100 || item.urgency === "critical") return "bg-red-500";
  if (item.priority_score >= 70 || item.urgency === "high") return "bg-orange-400";
  if (item.priority_score >= 30) return "bg-yellow-300";
  return "bg-muted-foreground/40";
}

function getPhaseStyleInfo(phase: string): { label: string; className: string } {
  const normalized = normalizeApiPhaseId(phase) as string;
  const map: Record<string, { label: string; className: string }> = {
    casus: { label: "Aanmelding", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400" },
    samenvatting: { label: "Aanmelding", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400" },
    matching: { label: "Matching", className: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400" },
    gemeente_validatie: { label: "Matching", className: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400" },
    wacht_op_validatie: { label: "Matching", className: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400" },
    aanbieder_beoordeling: { label: "Aanbiederreactie", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
    plaatsing: { label: "Plaatsing", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
    intake: { label: "Intake", className: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400" },
  };
  return map[normalized] ?? {
    label: normalized.charAt(0).toUpperCase() + normalized.slice(1),
    className: "bg-muted text-muted-foreground dark:bg-muted/40 dark:text-muted-foreground",
  };
}

/**
 * SLA-grenzen per fase — spiegelt DECISION_ENGINE_THRESHOLDS in
 * contracts/decision_engine.py, zodat de UI-aftelling en de backend-breach
 * exact dezelfde grenzen hanteren.
 */
const SLA_TARGET_HOURS = {
  aanmelding: 24, // aanmelding_sla_hours — Aanmelding (casus + samenvatting)
  urgentIdle: 48, // urgent_idle_hours — HIGH/CRISIS in elke fase
  providerResponse: 72, // provider_response_sla_hours — Aanbiederreactie
  intakeStart: 120, // intake_start_sla_days (5d) — Plaatsing/Intake
} as const;

type SlaStatus = "breached" | "soon" | "ok" | "none";

const SLA_STATUS_RANK: Record<SlaStatus, number> = { breached: 0, soon: 1, ok: 2, none: 3 };

function getSlaTarget(item: CoordinationDecisionOverviewItem): { hours: number; basis: string } | null {
  const isUrgent = item.urgency === "high" || item.urgency === "critical";
  const phaseLabel = getPhaseStyleInfo(item.phase).label;
  const candidates: Array<{ hours: number; basis: string }> = [];
  if (isUrgent) candidates.push({ hours: SLA_TARGET_HOURS.urgentIdle, basis: "Urgentie" });
  if (phaseLabel === "Aanmelding") candidates.push({ hours: SLA_TARGET_HOURS.aanmelding, basis: "Aanmelding" });
  if (phaseLabel === "Aanbiederreactie") candidates.push({ hours: SLA_TARGET_HOURS.providerResponse, basis: "Aanbiederreactie" });
  if (phaseLabel === "Plaatsing" || phaseLabel === "Intake") candidates.push({ hours: SLA_TARGET_HOURS.intakeStart, basis: "Intake-start" });
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a.hours <= b.hours ? a : b));
}

function formatDurationShort(hours: number): string {
  const h = Math.abs(hours);
  if (h < 1) return "<1u";
  if (h < 24) return `${Math.round(h)}u`;
  const days = Math.floor(h / 24);
  const rem = Math.round(h % 24);
  if (days >= 3 || rem === 0) return `${days}d`;
  return `${days}d ${rem}u`;
}

interface SlaCountdown {
  hasSla: boolean;
  status: SlaStatus;
  remainingHours: number;
  label: string;
  sublabel: string;
  className: string;
}

function getSlaCountdown(item: CoordinationDecisionOverviewItem): SlaCountdown {
  const elapsed = item.hours_in_current_state ?? item.age_hours ?? 0;
  const phaseLabel = getPhaseStyleInfo(item.phase).label;
  const target = getSlaTarget(item);

  if (!target) {
    return {
      hasSla: false,
      status: "none",
      remainingHours: Number.POSITIVE_INFINITY,
      label: formatDurationShort(elapsed),
      sublabel: `in ${phaseLabel}`,
      className: "text-muted-foreground",
    };
  }

  const remaining = target.hours - elapsed;
  const soonThreshold = Math.max(8, target.hours * 0.2);

  if (remaining <= 0) {
    return {
      hasSla: true,
      status: "breached",
      remainingHours: remaining,
      label: `${formatDurationShort(remaining)} te laat`,
      sublabel: `SLA ${target.hours}u`,
      className: "font-semibold text-red-600 dark:text-red-400",
    };
  }
  if (remaining <= soonThreshold) {
    return {
      hasSla: true,
      status: "soon",
      remainingHours: remaining,
      label: `nog ${formatDurationShort(remaining)}`,
      sublabel: `SLA ${target.hours}u`,
      className: "font-medium text-orange-500 dark:text-orange-400",
    };
  }
  return {
    hasSla: true,
    status: "ok",
    remainingHours: remaining,
    label: `nog ${formatDurationShort(remaining)}`,
    sublabel: `SLA ${target.hours}u`,
    className: "text-emerald-600 dark:text-emerald-400",
  };
}

function formatOwnerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0] ?? fullName;
  const first = parts[0] ?? "";
  const lastInitial = parts[parts.length - 1]?.[0] ?? "";
  return `${first} ${lastInitial}.`;
}

function RegiekamerWorkRow({
  item,
  isSelected,
  currentUserName,
  onSelect,
  onCaseClick,
}: {
  item: CoordinationDecisionOverviewItem;
  isSelected: boolean;
  currentUserName: string;
  onSelect: (id: string) => void;
  onCaseClick: (id: string) => void;
}) {
  const rowId = String(item.case_id);
  const phaseInfo = getPhaseStyleInfo(item.phase);
  const sla = getSlaCountdown(item);
  const dotClass = getPriorityDotClass(item);
  const actionLabel = rowNextActionLabel(item);
  const blokkadeTitle = item.top_blocker?.title || item.top_alert?.title || null;
  const blokkadeMsg = item.top_blocker?.message || item.top_alert?.message || null;
  const hasBlocker = !!(blokkadeTitle || blokkadeMsg);
  const ownerDisplay = formatOwnerName(currentUserName);

  return (
    <div
      data-care-work-row
      data-testid="coordination-worklist-item"
      role="listitem"
      className={cn(
        "group relative grid cursor-pointer items-start border-b border-border/25",
        "min-w-[860px] grid-cols-[1.75rem_minmax(13rem,2fr)_minmax(11rem,1.6fr)_9rem_minmax(8rem,1fr)_minmax(10rem,1.1fr)]",
        "gap-x-4 px-6 py-3.5 transition-colors",
        isSelected ? "bg-violet-50/60 dark:bg-primary/8" : "hover:bg-muted/10",
      )}
    >
      {/* Stretched primary action — selects/opens the row. Keyboard-accessible native
          button; kept a sibling (not parent) of the action button to avoid nested interactives. */}
      <button
        type="button"
        aria-pressed={isSelected}
        aria-label={`Open casus ${item.case_reference}: ${item.title}`}
        onClick={() => onSelect(rowId)}
        className="absolute inset-0 z-0 cursor-pointer rounded-none border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
      />
      {/* Priority dot */}
      <div className="flex pt-1 items-center justify-center">
        <span className={cn("size-2 rounded-full shrink-0", dotClass)} aria-hidden />
      </div>

      {/* Casus: fase badge + ref + name */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold shrink-0", phaseInfo.className)}>
            {phaseInfo.label}
          </span>
          <span className="font-mono text-[12px] font-semibold tracking-tight text-muted-foreground">
            {item.case_reference}
          </span>
          {item.urgency_applied && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 shrink-0">
              Urgentie
            </span>
          )}
        </div>
        <span className="mt-1 block text-[13px] font-medium leading-snug text-foreground line-clamp-2">
          {item.title}
        </span>
      </div>

      {/* Blokkade — prominent, readable */}
      <div className="min-w-0">
        {hasBlocker ? (
          <div className="flex items-start gap-1.5">
            <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-500 dark:text-red-400" aria-hidden />
            <div className="min-w-0">
              {blokkadeTitle && (
                <p className="text-[12px] font-semibold leading-snug text-red-700 dark:text-red-400 line-clamp-1">{blokkadeTitle}</p>
              )}
              {blokkadeMsg && (
                <p className="mt-0.5 text-[12px] leading-snug text-red-600/80 dark:text-red-400/70 line-clamp-2">{blokkadeMsg}</p>
              )}
            </div>
          </div>
        ) : (
          <span className="text-[12px] text-muted-foreground/50 italic">Geen blokkade</span>
        )}
      </div>

      {/* Eigenaar — readable name */}
      <div className="flex items-start gap-2 pt-0.5">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
          {currentUserName.charAt(0).toUpperCase()}
        </span>
        <span className="text-[12px] leading-snug text-foreground/80 pt-0.5">{ownerDisplay}</span>
      </div>

      {/* Wachttijd — SLA-aftelling: time-to-breach, niet verstreken tijd */}
      <div className="pt-0.5">
        <p className={cn("flex items-center gap-1 text-[13px] font-medium tabular-nums leading-snug", sla.className)}>
          {sla.status === "breached" && <AlertCircle size={12} className="shrink-0" aria-hidden />}
          {sla.label}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/60">{sla.sublabel}</p>
      </div>

      {/* Volgende actie — always visible. relative/z-10 keeps it clickable above the stretched select button. */}
      <div className="relative z-10 flex items-start pt-0.5">
        <button
          type="button"
          aria-label={actionLabel}
          className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-white dark:bg-muted/10 px-3 py-1.5 text-[12px] font-semibold text-foreground shadow-sm hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:hover:text-primary transition-colors"
          onClick={(e) => { e.stopPropagation(); onCaseClick(rowId); }}
        >
          {actionLabel}
          <ChevronRight size={12} className="shrink-0 opacity-60" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function CasusdetailsPanel({
  item,
  currentUserName,
  onClose,
  onCaseClick,
}: {
  item: CoordinationDecisionOverviewItem;
  currentUserName: string;
  onClose: () => void;
  onCaseClick: (id: string) => void;
}) {
  const [activeDetailTab, setActiveDetailTab] = useState<"overzicht" | "documenten" | "tijdlijn" | "taken" | "contactmomenten">("overzicht");
  const phaseInfo = getPhaseStyleInfo(item.phase);
  const sla = getSlaCountdown(item);
  const isHoog = item.priority_score >= 70 || item.urgency === "high" || item.urgency === "critical";
  const blokkadeTitle = item.top_blocker?.title || item.top_alert?.title || null;
  const blokkadeMsg = item.top_blocker?.message || item.top_alert?.message || null;
  const ctaLabel = rowNextActionLabel(item);
  const region = rowRegionLabel(item);
  const regionDisplay = region === "Regio ontbreekt" ? null : region;
  const provider = (item.assigned_provider ?? "").trim() || "Niet toegewezen";
  const currentPhaseIdx = REGIEKAMER_FLOW_STEPS.findIndex((s) => phaseMatchesFlowStep(item, s.id));

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 flex w-[380px] flex-col border-l border-border/60 bg-white dark:bg-card"
      style={{ boxShadow: "-4px 0 24px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={cn("shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold", phaseInfo.className)}>
            {phaseInfo.label}
          </span>
          <span className="truncate font-mono text-[13px] font-semibold tracking-tight text-foreground">
            {item.case_reference}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Paneel sluiten"
          className="ml-2 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border/40 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="care-text-heading text-foreground">{item.title}</h2>
              {regionDisplay && <p className="mt-0.5 text-[12px] text-muted-foreground">{regionDisplay}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors">
                <Phone size={14} />
              </button>
              <button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors">
                <Mail size={14} />
              </button>
              <button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors">
                <MoreHorizontal size={14} />
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", isHoog ? "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400" : "bg-muted text-muted-foreground dark:bg-muted/40 dark:text-muted-foreground")}>
              {isHoog ? "Hoog" : "Normaal"}
            </span>
            <span className={cn("inline-flex items-center rounded-full bg-muted/40 px-2.5 py-0.5 text-[11px] font-semibold", sla.className)}>
              {sla.label}
            </span>
          </div>
        </div>

        {blokkadeTitle && (
          <div className="border-b border-border/40 px-5 py-3.5">
            <button
              type="button"
              className="flex w-full items-start gap-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-3.5 py-3 text-left transition-colors hover:bg-red-100/60 dark:hover:bg-red-950/30"
              onClick={() => onCaseClick(String(item.case_id))}
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-red-800 dark:text-red-400">{blokkadeTitle}</p>
                {blokkadeMsg && <p className="mt-0.5 line-clamp-2 text-[12px] text-red-600/80 dark:text-red-400/80">{blokkadeMsg}</p>}
              </div>
              <ChevronRight size={14} className="mt-0.5 shrink-0 text-red-400" aria-hidden />
            </button>
          </div>
        )}

        <div className="border-b border-border/40 px-5 py-4">
          <p className="mb-3 care-text-eyebrow text-muted-foreground/60">Casusinfo</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <dt className="text-[11px] text-muted-foreground">Fase</dt>
              <dd className="mt-0.5">
                <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold", phaseInfo.className)}>{phaseInfo.label}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Urgentie</dt>
              <dd className="mt-0.5 text-[13px] font-medium text-foreground">{isHoog ? "Hoog" : "Normaal"}</dd>
            </div>
            {regionDisplay && (
              <div>
                <dt className="text-[11px] text-muted-foreground">Gemeente</dt>
                <dd className="mt-0.5 text-[13px] text-foreground">{regionDisplay}</dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] text-muted-foreground">Aanbieder</dt>
              <dd className={cn("mt-0.5 text-[13px]", provider === "Niet toegewezen" ? "text-muted-foreground/60" : "text-foreground")}>{provider}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Eigenaar</dt>
              <dd className="mt-0.5 flex items-center gap-1.5">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {currentUserName.charAt(0).toUpperCase()}
                </span>
                <span className="text-[13px] text-foreground">{currentUserName}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">SLA</dt>
              <dd className={cn("mt-0.5 text-[13px]", sla.className)}>{sla.label}</dd>
            </div>
          </dl>
        </div>

        <div className="flex overflow-x-auto border-b border-border/40 px-5">
          {(
            [
              { id: "overzicht" as const, label: "Overzicht" },
              { id: "documenten" as const, label: "Documenten", count: 3 },
              { id: "tijdlijn" as const, label: "Tijdlijn" },
              { id: "taken" as const, label: "Taken", count: 2 },
              { id: "contactmomenten" as const, label: "Contactmomenten" },
            ]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveDetailTab(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-1 border-b-2 px-3 py-2.5 text-[12px] font-medium whitespace-nowrap transition-colors",
                activeDetailTab === tab.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn("rounded-full px-1.5 text-[10px] font-bold", activeDetailTab === tab.id ? "bg-foreground/10 text-foreground" : "bg-muted/40 text-muted-foreground")}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="border-b border-border/40 px-5 py-4">
          <p className="mb-3 care-text-eyebrow text-muted-foreground/60">Doorstroom</p>
          <div className="relative flex justify-between">
            <div className="absolute inset-x-3 top-[11px] h-px bg-border/40" aria-hidden />
            {REGIEKAMER_FLOW_STEPS.map((step, idx) => {
              const Icon = regiekamerFlowStepIcon(step.id);
              const isActive = idx === currentPhaseIdx || (currentPhaseIdx < 0 && idx === 0);
              const isDone = idx < (currentPhaseIdx >= 0 ? currentPhaseIdx : 0);
              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center gap-1.5">
                  <div className={cn("flex size-[22px] items-center justify-center rounded-full border-2 transition-colors", isActive ? "border-primary bg-primary text-white shadow-sm shadow-primary/30" : isDone ? "border-primary/40 bg-primary/10 text-primary/80" : "border-border/50 bg-white dark:bg-card text-muted-foreground")}>
                    <Icon size={11} className="text-current" />
                  </div>
                  <span className={cn("max-w-[3.5rem] text-center text-[10px] leading-tight", isActive ? "font-semibold text-primary" : isDone ? "text-primary/60 dark:text-primary/50" : "text-muted-foreground/50")}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="mb-3 care-text-eyebrow text-muted-foreground/60">Actiepunten</p>
          <div className="space-y-3">
            {[
              { label: blokkadeTitle ? `Los op: ${blokkadeTitle}` : "Controleer en upload geldige verwijzing", due: "Vandaag", urgent: true },
              { label: "Vraag aanvullende informatie op bij verwijzer", due: "Binnen 2 dagen", urgent: false },
            ].map((action, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <div className="mt-0.5 size-4 shrink-0 rounded border-2 border-border/60 cursor-pointer hover:border-primary transition-colors" />
                <p className="flex-1 text-[13px] text-foreground">{action.label}</p>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", action.urgent ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400")}>
                  {action.due}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border/40 p-5">
        <Button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-xl py-2.5 text-[13px] font-semibold"
          onClick={() => onCaseClick(String(item.case_id))}
        >
          <span>{ctaLabel}</span>
          <ChevronRight size={16} aria-hidden />
        </Button>
        <button
          type="button"
          className="mt-3 w-full text-center text-[12px] text-muted-foreground hover:text-primary dark:hover:text-primary transition-colors"
          onClick={() => onCaseClick(String(item.case_id))}
        >
          Bekijk alle taken en details →
        </button>
      </div>
    </aside>
  );
}

export function SystemAwarenessPage({
  onCaseClick,
  onAppNavigate,
  canCreateCase = false,
  onCreateCase,
}: SystemAwarenessPageProps) {
  const { data, loading, error, refetch } = useCoordinationDecisionOverview();
  const { me } = useCurrentUser();
  const initialFromUrl = readFiltersFromUrl();
  const [searchQuery, setSearchQuery] = useState(initialFromUrl.searchQuery);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(initialFromUrl.priorityFilter);
  const [issueFilter, setIssueFilter] = useState<IssueFilter>(initialFromUrl.issueFilter);
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>(initialFromUrl.phaseFilter);
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>(initialFromUrl.ownershipFilter);
  const [categoryFilter, setCategoryFilter] = useState<TaxonomyFilter>(initialFromUrl.categoryFilter);
  const [subcategoryFilter, setSubcategoryFilter] = useState<TaxonomyFilter>(initialFromUrl.subcategoryFilter);
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const [railSheetOpen, setRailSheetOpen] = useState(false);
  const { collapsed: railCollapsed, toggle: toggleRail, setCollapsed: setRailCollapsed } = useRailCollapsed();
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RegiekamerPhaseTab>("alle");
  const [showFiltersBar, setShowFiltersBar] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isCoordinationPath(window.location.pathname)) {
      return;
    }
    const next = buildCoordinationUrl({
      searchQuery,
      priorityFilter,
      issueFilter,
      phaseFilter,
      ownershipFilter,
      categoryFilter,
      subcategoryFilter,
    });
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === next) {
      return;
    }
    window.history.replaceState(window.history.state, "", next);
  }, [searchQuery, priorityFilter, issueFilter, phaseFilter, ownershipFilter, categoryFilter, subcategoryFilter]);

  useEffect(() => {
    const onPop = () => {
      if (!isCoordinationPath(window.location.pathname)) {
        return;
      }
      const parsed = filtersFromSearchString(window.location.search);
      setSearchQuery(parsed.searchQuery);
      setPriorityFilter(parsed.priorityFilter);
      setIssueFilter(parsed.issueFilter);
      setPhaseFilter(parsed.phaseFilter);
      setOwnershipFilter(parsed.ownershipFilter);
      setCategoryFilter(parsed.categoryFilter);
      setSubcategoryFilter(parsed.subcategoryFilter);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const applyListFilterSnapshot = useCallback(
    (snapshot: CoordinationListFilter) => {
      setSearchQuery("");
      setPriorityFilter((snapshot.priority === "all" ? "all" : snapshot.priority) as PriorityFilter);
      setIssueFilter(snapshot.issue as IssueFilter);
      setPhaseFilter(snapshot.phase as PhaseFilter);
      setOwnershipFilter("all");
      setCategoryFilter("all");
      setSubcategoryFilter("all");
    },
    [],
  );

  const applyPhaseBoardFilter = useCallback(
    (phase: CoordinationFlowPhase) => {
      applyListFilterSnapshot({ issue: "all", phase, priority: "all" });
      if (typeof window !== "undefined" && isCoordinationPath(window.location.pathname)) {
        const next = buildCoordinationUrl({
          searchQuery: "",
          priorityFilter: "all",
          issueFilter: "all",
          phaseFilter: phase as PhaseFilter,
          ownershipFilter: "all",
          categoryFilter: "all",
          subcategoryFilter: "all",
        });
        window.history.pushState(window.history.state, "", next);
      }
    },
    [applyListFilterSnapshot],
  );

  const visibleItems = useMemo(() => {
    const items = data?.items ?? [];
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return items
      .filter((item) => {
        if (normalizedQuery && !searchText(item).includes(normalizedQuery)) {
          return false;
        }
        if (priorityFilter !== "all" && priorityBand(item.priority_score) !== priorityFilter) {
          return false;
        }
        if (!itemMatchesPhaseFilter(item.phase, phaseFilter)) {
          return false;
        }
        if (!matchesIssueFilter(item, issueFilter)) {
          return false;
        }
        if (!matchesOwnershipFilter(item, ownershipFilter)) {
          return false;
        }
        if (categoryFilter !== "all" && (item.zorgbehoefte_categorie_code ?? "") !== categoryFilter) {
          return false;
        }
        if (subcategoryFilter !== "all" && (item.zorgbehoefte_specifiek_code ?? "") !== subcategoryFilter) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        const priorityDelta = right.priority_score - left.priority_score;
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        const rightHours = right.hours_in_current_state ?? 0;
        const leftHours = left.hours_in_current_state ?? 0;
        return rightHours - leftHours;
      });
  }, [data?.items, issueFilter, ownershipFilter, phaseFilter, priorityFilter, searchQuery, categoryFilter, subcategoryFilter]);

  const lastUpdateLabel = useMemo(() => {
    if (!data?.generated_at) {
      return "";
    }

    const date = new Date(data.generated_at);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate()
      && date.getMonth() === now.getMonth()
      && date.getFullYear() === now.getFullYear();
    const timePart = new Intl.DateTimeFormat("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
    if (isToday) {
      return `Laatste update: vandaag ${timePart}`;
    }
    const datePart = new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
    return `Laatste update: ${datePart} ${timePart}`;
  }, [data?.generated_at]);

  const avgDoorloopDays = useMemo(() => {
    const items = data?.items ?? [];
    if (items.length === 0) {
      return 0;
    }
    const sumHours = items.reduce((acc, row) => acc + (row.age_hours ?? 0), 0);
    return Math.max(1, Math.round(sumHours / items.length / 24));
  }, [data?.items]);

  const slaRiskTotal = useMemo(() => {
    const t = data?.totals;
    if (!t) {
      return 0;
    }
    return Math.max(0, (t.provider_sla_breaches ?? 0) + (t.high_priority_alerts ?? 0));
  }, [data?.totals]);

  const gemeenteDisplayName = me?.organization?.name?.trim() || "Gemeente";

  const applyCriticalDrillFilter = useCallback(() => {
    setPriorityFilter("critical");
    setIssueFilter("blockers");
    setPhaseFilter("all");
    setOwnershipFilter("all");
    setCategoryFilter("all");
    setSubcategoryFilter("all");
    setSearchQuery("");
    if (typeof window !== "undefined" && isCoordinationPath(window.location.pathname)) {
      const next = buildCoordinationUrl({
        searchQuery: "",
        priorityFilter: "critical",
        issueFilter: "blockers",
        phaseFilter: "all",
        ownershipFilter: "all",
        categoryFilter: "all",
        subcategoryFilter: "all",
      });
      window.history.pushState(window.history.state, "", next);
    }
  }, []);

  const hasActiveData = (data?.totals.active_cases ?? 0) > 0;
  const filtersActive =
    searchQuery.trim() !== "" ||
    priorityFilter !== "all" ||
    issueFilter !== "all" ||
    phaseFilter !== "all" ||
    ownershipFilter !== "all" ||
    categoryFilter !== "all" ||
    subcategoryFilter !== "all";

  const coordinationListItems = useMemo(() => {
    if (filtersActive) {
      return visibleItems;
    }
    const attention = visibleItems.filter(itemNeedsCoordinationAttention);
    const base = attention.length > 0 ? attention : visibleItems;
    return base.slice(0, REGIEKAMER_COORDINATION_LIST_CAP);
  }, [visibleItems, filtersActive]);

  const coordinationListCapped = !filtersActive && visibleItems.length > coordinationListItems.length;

  const currentUserDisplayName = me?.fullName?.trim() || me?.username || "Regisseur";
  const phaseTabCounts = useMemo<Record<RegiekamerPhaseTab, number>>(() => ({
    alle: coordinationListItems.length,
    aanmelding: coordinationListItems.filter((i) => phaseMatchesFlowStep(i, "aanmelding")).length,
    matching: coordinationListItems.filter((i) => phaseMatchesFlowStep(i, "matching")).length,
    aanbiederreactie: coordinationListItems.filter((i) => phaseMatchesFlowStep(i, "aanbiederreactie")).length,
    plaatsing: coordinationListItems.filter((i) => phaseMatchesFlowStep(i, "plaatsing")).length,
    intake: coordinationListItems.filter((i) => phaseMatchesFlowStep(i, "intake")).length,
    "hoog-urgent": coordinationListItems.filter((i) => i.priority_score >= 70 || i.urgency === "high" || i.urgency === "critical").length,
  }), [coordinationListItems]);
  const tabFilteredItems = useMemo(() => {
    const base =
      activeTab === "alle"
        ? coordinationListItems
        : activeTab === "hoog-urgent"
          ? coordinationListItems.filter((i) => i.priority_score >= 70 || i.urgency === "high" || i.urgency === "critical")
          : coordinationListItems.filter((i) => phaseMatchesFlowStep(i, activeTab as RegiekamerFlowStepId));
    // Self-sorterende worklist: SLA-breaches en bijna-breaches bovenaan.
    return [...base].sort((a, b) => {
      const sa = getSlaCountdown(a);
      const sb = getSlaCountdown(b);
      const rankDelta = SLA_STATUS_RANK[sa.status] - SLA_STATUS_RANK[sb.status];
      if (rankDelta !== 0) return rankDelta;
      if (sa.remainingHours !== sb.remainingHours) return sa.remainingHours - sb.remainingHours;
      return b.priority_score - a.priority_score;
    });
  }, [coordinationListItems, activeTab]);
  const selectedItem = useMemo(
    () => tabFilteredItems.find((i) => String(i.case_id) === selectedCaseId) ?? null,
    [tabFilteredItems, selectedCaseId],
  );

  const criticalBlockers = data?.totals.critical_blockers ?? 0;
  const highPriorityAlerts = data?.totals.high_priority_alerts ?? 0;
  const providerSlaBreaches = data?.totals.provider_sla_breaches ?? 0;
  const intakeDelaysTotal = data?.totals.intake_delays ?? 0;
  const urgencyApplicationsOpen = data?.totals.urgency_applications_open ?? 0;

  const allOverviewItems = data?.items ?? [];
  const directActieCount = useMemo(() => allOverviewItems.filter((i) => i.priority_score >= 100 || i.urgency === "critical").length, [allOverviewItems]);
  const blockedCount = useMemo(() => allOverviewItems.filter((i) => !!(i.top_blocker?.title || i.top_blocker?.message || i.top_alert?.message)).length, [allOverviewItems]);
  const taxonomyCategoryOptions = useMemo(() => collectTaxonomyCategoryOptions(allOverviewItems), [allOverviewItems]);
  const taxonomySubcategoryOptions = useMemo(
    () => collectTaxonomySubcategoryOptions(allOverviewItems, categoryFilter),
    [allOverviewItems, categoryFilter],
  );
  useEffect(() => {
    if (subcategoryFilter === "all") {
      return;
    }
    const allowed = taxonomySubcategoryOptions.some((option) => option.value === subcategoryFilter);
    if (!allowed) {
      setSubcategoryFilter("all");
    }
  }, [subcategoryFilter, taxonomySubcategoryOptions]);
  const noMatchUrgentCount = useMemo(
    () =>
      allOverviewItems.filter(
        i =>
          i.phase === "matching"
          && (i.urgency === "critical" || i.urgency === "warning" || i.urgency === "high"),
      ).length,
    [allOverviewItems],
  );
  const phaseBoardColumns = useMemo(() => derivePhaseBoard(allOverviewItems, 3), [allOverviewItems]);
  const dominantPhaseColumn = useMemo(() => getDominantPhaseColumn(phaseBoardColumns), [phaseBoardColumns]);
  const activeFlowIndex = useMemo(() => {
    if (!dominantPhaseColumn) return 0;
    const idx = phaseBoardColumns.findIndex((col) => col.phase === dominantPhaseColumn.phase);
    return idx >= 0 ? idx : 0;
  }, [dominantPhaseColumn, phaseBoardColumns]);

  const governanceQueuesStrip = useMemo(() => {
    if (loading || error || !hasActiveData || !data?.governance_queues) {
      return null;
    }
    const q = data.governance_queues;
    const segments: { key: string; label: string; help: string; ids: string[] }[] = [
      {
        key: "wijkteam",
        label: "Wijkteam-intake",
        help: "Aanvragen via wijkteam die nog intake of beoordeling nodig hebben.",
        ids: q.wijkteam_intakes_needing_assessment,
      },
      {
        key: "zorgvraag",
        label: "Zorgvraagbeoordeling",
        help: "Aanvragen in zorgvraagbeoordeling vóór matching.",
        ids: q.zorgvraag_beoordeling_open,
      },
      {
        key: "gemeente",
        label: "Goedkeuring nodig",
        help: "Aanvragen waarbij matching gereed is en de gemeente het arrangement, budget of de vervolgstap moet goedkeuren.",
        ids: q.cases_waiting_gemeente_validation,
      },
      {
        key: "budget",
        label: "Budgetgoedkeuring",
        help: "Plaatsingsaanvragen met open budgetcontrole door de gemeente.",
        ids: q.budget_approvals_pending,
      },
      {
        key: "transitie",
        label: "Aanbieder-transitie",
        help: "Open verzoeken tot overdracht of transitie tussen aanbieders.",
        ids: q.provider_transition_requests_pending,
      },
      {
        key: "eval_komend",
        label: "Evaluaties gepland",
        help: "Actieve plaatsingen met een geplande evaluatie.",
        ids: q.evaluations_upcoming,
      },
      {
        key: "eval_te_laat",
        label: "Evaluaties te laat",
        help: "Evaluaties waar de geplande datum is verstreken.",
        ids: q.evaluations_overdue,
      },
      {
        key: "intensiteit",
        label: "Intensiteitswijziging",
        help: "Actieve plaatsingen met gewijzigde of risicovolle zorgintensiteit.",
        ids: q.active_placements_care_intensity_changed,
      },
    ];
    const active = segments.filter((s) => s.ids.length > 0);
    if (active.length === 0) {
      return null;
    }
    return (
      <div
        data-testid="coordination-governance-queues"
        className="flex max-h-16 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/20 px-3 py-2 shadow-sm"
      >
        <span className="inline-flex shrink-0 items-center gap-1 care-text-eyebrow text-muted-foreground">
          Wachtrijen
          <CareInfoPopover
            ariaLabel="Uitleg wachtrijen"
            testId="coordination-governance-queues-info"
            triggerClassName="h-5 w-5"
          >
            <p className="text-muted-foreground">
              Operationele wachtrijen: waar aanvragen vastliggen binnen dezelfde doorstroom. Geen apart proces naast
              Doorstroom — klik een wachtrij om de eerste casus te openen.
            </p>
          </CareInfoPopover>
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {active.map((s) => {
            const first = s.ids[0];
            const count = s.ids.length;
            return (
              <button
                key={s.key}
                type="button"
                className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-transparent bg-muted/35 px-2.5 py-1 text-left text-[12px] font-medium text-foreground underline-offset-2 hover:border-border/60 hover:bg-muted/55 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!first}
                title={s.help}
                aria-label={`Open eerste casus in wachtrij ${s.label} (${count})`}
                onClick={() => {
                  if (first) {
                    onCaseClick(String(first));
                  }
                }}
                data-testid={`coordination-governance-${s.key}`}
              >
                <span className="truncate">{s.label}</span>{" "}
                <span className="shrink-0 tabular-nums text-muted-foreground">({count})</span>
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
    );
  }, [loading, error, hasActiveData, data?.governance_queues, onCaseClick]);

  const noMatchDrillItems = useMemo(
    () =>
      allOverviewItems.filter(
        i =>
          i.phase === "matching"
          && (i.urgency === "critical" || i.urgency === "warning" || i.urgency === "high"),
      ),
    [allOverviewItems],
  );

  const activeCasesTotal = data?.totals.active_cases ?? 0;

  const coordinationNbaExplain = useMemo(() => {
    const criticalTop = allOverviewItems.filter(
      (i) => String(i.top_blocker?.severity ?? "").toLowerCase() === "critical",
    );
    const blockedProviderCases = criticalTop.filter((i) => i.phase === "aanbieder_beoordeling").length;
    const blockerWaitingCases = criticalTop.length - blockedProviderCases;
    const matchingMissingCandidates = noMatchDrillItems.filter((i) => !(i.assigned_provider ?? "").trim()).length;
    return {
      blockerWaitingCases,
      blockedProviderCases,
      matchingMissingCandidates,
      slaOverdueCount: providerSlaBreaches,
      intakeDelayedStart: intakeDelaysTotal,
    };
  }, [allOverviewItems, noMatchDrillItems, providerSlaBreaches, intakeDelaysTotal]);

  const coordinationNba = useMemo(
    () =>
      computeCoordinationNextBestAction({
        totals: {
          critical_blockers: criticalBlockers,
          provider_sla_breaches: providerSlaBreaches,
          high_priority_alerts: highPriorityAlerts,
          intake_delays: intakeDelaysTotal,
        },
        activeCases: activeCasesTotal,
        noMatchUrgentCount,
        explain: coordinationNbaExplain,
      }),
    [
      activeCasesTotal,
      criticalBlockers,
      highPriorityAlerts,
      intakeDelaysTotal,
      noMatchUrgentCount,
      providerSlaBreaches,
      coordinationNbaExplain,
    ],
  );

  const uiMode = coordinationNba.panel.uiMode;

  const actionReminders = useCallback(() => {
    setSearchQuery("");
    setPriorityFilter("all");
    setIssueFilter("SLA");
    setPhaseFilter("aanbiederreactie");
    setOwnershipFilter("all");
  }, []);

  const actionRematch = useCallback(() => {
    setSearchQuery("");
    setPriorityFilter("all");
    setIssueFilter("alerts");
    setPhaseFilter("matching");
    setOwnershipFilter("all");
  }, []);

  const applyFiltersAll = useCallback(() => {
    setSearchQuery("");
    setPriorityFilter("all");
    setIssueFilter("all");
    setPhaseFilter("all");
    setOwnershipFilter("all");
  }, []);

  const runNbaAction = useCallback(
    (key: CoordinationNbaActionKey) => {
      switch (key) {
        case "FOCUS_BLOCKERS":
          applyFiltersAll();
          setIssueFilter("blockers");
          setPhaseFilter("all");
          break;
        case "FOCUS_SLA":
          applyFiltersAll();
          setIssueFilter("SLA");
          setPhaseFilter("all");
          break;
        case "FOCUS_MATCHING":
          actionRematch();
          break;
        case "FOCUS_INTAKE":
          applyFiltersAll();
          setIssueFilter("intake");
          setPhaseFilter("all");
          break;
        case "FOCUS_RISKS":
          applyFiltersAll();
          setIssueFilter("risks");
          setPhaseFilter("all");
          break;
        case "OPEN_WORKQUEUE":
          onAppNavigate?.("/casussen");
          break;
        case "FOCUS_PIPELINE":
          if (dominantPhaseColumn) {
            applyPhaseBoardFilter(dominantPhaseColumn.phase);
          } else {
            applyFiltersAll();
          }
          break;
        case "REVIEW_STABLE":
          onAppNavigate?.("/casussen");
          break;
        case "SLA_PROVIDER_REMINDERS":
          actionReminders();
          break;
        default:
          break;
      }
    },
    [actionRematch, actionReminders, applyFiltersAll, applyPhaseBoardFilter, dominantPhaseColumn, onAppNavigate],
  );

  const runModePrimary = useCallback(() => {
    emitCoordinationNbaEvent(
      "nba_primary_clicked",
      buildCoordinationNbaInstrumentationPayload({
        actionKey: coordinationNba.primaryAction.actionKey,
        uiMode,
        reasonCount: coordinationNba.reasons.length,
      }),
    );
    runNbaAction(coordinationNba.primaryAction.actionKey);
  }, [coordinationNba, runNbaAction, uiMode]);

  const runModeSecondary = useCallback(() => {
    const secondary = coordinationNba.secondaryAction;
    if (secondary) {
      emitCoordinationNbaEvent(
        "nba_secondary_clicked",
        buildCoordinationNbaInstrumentationPayload({
          actionKey: secondary.actionKey,
          uiMode,
          reasonCount: coordinationNba.reasons.length,
        }),
      );
      runNbaAction(secondary.actionKey);
    }
  }, [coordinationNba, runNbaAction, uiMode]);

  const applyModeCasesLink = useCallback(() => {
    emitCoordinationNbaEvent(
      "nba_cases_link_clicked",
      buildCoordinationNbaInstrumentationPayload({
        actionKey: coordinationNba.primaryAction.actionKey,
        uiMode,
        reasonCount: coordinationNba.reasons.length,
      }),
    );
    // Honest navigation: link copy ("Bekijk kritieke casussen" / "Open werkvoorraad")
    // promises a destination, not an in-page filter. Hand a one-shot focus hint to the
    // worklist for crisis modes so the destination opens pre-filtered to critical cases.
    if (uiMode === "crisis") {
      setCasussenPreferredFocus("critical");
    }
    onAppNavigate?.("/casussen");
  }, [coordinationNba, onAppNavigate, uiMode]);

  const applyModeSignalenLink = useCallback(() => {
    emitCoordinationNbaEvent(
      "nba_secondary_clicked",
      buildCoordinationNbaInstrumentationPayload({
        actionKey: "FOCUS_SLA",
        uiMode,
        reasonCount: coordinationNba.reasons.length,
      }),
    );
    onAppNavigate?.("/signalen");
  }, [coordinationNba, onAppNavigate, uiMode]);

  useEffect(() => {
    if (!hasActiveData) {
      return;
    }
    const fp = `${uiMode}|${coordinationNba.primaryAction.actionKey}|${coordinationNba.title}|${coordinationNba.reasons.length}`;
    if (!shouldEmitCoordinationNbaShown(fp)) {
      return;
    }
    emitCoordinationNbaEvent(
      "nba_shown",
      buildCoordinationNbaInstrumentationPayload({
        actionKey: coordinationNba.primaryAction.actionKey,
        uiMode,
        reasonCount: coordinationNba.reasons.length,
      }),
    );
  }, [hasActiveData, coordinationNba, uiMode]);

  const dominantPanelDescription = formatCoordinationDominantDescription(coordinationNba);
  const showDominantHeroMetric =
    uiMode === "crisis" && (coordinationNba.panel.linkCount > 0 || criticalBlockers > 0);
  const dominantMetric = showDominantHeroMetric
    ? Math.max(criticalBlockers, coordinationNba.panel.linkCount || criticalBlockers)
    : 0;
  const gemeenteActieLine =
    dominantMetric === 1
      ? "1 casus vraagt directe afstemming"
      : `${dominantMetric} aanvragen vragen directe afstemming`;
  const dominantAlertDescription =
    uiMode === "crisis" ? "1 casus blokkeert de doorstroom" : dominantPanelDescription;
  const dominantPrimaryLabel =
    uiMode === "crisis" ? "Los kritieke blokkades op" : coordinationNba.primaryAction.label;
  const dominantSecondaryLabel =
    uiMode === "crisis" ? "SLA-signalen bekijken" : coordinationNba.secondaryAction?.label;

  const clearFilters = () => {
    setSearchQuery("");
    setPriorityFilter("all");
    setIssueFilter("all");
    setPhaseFilter("all");
    setOwnershipFilter("all");
    setCategoryFilter("all");
    setSubcategoryFilter("all");
  };

  const regiekamerFlowCounts = useMemo(() => buildRegiekamerFlowCounts(allOverviewItems), [allOverviewItems]);
  const activeRegiekamerStepIndex = useMemo(() => {
    const firstActive = REGIEKAMER_FLOW_STEPS.findIndex((step) => regiekamerFlowCounts[step.id] > 0);
    return firstActive >= 0 ? firstActive : 0;
  }, [regiekamerFlowCounts]);
  const showCoordinationPhaseBoard = !loading && !error && hasActiveData && allOverviewItems.length > 0;

  return (
    <div className="flex min-h-0 flex-col" data-testid="regiekamer-page">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 pb-5">
        <div>
          <h1 className="care-text-title text-foreground">Regiekamer</h1>
          <p className="mt-0.5 care-text-body text-muted-foreground">Stuur op doorstroom, blokkades en urgente casussen.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1 text-[12px] text-muted-foreground">
          {lastUpdateLabel && <span>{lastUpdateLabel}</span>}
          <button type="button" onClick={refetch} aria-label="Vernieuwen" className="rounded p-0.5 hover:text-foreground transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={applyCriticalDrillFilter}
          className="flex flex-col gap-1 rounded-xl border border-red-200/60 dark:border-red-900/30 bg-red-50/60 dark:bg-red-950/20 px-4 py-3 text-left transition-colors hover:bg-red-100/60 dark:hover:bg-red-950/30"
        >
          <span className="text-[28px] font-bold tabular-nums leading-none text-red-600 dark:text-red-400">{directActieCount}</span>
          <span className="text-[12px] font-medium text-red-700/70 dark:text-red-400/70">Direct actie nodig</span>
        </button>
        <button
          type="button"
          onClick={() => setIssueFilter("blockers")}
          className="flex flex-col gap-1 rounded-xl border border-red-200/60 dark:border-red-900/30 bg-red-50/40 dark:bg-red-950/10 px-4 py-3 text-left transition-colors hover:bg-red-100/50 dark:hover:bg-red-950/20"
        >
          <span className="text-[28px] font-bold tabular-nums leading-none text-red-500 dark:text-red-400">{blockedCount}</span>
          <span className="text-[12px] font-medium text-red-600/70 dark:text-red-400/70">Geblokkeerd</span>
        </button>
        <button
          type="button"
          onClick={() => setIssueFilter("SLA")}
          className="flex flex-col gap-1 rounded-xl border border-amber-200/60 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/15 px-4 py-3 text-left transition-colors hover:bg-amber-100/60 dark:hover:bg-amber-950/25"
        >
          <span className="text-[28px] font-bold tabular-nums leading-none text-amber-600 dark:text-amber-400">{slaRiskTotal}</span>
          <span className="text-[12px] font-medium text-amber-700/70 dark:text-amber-400/70">Termijnrisico</span>
        </button>
      </div>
      {loading && (
        <LoadingState title="Regiekamer synchroniseren…" copy="Operationeel overzicht wordt opgebouwd." />
      )}

      {!loading && error && (
        <ErrorState
          title="Regiekamer kon niet worden geladen"
          copy={error}
          action={<Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>}
        />
      )}

      {!loading && !error && !hasActiveData && (
        <EmptyState
          title="Geen actieve aanvragen."
          copy={
            canCreateCase && onCreateCase
              ? "Open de werkvoorraad voor lopende aanvragen of start een nieuwe doorstroom."
              : "Open de werkvoorraad voor lopende aanvragen of wacht op nieuwe aanmeldingen."
          }
          action={
            canCreateCase && onCreateCase && onAppNavigate ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="default"
                  className="h-9 min-h-9 rounded-lg px-4 text-[13px] font-semibold shadow-sm"
                  onClick={onCreateCase}
                >
                  Nieuwe casus
                </Button>
                <Button type="button" variant="outline" onClick={() => onAppNavigate("/casussen")}>
                  Open aanvragen
                </Button>
              </div>
            ) : canCreateCase && onCreateCase ? (
              <Button
                type="button"
                variant="default"
                className="h-9 min-h-9 rounded-lg px-4 text-[13px] font-semibold shadow-sm"
                onClick={onCreateCase}
              >
                Nieuwe casus
              </Button>
            ) : onAppNavigate ? (
              <Button type="button" variant="outline" onClick={() => onAppNavigate("/casussen")}>
                Open aanvragen
              </Button>
            ) : undefined
          }
        />
      )}

      {!loading &&
        !error &&
        hasActiveData &&
        visibleItems.length === 0 &&
        (data?.items?.length ?? 0) > 0 && (
        <EmptyState
          title="Geen aanvragen in dit filter."
          copy="Wis filters of kies een andere stap."
          action={<Button variant="outline" onClick={clearFilters}>Wis filters</Button>}
        />
      )}

      {!loading && !error && coordinationListItems.length > 0 && (
        <div
          data-testid="coordination-uitvoerlijst"
          className="overflow-hidden rounded-xl border border-border/60 bg-white dark:bg-[var(--surface-elevated)]"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          {/* Phase tabs */}
          <div className="flex overflow-x-auto border-b border-border/35 px-2">
            {(
              [
                { id: "alle" as const, label: "Alle casussen" },
                { id: "aanmelding" as const, label: "Aanmelding" },
                { id: "matching" as const, label: "Matching" },
                { id: "aanbiederreactie" as const, label: "Aanbiederreactie" },
                { id: "plaatsing" as const, label: "Plaatsing" },
                { id: "intake" as const, label: "Intake" },
                { id: "hoog-urgent" as const, label: "Hoog urgent" },
              ] satisfies Array<{ id: RegiekamerPhaseTab; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setSelectedCaseId(null); }}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                  activeTab === tab.id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums", activeTab === tab.id ? "bg-foreground/10 text-foreground" : "bg-muted/40 text-muted-foreground")}>
                  {phaseTabCounts[tab.id]}
                </span>
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 border-b border-border/35 px-4 py-2.5">
            <div className="relative max-w-xs flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                placeholder="Zoek in werkvoorraad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-lg border border-border/50 bg-transparent pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFiltersBar((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                  showFiltersBar || filtersActive
                    ? "border-primary/40 bg-primary/5 text-primary dark:border-primary/30 dark:bg-primary/10"
                    : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <SlidersHorizontal size={13} aria-hidden />
                Filters
                {filtersActive && <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">!</span>}
              </button>
            </div>
          </div>

          {/* Inline filters */}
          {showFiltersBar && (
            <div className="border-b border-border/35 bg-muted/40 dark:bg-muted/5 px-4 py-3">
              <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
                  Prioriteit
                  <CareOperationalSelect aria-label="Prioriteit" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}>
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </CareOperationalSelect>
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
                  Type
                  <CareOperationalSelect aria-label="Type" value={issueFilter} onChange={(e) => setIssueFilter(e.target.value as IssueFilter)}>
                    {Object.entries(ISSUE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </CareOperationalSelect>
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
                  Rol
                  <CareOperationalSelect aria-label="Rol" value={ownershipFilter} onChange={(e) => setOwnershipFilter(e.target.value as OwnershipFilter)}>
                    {Object.entries(OWNERSHIP_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </CareOperationalSelect>
                </label>
                <Button type="button" variant="ghost" className="self-end text-[12px]" onClick={clearFilters}>Wis filters</Button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[860px] gap-x-4 border-b border-border/25 px-6 py-2 care-text-eyebrow text-muted-foreground"
              style={{ gridTemplateColumns: "1.75rem minmax(13rem,2fr) minmax(11rem,1.6fr) 9rem minmax(8rem,1fr) minmax(10rem,1.1fr)" }}
            >
              <span aria-hidden />
              <span>Casus</span>
              <span>Blokkade</span>
              <span>Eigenaar</span>
              <span>Wachttijd ↓</span>
              <span>Volgende actie</span>
            </div>
            <div role="list">
              {tabFilteredItems.map((item) => (
                <RegiekamerWorkRow
                  key={item.case_id}
                  item={item}
                  isSelected={selectedCaseId === String(item.case_id)}
                  currentUserName={currentUserDisplayName}
                  onSelect={(id) => setSelectedCaseId((prev) => (prev === id ? null : id))}
                  onCaseClick={onCaseClick}
                />
              ))}
              {tabFilteredItems.length === 0 && (
                <div className="px-6 py-8 text-center text-[13px] text-muted-foreground">
                  Geen casussen in dit filter.
                </div>
              )}
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-border/35 px-6 py-3">
            <p className="text-[12px] text-muted-foreground">
              {tabFilteredItems.length} {tabFilteredItems.length === 1 ? "resultaat" : "resultaten"}
            </p>
            <div className="flex items-center gap-1">
              <button type="button" disabled aria-label="Vorige pagina" className="flex size-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground disabled:opacity-40">
                <ChevronLeft size={13} aria-hidden />
              </button>
              <button type="button" className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md bg-foreground px-1.5 text-[12px] font-medium text-background">
                1
              </button>
              <button type="button" disabled aria-label="Volgende pagina" className="flex size-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-muted/20 disabled:opacity-40 transition-colors">
                <ChevronRight size={13} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right detail panel */}
      {selectedItem != null && (
        <CasusdetailsPanel
          item={selectedItem}
          currentUserName={currentUserDisplayName}
          onClose={() => setSelectedCaseId(null)}
          onCaseClick={onCaseClick}
        />
      )}
    </div>
  );
}
