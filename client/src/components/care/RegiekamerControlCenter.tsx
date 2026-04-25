import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Building2, Clock3, Filter, Loader2, RefreshCw, ShieldAlert, Siren } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useRegiekamerDecisionOverview } from "../../hooks/useRegiekamerDecisionOverview";
import type {
  RegiekamerDecisionOverviewItem,
  RegiekamerOwnershipRole,
  RegiekamerPriorityBand,
} from "../../lib/regiekamerDecisionOverview";

interface RegiekamerControlCenterProps {
  onCaseClick: (caseId: string) => void;
}

type PriorityFilter = "all" | "critical" | "high" | "medium";
type IssueFilter = "all" | "blockers" | "risks" | "alerts" | "SLA" | "rejection" | "intake";
type PhaseFilter = "all" | "casus" | "samenvatting" | "matching" | "aanbieder_beoordeling" | "plaatsing" | "intake";
type OwnershipFilter = "all" | RegiekamerOwnershipRole;

const PHASE_LABELS: Record<string, string> = {
  casus: "Casus",
  samenvatting: "Samenvatting",
  matching: "Matching",
  aanbieder_beoordeling: "Beoordeling door aanbieder",
  plaatsing: "Plaatsing",
  intake: "Intake",
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

function urgencyBadgeClasses(urgency: string) {
  switch (urgency.toLowerCase()) {
    case "critical":
      return "border-red-500/35 bg-red-500/10 text-red-200";
    case "high":
    case "warning":
      return "border-amber-500/35 bg-amber-500/10 text-amber-100";
    case "medium":
    case "normal":
      return "border-blue-500/35 bg-blue-500/10 text-blue-200";
    default:
      return "border-border bg-muted/20 text-muted-foreground";
  }
}

function phaseLabel(phase: string) {
  return PHASE_LABELS[phase] ?? (phase || "Onbekend");
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

function SummaryCard({
  label,
  value,
  accent,
  testId,
}: {
  label: string;
  value: number;
  accent: string;
  testId: string;
}) {
  return (
    <div data-testid={testId} className={`rounded-2xl border p-4 ${accent}`}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function RegiekamerControlCenter({ onCaseClick }: RegiekamerControlCenterProps) {
  const { data, loading, error, refetch } = useRegiekamerDecisionOverview();
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("all");
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");

  const visibleItems = useMemo(() => {
    const items = data?.items ?? [];

    return items
      .filter((item) => {
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
  }, [data?.items, issueFilter, ownershipFilter, phaseFilter, priorityFilter]);

  const generatedAtLabel = useMemo(() => {
    if (!data?.generated_at) {
      return "";
    }

    const date = new Date(data.generated_at);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("nl-NL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }, [data?.generated_at]);

  const hasAnySignals = Boolean(data?.items?.some((item) => item.priority_score > 0));
  const hasActiveData = (data?.totals.active_cases ?? 0) > 0;
  const filtersActive = priorityFilter !== "all" || issueFilter !== "all" || phaseFilter !== "all" || ownershipFilter !== "all";

  const clearFilters = () => {
    setPriorityFilter("all");
    setIssueFilter("all");
    setPhaseFilter("all");
    setOwnershipFilter("all");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Siren className="text-primary" size={18} />
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Regiekamer</p>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-foreground">Regiekamer</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Operationele sturing op vastgelopen casussen, risico&apos;s en vervolgstappen.
              </p>
            </div>
            {generatedAtLabel && (
              <p className="text-xs text-muted-foreground">Bijgewerkt op {generatedAtLabel}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refetch} className="gap-2">
              <RefreshCw size={14} />
              Ververs
            </Button>
            {filtersActive && (
              <Button variant="ghost" onClick={clearFilters} className="gap-2">
                Filters wissen
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          testId="regiekamer-summary-active"
          label="Actieve casussen"
          value={data?.totals.active_cases ?? 0}
          accent="border-border bg-muted/20"
        />
        <SummaryCard
          testId="regiekamer-summary-critical"
          label="Kritieke blokkades"
          value={data?.totals.critical_blockers ?? 0}
          accent="border-red-500/25 bg-red-500/8"
        />
        <SummaryCard
          testId="regiekamer-summary-alerts"
          label="Hoge prioriteit alerts"
          value={data?.totals.high_priority_alerts ?? 0}
          accent="border-amber-500/25 bg-amber-500/8"
        />
        <SummaryCard
          testId="regiekamer-summary-sla"
          label="SLA overschrijdingen"
          value={data?.totals.provider_sla_breaches ?? 0}
          accent="border-border bg-muted/20"
        />
        <SummaryCard
          testId="regiekamer-summary-rejections"
          label="Herhaalde afwijzingen"
          value={data?.totals.repeated_rejections ?? 0}
          accent="border-border bg-muted/20"
        />
        <SummaryCard
          testId="regiekamer-summary-intake"
          label="Intake vertragingen"
          value={data?.totals.intake_delays ?? 0}
          accent="border-border bg-muted/20"
        />
      </div>

      <div className="rounded-3xl border bg-card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-3">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <Filter size={12} />
                Prioriteit
              </span>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                className="min-w-36 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              >
                {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Issue type</span>
              <select
                value={issueFilter}
                onChange={(event) => setIssueFilter(event.target.value as IssueFilter)}
                className="min-w-36 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              >
                {Object.entries(ISSUE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Fase</span>
              <select
                value={phaseFilter}
                onChange={(event) => setPhaseFilter(event.target.value as PhaseFilter)}
                className="min-w-44 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              >
                <option value="all">Alles</option>
                {Object.entries(PHASE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Rol ownership</span>
              <select
                value={ownershipFilter}
                onChange={(event) => setOwnershipFilter(event.target.value as OwnershipFilter)}
                className="min-w-40 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              >
                {Object.entries(OWNERSHIP_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldAlert size={14} />
            <span>Alleen backend-overzicht, geen lokale workflowlogica.</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-3xl border bg-card p-10 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 animate-spin" size={18} />
          Regiekamer-overzicht laden…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-3xl border bg-card p-10 text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Regiekamer kon niet worden geladen</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>
        </div>
      )}

      {!loading && !error && !hasActiveData && (
        <div className="rounded-3xl border bg-card p-10 text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Er zijn nog geen actieve casussen om te beoordelen.</p>
        </div>
      )}

      {!loading && !error && hasActiveData && !hasAnySignals && (
        <div className="rounded-3xl border bg-card p-10 text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Geen vastgelopen casussen. De actieve keten loopt momenteel zonder kritieke signalen.</p>
        </div>
      )}

      {!loading && !error && hasActiveData && hasAnySignals && visibleItems.length === 0 && (
        <div className="rounded-3xl border bg-card p-10 text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Geen casussen binnen de huidige filters.</p>
          <p className="text-sm text-muted-foreground">Pas de selectie aan om meer casussen te tonen.</p>
          <Button variant="outline" onClick={clearFilters}>Filters wissen</Button>
        </div>
      )}

      {!loading && !error && visibleItems.length > 0 && (
        <div className="space-y-3">
          {visibleItems.map((item) => (
            <article
              key={item.case_id}
              data-testid="regiekamer-worklist-item"
              className="rounded-3xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/30"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={priorityBadgeClasses(item.priority_score)}>
                      {priorityLabel(item.priority_score)}
                    </Badge>
                    <Badge variant="outline" className={urgencyBadgeClasses(item.urgency)}>
                      Urgentie: {item.urgency || "onbekend"}
                    </Badge>
                    <Badge variant="outline">{phaseLabel(item.phase)}</Badge>
                    <Badge variant="outline">{filterLabelFromItem(item)}</Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{item.case_reference}</p>
                    <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.current_state} · {item.assigned_provider || "Nog geen toegewezen aanbieder"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className={severityBadgeClasses(issueTone(item))}>
                      {issueTypeLabel(item)} · {issueText(item)}
                    </Badge>
                    {item.next_best_action?.label && (
                      <Badge variant="outline" className="border-primary/25 bg-primary/5 text-foreground">
                        Volgende actie: {item.next_best_action.label}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-3 xl:min-w-[280px] xl:text-right">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Tijd in huidige staat</p>
                    <p className="text-sm font-medium text-foreground">{formatHours(item.hours_in_current_state)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Leeftijd casus</p>
                    <p className="text-sm font-medium text-foreground">{formatHours(item.age_hours)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Prioriteitsscore</p>
                    <p className="text-sm font-medium text-foreground">{item.priority_score}</p>
                  </div>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => onCaseClick(String(item.case_id))}
                    >
                      Bekijk detail
                      <ArrowRight size={14} />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <AlertTriangle size={12} />
                    Blokkade
                  </div>
                  <p className="mt-2 text-sm text-foreground">
                    {item.top_blocker?.message ?? "Geen blokkade"}
                  </p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <Clock3 size={12} />
                    Risico
                  </div>
                  <p className="mt-2 text-sm text-foreground">
                    {item.top_risk?.message ?? "Geen zichtbaar risico"}
                  </p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <Building2 size={12} />
                    Alert
                  </div>
                  <p className="mt-2 text-sm text-foreground">
                    {item.top_alert?.message ?? "Geen actieve alert"}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
