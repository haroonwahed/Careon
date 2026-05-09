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
import { CareInfoPopover } from "./CareUnifiedPage";
import {
  CareMetaChip,
  CarePageScaffold,
  CareAlertCard,
  CareFlowBoard,
  CareFlowStepCard,
  CareSection,
  CareSectionBody,
  CareSectionHeader,
  CareSearchFiltersBar,
  CareWorkListCard,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
} from "./CareDesignPrimitives";
import { useRegiekamerDecisionOverview } from "../../hooks/useRegiekamerDecisionOverview";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useRailCollapsed } from "../../hooks/useRailCollapsed";
import { RegieNotesPanel } from "./RegieNotesPanel";
import { RegieRailEdgeTab, RegieRailToggleButton } from "./RegieRailControls";
import { getShortReasonLabel } from "../../lib/uxCopy";
import { imperativeLabelForActionCode } from "./nbaImperativeLabels";
import type {
  RegiekamerDecisionOverviewItem,
  RegiekamerOwnershipRole,
  RegiekamerPriorityBand,
} from "../../lib/regiekamerDecisionOverview";
import {
  computeRegiekamerNextBestAction,
  formatRegiekamerDominantDescription,
  type RegiekamerNbaActionKey,
  type RegiekamerNbaUiMode,
} from "../../lib/regiekamerNextBestAction";
import {
  derivePhaseBoard,
  getDominantPhaseColumn,
  type PhaseBoardColumn,
  type RegiekamerListFilter,
  type RegiekamerFlowPhase,
} from "../../lib/regiekamerCommandCenter";
import { tokens } from "../../design/tokens";
import {
  buildRegiekamerNbaInstrumentationPayload,
  emitRegiekamerNbaEvent,
  shouldEmitRegiekamerNbaShown,
} from "../../lib/regiekamerNbaInstrumentation";
import { setCasussenPreferredFocus } from "../../lib/casussenNavigation";
import {
  DECISION_UI_PHASE_IDS,
  DECISION_UI_PHASE_LABELS,
  isDecisionUiPhaseId,
  mapApiPhaseToDecisionUiPhase,
  normalizeRegiekamerPhaseQueryParam,
  type DecisionUiPhaseId,
} from "../../lib/decisionPhaseUi";
import { CARE_PATHS } from "../../lib/routes";

interface SystemAwarenessPageProps {
  onCaseClick: (caseId: string) => void;
  /** Shell navigation (e.g. metric strip → Casussen). Optional in standalone demos/tests. */
  onAppNavigate?: (path: string) => void;
  /** Same rules as Casussen werkvoorraad — shows “Nieuwe casus” on empty Regiekamer when true. */
  canCreateCase?: boolean;
  onCreateCase?: () => void;
}

type PriorityFilter = "all" | "critical" | "high" | "medium";
type IssueFilter = "all" | "blockers" | "risks" | "alerts" | "SLA" | "rejection" | "intake";
type PhaseFilter =
  | "all"
  | DecisionUiPhaseId
  | "casus"
  | "samenvatting"
  | "matching"
  | "gemeente_validatie"
  | "aanbieder_beoordeling"
  | "plaatsing"
  | "intake";
type OwnershipFilter = "all" | RegiekamerOwnershipRole;

const PRIORITY_PARAM_VALUES = new Set<PriorityFilter>(["all", "critical", "high", "medium"]);
const ISSUE_PARAM_VALUES = new Set<IssueFilter>(["all", "blockers", "risks", "alerts", "SLA", "rejection", "intake"]);
const PHASE_PARAM_VALUES = new Set<PhaseFilter>([
  "all",
  ...DECISION_UI_PHASE_IDS,
  "casus",
  "samenvatting",
  "matching",
  "gemeente_validatie",
  "aanbieder_beoordeling",
  "plaatsing",
  "intake",
]);
const OWNERSHIP_PARAM_VALUES = new Set<OwnershipFilter>(["all", "gemeente", "zorgaanbieder", "regie"]);

function pathWithoutTrailingSlash(path: string): string {
  const p = path.split("?")[0]?.split("#")[0] ?? "/";
  if (p.length > 1 && p.endsWith("/")) {
    return p.slice(0, -1);
  }
  return p || "/";
}

function isRegiekamerPath(pathname: string): boolean {
  return pathWithoutTrailingSlash(pathname) === CARE_PATHS.REGIEKAMER;
}

function filtersFromSearchString(search: string): {
  searchQuery: string;
  priorityFilter: PriorityFilter;
  issueFilter: IssueFilter;
  phaseFilter: PhaseFilter;
  ownershipFilter: OwnershipFilter;
} {
  const params = new URLSearchParams(search);
  const searchQuery = (params.get("q") ?? "").trim();
  const pr = params.get("priority") as PriorityFilter;
  const priorityFilter = PRIORITY_PARAM_VALUES.has(pr) ? pr : "all";
  const ir = params.get("issue") as IssueFilter;
  const issueFilter = ISSUE_PARAM_VALUES.has(ir) ? ir : "all";
  const phaseKey = normalizeRegiekamerPhaseQueryParam(params.get("phase"));
  const phaseFilter: PhaseFilter =
    phaseKey && PHASE_PARAM_VALUES.has(phaseKey as PhaseFilter)
      ? (phaseKey as PhaseFilter)
      : "all";
  const ow = params.get("ownership") as OwnershipFilter;
  const ownershipFilter = OWNERSHIP_PARAM_VALUES.has(ow) ? ow : "all";
  return { searchQuery, priorityFilter, issueFilter, phaseFilter, ownershipFilter };
}

