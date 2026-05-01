import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, ChevronDown, ChevronUp, Clock3, Info, RefreshCw, Siren, TriangleAlert } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { CareEmptyState } from "./CareSurface";
import {
  CareAttentionBar,
  CareMetaChip,
  CarePageTemplate,
  CareSearchFiltersBar,
  CareUnifiedHeader,
  CareWorkRow,
} from "./CareUnifiedPage";
import { useRegiekamerDecisionOverview } from "../../hooks/useRegiekamerDecisionOverview";
import { getShortReasonLabel } from "../../lib/uxCopy";
import type {
  RegiekamerDecisionOverviewItem,
  RegiekamerOwnershipRole,
  RegiekamerPriorityBand,
} from "../../lib/regiekamerDecisionOverview";

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

function phaseLabel(phase: string) {
  return PHASE_LABELS[phase] ?? (phase || "Onbekend");
}

/** Imperative next-best-action labels (decision system, not dashboard copy). */
const NBA_IMPERATIVE: Record<string, string> = {
  COMPLETE_CASE_DATA: "Vul casusgegevens aan",
  GENERATE_SUMMARY: "Genereer samenvatting",
  START_MATCHING: "Start matching",
  VALIDATE_MATCHING: "Valideer matching",
  SEND_TO_PROVIDER: "Stuur naar aanbieder",
  WAIT_PROVIDER_RESPONSE: "Volg aanbieder op",
  FOLLOW_UP_PROVIDER: "Volg aanbieder op",
  REMATCH_CASE: "Her-match casus",
  CONFIRM_PLACEMENT: "Bevestig plaatsing",
  START_INTAKE: "Start intake",
  MONITOR_CASE: "Bewaak casus",
  ARCHIVE_CASE: "Archiveer casus",
  PROVIDER_ACCEPT: "Verwerk acceptatie",
  PROVIDER_REJECT: "Verwerk afwijzing",
  PROVIDER_REQUEST_INFO: "Beantwoord infoverzoek",
};

function imperativeCtaLabel(item: RegiekamerDecisionOverviewItem): string {
  const code = item.next_best_action?.action?.trim();
  if (code && NBA_IMPERATIVE[code]) {
    return NBA_IMPERATIVE[code];
  }
  const label = item.next_best_action?.label?.trim();
  if (label) {
    return label;
  }
  return "Open casus nu";
}

function phaseBadgeShellClass(phase: string): string {
  switch (phase) {
    case "samenvatting":
      return "border-amber-500/40 bg-amber-500/12 text-amber-100";
    case "matching":
      return "border-sky-500/40 bg-sky-500/12 text-sky-100";
    case "gemeente_validatie":
      return "border-violet-500/40 bg-violet-500/12 text-violet-100";
    case "aanbieder_beoordeling":
      return "border-fuchsia-500/40 bg-fuchsia-500/12 text-fuchsia-100";
    case "plaatsing":
      return "border-emerald-500/40 bg-emerald-500/12 text-emerald-100";
    case "intake":
      return "border-cyan-500/40 bg-cyan-500/12 text-cyan-100";
    case "casus":
    default:
      return "border-border/80 bg-muted/35 text-foreground";
  }
}

