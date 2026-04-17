/**
 * RegiekamerControlCenter - Operational Control Tower
 * 
 * This is NOT a dashboard. This is a command center that:
 * - Shows what needs attention NOW
 * - Prioritizes urgent cases
 * - Highlights bottlenecks
 * - Guides users toward action
 * 
 * Users do NOT execute workflows here - they decide WHERE to act.
 */

import { Fragment, useState, useMemo } from "react";
import { 
  Search,
  Filter,
  AlertTriangle,
  Clock,
  Users,
  TrendingUp,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  MapPin,
  ClipboardList,
  Siren,
  Activity
} from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { mockCasusList } from "../../lib/casesData";
import type { Casus, CasusPhase } from "../../lib/phaseEngine";
import {
  buildRegiekamerDecisionSummary,
  type RegiekamerFilterTarget,
  type RegiekamerPriorityCard,
} from "../../lib/regiekamerDecisionEngine";

interface RegiekamerControlCenterProps {
  onCaseClick: (caseId: string) => void;
}

export function RegiekamerControlCenter({ onCaseClick }: RegiekamerControlCenterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("all");
  const [activeKPIFilter, setActiveKPIFilter] = useState<string | null>(null);

  const decisionSummary = useMemo(() => buildRegiekamerDecisionSummary(mockCasusList), []);

  const applyDecisionTarget = (target: {
    target_view: string;
    target_filter: RegiekamerFilterTarget;
    target_region?: string;
  }) => {
    const filter = target.target_filter;

    if (filter) {
      setActiveKPIFilter(filter);
    }

    if (target.target_region) {
      setSelectedRegion(target.target_region);
    }

    if (target.target_view === "beoordelingen") {
      setSelectedStatus("beoordeling");
    } else if (target.target_view === "matching") {
      setSelectedStatus("matching");
    } else if (target.target_view === "plaatsingen") {
      setSelectedStatus("plaatsing");
    } else if (target.target_view === "casussen") {
      setSelectedStatus("all");
    }
  };

  const getPriorityCard = (key: RegiekamerPriorityCard["key"]) => {
    return decisionSummary.priority_cards.find((card) => card.key === key);
  };

  const flowStages = [
    {
      id: "casussen",
      label: "Casussen",
      count: decisionSummary.flow_counts.casussen,
      filter: "casussen",
      onClick: () => {
        setSelectedStatus("all");
        setActiveKPIFilter("casussen");
      }
    },
    {
      id: "beoordelingen",
      label: "Beoordelingen",
      count: decisionSummary.flow_counts.beoordelingen,
      filter: "assessment",
      onClick: () => {
        setSelectedStatus("beoordeling");
        setActiveKPIFilter("assessment");
      }
    },
    {
      id: "matching",
      label: "Matching",
      count: decisionSummary.flow_counts.matching,
      filter: "noMatch",
      onClick: () => {
        setSelectedStatus("matching");
        setActiveKPIFilter("noMatch");
      }
    },
    {
      id: "plaatsingen",
      label: "Plaatsingen",
      count: decisionSummary.flow_counts.plaatsingen,
      filter: "placement",
      onClick: () => {
        setSelectedStatus("plaatsing");
        setActiveKPIFilter("placement");
      }
    }
  ].map((stage) => ({ ...stage, isBottleneck: stage.id === decisionSummary.bottleneck_stage }));

  const casesWithoutMatchCard = getPriorityCard("casussen_zonder_match");
  const openAssessmentsCard = getPriorityCard("open_beoordelingen");
  const waitingOverdueCard = getPriorityCard("wachttijd_overschreden");
  const placementsInProgressCard = getPriorityCard("plaatsingen_bezig");
  const avgWaitingTimeCard = getPriorityCard("gem_wachttijd");
  const capacityIssuesCard = getPriorityCard("capaciteitstekorten");

  const filteredCases = useMemo(() => {
    return mockCasusList
      .filter(c => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (!(
            c.id.toLowerCase().includes(query) ||
            c.clientName.toLowerCase().includes(query) ||
            c.careType.toLowerCase().includes(query)
          )) return false;
        }
        if (selectedRegion !== "all" && c.region !== selectedRegion) return false;
        if (selectedStatus !== "all" && c.phase !== selectedStatus) return false;
        if (selectedUrgency !== "all" && c.urgency !== selectedUrgency) return false;
        if (activeKPIFilter) {
          if (activeKPIFilter === "casussen" && c.phase !== "intake_initial" && c.phase !== "intake_provider") return false;
          if (activeKPIFilter === "noMatch" && c.phase !== "matching" && c.phase !== "geblokkeerd") return false;
          if (activeKPIFilter === "assessment" && c.phase !== "beoordeling") return false;
          if (activeKPIFilter === "placement" && c.phase !== "plaatsing") return false;
          if (activeKPIFilter === "highRisk" && c.complexity !== "high") return false;
          if (activeKPIFilter === "waitingOverdue" && c.waitingDays <= 7) return false;
          if (activeKPIFilter === "delayed" && c.waitingDays <= 7) return false;
          if (activeKPIFilter === "capacity" && decisionSummary.capacity_region && c.region !== decisionSummary.capacity_region) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const complexityOrder = { high: 0, medium: 1, low: 2 };
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        const waitingDiff = b.waitingDays - a.waitingDays;
        if (waitingDiff !== 0) return waitingDiff;
        if (a.phase === "geblokkeerd" && b.phase !== "geblokkeerd") return -1;
        if (b.phase === "geblokkeerd" && a.phase !== "geblokkeerd") return 1;
        return complexityOrder[a.complexity] - complexityOrder[b.complexity];
      });
  }, [activeKPIFilter, decisionSummary.capacity_region, searchQuery, selectedRegion, selectedStatus, selectedUrgency]);

  const regions = ["all", ...Array.from(new Set(mockCasusList.map(c => c.region)))];

  const getNextAction = (caseItem: Casus): { action: string; type: "urgent" | "normal" | "waiting" } => {
    switch (caseItem.phase) {
      case "intake_initial": return { action: "Start beoordeling", type: "urgent" };
      case "beoordeling": return { action: "Voltooi beoordeling", type: "urgent" };
      case "matching": return { action: "Herzie matching", type: "urgent" };
      case "plaatsing": return { action: "Volg op bij aanbieder", type: "normal" };
      case "geblokkeerd": return { action: "Escaleer", type: "urgent" };
      case "intake_provider": return { action: "Wacht op aanbieder reactie", type: "waiting" };
      case "afgerond": return { action: "Archiveren", type: "waiting" };
      default: return { action: "Open", type: "waiting" };
    }
  };

  const commandToneStyles = {
    critical: "command-bar-gradient-critical",
    warning: "command-bar-gradient-warning",
    info: "command-bar-gradient-info",
    good: "command-bar-gradient-info"
  };

  return (
    <div className="space-y-6 pb-24">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-semibold text-foreground">
            Regiekamer
          </h1>
          <p className="text-sm text-muted-foreground">
            Stuur op doorstroom, los blokkades op en bepaal direct de volgende actie
          </p>
        </div>
      </div>

      <section className={`premium-card command-bar-surface overflow-hidden border border-border ${commandToneStyles[decisionSummary.command_bar_summary.tone]}`}>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Siren size={13} className={decisionSummary.command_bar_summary.tone === "critical" ? "text-red-base" : decisionSummary.command_bar_summary.tone === "warning" ? "text-yellow-base" : "text-blue-base"} />
              Commandocentrum
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
              {decisionSummary.command_bar_summary.primary_message}
            </h2>
            <p className="text-sm text-muted-foreground">
              {decisionSummary.command_bar_summary.why_it_matters}
            </p>
            <p className="text-sm font-medium text-foreground">
              Aanbevolen actie: {decisionSummary.recommended_action.label}
            </p>
            <p className="text-sm text-muted-foreground">
              {decisionSummary.recommended_action_reason}
            </p>
          </div>

          <Button onClick={() => applyDecisionTarget(decisionSummary.recommended_action)} className="gap-2 self-start lg:self-center">
            {decisionSummary.recommended_action.cta_label}
            <ArrowRight size={15} />
          </Button>
        </div>
      </section>

      <section className="premium-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {flowStages.map((stage, index) => (
            <Fragment key={stage.id}>
              <button
                onClick={stage.onClick}
                className={`flow-stage-chip flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 ${
                  stage.isBottleneck
                    ? "flow-stage-bottleneck"
                    : activeKPIFilter === stage.filter
                      ? "border-primary/45 bg-primary/10"
                      : "border-border bg-card"
                }`}
              >
                <span className="text-lg font-semibold text-foreground">{stage.count}</span>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{stage.label}</span>
              </button>
              {index < flowStages.length - 1 && (
                <ChevronRight size={15} className="text-muted-foreground/70" />
              )}
            </Fragment>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KPICard
          label={casesWithoutMatchCard?.title || "Casussen zonder match"}
          value={casesWithoutMatchCard?.value || 0}
          context={casesWithoutMatchCard?.subtitle || "Vraagt handmatige opvolging"}
          status={casesWithoutMatchCard?.severity || "critical"}
          icon={<Users size={17} />}
          active={activeKPIFilter === "noMatch"}
          onClick={() => setActiveKPIFilter(activeKPIFilter === "noMatch" ? null : "noMatch")}
        />
        <KPICard
          label={openAssessmentsCard?.title || "Open beoordelingen"}
          value={openAssessmentsCard?.value || 0}
          context={openAssessmentsCard?.subtitle || "Blokkeren de volgende stap"}
          status={openAssessmentsCard?.severity || "warning"}
          icon={<ClipboardList size={17} />}
          active={activeKPIFilter === "assessment"}
          onClick={() => setActiveKPIFilter(activeKPIFilter === "assessment" ? null : "assessment")}
        />
        <KPICard
          label={waitingOverdueCard?.title || "Wachttijd overschreden"}
          value={waitingOverdueCard?.value || 0}
          context={waitingOverdueCard?.subtitle || "Overschrijden wachttijdnorm"}
          status={waitingOverdueCard?.severity || "warning"}
          icon={<Clock size={17} />}
          active={activeKPIFilter === "waitingOverdue"}
          onClick={() => setActiveKPIFilter(activeKPIFilter === "waitingOverdue" ? null : "waitingOverdue")}
        />
        <KPICard
          label={placementsInProgressCard?.title || "Plaatsingen bezig"}
          value={placementsInProgressCard?.value || 0}
          context={placementsInProgressCard?.subtitle || "Wachten op bevestiging"}
          status={placementsInProgressCard?.severity || "info"}
          icon={<TrendingUp size={17} />}
          active={activeKPIFilter === "placement"}
          onClick={() => setActiveKPIFilter(activeKPIFilter === "placement" ? null : "placement")}
        />
        <KPICard
          label={avgWaitingTimeCard?.title || "Gem. wachttijd"}
          value={avgWaitingTimeCard?.value || 0}
          suffix={avgWaitingTimeCard?.suffix || "d"}
          context={avgWaitingTimeCard?.subtitle || "Norm is 7 dagen"}
          status={avgWaitingTimeCard?.severity || "warning"}
          icon={<Activity size={17} />}
          active={activeKPIFilter === "delayed"}
          onClick={() => setActiveKPIFilter(activeKPIFilter === "delayed" ? null : "delayed")}
        />
        <KPICard
          label={capacityIssuesCard?.title || "Capaciteitstekorten"}
          value={capacityIssuesCard?.value || 0}
          context={capacityIssuesCard?.subtitle || "Geen regionale piek gedetecteerd"}
          status={capacityIssuesCard?.severity || "critical"}
          icon={<MapPin size={17} />}
          active={activeKPIFilter === "capacity"}
          onClick={() => setActiveKPIFilter(activeKPIFilter === "capacity" ? null : "capacity")}
        />
      </div>

      <section className="grid gap-3 md:grid-cols-1">
        {decisionSummary.signal_strips.map((signal) => (
          <button
            key={signal.key}
            onClick={() => applyDecisionTarget(signal.action)}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              signal.tone === "critical"
                ? "border-red-border bg-red-light/60"
                : signal.tone === "warning"
                  ? "border-yellow-border bg-yellow-light/65"
                  : "border-blue-border bg-blue-light/62"
            }`}
          >
            <span className="flex items-center gap-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${
                signal.tone === "critical"
                  ? "bg-red-light text-red-base"
                  : signal.tone === "warning"
                    ? "bg-yellow-light text-yellow-base"
                    : "bg-blue-light text-blue-base"
              }`}>
                {signal.tone === "critical" ? <AlertTriangle size={15} /> : signal.tone === "warning" ? <Clock size={15} /> : <MapPin size={15} />}
              </span>
              <span className="text-sm font-medium text-foreground">{signal.text}</span>
            </span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-muted/35 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Filter size={14} />
          Zoek en filters
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Zoek op casus, client of aanbieder..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card pl-10"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:w-auto">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground"
            >
              <option value="all">Alle regio's</option>
              {regions.filter(r => r !== "all").map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground"
            >
              <option value="all">Alle statussen</option>
              <option value="intake_initial">Intake</option>
              <option value="intake_provider">Intake aanbieder</option>
              <option value="beoordeling">Beoordeling</option>
              <option value="matching">Matching</option>
              <option value="plaatsing">Plaatsing</option>
              <option value="geblokkeerd">Geblokkeerd</option>
            </select>

            <select
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground"
            >
              <option value="all">Alle urgentie</option>
              <option value="critical">Kritiek</option>
              <option value="high">Hoog</option>
              <option value="medium">Gemiddeld</option>
              <option value="low">Laag</option>
            </select>
          </div>
        </div>

        {(searchQuery || selectedRegion !== "all" || selectedStatus !== "all" || selectedUrgency !== "all" || activeKPIFilter) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-sm">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Filter size={14} />
              Gefilterd op
            </span>

            {searchQuery && <ActiveFilterChip label={`Zoekterm: ${searchQuery}`} />}
            {selectedRegion !== "all" && <ActiveFilterChip label={`Regio: ${selectedRegion}`} />}
            {selectedStatus !== "all" && <ActiveFilterChip label={`Status: ${selectedStatus}`} />}
            {selectedUrgency !== "all" && <ActiveFilterChip label={`Urgentie: ${selectedUrgency}`} />}
            {activeKPIFilter && (
              <ActiveFilterChip
                label={
                  activeKPIFilter === "casussen" ? "Fase: Casussen" :
                  activeKPIFilter === "noMatch" ? "Zonder match" :
                  activeKPIFilter === "assessment" ? "Open beoordelingen" :
                  activeKPIFilter === "placement" ? "Plaatsingen bezig" :
                  activeKPIFilter === "highRisk" ? "Hoog risico" :
                  activeKPIFilter === "waitingOverdue" ? "Wachttijd overschreden" :
                  activeKPIFilter === "capacity" ? `Capaciteit ${decisionSummary.capacity_region || "onbekend"}` :
                  "Wachttijd > 7 dagen"
                }
              />
            )}

            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedRegion("all");
                setSelectedStatus("all");
                setSelectedUrgency("all");
                setActiveKPIFilter(null);
              }}
              className="ml-auto text-xs font-semibold text-primary hover:underline"
            >
              Wis filters
            </button>
          </div>
        )}
      </section>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Actieve casussen
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gesorteerd op urgentie, wachttijd en blokkade
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredCases.length} {filteredCases.length === 1 ? 'casus' : 'casussen'}
          </span>
        </div>

        <div className="space-y-3">
          {filteredCases.map((caseItem: Casus) => {
            const nextAction = getNextAction(caseItem);

            return (
              <CaseRow
                key={caseItem.id}
                caseItem={caseItem}
                nextAction={nextAction}
                onClick={() => onCaseClick(caseItem.id)}
              />
            );
          })}

          {filteredCases.length === 0 && (
            <div className="premium-card p-12 text-center">
              <p className="text-muted-foreground">
                Geen casussen gevonden met de huidige filters
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedRegion("all");
                  setSelectedStatus("all");
                  setSelectedUrgency("all");
                  setActiveKPIFilter(null);
                }}
              >
                Reset filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ActiveFilterChipProps {
  label: string;
}

