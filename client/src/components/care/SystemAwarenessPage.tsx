import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  Home,
  PanelRight,
  RefreshCw,
  UserCheck,
  Users,
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
import { CareAttentionSurface, CareInfoPopover } from "./CareUnifiedPage";
import {
  GuidanceContextBanner,
  InlineHelpChip,
} from "../guidance";
import { FieldHelperBox } from "../ui/form";
import {
  CareMetaChip,
  CarePageScaffold,
  CareAlertCard,
  CareFlowBoard,
  CareFlowStepCard,
  CareSection,
  CareSectionBody,
  CareSectionHeader,
  CareOperationalSelect,
  CareSearchFiltersBar,
  CareDominantStatus,
  CareOperationalQueueHeader,
  CareWorkListCard,
  CareWorkRow,
  CareQueueInlineAction,
  CareWorkspaceSection,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import { useCoordinationDecisionOverview } from "../../hooks/useCoordinationDecisionOverview";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useRailCollapsed } from "../../hooks/useRailCollapsed";
import { CoordinationNotesPanel } from "./CoordinationNotesPanel";
import { CoordinationRailEdgeTab, CoordinationRailToggleButton } from "./CoordinationRailControls";
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
  type PhaseBoardColumn,
  type CoordinationListFilter,
  type CoordinationFlowPhase,
} from "../../lib/coordinationCommandCenter";
import { tokens } from "../../design/tokens";
import { CARE_RHYTHM } from "../../lib/operationalRhythm";
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
      return "border-red-500/35 bg-red-500/10 text-red-200";
    case "high":
      return "border-amber-500/35 bg-amber-500/10 text-amber-100";
    case "medium":
      return "border-border bg-muted/30 text-foreground";
    default:
      return "border-border bg-muted/15 text-muted-foreground";
  }
}

