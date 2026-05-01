import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, ChevronDown, ChevronUp, Clock3, RefreshCw, Siren } from "lucide-react";
import { DominantActionPanel } from "../design/DominantActionPanel";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { CareEmptyState } from "./CareSurface";
import { CarePageScaffold } from "./CarePageScaffold";
import {
  CanonicalPhaseBadge,
  CareMetaChip,
  CareSearchFiltersBar,
  CareWorkRow,
} from "./CareUnifiedPage";
import { useRegiekamerDecisionOverview } from "../../hooks/useRegiekamerDecisionOverview";
import { getShortReasonLabel } from "../../lib/uxCopy";
import { imperativeLabelForActionCode } from "./nbaImperativeLabels";
import type {
  RegiekamerDecisionOverviewItem,
  RegiekamerOwnershipRole,
  RegiekamerPriorityBand,
} from "../../lib/regiekamerDecisionOverview";
import {
  computeRegiekamerNextBestAction,
  type RegiekamerNbaActionKey,
  type RegiekamerNbaUiMode,
} from "../../lib/regiekamerNextBestAction";

interface SystemAwarenessPageProps {
  onCaseClick: (caseId: string) => void;
  /** Shell navigation (e.g. metric strip → Casussen). Optional in standalone demos/tests. */
  onAppNavigate?: (path: string) => void;
}

type PriorityFilter = "all" | "critical" | "high" | "medium";
type IssueFilter = "all" | "blockers" | "risks" | "alerts" | "SLA" | "rejection" | "intake";
type PhaseFilter =
  | "all"
  | "casus"
  | "samenvatting"
  | "matching"
  | "gemeente_validatie"
  | "aanbieder_beoordeling"
  | "plaatsing"
  | "intake";
type OwnershipFilter = "all" | RegiekamerOwnershipRole;
const SECTION_STACK_CLASS = "space-y-1.5";

const REGIEKAMER_PATH = "/regiekamer";