function readFiltersFromUrl(): {
  searchQuery: string;
  priorityFilter: PriorityFilter;
  issueFilter: IssueFilter;
  phaseFilter: PhaseFilter;
  ownershipFilter: OwnershipFilter;
} {
  if (typeof window === "undefined") {
    return {
      searchQuery: "",
      priorityFilter: "all",
      issueFilter: "all",
      phaseFilter: "all",
      ownershipFilter: "all",
    };
  }
  if (!isRegiekamerPath(window.location.pathname)) {
    return {
      searchQuery: "",
      priorityFilter: "all",
      issueFilter: "all",
      phaseFilter: "all",
      ownershipFilter: "all",
    };
  }
  return filtersFromSearchString(window.location.search);
}

function buildRegiekamerUrl(parts: {
  searchQuery: string;
  priorityFilter: PriorityFilter;
  issueFilter: IssueFilter;
  phaseFilter: PhaseFilter;
  ownershipFilter: OwnershipFilter;
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
  const qs = params.toString();
  return qs ? `${CARE_PATHS.REGIEKAMER}?${qs}` : CARE_PATHS.REGIEKAMER;
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

/** NBA action codes from API → korte Nederlandse label voor Regiekamer (alleen weergave). */
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

const OWNERSHIP_LABELS: Record<OwnershipFilter, string> = {
  all: "Alles",
  gemeente: "Gemeente",
  zorgaanbieder: "Zorgaanbieder",
  regie: "Regie",
};

function priorityBand(score: number): RegiekamerPriorityBand {
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

function phaseCardIcon(phase: RegiekamerFlowPhase) {
  switch (phase) {
    case "casus_gestart":
      return FolderOpen;
    case "klaar_voor_matching":
      return Users;
    case "in_beoordeling":
      return UserCheck;
    case "plaatsing_intake":
      return Home;
    default:
      return FileText;
  }
}

function renderQuickPhaseIcon(phase: RegiekamerFlowPhase) {
  const Icon = phaseCardIcon(phase);
  return <Icon size={16} className="text-muted-foreground" aria-hidden />;
}

type PhaseBoardDetail = {
  label: string;
  tone: "blocked" | "waiting" | "ready" | "in_progress";
};

function phaseBoardDetails(phase: RegiekamerFlowPhase): PhaseBoardDetail[] {
  switch (phase) {
    case "casus_gestart":
      return [
        { label: "Geblokkeerd", tone: "blocked" },
      ];
    case "klaar_voor_matching":
      return [{ label: "Klaar", tone: "ready" }];
    case "in_beoordeling":
      return [{ label: "Wacht", tone: "waiting" }];
    case "plaatsing_intake":
      return [{ label: "Lopend", tone: "in_progress" }];
    default:
      return [];
  }
}

function phasePillClasses(tone: PhaseBoardDetail["tone"]): string {
  switch (tone) {
    case "blocked":
      return "border-red-500/35 bg-red-500/10 text-red-100";
    case "waiting":
      return "border-amber-500/35 bg-amber-500/10 text-amber-100";
    case "ready":
      return "border-sky-500/35 bg-sky-500/10 text-sky-100";
    case "in_progress":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-100";
    default:
      return "border-border bg-muted/30 text-foreground";
  }
}

function imperativeCtaLabel(item: RegiekamerDecisionOverviewItem): string | null {
  const nba = item.next_best_action;
  if (!nba) {
    return null;
  }
  return imperativeLabelForActionCode(nba.action, nba.label);
}

function summaryWorkflowState(item: RegiekamerDecisionOverviewItem): {
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
      statusLabel: "Samenvatting wordt automatisch verwerkt",
      actionLabel: null,
      processing: true,
    };
  }

  if (actionCode === "VIEW_SUMMARY") {
    return {
      statusLabel: "Samenvatting gereed",
      actionLabel: null,
      processing: false,
    };
  }

  return {
    statusLabel: "Casusgegevens onvolledig",
    actionLabel: "Vul casus aan",
    processing: false,
  };
}

function normalizeWorklistActionLabel(item: RegiekamerDecisionOverviewItem, label: string | null): string | null {
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
    return "Start matching";
  }
  if (actionCode === "VALIDATE_MATCHING") {
    return "Beoordeel matches";
  }
  if (actionCode === "SEND_TO_PROVIDER") {
    return "Stuur naar aanbieder";
  }
  if (actionCode === "WAIT_PROVIDER_RESPONSE" || actionCode === "FOLLOW_UP_PROVIDER") {
    return "Volg aanbieder op";
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

function actionableProblemLabel(item: RegiekamerDecisionOverviewItem): string {
  const code = item.top_blocker?.code ?? item.top_alert?.code ?? item.top_risk?.code ?? "";
  const nextAction = (item.next_best_action?.action ?? "").toUpperCase();
  const summaryState = summaryWorkflowState(item);
  if (summaryState) {
    return summaryState.statusLabel;
  }
  switch (code) {
    case "MISSING_SUMMARY":
      return "Casusgegevens onvolledig";
    case "GEMEENTE_VALIDATION_REQUIRED":
      return "Matching wacht op gemeente";
    case "NO_MATCH_AVAILABLE":
      if (nextAction === "START_MATCHING") {
        return "Klaar voor matching";
      }
      return "🟡 Geen aanbieder toegewezen";
    case "PROVIDER_REVIEW_PENDING_SLA":
      return "🟡 Wacht op aanbieder";
    case "REPEATED_PROVIDER_REJECTIONS":
      return "🔴 Herhaalde afwijzingen";
    case "INTAKE_NOT_STARTED":
    case "INTAKE_DELAYED":
      return "🟡 Wacht op intake";
    default:
      return `🟡 ${getShortReasonLabel(primaryProblemText(item), 28)}`;
  }
}

function formatHours(hours: number | null) {
  if (hours === null || Number.isNaN(hours)) {
    return "Onbekend";
  }
  if (hours < 24) {
    return `${Math.round(hours)} uur`;
  }
  return `${Math.round(hours / 24)} dagen`;
}

function issueTone(item: RegiekamerDecisionOverviewItem) {
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

function primaryProblemText(item: RegiekamerDecisionOverviewItem): string {
  if (item.top_blocker?.message) {
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

function ownerLabel(item: RegiekamerDecisionOverviewItem): string {
  const role = (item.responsible_role ?? "regie") as OwnershipFilter;
  return OWNERSHIP_LABELS[role] ?? "Regie";
}

function matchesIssueFilter(item: RegiekamerDecisionOverviewItem, filter: IssueFilter) {
  if (filter === "all") {
    return true;
  }
  return (item.issue_tags ?? []).includes(filter);
}

function matchesOwnershipFilter(item: RegiekamerDecisionOverviewItem, filter: OwnershipFilter) {
  if (filter === "all") {
    return true;
  }
  return (item.responsible_role ?? "regie") === filter;
}

/** UI-only Regiekamer modes — computed via `computeRegiekamerNextBestAction` (deterministic). */
export type RegiekamerUiMode = RegiekamerNbaUiMode;

function searchText(item: RegiekamerDecisionOverviewItem) {
  return [
    item.case_reference,
    item.title,
    item.current_state,
    item.phase,
    item.assigned_provider,
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

export function SystemAwarenessPage({
  onCaseClick,
  onAppNavigate,
  canCreateCase = false,
  onCreateCase,
}: SystemAwarenessPageProps) {
  const { data, loading, error, refetch } = useRegiekamerDecisionOverview();
  const { me } = useCurrentUser();
  const initialFromUrl = readFiltersFromUrl();
  const [searchQuery, setSearchQuery] = useState(initialFromUrl.searchQuery);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(initialFromUrl.priorityFilter);
  const [issueFilter, setIssueFilter] = useState<IssueFilter>(initialFromUrl.issueFilter);
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>(initialFromUrl.phaseFilter);
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>(initialFromUrl.ownershipFilter);
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const [railSheetOpen, setRailSheetOpen] = useState(false);
  const { collapsed: railCollapsed, toggle: toggleRail, setCollapsed: setRailCollapsed } = useRailCollapsed();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isRegiekamerPath(window.location.pathname)) {
      return;
    }
    const next = buildRegiekamerUrl({
      searchQuery,
      priorityFilter,
      issueFilter,
      phaseFilter,
      ownershipFilter,
    });
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === next) {
      return;
    }
    window.history.replaceState(window.history.state, "", next);
  }, [searchQuery, priorityFilter, issueFilter, phaseFilter, ownershipFilter]);

  useEffect(() => {
    const onPop = () => {
      if (!isRegiekamerPath(window.location.pathname)) {
        return;
      }
      const parsed = filtersFromSearchString(window.location.search);
      setSearchQuery(parsed.searchQuery);
      setPriorityFilter(parsed.priorityFilter);
      setIssueFilter(parsed.issueFilter);
      setPhaseFilter(parsed.phaseFilter);
      setOwnershipFilter(parsed.ownershipFilter);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const applyListFilterSnapshot = useCallback(
    (snapshot: RegiekamerListFilter) => {
      setSearchQuery("");
      setPriorityFilter((snapshot.priority === "all" ? "all" : snapshot.priority) as PriorityFilter);
      setIssueFilter(snapshot.issue as IssueFilter);
      setPhaseFilter(snapshot.phase as PhaseFilter);
      setOwnershipFilter("all");
    },
    [],
  );

  const applyPhaseBoardFilter = useCallback(
    (phase: RegiekamerFlowPhase) => {
      applyListFilterSnapshot({ issue: "all", phase, priority: "all" });
      if (typeof window !== "undefined" && isRegiekamerPath(window.location.pathname)) {
        const next = buildRegiekamerUrl({
          searchQuery: "",
          priorityFilter: "all",
          issueFilter: "all",
          phaseFilter: phase as PhaseFilter,
          ownershipFilter: "all",
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
  }, [data?.items, issueFilter, ownershipFilter, phaseFilter, priorityFilter, searchQuery]);

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
    setSearchQuery("");
    if (typeof window !== "undefined" && isRegiekamerPath(window.location.pathname)) {
      const next = buildRegiekamerUrl({
        searchQuery: "",
        priorityFilter: "critical",
        issueFilter: "blockers",
        phaseFilter: "all",
        ownershipFilter: "all",
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
    ownershipFilter !== "all";
  const criticalBlockers = data?.totals.critical_blockers ?? 0;
  const highPriorityAlerts = data?.totals.high_priority_alerts ?? 0;
  const providerSlaBreaches = data?.totals.provider_sla_breaches ?? 0;
  const intakeDelaysTotal = data?.totals.intake_delays ?? 0;

  const allOverviewItems = data?.items ?? [];
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

  const regiekamerNbaExplain = useMemo(() => {
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

  const regiekamerNba = useMemo(
    () =>
      computeRegiekamerNextBestAction({
        totals: {
          critical_blockers: criticalBlockers,
          provider_sla_breaches: providerSlaBreaches,
          high_priority_alerts: highPriorityAlerts,
          intake_delays: intakeDelaysTotal,
        },
        activeCases: activeCasesTotal,
        noMatchUrgentCount,
        explain: regiekamerNbaExplain,
      }),
    [
      activeCasesTotal,
      criticalBlockers,
      highPriorityAlerts,
      intakeDelaysTotal,
      noMatchUrgentCount,
      providerSlaBreaches,
      regiekamerNbaExplain,
    ],
  );

  const uiMode = regiekamerNba.panel.uiMode;

  const actionReminders = useCallback(() => {
    setSearchQuery("");
    setPriorityFilter("all");
    setIssueFilter("SLA");
    setPhaseFilter("in_beoordeling");
    setOwnershipFilter("all");
  }, []);

  const actionRematch = useCallback(() => {
    setSearchQuery("");
    setPriorityFilter("all");
    setIssueFilter("alerts");
    setPhaseFilter("klaar_voor_matching");
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
    (key: RegiekamerNbaActionKey) => {
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
        case "OPEN_REPORTS":
          onAppNavigate?.("/rapportages");
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
    [actionRematch, actionReminders, applyFiltersAll, onAppNavigate],
  );

  const runModePrimary = useCallback(() => {
    emitRegiekamerNbaEvent(
      "nba_primary_clicked",
      buildRegiekamerNbaInstrumentationPayload({
        actionKey: regiekamerNba.primaryAction.actionKey,
        uiMode,
        reasonCount: regiekamerNba.reasons.length,
      }),
    );
    runNbaAction(regiekamerNba.primaryAction.actionKey);
  }, [regiekamerNba, runNbaAction, uiMode]);

  const runModeSecondary = useCallback(() => {
    const secondary = regiekamerNba.secondaryAction;
    if (secondary) {
      emitRegiekamerNbaEvent(
        "nba_secondary_clicked",
        buildRegiekamerNbaInstrumentationPayload({
          actionKey: secondary.actionKey,
          uiMode,
          reasonCount: regiekamerNba.reasons.length,
        }),
      );
      runNbaAction(secondary.actionKey);
    }
  }, [regiekamerNba, runNbaAction, uiMode]);

  const applyModeCasesLink = useCallback(() => {
    emitRegiekamerNbaEvent(
      "nba_cases_link_clicked",
      buildRegiekamerNbaInstrumentationPayload({
        actionKey: regiekamerNba.primaryAction.actionKey,
        uiMode,
        reasonCount: regiekamerNba.reasons.length,
      }),
    );
    // Honest navigation: link copy ("Bekijk kritieke casussen" / "Open werkvoorraad")
    // promises a destination, not an in-page filter. Hand a one-shot focus hint to the
    // worklist for crisis modes so the destination opens pre-filtered to critical cases.
    if (uiMode === "crisis") {
      setCasussenPreferredFocus("critical");
    }
    onAppNavigate?.("/casussen");
  }, [regiekamerNba, onAppNavigate, uiMode]);

  useEffect(() => {
    if (!hasActiveData) {
      return;
    }
    const fp = `${uiMode}|${regiekamerNba.primaryAction.actionKey}|${regiekamerNba.title}|${regiekamerNba.reasons.length}`;
    if (!shouldEmitRegiekamerNbaShown(fp)) {
      return;
    }
    emitRegiekamerNbaEvent(
      "nba_shown",
      buildRegiekamerNbaInstrumentationPayload({
        actionKey: regiekamerNba.primaryAction.actionKey,
        uiMode,
        reasonCount: regiekamerNba.reasons.length,
      }),
    );
  }, [hasActiveData, regiekamerNba, uiMode]);

  const dominantPanelDescription = formatRegiekamerDominantDescription(regiekamerNba);
  const dominantMetric = Math.max(criticalBlockers, regiekamerNba.panel.linkCount || criticalBlockers);
  const dominantAlertTitle = uiMode === "crisis" ? "Kritieke blokkades actief" : regiekamerNba.title;
  const gemeenteActieLine =
    dominantMetric === 1 ? "1 casus — gemeentelijke actie nodig" : `${dominantMetric} casussen — gemeentelijke actie nodig`;
  const dominantAlertDescription =
    uiMode === "crisis" ? gemeenteActieLine : dominantPanelDescription;
  const dominantPrimaryLabel = regiekamerNba.primaryAction.label;
  const dominantSecondaryLabel = regiekamerNba.secondaryAction?.label;
  const dominantCasesLinkLabel = uiMode === "crisis" ? "Bekijk kritieke casussen" : "Open werkvoorraad";

  const clearFilters = () => {
    setSearchQuery("");
    setPriorityFilter("all");
    setIssueFilter("all");
    setPhaseFilter("all");
    setOwnershipFilter("all");
  };

  return (
    <div className="flex w-full flex-col gap-8 xl:flex-row xl:items-start xl:gap-8">
      <div className="min-w-0 flex-1">
        <CarePageScaffold
          archetype="decision"
          className="pb-8"
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              Regiekamer
              <CareInfoPopover ariaLabel="Uitleg Regiekamer" testId="regiekamer-page-info">
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    De Regiekamer is een control tower: blokkades, eigenaarschap en de eerstvolgende veilige stap
                    krijgen prioriteit, niet losse statistieken.
                  </p>
                  <p>Gebruik dit overzicht om de volgende actie, eigenaar en reden snel te zien.</p>
                </div>
              </CareInfoPopover>
            </span>
          }
          actions={(
            <div className="flex flex-col items-start gap-1 md:items-end">
              <div className="flex flex-wrap items-center gap-2">
                {filtersActive && (
                  <Button variant="outline" onClick={clearFilters} className="gap-2">
                    Wis filters
                  </Button>
                )}
                {canCreateCase && onCreateCase && hasActiveData ? (
                  // Demoted to outline so the dominantAction below holds the operational focus.
                  // Empty-state still uses PrimaryActionButton (no competing dominantAction there).
                  <Button variant="outline" onClick={onCreateCase} className="gap-2">
                    Start regiecasus
                  </Button>
                ) : null}
                <Button variant="outline" onClick={refetch} className="gap-2">
                  <RefreshCw size={14} />
                  Ververs
                </Button>
                <RegieRailToggleButton
                  collapsed={railCollapsed}
                  onToggle={toggleRail}
                  testId="regiekamer-rail-toggle"
                />
              </div>
              {lastUpdateLabel ? (
                <p className="text-xs text-muted-foreground">{lastUpdateLabel}</p>
              ) : null}
            </div>
          )}
          dominantAction={
            <div className="space-y-3">
          {hasActiveData && (
            <CareAlertCard
              testId="regiekamer-dominant-action"
              data-regiekamer-mode={uiMode}
              className="ring-1 ring-border/20"
              tone={
                regiekamerNba.panel.tone === "urgent"
                  ? "critical"
                  : regiekamerNba.panel.tone === "attention"
                    ? "warning"
                    : "info"
              }
              icon={<AlertCircle size={24} />}
              metric={dominantMetric}
              title={dominantAlertTitle}
              description={dominantAlertDescription}
              supportingLink={
                regiekamerNba.panel.showCasesLink && regiekamerNba.panel.linkCount > 0 ? (
                  <button
                    type="button"
                    className="text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
                    onClick={applyModeCasesLink}
                    data-testid="regiekamer-dominant-cases-link"
                    >
                    {dominantCasesLinkLabel} ({regiekamerNba.panel.linkCount})
                  </button>
                ) : undefined
              }
              primaryAction={
                <Button
                  type="button"
                  size="lg"
                  className="h-11 rounded-xl px-5 text-[14px] font-semibold shadow-md"
                  onClick={runModePrimary}
                  data-testid="regiekamer-dominant-primary-cta"
                >
                  {dominantPrimaryLabel}
                  <ChevronRight size={16} className="ml-2" aria-hidden />
                </Button>
              }
              secondaryAction={
                regiekamerNba.secondaryAction ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-11 rounded-xl border-border/70 px-5 text-[14px]"
                    onClick={runModeSecondary}
                    data-testid="regiekamer-dominant-secondary-cta"
                  >
                    {dominantSecondaryLabel}
                  </Button>
                ) : undefined
              }
            />
          )}

          {hasActiveData &&
            criticalBlockers === 0 &&
            providerSlaBreaches === 0 &&
            intakeDelaysTotal === 0 &&
            (data?.totals.repeated_rejections ?? 0) === 0 &&
            noMatchUrgentCount === 0 &&
            highPriorityAlerts === 0 && (
              <div
                data-testid="regiekamer-calm-state"
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-foreground"
              >
                <p className="font-medium">Geen operationele blokkades</p>
                <p className="mt-1 text-xs text-muted-foreground">Geen spoedsignalen in dit overzicht.</p>
              </div>
            )}
        </div>
      }
      kpiStrip={
        !loading && !error && hasActiveData && allOverviewItems.length > 0 ? (
          <CareSection testId="regiekamer-phase-board" aria-label="Aantallen per beslisstap">
            <CareSectionHeader
              title="De regiestroom"
              action={
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-1 px-2 text-sm font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={() => {
                    // Distinct from "Bekijk kritieke casussen" (critical-only) and from a
                    // plain /casussen entry: hand off `pipeline` so the worklist opens on
                    // casussen die in de stroom zitten (gemeentelijke aandacht of bij aanbieder).
                    setCasussenPreferredFocus("pipeline");
                    onAppNavigate?.("/casussen");
                  }}
                  data-testid="regiekamer-doorstroom-open-werkvoorraad"
                >
                  Bekijk gehele stroom
                  <ChevronRight size={14} aria-hidden />
                </Button>
              }
            />
            <CareSectionBody>
              <CareFlowBoard testId="regiekamer-flow-board" variant="pipeline">
                {phaseBoardColumns.map((col) => {
                  const isBottleneck =
                    dominantPhaseColumn?.phase === col.phase && col.count > 0 && (dominantPhaseColumn?.count ?? 0) > 0;
                  const Icon = phaseCardIcon(col.phase);
                  const details = phaseBoardDetails(col.phase);
                  const status = details[0];
                  return (
                    <div key={col.phase} className="relative">
                      <CareFlowStepCard
                        testId={`regiekamer-phase-column-${col.phase}`}
                        onClick={() => applyPhaseBoardFilter(col.phase)}
                        active={isBottleneck}
                        icon={<Icon size={18} className="text-current" />}
                        metric={col.count}
                        title={col.label}
                        subStatusLines={
                          status
                            ? [
                              <span
                                key={`${col.phase}-status`}
                                className={cn(
                                  "inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold",
                                  phasePillClasses(status.tone),
                                )}
                              >
                                {status.label}
                              </span>,
                            ]
                            : []
                        }
                      />
                    </div>
                  );
                })}
              </CareFlowBoard>
            </CareSectionBody>
          </CareSection>
        ) : undefined
      }
    >
      {loading && (
        <LoadingState title="Regiekamer laden…" copy="Gegevens worden geladen." />
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
          title="Geen actieve casussen."
          copy={
            canCreateCase && onCreateCase
              ? "Open de werkvoorraad voor lopende casussen of start een nieuw regietraject."
              : "Open de werkvoorraad voor lopende casussen of wacht op nieuwe casussen."
          }
          action={
            canCreateCase && onCreateCase && onAppNavigate ? (
              <div className="flex flex-wrap items-center gap-2">
                <PrimaryActionButton type="button" onClick={onCreateCase}>
                  Start regiecasus
                </PrimaryActionButton>
                <Button type="button" variant="outline" onClick={() => onAppNavigate("/casussen")}>
                  Open casussen
                </Button>
              </div>
            ) : canCreateCase && onCreateCase ? (
              <PrimaryActionButton type="button" onClick={onCreateCase}>
                Start regiecasus
              </PrimaryActionButton>
            ) : onAppNavigate ? (
              <Button type="button" variant="outline" onClick={() => onAppNavigate("/casussen")}>
                Open casussen
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
          title="Geen casussen in dit filter."
          copy="Wis filters of kies een andere stap."
          action={<Button variant="outline" onClick={clearFilters}>Wis filters</Button>}
        />
      )}

      {!loading && !error && visibleItems.length > 0 && (
        <CareSection testId="regiekamer-uitvoerlijst" aria-labelledby="regiekamer-uitvoerlijst-heading">
          <CareSectionHeader
            className="lg:flex-col lg:items-stretch"
            title={
              <span id="regiekamer-uitvoerlijst-heading">Werkvoorraad</span>
            }
            meta={
              <div className="w-full min-w-0 space-y-2">
                <span className="inline-flex w-fit items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[12px] font-semibold text-cyan-200">
                  {visibleItems.length} casussen
                </span>
                <CareSearchFiltersBar
                  className="px-0"
                  searchValue={searchQuery}
                  onSearchChange={setSearchQuery}
                  searchPlaceholder="Zoek casussen, regio's, aanbieders…"
                  showSecondaryFilters={showSecondaryFilters}
                  onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
                  secondaryFiltersLabel="Filters"
                  secondaryFilters={(
                    <div className="grid items-end gap-2 md:grid-cols-2 xl:grid-cols-4">
                      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                        Prioriteit
                        <select
                          aria-label="Prioriteit"
                          value={priorityFilter}
                          onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                          className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                        >
                          {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                        Type
                        <select
                          aria-label="Type"
                          value={issueFilter}
                          onChange={(event) => setIssueFilter(event.target.value as IssueFilter)}
                          className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                        >
                          {Object.entries(ISSUE_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                        Stap
                        <select
                          aria-label="Stap in de keten"
                          value={phaseFilter}
                          onChange={(event) => setPhaseFilter(event.target.value as PhaseFilter)}
                          className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                        >
                          <option value="all">Alles</option>
                          {DECISION_UI_PHASE_IDS.map((id) => (
                            <option key={id} value={id}>{DECISION_UI_PHASE_LABELS[id]}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                        Rol
                        <select
                          aria-label="Rol"
                          value={ownershipFilter}
                          onChange={(event) => setOwnershipFilter(event.target.value as OwnershipFilter)}
                          className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                        >
                          {Object.entries(OWNERSHIP_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                />
              </div>
            }
          />
          <CareSectionBody>
            <CareWorkListCard className="overflow-x-auto"
              header={(
                <div className="hidden min-w-[980px] gap-y-3 gap-x-4 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid md:grid-cols-[88px_128px_minmax(220px,260px)_104px_112px_minmax(220px,1fr)] md:gap-x-5 md:px-5">
                  <span>Prioriteit</span>
                  <span>Casus</span>
                  <span>Blokkade / aandacht</span>
                  <span>Eigenaar</span>
                  <span>Wachttijd</span>
                  <span>Volgende actie</span>
                </div>
              )}
            >
              <div className="min-w-[980px] divide-y divide-border/45">
                {visibleItems.map((item) => (
                  <RegiekamerWorkItemCard
                    key={item.case_id}
                    item={item}
                    onCaseClick={onCaseClick}
                  />
                ))}
              </div>
            </CareWorkListCard>
            {onAppNavigate ? (
              <div className="flex justify-center pt-5">
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => onAppNavigate("/casussen")}
                  data-testid="regiekamer-bekijk-alle-casussen"
                >
                  Bekijk alle {visibleItems.length} casussen
                  <ChevronDown size={16} aria-hidden />
                </Button>
              </div>
            ) : null}
          </CareSectionBody>
        </CareSection>
      )}
        </CarePageScaffold>
      </div>

      {!loading && !error && hasActiveData ? (
        <>
          {!railCollapsed && (
            <aside
              data-testid="regiekamer-right-rail"
              className="hidden w-[300px] shrink-0 space-y-4 pt-1 xl:block xl:sticky xl:top-4 xl:z-10 xl:overflow-y-auto xl:self-start"
              style={{ maxHeight: tokens.layout.regiekamerRailMaxHeight }}
            >
              <RegiekamerInsightsPanels
                gemeenteDisplayName={gemeenteDisplayName}
                activeCasesTotal={activeCasesTotal}
                avgDoorloopDays={avgDoorloopDays}
                slaRiskTotal={slaRiskTotal}
                criticalBlockers={criticalBlockers}
                phaseBoardColumns={phaseBoardColumns}
                onCriticalClick={applyCriticalDrillFilter}
                onPhaseClick={applyPhaseBoardFilter}
                onNavigateCasussen={() => {
                  onAppNavigate?.("/casussen");
                }}
              />
            </aside>
          )}

          {railCollapsed && (
            <RegieRailEdgeTab
              onExpand={() => setRailCollapsed(false)}
              testId="regiekamer-rail-edge-tab"
            />
          )}

          <div className="contents xl:hidden">
            <Button
              type="button"
              variant="default"
              size="lg"
              className="fixed right-5 z-40 h-12 gap-2 rounded-full px-5 shadow-lg md:right-6"
              style={{
                bottom: "max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))",
              }}
              aria-expanded={railSheetOpen}
              aria-controls="regiekamer-rail-sheet"
              data-testid="regiekamer-rail-open"
              onClick={() => setRailSheetOpen(true)}
            >
              <PanelRight size={18} aria-hidden />
              Regie-paneel
            </Button>

            <Sheet open={railSheetOpen} onOpenChange={setRailSheetOpen}>
              <SheetContent
                id="regiekamer-rail-sheet"
                side="right"
                data-testid="regiekamer-rail-sheet"
                className="flex w-full max-w-md flex-col gap-0 border-border/60 p-0 sm:max-w-md"
              >
                <SheetHeader className="shrink-0 space-y-1 border-b border-border/50 px-4 py-4">
                  <SheetTitle>Regie-paneel</SheetTitle>
                  <SheetDescription className="sr-only">
                    Regie-overzicht, snelle filters en notities voor deze pagina.
                  </SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-4">
                    <RegiekamerInsightsPanels
                      gemeenteDisplayName={gemeenteDisplayName}
                      activeCasesTotal={activeCasesTotal}
                      avgDoorloopDays={avgDoorloopDays}
                      slaRiskTotal={slaRiskTotal}
                      criticalBlockers={criticalBlockers}
                      phaseBoardColumns={phaseBoardColumns}
                      onCriticalClick={applyCriticalDrillFilter}
                      onPhaseClick={applyPhaseBoardFilter}
                      onNavigateCasussen={() => {
                        onAppNavigate?.("/casussen");
                      }}
                      onAfterAction={() => setRailSheetOpen(false)}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </>
      ) : null}
    </div>
  );
}

function RegiekamerInsightsPanels({
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
  onPhaseClick: (phase: RegiekamerFlowPhase) => void;
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
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Actieve casussen</dt>
                <dd className="tabular-nums font-semibold text-foreground">{activeCasesTotal}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Gem. doorlooptijd</dt>
                <dd className="tabular-nums font-semibold text-foreground">{avgDoorloopDays} dagen</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Doorlooptijd {'>'} SLA</dt>
                <dd className={cn("tabular-nums font-semibold", slaRiskTotal > 0 ? "text-red-400" : "text-foreground")}>
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
              data-testid="regiekamer-bekijk-regiemetrics"
            >
              Bekijk regiemetrics
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/50 bg-card/40 p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Snel naar</p>
        <ul className="mt-3 space-y-2">
          <li>
            <button
              type="button"
              data-testid="regiekamer-quick-critical"
              onClick={() => {
                onCriticalClick();
                done?.();
              }}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2.5 text-left text-sm transition hover:border-primary/35 hover:bg-muted/25"
            >
              <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                <AlertCircle size={16} className="shrink-0 text-red-400" aria-hidden />
                Kritieke casussen
              </span>
              <span className="tabular-nums font-semibold text-foreground">{criticalBlockers}</span>
            </button>
          </li>
          {phaseBoardColumns.map((col) => (
            <li key={col.phase}>
              <button
                type="button"
                data-testid={`regiekamer-quick-phase-${col.phase}`}
                onClick={() => {
                  onPhaseClick(col.phase);
                  done?.();
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2.5 text-left text-sm transition hover:border-primary/35 hover:bg-muted/25"
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
          data-testid="regiekamer-quick-werkvoorraad-link"
        >
          Bekijk werkvoorraad
        </button>
      </section>

      <RegieNotesPanel testId="regiekamer-notes-panel" onAfterAction={done} />
    </>
  );
}

function RegiekamerWorkItemCard({
  item,
  onCaseClick,
}: {
  item: RegiekamerDecisionOverviewItem;
  onCaseClick: (caseId: string) => void;
}) {
  const primaryAction = imperativeCtaLabel(item);
  const normalizedPrimaryAction = normalizeWorklistActionLabel(item, primaryAction);
  const summaryState = summaryWorkflowState(item);
  const hasPrimaryNba = normalizedPrimaryAction != null && normalizedPrimaryAction.trim() !== "" && !summaryState?.processing;
  const blockerDetail = actionableProblemLabel(item);
  return (
    <div
      data-testid="regiekamer-worklist-item"
      className={cn(
        "group grid gap-y-3 gap-x-4 px-4 py-3.5 transition-colors md:grid-cols-[88px_128px_minmax(220px,260px)_104px_112px_minmax(220px,1fr)] md:gap-x-5 md:items-center md:px-5",
        "hover:bg-background/35",
      )}
    >
      <button
        type="button"
        onClick={() => onCaseClick(String(item.case_id))}
        aria-label={`Open casus ${item.title}`}
        className={cn(
          "group grid min-w-0 gap-y-3 gap-x-4 text-left outline-none transition-colors md:col-span-5 md:grid-cols-[88px_128px_minmax(220px,260px)_104px_112px] md:gap-x-5 md:items-center",
          "focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <div className="flex items-center gap-2 md:flex-col md:items-start md:gap-2.5">
          <CareMetaChip className={cn("h-8 px-3 text-[13px] font-semibold", priorityBadgeClasses(item.priority_score))}>
            {priorityLabel(item.priority_score)}
          </CareMetaChip>
        </div>

        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight text-foreground">{item.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
            <span className="font-mono text-[11px] text-muted-foreground/80">{item.case_reference}</span>
          </div>
        </div>

        <div className="min-w-0 space-y-1.5">
          <CareMetaChip
            className={cn(
              "w-fit max-w-full whitespace-normal border text-left text-[12px] font-semibold leading-snug text-foreground",
              severityBadgeClasses(issueTone(item)),
            )}
          >
            <span className="line-clamp-2">{blockerDetail}</span>
          </CareMetaChip>
        </div>

        <div className="min-w-0">
          <p className="text-[14px] font-medium leading-tight text-foreground/95">{ownerLabel(item)}</p>
        </div>

        <div className="md:justify-self-start">
          <CareMetaChip className="h-8">
            <Clock3 size={12} />
            {formatHours(item.hours_in_current_state)}
          </CareMetaChip>
        </div>
      </button>

      <div className="min-w-0 md:justify-self-start">
        {summaryState && summaryState.actionLabel == null ? (
          <CareMetaChip className="h-8 max-w-full whitespace-normal text-left leading-tight">
            {summaryState.statusLabel}
          </CareMetaChip>
        ) : hasPrimaryNba ? (
          <Button
            variant="default"
            size="sm"
            className="h-11 min-h-11 w-full justify-center rounded-xl px-3 text-[13px] font-semibold leading-tight"
            onClick={() => onCaseClick(String(item.case_id))}
          >
            <span className="whitespace-nowrap text-center">{normalizedPrimaryAction}</span>
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="h-11 min-h-11 w-full justify-center rounded-xl px-3 text-[13px] font-semibold leading-tight"
            onClick={() => onCaseClick(String(item.case_id))}
          >
            Bekijk casus
          </Button>
        )}
      </div>

    </div>
  );
}