function severityBadgeClasses(severity?: string | null) {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return "border-red-500/35 bg-red-500/10 text-red-100";
    case "high":
    case "warning":
      return "border-amber-500/35 bg-amber-500/10 text-amber-100";
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

function renderQuickPhaseIcon(phase: CoordinationFlowPhase) {
  const Icon = phaseCardIcon(phase);
  return <Icon size={16} className="text-muted-foreground" aria-hidden />;
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

function RegiekamerWorkRow({
  item,
  onCaseClick,
}: {
  item: CoordinationDecisionOverviewItem;
  onCaseClick: (caseId: string) => void;
}) {
  const rowId = String(item.case_id);
  const urgencyTone =
    item.priority_score >= 100 || item.urgency === "critical"
      ? "critical"
      : item.priority_score >= 70 || item.urgency === "high"
        ? "warning"
        : "neutral";
  const statusTone =
    item.priority_score >= 100 || item.urgency === "critical"
      ? "border-red-500/35 bg-red-500/10 text-red-100"
      : "border-amber-500/35 bg-amber-500/10 text-amber-100";
  const actionLabel = rowNextActionLabel(item);

  return (
    <article
      data-care-work-row
      data-testid="coordination-worklist-item"
      className="grid min-w-[980px] grid-cols-[5.5rem_16rem_minmax(11rem,1fr)_11rem_9rem_12rem] items-center gap-x-4 border-b border-border/35 px-4 py-3 last:border-b-0 md:px-5"
    >
      <div className="flex items-center">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[12px] font-medium leading-none",
            urgencyTone === "critical"
              ? "border-red-500/35 bg-red-500/10 text-red-100"
              : urgencyTone === "warning"
                ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                : "border-border/60 bg-muted/20 text-muted-foreground",
          )}
        >
          <span className={cn("size-2 rounded-full", urgencyTone === "critical" ? "bg-red-400" : "bg-amber-400")} aria-hidden />
          {priorityDotLabel(item)}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onCaseClick(rowId)}
        className="min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1"
      >
        <span className="block truncate text-[14px] font-semibold leading-tight text-foreground">{item.case_reference}</span>
        <span className="mt-0.5 block truncate text-[12px] leading-tight text-muted-foreground">{item.title}</span>
      </button>

      <div className="min-w-0 text-[13px] leading-tight text-muted-foreground">
        <span className="block truncate">{rowRegionLabel(item)}</span>
      </div>

      <div className="min-w-0">
        <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold leading-none", statusTone)}>
          {rowStatusLabel(item)}
        </span>
        <span className="mt-1 block truncate text-[12px] leading-tight text-muted-foreground">{rowStatusReason(item)}</span>
      </div>

      <div className="min-w-0 text-[13px] leading-tight">
        <span className="block truncate font-medium text-foreground">{rowLastActionLabel(item)}</span>
        <span className="mt-1 block truncate text-muted-foreground">{rowLastActionDateLabel(item)}</span>
      </div>

      <div className="flex min-w-0 justify-end">
        <Button
          type="button"
          variant="default"
          onClick={() => onCaseClick(rowId)}
          className="h-10 rounded-full px-4 text-[13px] font-semibold shadow-md shadow-primary/20"
        >
          {actionLabel}
          <ChevronRight size={16} className="ml-2" aria-hidden />
        </Button>
      </div>
    </article>
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

  const criticalBlockers = data?.totals.critical_blockers ?? 0;
  const highPriorityAlerts = data?.totals.high_priority_alerts ?? 0;
  const providerSlaBreaches = data?.totals.provider_sla_breaches ?? 0;
  const intakeDelaysTotal = data?.totals.intake_delays ?? 0;
  const urgencyApplicationsOpen = data?.totals.urgency_applications_open ?? 0;

  const allOverviewItems = data?.items ?? [];
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
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
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
    <CarePageScaffold
      archetype="command"
      className="pb-8"
      titleClassName="text-[32px] sm:text-[36px] lg:text-[38px]"
      title="Regiekamer"
      subtitle="Stuur op doorstroom, blokkades en urgente casussen."
      dominantAction={
        hasActiveData ? (
          <CareAlertCard
            density="compact"
            testId="coordination-dominant-action"
            data-coordination-mode={uiMode}
            tone="warning"
            icon={<AlertCircle size={18} aria-hidden />}
            metric={0}
            showMetric={false}
            title={coordinationNba.title}
            description={dominantAlertDescription}
            primaryAction={(
                <Button
                  type="button"
                  className="h-10 rounded-full bg-amber-400 px-5 text-[13px] font-semibold leading-none text-amber-950 shadow-sm hover:bg-amber-300"
                  onClick={uiMode === "crisis" ? applyModeCasesLink : runModePrimary}
                  data-testid="coordination-dominant-primary-cta"
                >
                  {dominantPrimaryLabel}
                  <ChevronRight size={16} className="ml-2 translate-y-px" aria-hidden />
                </Button>
            )}
            secondaryAction={(
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full border-border/70 px-5 text-[13px] font-semibold leading-none text-foreground hover:bg-muted/20"
                onClick={uiMode === "crisis" ? applyModeSignalenLink : runModeSecondary}
                data-testid="coordination-dominant-secondary-cta"
              >
                {dominantSecondaryLabel}
              </Button>
            )}
          />
        ) : undefined
      }
      workflow={
        showCoordinationPhaseBoard ? (
          <CareSection tone="context" testId="coordination-phase-board" aria-label="Aantallen per beslisstap">
            <CareSectionHeader
              title="Doorstroom"
              action={
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-1 px-2 text-[13px] font-semibold text-primary hover:bg-muted/35 hover:text-primary"
                  onClick={() => {
                    setCasussenPreferredFocus("pipeline");
                    onAppNavigate?.("/casussen");
                  }}
                  data-testid="coordination-doorstroom-open-werkvoorraad"
                >
                  Bekijk gehele stroom
                  <ChevronRight size={14} aria-hidden />
                </Button>
              }
            />
            <CareSectionBody>
              <CareFlowBoard
                testId="coordination-flow-board"
                variant="pipeline"
                activeStepIndex={activeRegiekamerStepIndex}
                stepCount={REGIEKAMER_FLOW_STEPS.length}
              >
                {REGIEKAMER_FLOW_STEPS.map((step, stepIndex) => {
                  const Icon = regiekamerFlowStepIcon(step.id);
                  const count = regiekamerFlowCounts[step.id];
                  const isBottleneck = count > 0 && stepIndex === activeRegiekamerStepIndex;
                  const completed = stepIndex < activeRegiekamerStepIndex && !isBottleneck;
                  return (
                    <CareFlowStepCard
                      key={step.id}
                      testId={`coordination-phase-column-${step.id}`}
                      onClick={() => {
                        const phaseMap: Record<RegiekamerFlowStepId, CoordinationFlowPhase> = {
                          aanmelding: "aanmelding",
                          matching: "matching",
                          aanbiederreactie: "aanbiederreactie",
                          plaatsing: "plaatsing",
                          intake: "intake",
                        };
                        applyPhaseBoardFilter(phaseMap[step.id]);
                      }}
                      active={isBottleneck}
                      completed={completed}
                      icon={<Icon size={18} className="text-current" />}
                      metric={count}
                      subtitle={step.subtitle}
                      title={step.label}
                    />
                  );
                })}
              </CareFlowBoard>
            </CareSectionBody>
          </CareSection>
        ) : undefined
      }
    >
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
        <section
          data-testid="coordination-uitvoerlijst"
          aria-labelledby="coordination-uitvoerlijst-heading"
          className="surface-workspace rounded-[22px] border border-border/60 bg-card/45 p-4 shadow-sm md:p-5"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 id="coordination-uitvoerlijst-heading" className="text-[22px] font-semibold tracking-tight text-foreground">
                Werkvoorraad
              </h2>
              <p className="text-[13px] leading-6 text-muted-foreground">Actuele casussen die jouw aandacht vragen.</p>
            </div>

            <CareSearchFiltersBar
              variant="workspace"
              className="px-0"
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Zoek casussen, regio's, aanbieders..."
              showSecondaryFilters={showSecondaryFilters}
              onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
              secondaryFiltersLabel="Filters"
              secondaryFilters={(
                <>
                  <div className="grid items-end gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        Prioriteit
                        <InlineHelpChip
                          title="Waarom staat dit bovenaan?"
                          triggerLabel="Uitleg"
                          testId="coordination-prioriteit-help"
                        >
                          <p>Items worden geprioriteerd op urgentie, blokkades en benodigde actie.</p>
                        </InlineHelpChip>
                      </span>
                      <CareOperationalSelect
                        aria-label="Prioriteit"
                        value={priorityFilter}
                        onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                      >
                        {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </CareOperationalSelect>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Type
                      <CareOperationalSelect
                        aria-label="Type"
                        value={issueFilter}
                        onChange={(event) => setIssueFilter(event.target.value as IssueFilter)}
                      >
                        {Object.entries(ISSUE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </CareOperationalSelect>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Stap
                      <CareOperationalSelect
                        aria-label="Stap in de keten"
                        value={phaseFilter}
                        onChange={(event) => setPhaseFilter(event.target.value as PhaseFilter)}
                      >
                        <option value="all">Alles</option>
                        {DECISION_UI_PHASE_IDS.map((id) => (
                          <option key={id} value={id}>{DECISION_UI_PHASE_LABELS[id]}</option>
                        ))}
                      </CareOperationalSelect>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Rol
                      <CareOperationalSelect
                        aria-label="Rol"
                        value={ownershipFilter}
                        onChange={(event) => setOwnershipFilter(event.target.value as OwnershipFilter)}
                      >
                        {Object.entries(OWNERSHIP_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </CareOperationalSelect>
                    </label>
                  </div>
                  <div className="grid items-end gap-2 md:grid-cols-2">
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Zorgbehoefte categorie
                      <CareOperationalSelect
                        aria-label="Zorgbehoefte categorie"
                        value={categoryFilter}
                        onChange={(event) => {
                          setCategoryFilter(event.target.value);
                          setSubcategoryFilter("all");
                        }}
                      >
                        <option value="all">Alle categorieën</option>
                        {taxonomyCategoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </CareOperationalSelect>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Specifieke zorgbehoefte
                      <CareOperationalSelect
                        aria-label="Specifieke zorgbehoefte"
                        value={subcategoryFilter}
                        disabled={categoryFilter === "all" || taxonomySubcategoryOptions.length === 0}
                        onChange={(event) => setSubcategoryFilter(event.target.value)}
                      >
                        <option value="all">Alle specifieke behoeften</option>
                        {taxonomySubcategoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </CareOperationalSelect>
                    </label>
                  </div>
                </>
              )}
            />

            <div className="overflow-hidden rounded-[20px] border border-border/45 bg-background/20">
              <div className="grid min-w-[980px] grid-cols-[5.5rem_16rem_minmax(11rem,1fr)_11rem_9rem_12rem] border-b border-border/35 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:px-5">
                <span>Urgentie</span>
                <span>Casus</span>
                <span>Regio</span>
                <span>Status</span>
                <span>Laatste actie</span>
                <span>Volgende actie</span>
              </div>
              <div className="divide-y divide-border/35">
                {coordinationListItems.map((item) => (
                  <RegiekamerWorkRow key={item.case_id} item={item} onCaseClick={onCaseClick} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </CarePageScaffold>
  );
}

function CoordinationInsightsPanels({
  gemeenteDisplayName,
  activeCasesTotal,
  avgDoorloopDays,
  slaRiskTotal,
  criticalBlockers,
  phaseBoardColumns,
  onCriticalClick,
  onPhaseClick,
  onNavigateCasussen,
  onAfterAction,
}: {
  gemeenteDisplayName: string;
  activeCasesTotal: number;
  avgDoorloopDays: number;
  slaRiskTotal: number;
  criticalBlockers: number;
  phaseBoardColumns: PhaseBoardColumn[];
  onCriticalClick: () => void;
  onPhaseClick: (phase: CoordinationFlowPhase) => void;
  onNavigateCasussen: () => void;
  onAfterAction?: () => void;
}) {
  const done = onAfterAction;

  return (
    <>
      <section className="rounded-xl border border-border/50 bg-card/40 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/40">
            <Building2 size={18} className="text-primary" aria-hidden />
          </div>
          <div className="min-w-0 space-y-3">
            <p className="text-sm font-semibold leading-tight text-foreground">{gemeenteDisplayName}</p>
            <dl className="space-y-2 text-sm">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <dt className="text-muted-foreground">Actieve aanvragen</dt>
                <dd className="min-w-0 break-words text-right tabular-nums font-semibold text-foreground">{activeCasesTotal}</dd>
              </div>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <dt className="text-muted-foreground">Gem. doorlooptijd</dt>
                <dd className="min-w-0 break-words text-right tabular-nums text-sm text-muted-foreground">{avgDoorloopDays} dagen</dd>
              </div>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <dt className="text-muted-foreground">Doorlooptijd {'>'} SLA</dt>
                <dd className={cn("min-w-0 break-words text-right tabular-nums font-semibold", slaRiskTotal > 0 ? "text-red-400" : "text-foreground")}>
                  {slaRiskTotal}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              onClick={() => {
                onNavigateCasussen();
                done?.();
              }}
              data-testid="coordination-bekijk-aanvragen-rail"
            >
              Naar aanvragen
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/50 bg-card/40 p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Snelle acties</p>
        <ul className="mt-3 space-y-2">
          <li>
            <button
              type="button"
              data-testid="coordination-quick-critical"
              onClick={() => {
                onCriticalClick();
                done?.();
              }}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2.5 text-left text-sm transition hover:border-border/80 hover:bg-muted/25"
            >
              <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                <AlertCircle size={16} className="shrink-0 text-red-400" aria-hidden />
                Kritieke aanvragen
              </span>
              <span className="tabular-nums font-semibold text-foreground">{criticalBlockers}</span>
            </button>
          </li>
          {phaseBoardColumns.map((col) => (
            <li key={col.phase}>
              <button
                type="button"
                data-testid={`coordination-quick-phase-${col.phase}`}
                onClick={() => {
                  onPhaseClick(col.phase);
                  done?.();
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2.5 text-left text-sm transition hover:border-border/80 hover:bg-muted/25"
              >
                <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                  <span className="shrink-0 opacity-90">{renderQuickPhaseIcon(col.phase)}</span>
                  <span className="truncate">{col.label}</span>
                </span>
                <span className="tabular-nums font-semibold text-foreground">{col.count}</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 w-full text-left text-sm font-semibold text-primary underline-offset-4 hover:underline"
          onClick={() => {
            onNavigateCasussen();
            done?.();
          }}
          data-testid="coordination-quick-werkvoorraad-link"
        >
          Bekijk werkvoorraad
        </button>
      </section>

      <CoordinationNotesPanel testId="coordination-notes-panel" onAfterAction={done} />
    </>
  );
}

function CoordinationWorkItemCard({
  item,
  onCaseClick,
}: {
  item: CoordinationDecisionOverviewItem;
  onCaseClick: (caseId: string) => void;
}) {
  const primaryAction = imperativeCtaLabel(item);
  const normalizedPrimaryAction = normalizeWorklistActionLabel(item, primaryAction);
  const summaryState = summaryWorkflowState(item);
  const hasPrimaryNba = normalizedPrimaryAction != null && normalizedPrimaryAction.trim() !== "" && !summaryState?.processing;
  const blockerDetail = actionableProblemLabel(item);
  const processingOnly = Boolean(summaryState && summaryState.actionLabel == null);
  const actionLabel = processingOnly
    ? summaryState!.statusLabel
    : hasPrimaryNba
      ? normalizedPrimaryAction!
      : "Bekijk casus";
  const taxonomySummary = buildTaxonomySummaryLabel(item);

  return (
    <CareWorkRow
      testId="coordination-worklist-item"
      density="operational"
      queueVariant="command"
      leading={
        <CareMetaChip className={cn("h-6 px-2 text-[11px] font-semibold", priorityBadgeClasses(item.priority_score))}>
          {priorityLabel(item.priority_score)}
        </CareMetaChip>
      }
      title={item.title}
      context={
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground/90">{item.case_reference}</span>
          {item.urgency_applied ? (
            <CareMetaChip className="text-[11px] font-medium text-amber-300">
              Urgentie aangevraagd
            </CareMetaChip>
          ) : null}
          {taxonomySummary ? (
            <CareMetaChip className="max-w-[min(100%,16rem)] truncate text-[11px]" title={taxonomySummary}>
              {taxonomySummary}
            </CareMetaChip>
          ) : null}
        </div>
      }
      status={
        <CareDominantStatus
          className={cn(
            "h-auto max-w-full whitespace-normal border px-2 py-1 text-left text-[11px] font-semibold leading-snug",
            severityBadgeClasses(issueTone(item)),
          )}
        >
          <span className="line-clamp-2">{blockerDetail}</span>
        </CareDominantStatus>
      }
      time={
        <CareMetaChip>
          <Clock3 size={12} aria-hidden />
          {formatHours(item.hours_in_current_state)}
        </CareMetaChip>
      }
      contextInfo={<CareMetaChip>{ownerLabel(item)}</CareMetaChip>}
      actionLabel={actionLabel}
      actionVariant={processingOnly ? "ghost" : hasPrimaryNba ? "primary" : "ghost"}
      hideAction={processingOnly}
      accentTone={item.priority_score >= 80 ? "critical" : item.priority_score >= 50 ? "warning" : "neutral"}
      onOpen={() => onCaseClick(String(item.case_id))}
      onAction={(event) => {
        event.stopPropagation();
        onCaseClick(String(item.case_id));
      }}
    />
  );
}
