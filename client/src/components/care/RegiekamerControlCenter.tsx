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
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  MapPin,
  Siren,
  BrainCircuit
} from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ActionPanel, type ActionPanelItem } from "../ui/ActionPanel";
import { useCases } from "../../hooks/useCases";
import type { Casus, CasusPhase } from "../../lib/phaseEngine";
import {
  buildRegiekamerDecisionSummary,
  type RegiekamerFilterTarget,
  type RegiekamerPriorityCard,
  type RegiekamerViewTarget,
} from "../../lib/regiekamerDecisionEngine";
import {
  buildRegiekamerPredictiveSummary,
  type RegiekamerCaseForecast,
  type RegiekamerForecastSignal,
} from "../../lib/regiekamerPredictiveEngine";

interface RegiekamerControlCenterProps {
  onCaseClick: (caseId: string) => void;
  onNavigateToView?: (view: RegiekamerViewTarget) => void;
}

export function RegiekamerControlCenter({ onCaseClick, onNavigateToView }: RegiekamerControlCenterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("all");
  const [activeKPIFilter, setActiveKPIFilter] = useState<string | null>(null);

  const { cases } = useCases({ q: "" });
  const casusList = cases as unknown as typeof import("../../lib/casesData").mockCasusList;

  const decisionSummary = useMemo(() => buildRegiekamerDecisionSummary(casusList), [casusList]);
  const predictiveSummary = useMemo(
    () => buildRegiekamerPredictiveSummary(casusList, decisionSummary),
    [decisionSummary]
  );

  const applyDecisionTarget = (target: {
    target_view: string;
    target_filter: RegiekamerFilterTarget;
    target_region?: string;
  }) => {
    if (onNavigateToView) {
      onNavigateToView(target.target_view as RegiekamerViewTarget);
    }

    const filter = target.target_filter;

    if (filter) {
      setActiveKPIFilter(filter);
    }

    if (target.target_region) {
      setSelectedRegion(target.target_region);
    }

    if (target.target_view === "matching") {
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

  const applyForecastSignal = (signal: RegiekamerForecastSignal) => {
    if (signal.target_stage === "matching") {
      setSelectedStatus("matching");
      setActiveKPIFilter("noMatch");
      return;
    }
    if (signal.target_stage === "plaatsingen") {
      setSelectedStatus("plaatsing");
      setActiveKPIFilter("placement");
      return;
    }
    setSelectedStatus("all");
    setActiveKPIFilter("waitingOverdue");
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
      id: "bij_aanbieder",
      label: "Aanbieder Beoordeling",
      count: decisionSummary.flow_counts.bij_aanbieder,
      filter: "aanbieder_wacht",
      onClick: () => {
        setSelectedStatus("provider_beoordeling");
        setActiveKPIFilter("aanbieder_wacht");
      }
    },
    {
      id: "plaatsingen",
      label: "Plaatsingen",
      count: decisionSummary.flow_counts.intake_pending,
      filter: "placement",
      onClick: () => {
        setSelectedStatus("intake_provider");
        setActiveKPIFilter("placement");
      }
    }
  ];

  const stageWaiting = {
    casussen: 0,
    matching: 0,
    bij_aanbieder: 0,
    plaatsingen: 0,
  };

  const stageCases = {
    casussen: casusList.filter((c) => c.phase === "casus"),
    matching: casusList.filter((c) => c.phase === "matching" || c.phase === "aanbieder_selectie" || c.phase === "geblokkeerd"),
    bij_aanbieder: casusList.filter((c) => c.phase === "provider_beoordeling"),
    plaatsingen: casusList.filter((c) => c.phase === "intake_provider"),
  };

  (Object.keys(stageCases) as Array<keyof typeof stageCases>).forEach((stage) => {
    const list = stageCases[stage];
    stageWaiting[stage] = list.length
      ? Math.round(list.reduce((sum, caseItem) => sum + caseItem.waitingDays, 0) / list.length)
      : 0;
  });

  const highestCountStage = flowStages
    .slice()
    .sort((a, b) => b.count - a.count)[0]?.id as keyof typeof stageWaiting | undefined;

  const longestWaitStage = (Object.entries(stageWaiting) as Array<[keyof typeof stageWaiting, number]>)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const workflowBottleneckStage =
    longestWaitStage && stageWaiting[longestWaitStage] > 7
      ? longestWaitStage
      : highestCountStage ?? decisionSummary.bottleneck_stage;

  const clickableFlowStages = flowStages.map((stage) => ({
    ...stage,
    isBottleneck: stage.id === workflowBottleneckStage,
  }));

  const casesWithoutMatchCard = getPriorityCard("casussen_zonder_match");
  const wachtOpAanbiederCard = getPriorityCard("wacht_op_aanbieder");
  const afgewezenDoorAanbiederCard = getPriorityCard("afgewezen_door_aanbieder");
  const waitingOverdueCard = getPriorityCard("wachttijd_overschreden");
  const placementsInProgressCard = getPriorityCard("plaatsingen_bezig");
  const avgWaitingTimeCard = getPriorityCard("gem_wachttijd");
  const capacityIssuesCard = getPriorityCard("capaciteitstekorten");

  const criticalActionCount = (casesWithoutMatchCard?.value ?? 0) + (waitingOverdueCard?.value ?? 0) + (afgewezenDoorAanbiederCard?.value ?? 0);
  const warningActionCount = (wachtOpAanbiederCard?.value ?? 0) + (placementsInProgressCard?.value ?? 0);
  const commandTone = criticalActionCount > 0 ? "critical" : warningActionCount > 0 ? "warning" : "good";
  const commandStateLine =
    commandTone === "critical"
      ? `${criticalActionCount} casussen vereisen directe actie`
      : commandTone === "warning"
        ? `${warningActionCount} casussen wachten op aanbiederreactie`
        : "Doorstroom stabiel - geen directe blokkades";

  const actionBreakdown: string[] = [];
  if ((casesWithoutMatchCard?.value ?? 0) > 0) {
    actionBreakdown.push(`${casesWithoutMatchCard?.value} zonder match`);
  }
  if ((afgewezenDoorAanbiederCard?.value ?? 0) > 0) {
    actionBreakdown.push(`${afgewezenDoorAanbiederCard?.value} afgewezen door aanbieder`);
  }
  if ((waitingOverdueCard?.value ?? 0) > 0) {
    actionBreakdown.push(`${waitingOverdueCard?.value} wachttijd overschreden`);
  }
  if ((wachtOpAanbiederCard?.value ?? 0) > 0) {
    actionBreakdown.push(`${wachtOpAanbiederCard?.value} wachten op aanbieder`);
  }
  if ((placementsInProgressCard?.value ?? 0) > 0) {
    actionBreakdown.push(`${placementsInProgressCard?.value} plaatsingen bezig`);
  }
  const commandSummaryLine =
    actionBreakdown.length > 0
      ? actionBreakdown.slice(0, 2).join(", ")
      : "Alle kernindicatoren zijn stabiel";

  const actionPanelItems: ActionPanelItem[] = [
    {
      key: "casussen-zonder-match",
      title: `${casesWithoutMatchCard?.value ?? 0} Casussen zonder match (>48u)`,
      description: "Casussen in matching zonder passende aanbieder",
      count: casesWithoutMatchCard?.value ?? 0,
      severity: (casesWithoutMatchCard?.value ?? 0) > 0 ? "critical" : "stable",
      ctaLabel: "Ga naar Matching",
      onSelect: () => applyDecisionTarget(casesWithoutMatchCard?.action ?? { target_view: "matching", target_filter: "noMatch" }),
    },
    {
      key: "afgewezen-door-aanbieder",
      title: `${afgewezenDoorAanbiederCard?.value ?? 0} Afgewezen door aanbieder`,
      description: "Vereisen hermatching met andere aanbieder",
      count: afgewezenDoorAanbiederCard?.value ?? 0,
      severity: (afgewezenDoorAanbiederCard?.value ?? 0) > 0 ? "critical" : "stable",
      ctaLabel: "Herstart matching",
      onSelect: () => applyDecisionTarget(afgewezenDoorAanbiederCard?.action ?? { target_view: "matching", target_filter: "afgewezen" }),
    },
    {
      key: "wacht-op-aanbieder",
      title: `${wachtOpAanbiederCard?.value ?? 0} Wacht op aanbieder`,
      description: "Plaatsingsverzoek verstuurd, wacht op reactie",
      count: wachtOpAanbiederCard?.value ?? 0,
      severity: (wachtOpAanbiederCard?.value ?? 0) > 0 ? "warning" : "stable",
      ctaLabel: "Bekijk aanbiederreacties",
      onSelect: () => applyDecisionTarget(wachtOpAanbiederCard?.action ?? { target_view: "plaatsingen", target_filter: "aanbieder_wacht" }),
    },
    {
      key: "wachttijd-overschreden",
      title: `${waitingOverdueCard?.value ?? 0} Wachttijd overschreden`,
      description: "Casussen boven normtijd, direct prioriteren",
      count: waitingOverdueCard?.value ?? 0,
      severity: (waitingOverdueCard?.value ?? 0) > 0 ? "critical" : "stable",
      ctaLabel: "Ga naar Casussen",
      onSelect: () => applyDecisionTarget(waitingOverdueCard?.action ?? { target_view: "casussen", target_filter: "waitingOverdue" }),
    },
    {
      key: "plaatsingen-bezig",
      title: `${placementsInProgressCard?.value ?? 0} Plaatsingen bezig`,
      description: "Wachten op bevestiging of startmoment",
      count: placementsInProgressCard?.value ?? 0,
      severity: (placementsInProgressCard?.value ?? 0) > 0 ? "warning" : "stable",
      ctaLabel: "Ga naar Plaatsingen",
      showWhenZero: true,
      onSelect: () => applyDecisionTarget(placementsInProgressCard?.action ?? { target_view: "plaatsingen", target_filter: "placement" }),
    },
  ];

  const filteredCases = useMemo(() => {
    return casusList
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

  const regions = ["all", ...Array.from(new Set(casusList.map(c => (c as any).region ?? "")))];

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

  const flowDiagnosticMeaning =
    decisionSummary.bottleneck_stage === "aanbieder_review"
      ? "Aanbieder beoordeelt plaatsingsverzoek"
      : decisionSummary.bottleneck_stage === "matching"
        ? "Matching vertraagt door capaciteit of casusfit"
        : decisionSummary.bottleneck_stage === "plaatsingen"
          ? "Plaatsingen wachten op bevestiging"
          : decisionSummary.bottleneck_stage === "casussen"
            ? "Intake instroom vraagt opvolging"
            : "Doorstroom in balans";

  const secondarySignal = decisionSummary.signal_strips.find((signal) => {
    const signalText = signal.text.toLowerCase();
    const primaryText = commandStateLine.toLowerCase();
    return !primaryText.includes(signalText);
  }) ?? null;

  const topForecastSignal = predictiveSummary.forecast_signals[0] ?? null;

  const formatStageCount = (count: number, singular: string, plural: string) =>
    `${count} ${count === 1 ? singular : plural}`;

  return (
    <div className="space-y-6 pb-24">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-semibold text-foreground">
            Regiekamer
          </h1>
        </div>
      </div>

      <section className={`premium-card command-bar-surface overflow-hidden border border-border ${commandToneStyles[commandTone]}`}>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Siren size={13} className={commandTone === "critical" ? "text-red-base" : commandTone === "warning" ? "text-yellow-base" : "text-green-base"} />
              Commandocentrum
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
              {commandStateLine}
            </h2>
            <p className="text-sm text-muted-foreground">
              {commandSummaryLine}
            </p>
          </div>

          <Button onClick={() => applyDecisionTarget(decisionSummary.recommended_action)} className="gap-2 self-start lg:self-center">
            Ga naar acties
            <ArrowRight size={15} />
          </Button>
        </div>
      </section>

      <section className="premium-card p-4">
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch gap-0">
          {clickableFlowStages.map((stage, index) => (
            <Fragment key={stage.id}>
              <button
                onClick={stage.onClick}
                className={`flow-stage-chip flex flex-col items-center justify-center rounded-xl border px-4 py-5 text-center transition-all hover:-translate-y-0.5 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 ${
                  stage.isBottleneck
                    ? "flow-stage-bottleneck shadow-md ring-1 ring-primary/30"
                    : activeKPIFilter === stage.filter
                      ? "border-primary/45 bg-primary/10"
                      : "border-border bg-card"
                }`}
              >
                <p className="text-3xl font-semibold text-foreground leading-none mb-1.5">{stage.count}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {stage.isBottleneck ? `${stage.label} — Bottleneck` : stage.label}
                </p>
              </button>
              {index < flowStages.length - 1 && (
                <div className="flex items-center justify-center px-1">
                  <ChevronRight size={18} className="text-muted-foreground/50" />
                </div>
              )}
            </Fragment>
          ))}
        </div>
        {decisionSummary.bottleneck_stage !== "none" && (
          <p className="px-1 pt-3 text-xs text-muted-foreground">
            {flowDiagnosticMeaning}
          </p>
        )}
      </section>

      <ActionPanel items={actionPanelItems} />

      <section className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setActiveKPIFilter(activeKPIFilter === "delayed" ? null : "delayed")}
          className={`rounded-xl border px-4 py-3 text-left transition-all hover:border-primary/45 hover:shadow-sm ${activeKPIFilter === "delayed" ? "border-primary/45 bg-primary/10" : "border-border bg-card"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Gemiddelde wachttijd</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{avgWaitingTimeCard?.value ?? 0}{avgWaitingTimeCard?.suffix || "d"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{(avgWaitingTimeCard?.value ?? 0) > 7 ? "Boven norm" : "Binnen norm"}</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveKPIFilter(activeKPIFilter === "capacity" ? null : "capacity")}
          className={`rounded-xl border px-4 py-3 text-left transition-all hover:border-primary/45 hover:shadow-sm ${activeKPIFilter === "capacity" ? "border-primary/45 bg-primary/10" : "border-border bg-card"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Capaciteitstekorten</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{capacityIssuesCard?.value ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {decisionSummary.capacity_region ? `Druk in ${decisionSummary.capacity_region}` : "Geen regionale piek"}
          </p>
        </button>
      </section>

      <section className="grid gap-3 md:grid-cols-1">
        {secondarySignal ? (
          <button
            key={secondarySignal.key}
            onClick={() => applyDecisionTarget(secondarySignal.action)}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              secondarySignal.tone === "critical"
                ? "border-red-border bg-red-light/60"
                : secondarySignal.tone === "warning"
                  ? "border-yellow-border bg-yellow-light/65"
                  : "border-blue-border bg-blue-light/62"
            }`}
          >
            <span className="flex items-center gap-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${
                secondarySignal.tone === "critical"
                  ? "bg-red-light text-red-base"
                  : secondarySignal.tone === "warning"
                    ? "bg-yellow-light text-yellow-base"
                    : "bg-blue-light text-blue-base"
              }`}>
                {secondarySignal.tone === "critical" ? <AlertTriangle size={15} /> : secondarySignal.tone === "warning" ? <Clock size={15} /> : <MapPin size={15} />}
              </span>
              <span className="text-sm font-medium text-foreground">{secondarySignal.text}</span>
            </span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <BrainCircuit size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Predictieve signalen</h3>
        </div>
        <div>
          {topForecastSignal ? (
            <button
              onClick={() => applyForecastSignal(topForecastSignal)}
              className={`w-full rounded-xl border px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                topForecastSignal.severity === "critical"
                  ? "border-red-border bg-red-light/55"
                  : topForecastSignal.severity === "warning"
                    ? "border-yellow-border bg-yellow-light/60"
                    : "border-blue-border bg-blue-light/55"
              }`}
            >
              <p className="text-sm font-medium text-foreground">{topForecastSignal.text}</p>
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">Geen voorspellende risicosignalen gevonden.</p>
          )}
        </div>
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
              <option value="casus">Casus</option>
              <option value="matching">Matching</option>
              <option value="aanbieder_selectie">Aanbieder selectie</option>
              <option value="provider_beoordeling">Aanbieder beoordeling</option>
              <option value="intake_provider">Intake</option>
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
                  activeKPIFilter === "assessment" ? "Aanbieder beoordeling" :
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
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredCases.length} {filteredCases.length === 1 ? 'casus' : 'casussen'}
          </span>
        </div>

        <div className="space-y-3">
          {filteredCases.map((caseItem: Casus) => {
            const forecast = predictiveSummary.per_case_forecast[caseItem.id];
            const nextAction = forecast
              ? {
                  action: forecast.next_best_action,
                  type: forecast.risk_band === "critical" || forecast.risk_band === "high"
                    ? "urgent"
                    : forecast.risk_band === "medium"
                      ? "normal"
                      : "waiting",
                }
              : getNextAction(caseItem);

            return (
              <CaseRow
                key={caseItem.id}
                caseItem={caseItem}
                nextAction={nextAction}
                forecast={forecast}
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

const PHASE_LABELS: Record<CasusPhase, string> = {
  intake_initial: "Intake",
  beoordeling: "Aanbieder Beoordeling",
  matching: "Matching",
  plaatsing: "Plaatsing",
  intake_provider: "Intake",
  afgerond: "Afgerond",
  geblokkeerd: "Geblokkeerd",
};

interface CaseRowProps {
  caseItem: Casus;
  nextAction: { action: string; type: "urgent" | "normal" | "waiting" };
  forecast?: RegiekamerCaseForecast;
  onClick: () => void;
}

function CaseRow({ caseItem, nextAction, forecast, onClick }: CaseRowProps) {
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
            {forecast && (
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  forecast.risk_band === "critical"
                    ? "border-red-border bg-red-light text-red-base"
                    : forecast.risk_band === "high"
                      ? "border-yellow-border bg-yellow-light text-yellow-base"
                      : forecast.risk_band === "medium"
                        ? "border-blue-border bg-blue-light text-blue-base"
                        : "border-green-border bg-green-light text-green-base"
                }`}
              >
                Risico {forecast.risk_score}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {caseItem.region} · {caseItem.assignedTo}
          </p>
          {forecast && forecast.top_reasons.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {forecast.top_reasons[0]}
            </p>
          )}
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
