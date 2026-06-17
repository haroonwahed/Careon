import { type ComponentType, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Clock3,
  FolderOpen,
  Home,
  Lock,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import {
  CareOperationalSelect,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import {
  CareCommandShell,
  CareWorklist,
  CareWorklistTabs,
  CareWorklistToolbar,
  CareWorklistFilterPanel,
  CareWorklistColumnHeader,
  CareWorklistBody,
  CareWorklistRow,
  CareWorklistRowAction,
  CareWorklistPagination,
  ROW_ACTION_CLASSES,
} from "./CareCommandPrimitives";
import { useCoordinationDecisionOverview } from "../../hooks/useCoordinationDecisionOverview";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { imperativeLabelForActionCode } from "./nbaImperativeLabels";
import type {
  CoordinationDecisionOverviewItem,
  CoordinationOwnershipRole,
  CoordinationPriorityBand,
} from "../../lib/coordinationDecisionOverview";
import {
  computeCoordinationNextBestAction,
  type CoordinationNbaUiMode,
} from "../../lib/coordinationNextBestAction";
import {
  buildCoordinationNbaInstrumentationPayload,
  emitCoordinationNbaEvent,
  shouldEmitCoordinationNbaShown,
} from "../../lib/coordinationNbaInstrumentation";
import {
  DECISION_UI_PHASE_IDS,
  isDecisionUiPhaseId,
  mapApiPhaseToDecisionUiPhase,
  normalizeApiPhaseId,
  normalizeCoordinationPhaseQueryParam,
  type DecisionUiPhaseId,
} from "../../lib/decisionPhaseUi";
import { getSlaCountdown, SLA_STATUS_RANK } from "../../lib/careSla";
import { CareSlaCountdown } from "./CareSlaCountdown";
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

type ActionVariant = "blocking" | "active" | "waiting" | "default";

function rowNextAction(item: CoordinationDecisionOverviewItem): { label: string; variant: ActionVariant } {
  const actionCode = (item.next_best_action?.action ?? "").toUpperCase();
  switch (actionCode) {
    case "COMPLETE_CASE_DATA":
    case "GENERATE_SUMMARY":
      return { label: "Maak casus compleet", variant: "blocking" };
    case "VALIDATE_MATCHING":
      return { label: "Controleer voorstel", variant: "blocking" };
    case "START_MATCHING":
      return { label: "Start matching", variant: "active" };
    case "SEND_TO_PROVIDER":
      return { label: "Vraag reactie aan", variant: "active" };
    case "FOLLOW_UP_PROVIDER":
      return { label: "Herinner aanbieder", variant: "active" };
    case "CONFIRM_PLACEMENT":
      return { label: "Bevestig plaatsing", variant: "active" };
    case "START_INTAKE":
      return { label: "Plan intake", variant: "active" };
    case "WAIT_PROVIDER_RESPONSE":
      return { label: "Wacht op reactie", variant: "waiting" };
    default:
      break;
  }
  const actionLabel = imperativeLabelForActionCode(
    item.next_best_action?.action ?? "",
    item.next_best_action?.label ?? undefined,
  );
  const label = actionLabel?.trim() || item.next_best_action?.label?.trim() || "Bekijk casus";
  return { label, variant: "default" };
}

const ACTION_BUTTON_CLASSES: Record<ActionVariant, string> = {
  blocking:
    "bg-foreground text-background hover:bg-foreground/85 border-transparent shadow-sm",
  active:
    "border-primary/50 text-primary bg-primary/5 hover:bg-primary/10 hover:border-primary/70",
  waiting:
    "border-border/40 text-muted-foreground/60 cursor-default pointer-events-none",
  default:
    "border-border/60 text-foreground bg-white dark:bg-muted/10 hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:hover:text-primary shadow-sm",
};

const PRIORITY_BAND_LABELS: Record<string, string> = {
  critical: "Kritiek",
  high: "Hoog",
  medium: "Middel",
  low: "Laag",
};

type KpiCardTone = "urgent" | "warning" | "neutral" | "brand";

const KPI_CARD_TONES: Record<KpiCardTone, { card: string; active: string; icon: string; value: string; label: string }> = {
  urgent: {
    card: "border-care-urgent-border bg-care-urgent-bg hover:-translate-y-0.5 hover:shadow-md hover:border-care-urgent-solid/60",
    active: "border-care-urgent-border bg-care-urgent-bg ring-2 ring-care-urgent-solid/30 shadow-sm",
    icon: "text-care-urgent-text",
    value: "text-care-urgent-text",
    label: "text-care-urgent-text/70",
  },
  warning: {
    card: "border-care-warning-border bg-care-warning-bg hover:-translate-y-0.5 hover:shadow-md hover:border-care-warning-solid/60",
    active: "border-care-warning-border bg-care-warning-bg ring-2 ring-care-warning-solid/30 shadow-sm",
    icon: "text-care-warning-text",
    value: "text-care-warning-text",
    label: "text-care-warning-text/70",
  },
  neutral: {
    card: "border-border/60 bg-card/40 hover:bg-card/55 hover:-translate-y-0.5 hover:shadow-md hover:border-border/80 dark:bg-card/20 dark:hover:bg-card/30",
    active: "border-primary/40 bg-primary/5 ring-2 ring-primary/20 shadow-sm dark:bg-primary/10",
    icon: "text-muted-foreground",
    value: "text-foreground",
    label: "text-muted-foreground",
  },
  brand: {
    card: "border-care-brand-border bg-care-brand-bg hover:-translate-y-0.5 hover:shadow-md",
    active: "border-care-brand-border bg-care-brand-bg ring-2 ring-care-brand-solid/30 shadow-sm",
    icon: "text-care-brand-text",
    value: "text-care-brand-text",
    label: "text-care-brand-text/70",
  },
};

function RegiekamerKpiCard({
  icon: _Icon,
  value,
  label,
  subtitle,
  tone,
  isActive = false,
  onClick,
}: {
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" }>;
  value: number;
  label: string;
  subtitle?: string;
  tone: KpiCardTone;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const t = KPI_CARD_TONES[tone];
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-all",
        isActive ? t.active : t.card,
      )}
    >
      <span className={cn("text-[28px] font-bold tabular-nums leading-none", t.value)}>{value}</span>
      <span className={cn("flex items-center gap-1 text-[12px] font-medium", t.label)}>
        {label}
        {isActive && <X size={11} className="shrink-0 opacity-60" aria-hidden />}
      </span>
      {subtitle && (
        <span className={cn("text-[11px] leading-none opacity-60", t.label)}>{subtitle}</span>
      )}
    </button>
  );
}