const PRIORITY_PARAM_VALUES = new Set<PriorityFilter>(["all", "critical", "high", "medium"]);
const ISSUE_PARAM_VALUES = new Set<IssueFilter>(["all", "blockers", "risks", "alerts", "SLA", "rejection", "intake"]);
const PHASE_PARAM_VALUES = new Set<PhaseFilter>([
  "all",
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
  return pathWithoutTrailingSlash(pathname) === REGIEKAMER_PATH;
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
  const ph = params.get("phase") as PhaseFilter;
  const phaseFilter = PHASE_PARAM_VALUES.has(ph) ? ph : "all";
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
  return qs ? `${REGIEKAMER_PATH}?${qs}` : REGIEKAMER_PATH;
}

type MetricNav = { kind: "cases" } | { kind: "issue"; issue: IssueFilter };

const PHASE_LABELS: Record<string, string> = {
  casus: "Casus",
  samenvatting: "Samenvatting",
  matching: "Matching",
  gemeente_validatie: "Gemeente validatie",
  aanbieder_beoordeling: "Wacht op aanbieder",
  plaatsing: "Plaatsing",
  intake: "Intake",
};

/** Canonieke keten voor doorloop-funnel (Regiekamer). */
const FLOW_PIPELINE_PHASES: PhaseFilter[] = [
  "casus",
  "samenvatting",
  "matching",
  "gemeente_validatie",
  "aanbieder_beoordeling",
  "plaatsing",
  "intake",
];

/** NBA action codes from API → korte Nederlandse label voor Regiekamer (alleen weergave). */
const NBA_ACTION_CODE_LABELS: Record<string, string> = {
  COMPLETE_CASE_DATA: "Casusgegevens aanvullen",
  GENERATE_SUMMARY: "Samenvatting genereren",
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
  medium: "Middel",
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
      return "Middel";
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

function imperativeCtaLabel(item: RegiekamerDecisionOverviewItem): string | null {
  const nba = item.next_best_action;
  if (!nba) {
    return null;
  }
  return imperativeLabelForActionCode(nba.action, nba.label);
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

function issueText(item: RegiekamerDecisionOverviewItem) {
  if (item.top_blocker) {
    return item.top_blocker.message ?? item.top_blocker.title ?? item.top_blocker.code;
  }
  if (item.top_risk) {
    return item.top_risk.message ?? item.top_risk.title ?? item.top_risk.code;
  }
  if (item.top_alert) {
    return item.top_alert.message ?? item.top_alert.title ?? item.top_alert.code;
  }
  return "Geen actieve blokkade";
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

function issueTypeLabel(item: RegiekamerDecisionOverviewItem) {
  if (item.top_blocker) {
    return "Blokkade";
  }
  if (item.top_risk) {
    return "Risico";
  }
  if (item.top_alert) {
    return "Alert";
  }
  return "Status";
}

/** Decision-system problem class (uppercase, scannable). */
function issueTypeLabelUpper(item: RegiekamerDecisionOverviewItem): string {
  const t = issueTypeLabel(item);
  if (t === "Blokkade") {
    return "BLOKKADE";
  }
  if (t === "Risico") {
    return "RISICO";
  }
  if (t === "Alert") {
    return "ALERT";
  }
  return "STATUS";
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
  return "Geen expliciet signaal vastgelegd; open detail om te controleren.";
}

function impactLine(item: RegiekamerDecisionOverviewItem): string {
  const hours = item.hours_in_current_state;
  const urg = (item.urgency || "").toLowerCase();
  const parts: string[] = [];
  if (hours != null && !Number.isNaN(hours) && hours >= 168) {
    parts.push(`Casus staat al ${formatHours(hours)} in dezelfde stap; doorlooptijd loopt vast.`);
  } else if (hours != null && !Number.isNaN(hours) && hours >= 72) {
    parts.push(`Langere stilstand (${formatHours(hours)}) vergroot vertragingsrisico.`);
  } else if (hours != null && !Number.isNaN(hours) && hours >= 24) {
    parts.push(`Stap duurt ${formatHours(hours)}; bewaak opvolging.`);
  }
  if (urg === "critical" || urg === "crisis" || urg === "high") {
    parts.push("Verhoogde urgentie vraagt snellere regie.");
  }
  if (item.priority_score >= 120) {
    parts.push("Hoge prioriteit in dit overzicht.");
  }
  if (parts.length === 0) {
    return "Geen acute doorloop-impact gemeld; blijf signalen monitoren.";
  }
  return parts.join(" ");
}

function ownerLabel(item: RegiekamerDecisionOverviewItem): string {
  const role = (item.responsible_role ?? "regie") as OwnershipFilter;
  return OWNERSHIP_LABELS[role] ?? "Regie";
}

function recommendedActionLine(item: RegiekamerDecisionOverviewItem): string {
  const nba = item.next_best_action;
  if (nba?.label) {
    const reason = (nba.reason || "").trim();
    return reason ? `${nba.label} — ${reason}` : nba.label;
  }
  const code = item.top_alert?.recommended_action;
  if (code) {
    return NBA_ACTION_CODE_LABELS[code] ?? code;
  }
  return "Geen automatische vervolgstap; bekijk casusdetail.";
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

function filterLabelFromItem(item: RegiekamerDecisionOverviewItem) {
  const responsibleRole = item.responsible_role ?? "regie";
  const nextAction = item.next_best_action?.label ?? "Geen vervolgstap";
  return `${OWNERSHIP_LABELS[responsibleRole]} · ${nextAction}`;
}

function metricNavForItemKey(key: string): MetricNav {
  if (key === "cases") {
    return { kind: "cases" };
  }
  if (key === "blockers") {
    return { kind: "issue", issue: "blockers" };
  }
  if (key === "alerts") {
    return { kind: "issue", issue: "alerts" };
  }
  if (key === "sla") {
    return { kind: "issue", issue: "SLA" };
  }
  if (key === "rejections") {
    return { kind: "issue", issue: "rejection" };
  }
  if (key === "intake") {
    return { kind: "issue", issue: "intake" };
  }
  return { kind: "issue", issue: "all" };
}

function countByPhase(items: RegiekamerDecisionOverviewItem[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const it of items) {
    const p = (it.phase || "").trim() || "onbekend";
    m[p] = (m[p] ?? 0) + 1;
  }
  return m;
}

function dominantFlowPhase(
  items: RegiekamerDecisionOverviewItem[],
): { phase: PhaseFilter; count: number; label: string } | null {
  if (items.length === 0) {
    return null;
  }
  const counts = countByPhase(items);
  let best: PhaseFilter | "onbekend" = "casus";
  let bestN = -1;
  for (const ph of FLOW_PIPELINE_PHASES) {
    const n = counts[ph] ?? 0;
    if (n > bestN) {
      bestN = n;
      best = ph;
    }
  }
  if (bestN <= 0) {
    return null;
  }
  return { phase: best as PhaseFilter, count: bestN, label: PHASE_LABELS[best] ?? best };
}

function failureShareLines(items: RegiekamerDecisionOverviewItem[]): { label: string; pct: number }[] {
  if (items.length === 0) {
    return [];
  }
  const total = items.length;
  const rows = FLOW_PIPELINE_PHASES.map((ph) => ({
    label: PHASE_LABELS[ph] ?? ph,
    pct: Math.round(((countByPhase(items)[ph] ?? 0) / total) * 100),
  })).sort((a, b) => b.pct - a.pct);
  return rows.filter((r) => r.pct > 0).slice(0, 3);
}

function dominantMetricKey(totals: {
  critical_blockers: number;
  high_priority_alerts: number;
  provider_sla_breaches: number;
  intake_delays: number;
  repeated_rejections: number;
}): string | null {
  if (totals.critical_blockers > 0) {
    return "blockers";
  }
  if (totals.high_priority_alerts > 0) {
    return "alerts";
  }
  if (totals.provider_sla_breaches > 0) {
    return "sla";
  }
  if (totals.intake_delays > 0) {
    return "intake";
  }
  if (totals.repeated_rejections > 0) {
    return "rejections";
  }
  return null;
}

/** UI-only Regiekamer modes — computed via `computeRegiekamerNextBestAction` (deterministic). */
export type RegiekamerUiMode = RegiekamerNbaUiMode;

const FLOW_CHAIN_LABEL =
  "Casus → Samenvatting → Matching → Gemeente validatie → Wacht op aanbieder → Plaatsing → Intake";

function CompactMetricStrip({
  totals,
  onMetricNavigate,
}: {
  totals: {
    active_cases: number;
    critical_blockers: number;
    high_priority_alerts: number;
    provider_sla_breaches: number;
    intake_delays: number;
  };
  onMetricNavigate: (nav: MetricNav) => void;
}) {
  const dom = dominantMetricKey({
    critical_blockers: totals.critical_blockers,
    high_priority_alerts: totals.high_priority_alerts,
    provider_sla_breaches: totals.provider_sla_breaches,
    intake_delays: totals.intake_delays,
    repeated_rejections: 0,
  });
  type MetricTone = "neutral" | "critical" | "warning" | "success";
  const slaBreaches = totals.provider_sla_breaches;
  const items: Array<{
    key: string;
    testId: string;
    label: string;
    value: string | number;
    tone: MetricTone;
    dominant: boolean;
  }> = [
    {
      key: "cases",
      testId: "regiekamer-summary-active",
      label: "Actief",
      value: totals.active_cases,
      tone: "neutral",
      dominant: false,
    },
    {
      key: "blockers",
      testId: "regiekamer-summary-critical",
      label: "Geblokkeerd",
      value: totals.critical_blockers,
      tone: totals.critical_blockers > 0 ? "critical" : "neutral",
      dominant: dom === "blockers",
    },
    {
      key: "alerts",
      testId: "regiekamer-summary-alerts",
      label: "Risico's",
      value: totals.high_priority_alerts,
      tone: totals.high_priority_alerts > 0 ? "warning" : "neutral",
      dominant: dom === "alerts",
    },
    {
      key: "sla",
      testId: "regiekamer-summary-sla",
      label: "SLA",
      value: slaBreaches === 0 ? "OK" : `${slaBreaches} te laat`,
      tone: slaBreaches === 0 ? "success" : "warning",
      dominant: dom === "sla",
    },
    {
      key: "intake",
      testId: "regiekamer-summary-intake",
      label: "Intake vertraagd",
      value: totals.intake_delays,
      tone: totals.intake_delays > 0 ? "warning" : "neutral",
      dominant: dom === "intake",
    },
  ];

  const toneClass = (tone: MetricTone) => {
    if (tone === "critical") {
      return "border-red-500/25 bg-red-500/[0.07] text-red-100/95";
    }
    if (tone === "warning") {
      return "border-amber-500/25 bg-amber-500/[0.07] text-amber-100/95";
    }
    if (tone === "success") {
      return "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-100/95";
    }
    return "border-border/50 bg-muted/10 text-foreground";
  };

  return (
    <section data-testid="metric-strip" data-density="compact" className="w-full rounded-xl border border-border/50 bg-card/50 p-2">
      <p className="sr-only">
        Filters op het overzicht. Elke tegel past het casuslijst-filter aan of opent de werkvoorraad bij Actief.
      </p>
      <div className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            data-testid={item.testId}
            data-metric-supports-dominant={item.dominant ? "true" : undefined}
            aria-label={`Filter: ${item.label}, waarde ${item.value}.`}
            onClick={() => {
              onMetricNavigate(metricNavForItemKey(item.key));
            }}
            className={cn(
              "flex h-11 w-full min-w-0 cursor-pointer flex-col items-stretch justify-center gap-0.5 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-3",
              toneClass(item.tone),
              item.dominant && "border-l-2 border-l-primary/55 pl-2",
            )}
          >
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</span>
            <span className="truncate text-right text-[15px] font-semibold tabular-nums leading-none">
              {item.value}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

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

export function SystemAwarenessPage({ onCaseClick, onAppNavigate }: SystemAwarenessPageProps) {
  const { data, loading, error, refetch } = useRegiekamerDecisionOverview();
  const initialFromUrl = readFiltersFromUrl();
  const [searchQuery, setSearchQuery] = useState(initialFromUrl.searchQuery);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(initialFromUrl.priorityFilter);
  const [issueFilter, setIssueFilter] = useState<IssueFilter>(initialFromUrl.issueFilter);
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>(initialFromUrl.phaseFilter);
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>(initialFromUrl.ownershipFilter);
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [regieActionsExpanded, setRegieActionsExpanded] = useState(false);

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

  const handleMetricNavigate = useCallback(
    (nav: MetricNav) => {
      if (nav.kind === "cases") {
        onAppNavigate?.("/casussen");
        return;
      }
      setIssueFilter(nav.issue);
      if (typeof window === "undefined") {
        return;
      }
      if (!isRegiekamerPath(window.location.pathname)) {
        return;
      }
      const next = buildRegiekamerUrl({
        searchQuery,
        priorityFilter,
        issueFilter: nav.issue,
        phaseFilter,
        ownershipFilter,
      });
      window.history.pushState(window.history.state, "", next);
    },
    [onAppNavigate, ownershipFilter, phaseFilter, priorityFilter, searchQuery],
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
        if (phaseFilter !== "all" && item.phase !== phaseFilter) {
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

  const generatedAtLabel = useMemo(() => {
    if (!data?.generated_at) {
      return "";
    }

    const date = new Date(data.generated_at);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const datePart = new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
    const timePart = new Intl.DateTimeFormat("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
    return `${datePart}, ${timePart}`;
  }, [data?.generated_at]);

  const hasAnySignals = Boolean(data?.items?.some((item) => item.priority_score > 0));
  const hasActiveData = (data?.totals.active_cases ?? 0) > 0;
  const filtersActive =
    searchQuery.trim() !== "" ||
    priorityFilter !== "all" ||
    issueFilter !== "all" ||
    phaseFilter !== "all" ||
    ownershipFilter !== "all";
  const urgentItems = visibleItems.filter((item) => item.urgency === "critical" || item.urgency === "warning");
  const calmerItems = visibleItems.filter((item) => item.urgency !== "critical" && item.urgency !== "warning");
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
  const failureLines = useMemo(() => failureShareLines(allOverviewItems), [allOverviewItems]);
  const flowHotspot = useMemo(() => dominantFlowPhase(allOverviewItems), [allOverviewItems]);
  const phaseCountsMap = useMemo(() => countByPhase(allOverviewItems), [allOverviewItems]);
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
      }),
    [
      activeCasesTotal,
      criticalBlockers,
      highPriorityAlerts,
      intakeDelaysTotal,
      noMatchUrgentCount,
      providerSlaBreaches,
    ],
  );

  const uiMode = regiekamerNba.panel.uiMode;

  const actionReminders = useCallback(() => {
    setSearchQuery("");
    setPriorityFilter("all");
    setIssueFilter("SLA");
    setPhaseFilter("aanbieder_beoordeling");
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
    runNbaAction(regiekamerNba.primaryAction.actionKey);
  }, [regiekamerNba.primaryAction.actionKey, runNbaAction]);

  const runModeSecondary = useCallback(() => {
    const secondary = regiekamerNba.secondaryAction;
    if (secondary) {
      runNbaAction(secondary.actionKey);
    }
  }, [regiekamerNba.secondaryAction, runNbaAction]);

  const applyModeCasesLink = useCallback(() => {
    runModePrimary();
  }, [runModePrimary]);

  const dominantPanelDescription = regiekamerNba.impactHint
    ? `${regiekamerNba.description} ${regiekamerNba.impactHint}`
    : regiekamerNba.description;

  const showInsightSections = uiMode === "stable" || uiMode === "optimization";

  const insightWhyBullets = useMemo(() => {
    const bullets: string[] = [];
    for (const row of failureLines) {
      bullets.push(`${row.pct}% van de casussen staat in ${row.label}.`);
    }
    return bullets.slice(0, 3);
  }, [failureLines]);

  const regieActionDefs = useMemo(() => {
    const rows: { key: string; title: string; cta: string; onClick: () => void }[] = [];
    if (uiMode === "crisis") {
      return rows;
    }
    if (uiMode === "intervention") {
      rows.push({
        key: "align-dominant",
        title: "Zelfde prioriteit als het paneel hierboven",
        cta: regiekamerNba.primaryAction.label,
        onClick: runModePrimary,
      });
      if (regiekamerNba.secondaryAction) {
        rows.push({
          key: "align-secondary",
          title: "Alternatieve vervolgstap",
          cta: regiekamerNba.secondaryAction.label,
          onClick: runModeSecondary,
        });
      }
      return rows;
    }
    if (uiMode === "stable") {
      rows.push({
        key: "stock",
        title: "Open de werkvoorraad voor detail en prioriteit",
        cta: "Bekijk werkvoorraad",
        onClick: () => onAppNavigate?.("/casussen"),
      });
      return rows;
    }
    rows.push({
      key: "reports",
      title: "Rapportages en trends voor ketenverbetering",
      cta: "Analyseer prestaties",
      onClick: () => onAppNavigate?.("/rapportages"),
    });
    rows.push({
      key: "stock",
      title: "Casussen blijven de bron voor dagelijkse regie",
      cta: "Bekijk werkvoorraad",
      onClick: () => onAppNavigate?.("/casussen"),
    });
    return rows;
  }, [onAppNavigate, regiekamerNba.primaryAction.label, regiekamerNba.secondaryAction, runModePrimary, runModeSecondary, uiMode]);

  const regieVisibleCap = regieActionsExpanded ? 3 : 2;
  const regieVisibleActions = regieActionDefs.slice(0, regieVisibleCap);
  const regieHasMore = regieActionDefs.length > regieVisibleCap;

  const clearFilters = () => {
    setSearchQuery("");
    setPriorityFilter("all");
    setIssueFilter("all");
    setPhaseFilter("all");
    setOwnershipFilter("all");
  };

  return (
    <CarePageScaffold
      archetype="decision"
      className="pb-8"
      title={<span className="inline-flex items-center gap-2"><Siren size={16} className="text-primary" />Regiekamer</span>}
      subtitle="Waar moet je nu ingrijpen? Alleen signalen die regie-actie vragen."
      actions={(
        <>
          <Button variant="outline" onClick={refetch} className="gap-2">
            <RefreshCw size={14} />
            Ververs
          </Button>
          {generatedAtLabel && <p className="text-xs text-muted-foreground">Bijgewerkt op {generatedAtLabel}</p>}
          {filtersActive && (
            <Button variant="ghost" onClick={clearFilters} className="gap-2">
              Filters wissen
            </Button>
          )}
        </>
      )}
      dominantAction={
        <div className={SECTION_STACK_CLASS}>
          {hasActiveData && (
            <DominantActionPanel
              tone={regiekamerNba.panel.tone}
              title={regiekamerNba.title}
              description={dominantPanelDescription}
              primaryAction={{
                label: regiekamerNba.primaryAction.label,
                onClick: runModePrimary,
                testId: "regiekamer-dominant-primary-cta",
              }}
              secondaryAction={
                regiekamerNba.secondaryAction
                  ? {
                      label: regiekamerNba.secondaryAction.label,
                      onClick: runModeSecondary,
                      testId: "regiekamer-dominant-secondary-cta",
                    }
                  : undefined
              }
              supplementalLink={
                regiekamerNba.panel.showCasesLink && regiekamerNba.panel.linkCount > 0
                  ? {
                      label: `Bekijk casussen (${regiekamerNba.panel.linkCount})`,
                      onClick: applyModeCasesLink,
                      testId: "regiekamer-dominant-cases-link",
                    }
                  : undefined
              }
              panelTestId="regiekamer-dominant-action"
              rootDataset={{ "data-regiekamer-mode": uiMode }}
            />
          )}

          <CompactMetricStrip
            totals={{
              active_cases: data?.totals.active_cases ?? 0,
              critical_blockers: criticalBlockers,
              high_priority_alerts: highPriorityAlerts,
              provider_sla_breaches: providerSlaBreaches,
              intake_delays: data?.totals.intake_delays ?? 0,
            }}
            onMetricNavigate={handleMetricNavigate}
          />

          {hasActiveData && allOverviewItems.length > 0 && showInsightSections && (
            <>
              <details
                data-testid="regiekamer-insight-why"
                className="rounded-xl border border-border/50 bg-card/35 open:[&_summary_svg]:rotate-180"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  Waarom gebeurt dit?
                  <ChevronDown size={18} className="shrink-0 text-muted-foreground transition-transform" aria-hidden />
                </summary>
                <div className="border-t border-border/40 px-4 pb-4 pt-3">
                  {insightWhyBullets.length > 0 ? (
                    <ul className="list-disc space-y-1.5 pl-4 text-sm leading-snug text-foreground/95">
                      {insightWhyBullets.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Geen aanvullende verdeling beschikbaar.</p>
                  )}
                  {flowHotspot && flowHotspot.count > 0 && (
                    <p className="mt-3 text-sm font-medium leading-snug text-foreground">
                      Grootste knelpunt: {flowHotspot.label}
                      {flowHotspot.phase === "aanbieder_beoordeling"
                        ? " — casussen blijven hangen vóór beoordeling."
                        : ` — ${flowHotspot.count} casussen in deze fase.`}
                    </p>
                  )}
                </div>
              </details>

              <details
                data-testid="regiekamer-insight-flow"
                className="rounded-xl border border-border/50 bg-card/35 open:[&_summary_svg]:rotate-180"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  Bekijk doorloop in de keten
                  <ChevronDown size={18} className="shrink-0 text-muted-foreground transition-transform" aria-hidden />
                </summary>
                <div className="border-t border-border/40 px-4 pb-4 pt-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">{FLOW_CHAIN_LABEL}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {FLOW_PIPELINE_PHASES.map((ph) => {
                      const n = phaseCountsMap[ph] ?? 0;
                      return (
                        <div
                          key={ph}
                          className="flex min-w-[3.75rem] flex-1 flex-col items-center rounded-md border border-border/50 bg-background/30 px-1.5 py-1.5 text-center"
                        >
                          <span className="text-base font-bold tabular-nums leading-none text-foreground">{n}</span>
                          <span className="mt-0.5 line-clamp-2 text-[9px] font-semibold uppercase leading-tight text-muted-foreground">
                            {PHASE_LABELS[ph] ?? ph}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>
            </>
          )}

          {hasActiveData && uiMode !== "crisis" && regieVisibleActions.length > 0 && (
            <section
              data-testid="regiekamer-action-queue"
              className="rounded-xl border border-border/50 bg-card/30 px-4 py-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Regie-acties nu
              </p>
              <ol className="mt-2 space-y-2.5 text-sm text-foreground">
                {regieVisibleActions.map((row, idx) => (
                  <li
                    key={row.key}
                    className={cn(
                      "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
                      idx < regieVisibleActions.length - 1 && "border-b border-border/40 pb-2.5",
                    )}
                  >
                    <span>
                      <span className="font-semibold tabular-nums">{idx + 1}.</span> {row.title}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0 gap-1.5"
                      data-testid={idx === 0 ? "regiekamer-regie-action-primary" : undefined}
                      onClick={row.onClick}
                    >
                      {row.cta}
                      <ArrowRight size={14} />
                    </Button>
                  </li>
                ))}
              </ol>
              {regieHasMore && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="regiekamer-regie-actions-more"
                  className="mt-2 h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setRegieActionsExpanded((current) => !current)}
                >
                  {regieActionsExpanded ? "Minder acties" : "Toon meer acties"}
                </Button>
              )}
            </section>
          )}
        </div>
      }
      filters={
        <CareSearchFiltersBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Zoek casus, naam of type..."
          showSecondaryFilters={showSecondaryFilters}
          onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
          secondaryFilters={
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs text-muted-foreground">
                  Prioriteit
                  <select
                    aria-label="Prioriteit"
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                    className="mt-1 h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                  >
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Type
                  <select
                    aria-label="Type"
                    value={issueFilter}
                    onChange={(event) => setIssueFilter(event.target.value as IssueFilter)}
                    className="mt-1 h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                  >
                    {Object.entries(ISSUE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Fase
                  <select
                    aria-label="Fase"
                    value={phaseFilter}
                    onChange={(event) => setPhaseFilter(event.target.value as PhaseFilter)}
                    className="mt-1 h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                  >
                    <option value="all">Alles</option>
                    {Object.entries(PHASE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Rol
                  <select
                    aria-label="Rol"
                    value={ownershipFilter}
                    onChange={(event) => setOwnershipFilter(event.target.value as OwnershipFilter)}
                    className="mt-1 h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                  >
                    {Object.entries(OWNERSHIP_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
            }
        />
      }
    >
      {loading && (
        <CareEmptyState title="Regiekamer laden…" copy="Overzicht wordt opgebouwd." />
      )}

      {!loading && error && (
        <CareEmptyState
          title="Regiekamer kon niet worden geladen"
          copy={error}
          action={<Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>}
        />
      )}

      {!loading && !error && !hasActiveData && (
        <CareEmptyState title="Geen actieve casussen." copy="Zodra er casussen zijn, verschijnen ze hier met signalen en volgende stappen." />
      )}

      {!loading && !error && hasActiveData && !hasAnySignals && (
        <CareEmptyState title="Geen signalen." copy="De keten loopt zonder blokkades." />
      )}

      {!loading && !error && hasActiveData && hasAnySignals && visibleItems.length === 0 && (
        <CareEmptyState
          title="Geen casussen."
          copy="Pas filters aan."
          action={<Button variant="outline" onClick={clearFilters}>Filters wissen</Button>}
        />
      )}

      {!loading && !error && visibleItems.length > 0 && (
        <div className="space-y-4 px-1">
          {/* 5 — Verdieping: geen-match casussen (optioneel) */}
          {noMatchDrillItems.length > 0 && (
            <section className="rounded-xl border border-border/70 bg-card/30 px-3 py-3">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => setDeepDiveOpen(o => !o)}
                aria-expanded={deepDiveOpen}
              >
                <span className="text-sm font-semibold text-foreground">
                  Verdieping: casussen zonder match (hoog urgent) ({noMatchDrillItems.length})
                </span>
                {deepDiveOpen ? <ChevronUp size={18} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={18} className="shrink-0 text-muted-foreground" />}
              </button>
              {deepDiveOpen && (
                <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                  <ul className="space-y-2 text-sm text-foreground/90">
                    {noMatchDrillItems.slice(0, 12).map((item) => (
                      <li key={String(item.case_id)} className="flex flex-wrap items-baseline gap-x-2">
                        <button
                          type="button"
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                          onClick={() => onCaseClick(String(item.case_id))}
                        >
                          {item.case_reference}
                        </button>
                        <span className="text-muted-foreground">→</span>
                        <span className="min-w-0">{primaryProblemText(item)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/95">
                    <span className="font-semibold">Aanbeveling: </span>
                    verruim regio of herzie zorgtype; controleer capaciteit en escaleer bij herhaalde afwijzingen.
                  </div>
                </div>
              )}
            </section>
          )}

          {urgentItems.length > 0 && (
            <section className="space-y-1.5">
              <h2 className="text-[15px] font-semibold tracking-tight">Direct actie nodig ({urgentItems.length})</h2>
              <div className="space-y-1.5">
                {urgentItems.map((item) => (
                  <RegiekamerWorkItemCard key={item.case_id} item={item} onCaseClick={onCaseClick} urgent />
                ))}
              </div>
            </section>
          )}

          {calmerItems.length > 0 && (
            <section className="space-y-1.5">
              <h2 className="text-[15px] font-semibold">Casussen in behandeling ({calmerItems.length})</h2>
              <div className="space-y-1.5">
                {calmerItems.map((item) => (
                  <RegiekamerWorkItemCard key={item.case_id} item={item} onCaseClick={onCaseClick} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </CarePageScaffold>
  );
}

function RegiekamerWorkItemCard({
  item,
  onCaseClick,
  urgent = false,
}: {
  item: RegiekamerDecisionOverviewItem;
  onCaseClick: (caseId: string) => void;
  urgent?: boolean;
}) {
  const primaryAction = imperativeCtaLabel(item);
  const hasPrimaryNba = primaryAction != null && primaryAction.trim() !== "";
  const blockerLine = getShortReasonLabel(primaryProblemText(item), 56);
  const consequenceLine = getShortReasonLabel(impactLine(item), 110);
  return (
    <CareWorkRow
      testId="regiekamer-worklist-item"
      leading={<CanonicalPhaseBadge phaseId={item.phase} />}
      title={item.title}
      context={
        <span className="text-[12px] text-muted-foreground">
          <span className="font-mono text-[11px] text-muted-foreground/90">{item.case_reference}</span>
          {" · "}
          {ownerLabel(item)}
        </span>
      }
      status={
        <div className="flex max-w-full flex-col gap-1 md:items-center">
          <span className="text-[10px] font-bold tracking-[0.16em] text-foreground/90">
            {issueTypeLabelUpper(item)}
          </span>
          <p className="max-w-[20rem] text-[11px] font-medium leading-snug text-muted-foreground">
            {consequenceLine}
          </p>
          <CareMetaChip
            className={cn(
              "max-w-full whitespace-normal border text-left text-[12px] font-semibold leading-snug text-foreground",
              severityBadgeClasses(issueTone(item)),
            )}
          >
            <span className="line-clamp-2">{blockerLine}</span>
          </CareMetaChip>
        </div>
      }
      time={
        <CareMetaChip>
          <Clock3 size={12} />
          {formatHours(item.hours_in_current_state)}
        </CareMetaChip>
      }
      contextInfo={
        <CareMetaChip title={item.assigned_provider || "Nog geen aanbieder"} className="opacity-90">
          <Building2 size={12} />
          <span className="max-w-[140px] truncate">{item.assigned_provider || "Nog geen aanbieder"}</span>
        </CareMetaChip>
      }
      actionLabel={hasPrimaryNba ? primaryAction! : ""}
      actionVariant="primary"
      hideAction={!hasPrimaryNba}
      onOpen={() => onCaseClick(String(item.case_id))}
      onAction={(event) => {
        event.stopPropagation();
        onCaseClick(String(item.case_id));
      }}
      accentTone={urgent ? "critical" : "neutral"}
    />
  );
}
