import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Building2, Clock3, Download, Filter, Loader2, RefreshCw, ShieldAlert, Siren } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { CareEmptyState, CareFilterLabel, CareInsightBanner, CareMetricCard, CarePageHeader, CareSectionCard } from "./CareSurface";
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
  const urgentItems = visibleItems.filter((item) => item.urgency === "critical" || item.urgency === "warning");
  const calmerItems = visibleItems.filter((item) => item.urgency !== "critical" && item.urgency !== "warning");
  const criticalBlockers = data?.totals.critical_blockers ?? 0;
  const highPriorityAlerts = data?.totals.high_priority_alerts ?? 0;
  const providerSlaBreaches = data?.totals.provider_sla_breaches ?? 0;

  const clearFilters = () => {
    setPriorityFilter("all");
    setIssueFilter("all");
    setPhaseFilter("all");
    setOwnershipFilter("all");
  };

  return (
    <div className="space-y-6 pb-10">
      <CarePageHeader
        eyebrow={<><Siren size={16} className="text-primary" /><span>Regiekamer</span></>}
        title="Regiekamer"
        subtitle="Operationele sturing op vastgelopen casussen, risico's en vervolgstappen. Elke kaart vertelt direct wat er misloopt en wat nu nodig is."
        meta={generatedAtLabel ? <p className="text-xs text-muted-foreground">Bijgewerkt op {generatedAtLabel}</p> : null}
        actions={(
          <>
            <Button variant="outline" onClick={refetch} className="gap-2">
              <RefreshCw size={14} />
              Ververs
            </Button>
            <Button variant="outline" className="gap-2">
              <Download size={14} />
              Exporteer rapport
            </Button>
            {filtersActive && (
              <Button variant="ghost" onClick={clearFilters} className="gap-2">
                Filters wissen
              </Button>
            )}
          </>
        )}
      />

      <CareInsightBanner
        tone="primary"
        title={`${criticalBlockers} kritieke blokkades • ${highPriorityAlerts} hoge prioriteit alerts • ${providerSlaBreaches} SLA-overschrijdingen`}
        copy="Regiekamer is een operationele cockpit: het laat alleen zien wat aandacht vraagt, waarom het vastloopt en welke partij nu moet handelen."
        action={(
          <Button
            onClick={() => setPriorityFilter("critical")}
            className="gap-2"
            variant="destructive"
            disabled={loading || !hasActiveData}
          >
            Bekijk urgente casussen
            <ArrowRight size={14} />
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <CareMetricCard
          testId="regiekamer-summary-active"
          label="Actieve casussen"
          value={data?.totals.active_cases ?? 0}
          tone="neutral"
          icon={<Building2 size={18} />}
        />
        <CareMetricCard
          testId="regiekamer-summary-critical"
          label="Kritieke blokkades"
          value={criticalBlockers}
          tone="danger"
          icon={<ShieldAlert size={18} />}
          active={criticalBlockers > 0}
        />
        <CareMetricCard
          testId="regiekamer-summary-alerts"
          label="Hoge prioriteit alerts"
          value={highPriorityAlerts}
          tone="warning"
          icon={<AlertTriangle size={18} />}
          active={highPriorityAlerts > 0}
        />
        <CareMetricCard
          testId="regiekamer-summary-sla"
          label="SLA overschrijdingen"
          value={providerSlaBreaches}
          tone="warning"
          icon={<Clock3 size={18} />}
          note="Over termijn"
          active={providerSlaBreaches > 0}
        />
        <CareMetricCard
          testId="regiekamer-summary-rejections"
          label="Herhaalde afwijzingen"
          value={data?.totals.repeated_rejections ?? 0}
          tone="neutral"
          icon={<AlertTriangle size={18} />}
        />
        <CareMetricCard
          testId="regiekamer-summary-intake"
          label="Intake vertragingen"
          value={data?.totals.intake_delays ?? 0}
          tone="neutral"
          icon={<Clock3 size={18} />}
        />
      </div>

      <CareSectionCard
        title="Filters"
        subtitle="Gebruik de live signalen om de lijst te beperken zonder de onderliggende workflow te wijzigen."
        actions={<div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldAlert size={14} /><span>Alleen backend-overzicht, geen lokale workflowlogica.</span></div>}
        className="p-5"
      >
        <div className="grid gap-4 xl:grid-cols-4">
          <CareFilterLabel label="Prioriteit">
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
              className="min-w-36 rounded-2xl border border-border bg-background/70 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
            >
              {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </CareFilterLabel>

          <CareFilterLabel label="Issue type">
            <select
              value={issueFilter}
              onChange={(event) => setIssueFilter(event.target.value as IssueFilter)}
              className="min-w-36 rounded-2xl border border-border bg-background/70 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
            >
              {Object.entries(ISSUE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </CareFilterLabel>

          <CareFilterLabel label="Fase">
            <select
              value={phaseFilter}
              onChange={(event) => setPhaseFilter(event.target.value as PhaseFilter)}
              className="min-w-44 rounded-2xl border border-border bg-background/70 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
            >
              <option value="all">Alles</option>
              {Object.entries(PHASE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </CareFilterLabel>

          <CareFilterLabel label="Rol ownership">
            <select
              value={ownershipFilter}
              onChange={(event) => setOwnershipFilter(event.target.value as OwnershipFilter)}
              className="min-w-40 rounded-2xl border border-border bg-background/70 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
            >
              {Object.entries(OWNERSHIP_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </CareFilterLabel>
        </div>
      </CareSectionCard>

      {loading && (
        <CareEmptyState title="Regiekamer-overzicht laden…" copy="De beslissingsengine bereidt de huidige triage-stand voor." />
      )}

      {!loading && error && (
        <CareEmptyState
          title="Regiekamer kon niet worden geladen"
          copy={error}
          action={<Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>}
        />
      )}

      {!loading && !error && !hasActiveData && (
        <CareEmptyState title="Er zijn nog geen actieve casussen om te beoordelen." />
      )}

      {!loading && !error && hasActiveData && !hasAnySignals && (
        <CareEmptyState title="Geen vastgelopen casussen." copy="De actieve keten loopt momenteel zonder kritieke signalen." />
      )}

      {!loading && !error && hasActiveData && hasAnySignals && visibleItems.length === 0 && (
        <CareEmptyState
          title="Geen casussen binnen de huidige filters."
          copy="Pas de selectie aan om meer casussen te tonen."
          action={<Button variant="outline" onClick={clearFilters}>Filters wissen</Button>}
        />
      )}

      {!loading && !error && visibleItems.length > 0 && (
        <div className="space-y-5">
          {urgentItems.length > 0 && (
            <CareSectionCard
              title="Casussen die aandacht nodig hebben"
              subtitle={`${urgentItems.length} urgente casussen`}
            >
              <div className="space-y-3">
                {urgentItems.map((item) => (
                  <RegiekamerWorkItemCard key={item.case_id} item={item} onCaseClick={onCaseClick} urgent />
                ))}
              </div>
            </CareSectionCard>
          )}

          {calmerItems.length > 0 && (
            <CareSectionCard
              title="Overige casussen"
              subtitle={`${calmerItems.length} stabiele of normale casussen`}
            >
              <div className="space-y-3">
                {calmerItems.map((item) => (
                  <RegiekamerWorkItemCard key={item.case_id} item={item} onCaseClick={onCaseClick} />
                ))}
              </div>
            </CareSectionCard>
          )}
        </div>
      )}
    </div>
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
  return (
    <article
      data-testid="regiekamer-worklist-item"
      className={cn(
        "rounded-[28px] border p-5 shadow-sm transition-all duration-200",
        urgent
          ? "border-red-500/25 bg-gradient-to-br from-red-500/8 via-card/80 to-card"
          : "border-border bg-card/75",
      )}
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-4">
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
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{item.case_reference}</p>
            <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
            <p className="text-sm text-muted-foreground">
              {item.current_state} · {item.assigned_provider || "Nog geen toegewezen aanbieder"}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <AlertTriangle size={12} />
                Blokkade
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">{item.top_blocker?.message ?? "Geen blokkade"}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <Clock3 size={12} />
                Risico
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">{item.top_risk?.message ?? "Geen zichtbaar risico"}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <Building2 size={12} />
                Alert
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">{item.top_alert?.message ?? "Geen actieve alert"}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:min-w-[280px] xl:text-right">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Tijd in huidige staat</p>
            <p className="text-sm font-medium text-foreground">{formatHours(item.hours_in_current_state)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Leeftijd casus</p>
            <p className="text-sm font-medium text-foreground">{formatHours(item.age_hours)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Prioriteitsscore</p>
            <p className="text-sm font-medium text-foreground">{item.priority_score}</p>
          </div>
          <div className="flex flex-wrap justify-start gap-2 pt-1 xl:justify-end">
            {item.next_best_action?.label && (
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-foreground">
                Volgende actie: {item.next_best_action.label}
              </Badge>
            )}
          </div>
          <div className="pt-1 xl:pt-2">
            <Button variant="outline" className="gap-2" onClick={() => onCaseClick(String(item.case_id))}>
              Bekijk detail
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