const PHASE_DONUT_COLORS: Record<RegiekamerFlowStepId, { stroke: string; label: string }> = {
  aanmelding:       { stroke: "#60A5FA", label: "Aanmelding" },
  matching:         { stroke: "#818CF8", label: "Matching" },
  aanbiederreactie: { stroke: "#FBBF24", label: "Aanbiederreactie" },
  plaatsing:        { stroke: "#34D399", label: "Plaatsing" },
  intake:           { stroke: "#6EE7B7", label: "Intake" },
};

function PhaseDonutPanel({
  items,
  activeTab,
  onPhaseClick,
}: {
  items: CoordinationDecisionOverviewItem[];
  activeTab: RegiekamerPhaseTab;
  onPhaseClick: (step: RegiekamerFlowStepId) => void;
}) {
  const counts = useMemo(() => ({
    aanmelding:       items.filter(i => phaseMatchesFlowStep(i, "aanmelding")).length,
    matching:         items.filter(i => phaseMatchesFlowStep(i, "matching")).length,
    aanbiederreactie: items.filter(i => phaseMatchesFlowStep(i, "aanbiederreactie")).length,
    plaatsing:        items.filter(i => phaseMatchesFlowStep(i, "plaatsing")).length,
    intake:           items.filter(i => phaseMatchesFlowStep(i, "intake")).length,
  }), [items]);
  const total = items.length;
  const R = 38;
  const CX = 48;
  const CY = 48;
  const CIRC = 2 * Math.PI * R;
  let cumulative = 0;
  const segments = (Object.keys(counts) as RegiekamerFlowStepId[]).map((step) => {
    const count = counts[step];
    const pct = total > 0 ? count / total : 0;
    const dashLen = pct * CIRC;
    const offset = -(cumulative * CIRC);
    cumulative += pct;
    return { step, count, pct, dashLen, offset };
  });
  return (
    <div
      className="rounded-xl border border-border/60 bg-white dark:bg-[var(--surface-elevated)] p-4"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
    >
      <p className="mb-3 text-[12px] font-semibold text-foreground">Faseverdeling</p>
      <div className="flex items-center gap-4">
        <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="currentColor" strokeWidth="9" className="text-border/25" />
          {segments.map(({ step, dashLen, offset }) =>
            dashLen > 0 && (
              <circle
                key={step}
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={PHASE_DONUT_COLORS[step].stroke}
                strokeWidth={activeTab === step ? 12 : 9}
                strokeDasharray={`${dashLen} ${CIRC}`}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${CX} ${CY})`}
                style={{ cursor: "pointer", transition: "stroke-width 0.15s" }}
                onClick={() => onPhaseClick(step)}
              />
            )
          )}
          <text x={CX} y={CY - 6} textAnchor="middle" dominantBaseline="auto" fill="currentColor" className="text-foreground" style={{ fontSize: "16px", fontWeight: 700 }}>{total}</text>
          <text x={CX} y={CY + 9} textAnchor="middle" dominantBaseline="auto" fill="currentColor" className="text-muted-foreground" style={{ fontSize: "9px" }}>totaal</text>
        </svg>
        <div className="min-w-0 flex-1 space-y-0.5">
          {(Object.keys(counts) as RegiekamerFlowStepId[]).map((step) => {
            const isActive = activeTab === step;
            return (
              <button
                key={step}
                type="button"
                onClick={() => onPhaseClick(step)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left transition-colors",
                  isActive
                    ? "bg-muted/50 dark:bg-muted/20"
                    : "hover:bg-muted/30 dark:hover:bg-muted/10",
                )}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-full transition-transform"
                    style={{
                      backgroundColor: PHASE_DONUT_COLORS[step].stroke,
                      transform: isActive ? "scale(1.4)" : "scale(1)",
                    }}
                  />
                  <span className={cn("truncate text-[11px]", isActive ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {PHASE_DONUT_COLORS[step].label}
                  </span>
                </div>
                <span className={cn("shrink-0 text-[11px] font-medium", isActive ? "text-foreground" : "text-muted-foreground/70")}>
                  {counts[step]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DelayReasonsPanel({
  items,
  activeReason,
  onReasonClick,
}: {
  items: CoordinationDecisionOverviewItem[];
  activeReason: string;
  onReasonClick: (reason: string) => void;
}) {
  const reasons = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const title = item.top_blocker?.title || item.top_alert?.title;
      if (title) map.set(title, (map.get(title) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [items]);
  const max = reasons[0]?.[1] ?? 1;
  return (
    <div
      className="rounded-xl border border-border/60 bg-white dark:bg-[var(--surface-elevated)] p-4"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
    >
      <p className="mb-3 text-[12px] font-semibold text-foreground">Vertraging oorzaken</p>
      {reasons.length === 0 ? (
        <p className="text-[12px] italic text-muted-foreground/60">Geen actieve blokkades</p>
      ) : (
        <div className="space-y-1">
          {reasons.map(([reason, count]) => {
            const isActive = activeReason === reason;
            return (
              <button
                key={reason}
                type="button"
                onClick={() => onReasonClick(reason)}
                className={cn(
                  "w-full rounded-lg px-2 py-1.5 text-left transition-colors",
                  isActive ? "bg-muted/50 dark:bg-muted/20" : "hover:bg-muted/30 dark:hover:bg-muted/10",
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className={cn("max-w-[75%] truncate text-[11px]", isActive ? "font-medium text-foreground" : "text-foreground/80")}>
                    {reason}
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/30">
                  <div
                    className={cn("h-full rounded-full transition-all", isActive ? "bg-care-urgent-text/80" : "bg-care-urgent-text/40")}
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SlaBreakdownPanel({
  items,
  slaFilterActive,
  onSlaToggle,
}: {
  items: CoordinationDecisionOverviewItem[];
  slaFilterActive: boolean;
  onSlaToggle: () => void;
}) {
  const counts = useMemo(() => {
    let breached = 0, soon = 0, ok = 0, none = 0;
    for (const item of items) {
      const { status } = getSlaCountdown(item);
      if (status === "breached") breached++;
      else if (status === "soon") soon++;
      else if (status === "ok") ok++;
      else none++;
    }
    return { breached, soon, ok, none, total: items.length };
  }, [items]);
  const { breached, soon, ok, none, total } = counts;
  const rows: Array<{ label: string; count: number; bar: string; text: string; clickable: boolean }> = [
    { label: "Overschreden", count: breached, bar: "bg-care-urgent-text/60",  text: "text-care-urgent-text",  clickable: true },
    { label: "Bijna",        count: soon,     bar: "bg-care-warning-text/60", text: "text-care-warning-text", clickable: true },
    { label: "Op tijd",      count: ok,       bar: "bg-care-success-text/60", text: "text-care-success-text", clickable: false },
    { label: "Geen SLA",     count: none,     bar: "bg-muted-foreground/25",  text: "text-muted-foreground",  clickable: false },
  ];
  return (
    <div
      className="rounded-xl border border-border/60 bg-white dark:bg-[var(--surface-elevated)] p-4"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
    >
      <p className="mb-3 text-[12px] font-semibold text-foreground">SLA-status</p>
      <div className="space-y-1">
        {rows.map(({ label, count, bar, text, clickable }) => {
          const isActive = slaFilterActive && clickable;
          const Tag = clickable ? "button" : "div";
          return (
            <Tag
              key={label}
              {...(clickable ? { type: "button" as const, onClick: onSlaToggle } : {})}
              className={cn(
                "grid w-full grid-cols-[96px_1fr_28px] items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                clickable && (isActive
                  ? "bg-muted/50 dark:bg-muted/20"
                  : "hover:bg-muted/30 dark:hover:bg-muted/10 cursor-pointer"),
              )}
            >
              <span className={cn("w-full truncate text-left text-[11px]", isActive ? "font-medium" : "", text)}>{label}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted/25">
                <div
                  className={cn("h-full rounded-full transition-all", bar, isActive && "opacity-100")}
                  style={{ width: total > 0 ? `${(count / total) * 100}%` : "0%", opacity: isActive ? 1 : 0.7 }}
                />
              </div>
              <span className={cn("text-right text-[11px] font-medium tabular-nums", isActive ? "text-foreground" : "text-muted-foreground")}>{count}</span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
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

function getPriorityAccentTone(item: CoordinationDecisionOverviewItem): "urgent" | "warning" | "low" | "neutral" {
  if (item.priority_score >= 100 || item.urgency === "critical") return "urgent";
  if (item.priority_score >= 70 || item.urgency === "high") return "warning";
  if (item.priority_score >= 30) return "low";
  return "neutral";
}

function getPhaseStyleInfo(phase: string): { label: string; className: string } {
  const normalized = normalizeApiPhaseId(phase) as string;
  const map: Record<string, { label: string; className: string }> = {
    casus: { label: "Aanmelding", className: "bg-care-info-bg text-care-info-text border-care-info-border" },
    samenvatting: { label: "Aanmelding", className: "bg-care-info-bg text-care-info-text border-care-info-border" },
    matching: { label: "Matching", className: "bg-care-brand-bg text-care-brand-text border-care-brand-border" },
    gemeente_validatie: { label: "Matching", className: "bg-care-brand-bg text-care-brand-text border-care-brand-border" },
    wacht_op_validatie: { label: "Matching", className: "bg-care-brand-bg text-care-brand-text border-care-brand-border" },
    aanbieder_beoordeling: { label: "Aanbiederreactie", className: "bg-care-warning-bg text-care-warning-text border-care-warning-border" },
    plaatsing: { label: "Plaatsing", className: "bg-care-success-bg text-care-success-text border-care-success-border" },
    intake: { label: "Intake", className: "bg-care-success-bg text-care-success-text border-care-success-border" },
  };
  return map[normalized] ?? {
    label: normalized.charAt(0).toUpperCase() + normalized.slice(1),
    className: "bg-muted text-muted-foreground border-border",
  };
}

function formatOwnerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0] ?? fullName;
  const first = parts[0] ?? "";
  const lastInitial = parts[parts.length - 1]?.[0] ?? "";
  return `${first} ${lastInitial}.`;
}

const REGIEKAMER_COLS = "minmax(11rem,1.8fr) 8rem 7.5rem minmax(9rem,1.4fr) 8.5rem minmax(7rem,0.9fr) minmax(9rem,1.1fr)";

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
  const accentTone = getPriorityAccentTone(item);
  const { label: actionLabel, variant: actionVariant } = rowNextAction(item);
  const blokkadeTitle = item.top_blocker?.title || item.top_alert?.title || null;
  const blokkadeMsg = item.top_blocker?.message || item.top_alert?.message || null;
  const hasBlocker = !!(blokkadeTitle || blokkadeMsg);
  const ownerDisplay = formatOwnerName(currentUserName);

  return (
    <CareWorklistRow
      testId="coordination-worklist-item"
      cols={REGIEKAMER_COLS}
      accentTone={accentTone}
      isSelected={isSelected}
      onRowClick={() => onSelect(rowId)}
    >
      {/* Casus: ref + name */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[12px] font-medium tracking-tight text-muted-foreground">
            Casus {item.case_reference}
          </span>
          {item.urgency_applied && (
            <span className="inline-flex items-center rounded-full bg-care-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-care-warning-text shrink-0">
              Urgentie
            </span>
          )}
        </div>
        <span className="mt-1 block text-[13px] font-medium leading-snug text-foreground line-clamp-2">
          {item.title}
        </span>
      </div>

      {/* Fase */}
      <div className="flex items-start pt-0.5">
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", phaseInfo.className)}>
          {phaseInfo.label}
        </span>
      </div>

      {/* Prioriteit — score circle + band label */}
      <div className="flex flex-col items-start gap-0.5 pt-0.5">
        <div
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full border text-[12px] font-bold tabular-nums",
            accentTone === "urgent"
              ? "border-care-urgent-border bg-care-urgent-bg text-care-urgent-text"
              : accentTone === "warning"
                ? "border-care-warning-border bg-care-warning-bg text-care-warning-text"
                : "border-border/40 bg-muted/40 text-foreground/60",
          )}
        >
          {item.priority_score >= 100 ? "!" : item.priority_score}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {PRIORITY_BAND_LABELS[priorityBand(item.priority_score)] ?? ""}
        </span>
      </div>

      {/* Blokkade — compact badge chip + muted detail line */}
      <div className="min-w-0">
        {hasBlocker ? (
          <div className="min-w-0">
            {blokkadeTitle && (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-care-urgent-border bg-care-urgent-bg px-1.5 py-0.5 text-[11px] font-medium text-care-urgent-text">
                <AlertCircle size={11} className="shrink-0" aria-hidden />
                <span className="truncate">{blokkadeTitle}</span>
              </span>
            )}
            {blokkadeMsg && (
              <p className="mt-1 text-[12px] leading-snug text-muted-foreground line-clamp-2">{blokkadeMsg}</p>
            )}
          </div>
        ) : (
          <span className="text-[12px] text-muted-foreground/50 italic">Geen blokkade</span>
        )}
      </div>

      {/* Eigenaar */}
      <div className="flex items-start gap-2 pt-0.5">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
          {currentUserName.charAt(0).toUpperCase()}
        </span>
        <span className="text-[12px] leading-snug text-foreground/80 pt-0.5">{ownerDisplay}</span>
      </div>

      {/* Wachttijd — SLA-aftelling */}
      <CareSlaCountdown item={item} />

      {/* Volgende actie */}
      <CareWorklistRowAction>
        <button
          type="button"
          aria-label={actionLabel}
          className={cn(
            "flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[12px] font-medium transition-colors",
            ACTION_BUTTON_CLASSES[actionVariant],
          )}
          onClick={(e) => { e.stopPropagation(); onCaseClick(rowId); }}
        >
          {actionLabel}
          <ChevronRight size={12} className="shrink-0 opacity-60" aria-hidden />
        </button>
      </CareWorklistRowAction>
    </CareWorklistRow>
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
  const { label: ctaLabel, variant: ctaVariant } = rowNextAction(item);
  const actionItems = (() => {
    const result: Array<{ label: string; due: string; urgent: boolean }> = [];
    const blockerTitle = item.top_blocker?.title ?? item.top_blocker?.message ?? null;
    const alertTitle = item.top_alert?.title ?? null;
    if (blockerTitle) {
      result.push({ label: `Los op: ${blockerTitle}`, due: "Vandaag", urgent: true });
    }
    if (alertTitle && alertTitle !== blockerTitle) {
      result.push({ label: alertTitle, due: "Binnen 2 dagen", urgent: false });
    }
    if (result.length === 0 && ctaVariant !== "waiting" && ctaVariant !== "default") {
      result.push({ label: ctaLabel, due: "Spoedig", urgent: ctaVariant === "blocking" });
    }
    return result;
  })();
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
          <span className="truncate font-mono text-[13px] font-medium tracking-tight text-foreground">
            Casus {item.case_reference}
          </span>
          <span className={cn("shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", phaseInfo.className)}>
            {phaseInfo.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Paneel sluiten"
          className="ml-2 shrink-0 rounded-[10px] p-1 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
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
              <button type="button" className="rounded-[10px] p-1.5 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors">
                <Phone size={14} />
              </button>
              <button type="button" className="rounded-[10px] p-1.5 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors">
                <Mail size={14} />
              </button>
              <button type="button" className="rounded-[10px] p-1.5 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors">
                <MoreHorizontal size={14} />
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium", isHoog ? "bg-care-warning-bg text-care-warning-text" : "bg-muted text-muted-foreground")}>
              {isHoog ? "Hoog" : "Normaal"}
            </span>
            <span className={cn("inline-flex items-center rounded-full bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium", sla.className)}>
              {sla.label}
            </span>
          </div>
        </div>

        {blokkadeTitle && (
          <div className="border-b border-border/40 px-5 py-3.5">
            <button
              type="button"
              className="flex w-full items-start gap-3 rounded-[10px] border border-care-urgent-border bg-care-urgent-bg px-3.5 py-3 text-left transition-colors hover:opacity-90"
              onClick={() => onCaseClick(String(item.case_id))}
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-care-urgent-text" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-care-urgent-text">{blokkadeTitle}</p>
                {blokkadeMsg && <p className="mt-0.5 line-clamp-2 text-[12px] text-care-urgent-text/80">{blokkadeMsg}</p>}
              </div>
              <ChevronRight size={14} className="mt-0.5 shrink-0 text-care-urgent-text" aria-hidden />
            </button>
          </div>
        )}

        <div className="border-b border-border/40 px-5 py-4">
          <p className="mb-3 care-text-eyebrow text-muted-foreground/60">Casusinfo</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <dt className="text-[11px] text-muted-foreground">Fase</dt>
              <dd className="mt-0.5">
                <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium", phaseInfo.className)}>{phaseInfo.label}</span>
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
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
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
                <span className={cn("rounded-full px-1.5 text-[10px] font-medium", activeDetailTab === tab.id ? "bg-foreground/10 text-foreground" : "bg-muted/40 text-muted-foreground")}>
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
                  <span className={cn("max-w-[3.5rem] text-center text-[10px] leading-tight", isActive ? "font-medium text-primary" : isDone ? "text-primary/60 dark:text-primary/50" : "text-muted-foreground/50")}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="mb-3 care-text-eyebrow text-muted-foreground/60">Actiepunten</p>
          {actionItems.length > 0 ? (
            <div className="space-y-3">
              {actionItems.map((action, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <div className="mt-0.5 size-4 shrink-0 rounded border-2 border-border/60 cursor-pointer hover:border-primary transition-colors" />
                  <p className="flex-1 text-[13px] text-foreground">{action.label}</p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", action.urgent ? "bg-care-urgent-bg text-care-urgent-text" : "bg-care-warning-bg text-care-warning-text")}>
                    {action.due}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground/60 italic">Geen openstaande actiepunten.</p>
          )}
        </div>
      </div>

      <div className="border-t border-border/40 p-5">
        <Button
          type="button"
          disabled={ctaVariant === "waiting"}
          className="flex w-full items-center justify-between gap-2 rounded-[10px] py-2.5 text-[13px] font-medium"
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
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RegiekamerPhaseTab>("alle");
  const [showFiltersBar, setShowFiltersBar] = useState(false);
  const [showAll, setShowAll] = useState(false);

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

  const slaRiskTotal = useMemo(() => {
    const t = data?.totals;
    if (!t) {
      return 0;
    }
    // sla_breaches (added in backend v2) counts every SLA-tagged item across all phases.
    // Fall back to provider_sla_breaches for older API responses.
    return Math.max(0, t.sla_breaches ?? t.provider_sla_breaches ?? 0);
  }, [data?.totals]);

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
    if (filtersActive || showAll) {
      return visibleItems;
    }
    const attention = visibleItems.filter(itemNeedsCoordinationAttention);
    const base = attention.length > 0 ? attention : visibleItems;
    return base.slice(0, REGIEKAMER_COORDINATION_LIST_CAP);
  }, [visibleItems, filtersActive, showAll]);

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

  const allOverviewItems = data?.items ?? [];
  const directActieCount = useMemo(() => allOverviewItems.filter((i) => i.priority_score >= 100 || i.urgency === "critical").length, [allOverviewItems]);
  const blockedCount = useMemo(() => allOverviewItems.filter((i) => !!(i.top_blocker?.title || i.top_blocker?.message || i.top_alert?.message)).length, [allOverviewItems]);
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

  const clearFilters = () => {
    setSearchQuery("");
    setPriorityFilter("all");
    setIssueFilter("all");
    setPhaseFilter("all");
    setOwnershipFilter("all");
    setCategoryFilter("all");
    setSubcategoryFilter("all");
  };

  const isDirectActieActive = priorityFilter === "critical";
  const isGeblokkeerddActive = issueFilter === "blockers" && priorityFilter !== "critical";
  const isTermijnrisicoActive = issueFilter === "SLA";

  const PHASE_TABS: Array<{ id: string; label: string; count: number }> = [
    { id: "alle", label: "Alle casussen", count: phaseTabCounts.alle },
    { id: "aanmelding", label: "Aanmelding", count: phaseTabCounts.aanmelding },
    { id: "matching", label: "Matching", count: phaseTabCounts.matching },
    { id: "aanbiederreactie", label: "Aanbiederreactie", count: phaseTabCounts.aanbiederreactie },
    { id: "plaatsing", label: "Plaatsing", count: phaseTabCounts.plaatsing },
    { id: "intake", label: "Intake", count: phaseTabCounts.intake },
    { id: "hoog-urgent", label: "Hoog urgent", count: phaseTabCounts["hoog-urgent"] },
  ];

  return (
    <CareCommandShell
      testId="regiekamer-page"
      title="Regiekamer"
      lastUpdatedLabel={lastUpdateLabel || undefined}
      onRefresh={refetch}
      actions={canCreateCase && onCreateCase ? (
        <Button
          type="button"
          className="h-9 min-h-9 rounded-[10px] px-4 text-[13px] font-medium shadow-sm"
          onClick={onCreateCase}
        >
          Nieuwe aanmelding
          <Plus className="ml-2 size-4 translate-y-px" aria-hidden />
        </Button>
      ) : undefined}
    >
      {/* 4-column KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RegiekamerKpiCard
          icon={AlertCircle}
          value={directActieCount}
          label="Direct actie"
          subtitle="Kritiek + blokkade"
          tone="urgent"
          isActive={isDirectActieActive}
          onClick={() => (isDirectActieActive ? clearFilters() : applyCriticalDrillFilter())}
        />
        <RegiekamerKpiCard
          icon={Lock}
          value={blockedCount}
          label="Geblokkeerd"
          subtitle="Actieve blokkades"
          tone="urgent"
          isActive={isGeblokkeerddActive}
          onClick={() => (isGeblokkeerddActive ? setIssueFilter("all") : setIssueFilter("blockers"))}
        />
        <RegiekamerKpiCard
          icon={Clock3}
          value={slaRiskTotal}
          label="Termijnrisico"
          subtitle="SLA overschreden"
          tone="warning"
          isActive={isTermijnrisicoActive}
          onClick={() => (isTermijnrisicoActive ? setIssueFilter("all") : setIssueFilter("SLA"))}
        />
        <RegiekamerKpiCard
          icon={Activity}
          value={activeCasesTotal}
          label="In beweging"
          subtitle="Actieve casussen"
          tone="neutral"
        />
      </div>

      {/* 3-column analytics panels */}
      {!loading && !error && hasActiveData && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <PhaseDonutPanel
            items={allOverviewItems}
            activeTab={activeTab}
            onPhaseClick={(step) => { setActiveTab(step); setSelectedCaseId(null); }}
          />
          <DelayReasonsPanel
            items={allOverviewItems}
            activeReason={searchQuery}
            onReasonClick={(reason) => setSearchQuery((prev) => (prev === reason ? "" : reason))}
          />
          <SlaBreakdownPanel
            items={allOverviewItems}
            slaFilterActive={isTermijnrisicoActive}
            onSlaToggle={() => (isTermijnrisicoActive ? setIssueFilter("all") : setIssueFilter("SLA"))}
          />
        </div>
      )}

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
                  className="h-9 min-h-9 rounded-[10px] px-4 text-[13px] font-medium shadow-sm"
                  onClick={onCreateCase}
                >
                  Nieuwe aanmelding
                </Button>
                <Button type="button" variant="outline" onClick={() => onAppNavigate("/casussen")}>
                  Open aanvragen
                </Button>
              </div>
            ) : canCreateCase && onCreateCase ? (
              <Button
                type="button"
                variant="default"
                className="h-9 min-h-9 rounded-[10px] px-4 text-[13px] font-medium shadow-sm"
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
        <>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-semibold text-foreground">Urgente casussen</h2>
              <span className="inline-flex items-center rounded-full bg-care-urgent-bg px-2 py-0.5 text-[11px] font-medium text-care-urgent-text">
                {coordinationListItems.length}
              </span>
            </div>
            {!filtersActive && !showAll && (data?.items?.length ?? 0) > REGIEKAMER_COORDINATION_LIST_CAP && (
              <button
                type="button"
                className="text-[12px] text-primary transition-colors hover:underline"
                onClick={() => setShowAll(true)}
              >
                Bekijk alle {data?.items?.length} →
              </button>
            )}
          </div>
        <CareWorklist testId="coordination-uitvoerlijst">
          <CareWorklistTabs
            tabs={PHASE_TABS}
            activeId={activeTab}
            onChange={(id) => { setActiveTab(id as RegiekamerPhaseTab); setSelectedCaseId(null); }}
          />

          <CareWorklistToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Zoek in werkvoorraad..."
            filtersActive={filtersActive}
            showFilters={showFiltersBar}
            onToggleFilters={() => setShowFiltersBar((v) => !v)}
          />

          <CareWorklistFilterPanel open={showFiltersBar}>
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
          </CareWorklistFilterPanel>

          <div className="overflow-x-auto">
            <CareWorklistColumnHeader
              columns={["Casus", "Fase", "Prioriteit", "Blokkade / Risico", "Eigenaar", "Wachttijd ↓", "Volgende actie"]}
              cols={REGIEKAMER_COLS}
            />
            <CareWorklistBody>
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
            </CareWorklistBody>
          </div>

          <CareWorklistPagination count={tabFilteredItems.length} />
        </CareWorklist>
        </>
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
    </CareCommandShell>
  );
}