function PhaseFlowBadge({ phase }: { phase: string }) {
  const label = phaseLabel(phase);
  return (
    <span
      className={cn(
        "inline-flex max-w-[11rem] items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold leading-none tracking-tight",
        phaseBadgeShellClass(phase),
      )}
      title="Fase in de canonieke keten"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current opacity-90" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
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

function CompactMetricStrip({
  totals,
  onMetricNavigate,
}: {
  totals: {
    active_cases: number;
    critical_blockers: number;
    high_priority_alerts: number;
    provider_sla_breaches: number;
    repeated_rejections: number;
    intake_delays: number;
  };
  onMetricNavigate: (nav: MetricNav) => void;
}) {
  const dom = dominantMetricKey(totals);
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
      label: "Casussen actief",
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
      key: "rejections",
      testId: "regiekamer-summary-rejections",
      label: "Herhaald afwijzen",
      value: totals.repeated_rejections,
      tone: totals.repeated_rejections > 0 ? "warning" : "neutral",
      dominant: dom === "rejections",
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
      return "border-red-500/40 bg-red-500/12 text-red-100";
    }
    if (tone === "warning") {
      return "border-amber-500/40 bg-amber-500/12 text-amber-100";
    }
    if (tone === "success") {
      return "border-emerald-500/40 bg-emerald-500/12 text-emerald-100";
    }
    return "border-border/70 bg-background/40 text-foreground";
  };

  return (
    <section data-testid="metric-strip" data-density="compact" className="w-full rounded-xl border border-border/70 bg-card/70 p-2">
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            data-testid={item.testId}
            data-metric-dominant={item.dominant ? "true" : undefined}
            aria-label={`${item.label}: ${item.value}. Klik om te filteren of te navigeren.`}
            onClick={() => {
              onMetricNavigate(metricNavForItemKey(item.key));
            }}
            className={cn(
              "flex h-12 w-full min-w-0 cursor-pointer flex-col items-stretch justify-center gap-0.5 rounded-lg border px-3 py-1.5 text-left text-sm transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:px-4",
              toneClass(item.tone),
              item.dominant && "z-[1] scale-[1.02] shadow-lg ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
            )}
          >
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</span>
            <span
              className={cn(
                "truncate text-right text-base font-bold tabular-nums leading-none",
                item.dominant && "text-[17px]",
              )}
            >
              {item.value}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function OperationalSignalRow({
  tone,
  message,
  ctaLabel,
  onClick,
}: {
  tone: "warning" | "info";
  message: string;
  ctaLabel: string;
  onClick: () => void;
}) {
  return (
    <CareAttentionBar
      tone={tone}
      message={message}
      icon={tone === "warning" ? <TriangleAlert className="text-amber-400" size={18} /> : <Info className="text-cyan-400" size={18} />}
      action={
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onClick}
          className={cn(
            "h-9 gap-2 rounded-full px-4 text-xs font-bold shadow-md",
            tone === "warning" && "ring-2 ring-amber-500/35",
            tone === "info" &&
              "border border-cyan-500/40 bg-cyan-600 text-white ring-2 ring-cyan-500/30 hover:bg-cyan-600/90 dark:bg-cyan-700 dark:hover:bg-cyan-700/90",
          )}
        >
          {ctaLabel}
          <ArrowRight size={14} className="shrink-0 opacity-95" aria-hidden />
        </Button>
      }
    />
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
  const overdueActionCount = visibleItems.filter((item) => (item.hours_in_current_state ?? 0) >= 168).length;
  const noProviderCount = visibleItems.filter((item) => !item.assigned_provider || item.assigned_provider === "Nog geen toegewezen aanbieder").length;

  const clearFilters = () => {
    setSearchQuery("");
    setPriorityFilter("all");
    setIssueFilter("all");
    setPhaseFilter("all");
    setOwnershipFilter("all");
  };

  return (
    <CarePageTemplate
      className="pb-8"
      header={
        <CareUnifiedHeader
          title={<span className="inline-flex items-center gap-2"><Siren size={16} className="text-primary" />Regiekamer</span>}
          subtitle="Operationele regie op blokkades, risico's en volgende acties."
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
        />
      }
      attention={
        <div className={SECTION_STACK_CLASS}>
          <CompactMetricStrip
            totals={{
              active_cases: data?.totals.active_cases ?? 0,
              critical_blockers: criticalBlockers,
              high_priority_alerts: highPriorityAlerts,
              provider_sla_breaches: providerSlaBreaches,
              repeated_rejections: data?.totals.repeated_rejections ?? 0,
              intake_delays: data?.totals.intake_delays ?? 0,
            }}
            onMetricNavigate={handleMetricNavigate}
          />

          <div className="space-y-1.5">
            <OperationalSignalRow
              tone="warning"
              message={
                criticalBlockers > 0
                  ? `${criticalBlockers} casussen met kritieke blokkade (backend)`
                  : `${overdueActionCount} casussen wachten langer dan 7 dagen in dit filter`
              }
              ctaLabel="Lang wachten"
              onClick={() => setPriorityFilter("high")}
            />
            <OperationalSignalRow
              tone="info"
              message={
                providerSlaBreaches > 0
                  ? `${providerSlaBreaches} casussen met provider-SLA of capaciteitssignaal (backend)`
                  : `${noProviderCount} casussen zonder toegewezen aanbieder in dit filter`
              }
              ctaLabel="Bekijk tekort"
              onClick={() => setIssueFilter("alerts")}
            />
            {intakeDelaysTotal > 0 && (
              <OperationalSignalRow
                tone="warning"
                message={`${intakeDelaysTotal} casussen met vertraagde of ontbrekende intake (backend)`}
                ctaLabel="Bekijk intake"
                onClick={() => setIssueFilter("intake")}
              />
            )}
          </div>
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
    </CarePageTemplate>
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
  const blockerLine = getShortReasonLabel(primaryProblemText(item), 56);
  return (
    <CareWorkRow
      testId="regiekamer-worklist-item"
      leading={<PhaseFlowBadge phase={item.phase} />}
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
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {issueTypeLabel(item)}
          </span>
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
      actionLabel={primaryAction}
      actionVariant="primary"
      onOpen={() => onCaseClick(String(item.case_id))}
      onAction={(event) => {
        event.stopPropagation();
        onCaseClick(String(item.case_id));
      }}
      accentTone={urgent ? "critical" : "neutral"}
    />
  );
}