function ActiveFilterChip({ label }: ActiveFilterChipProps) {
  return (
    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
      {label}
    </span>
  );
}

interface KPICardProps {
  label: string;
  value: number;
  context: string;
  status: "good" | "info" | "warning" | "critical";
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  suffix?: string;
}

function KPICard({ label, value, context, status, icon, active, onClick, suffix }: KPICardProps) {
  const cardStyles = {
    good: "border-green-border/60",
    info: "border-blue-border/60",
    warning: "border-yellow-border/60",
    critical: "border-red-border/60"
  };

  const iconStyles = {
    good: "text-green-base icon-surface",
    info: "text-blue-base icon-surface",
    warning: "text-yellow-base icon-surface",
    critical: "text-red-base icon-surface"
  };

  return (
    <button
      onClick={onClick}
      className={`kpi-card rounded-2xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 ${cardStyles[status]} ${active ? "ring-2 ring-primary/35" : ""}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconStyles[status]}`}>
          {icon}
        </span>
        {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold text-foreground">
          {value}{suffix || ""}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {context}
        </p>
        <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
          Bekijk dossiers
          <ChevronRight size={13} />
        </p>
      </div>
    </button>
  );
}

const PHASE_LABELS: Record<CasusPhase, string> = {
  intake_initial: "Intake",
  beoordeling: "Beoordeling",
  matching: "Matching",
  plaatsing: "Plaatsing",
  intake_provider: "Intake aanbieder",
  afgerond: "Afgerond",
  geblokkeerd: "Geblokkeerd",
};

interface CaseRowProps {
  caseItem: Casus;
  nextAction: { action: string; type: "urgent" | "normal" | "waiting" };
  onClick: () => void;
}

function CaseRow({ caseItem, nextAction, onClick }: CaseRowProps) {
  const urgencyStyles = {
    critical: "border-red-border bg-red-light/38",
    high: "border-yellow-border bg-yellow-light/42",
    medium: "border-blue-border bg-blue-light/30",
    low: "border-border bg-card"
  };

  const urgencyBadge = {
    critical: "bg-red-light text-red-base border-red-border",
    high: "bg-yellow-light text-yellow-base border-yellow-border",
    medium: "bg-blue-light text-blue-base border-blue-border",
    low: "bg-muted text-muted-foreground border-border"
  };

  const phaseBadge: Record<CasusPhase, string> = {
    intake_initial: "careon-badge-blue",
    beoordeling: "careon-badge-purple",
    matching: "careon-badge-yellow",
    plaatsing: "bg-green-light text-green-base border border-green-border",
    intake_provider: "bg-blue-light text-blue-base border border-blue-border",
    afgerond: "bg-muted text-muted-foreground border border-border",
    geblokkeerd: "careon-badge-red",
  };

  const complexityIcon =
    caseItem.complexity === "high" ? <AlertCircle size={16} className="text-red-base" /> :
    caseItem.complexity === "medium" ? <AlertTriangle size={16} className="text-yellow-base" /> :
    <CheckCircle2 size={16} className="text-green-base" />;

  const actionTone =
    nextAction.type === "urgent" ? "bg-primary text-white" :
    nextAction.type === "normal" ? "bg-primary-light text-primary" :
    "bg-muted text-muted-foreground";

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${urgencyStyles[caseItem.urgency]}`}
    >
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.95fr_1.1fr_auto] xl:items-center">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-foreground">
              {caseItem.id}
            </p>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${urgencyBadge[caseItem.urgency]}`}>
              {caseItem.urgency === "critical" ? "Kritiek" : caseItem.urgency === "high" ? "Hoog" : caseItem.urgency === "medium" ? "Gemiddeld" : "Laag"}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${phaseBadge[caseItem.phase]}`}>
              {PHASE_LABELS[caseItem.phase]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {caseItem.careType} · {caseItem.region} · Eigenaar: {caseItem.assignedTo}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Complexiteit
          </p>
          <p className="text-sm font-medium text-foreground">
            {caseItem.complexity === "high" ? "Hoog" : caseItem.complexity === "medium" ? "Gemiddeld" : "Laag"} · {caseItem.careType}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 xl:gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock size={15} className={caseItem.waitingDays > 7 ? "text-red-base" : "text-muted-foreground"} />
            <span className={caseItem.waitingDays > 7 ? "font-semibold text-red-base" : "font-medium text-foreground"}>
              {caseItem.waitingDays} dagen wachttijd
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {complexityIcon}
            <span>
              {caseItem.assessment?.assessor ?? "Geen beoordelaar"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 xl:justify-end">
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Volgende actie
            </p>
            <div className={`mt-1 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${actionTone}`}>
              {nextAction.action}
            </div>
          </div>
          <div className="icon-surface flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-primary">
            <ChevronRight size={18} />
          </div>
        </div>
      </div>
    </button>
  );
}
