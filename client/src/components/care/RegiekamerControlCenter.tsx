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

import { useState, useMemo } from "react";
import { 
  Search,
  Filter,
  Download,
  AlertTriangle,
  Clock,
  Users,
  TrendingUp,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  MapPin,
  ClipboardList,
  Siren
} from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { mockCases, Case } from "../../lib/casesData";

interface RegiekamerControlCenterProps {
  onCaseClick: (caseId: string) => void;
}

export function RegiekamerControlCenter({ onCaseClick }: RegiekamerControlCenterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("all");
  const [activeKPIFilter, setActiveKPIFilter] = useState<string | null>(null);

  const systemState = useMemo(() => {
    const urgent = mockCases.filter(c => c.urgency === "high" || c.urgency === "critical");
    const blocked = mockCases.filter(c => c.status === "blocked");
    const delayed = mockCases.filter(c => c.waitingDays > 7);
    const noMatch = mockCases.filter(c => c.status === "matching" && c.waitingDays > 3);
    const openAssessments = mockCases.filter(c => c.status === "assessment");
    const highRisk = mockCases.filter(c => c.risk === "high");

    const regionPressure = mockCases.reduce<Record<string, number>>((acc, caseItem) => {
      if (caseItem.status === "blocked" || caseItem.status === "matching") {
        acc[caseItem.region] = (acc[caseItem.region] || 0) + 1;
      }
      return acc;
    }, {});

    const busiestRegion = Object.entries(regionPressure).sort((a, b) => b[1] - a[1])[0];
    
    return {
      urgentCount: urgent.length,
      blockedCount: blocked.length,
      delayedCount: delayed.length,
      noMatchCount: noMatch.length,
      openAssessmentCount: openAssessments.length,
      busiestRegion: busiestRegion?.[0] || "Utrecht",
      highRiskCount: highRisk.length
    };
  }, []);

  const kpis = useMemo(() => {
    return {
      casesWithoutMatch: {
        value: mockCases.filter(c => c.status === "matching" || c.status === "blocked").length,
        context: "Vraagt handmatige opvolging",
        status: "critical" as const,
        label: "Casussen zonder match",
        filter: "noMatch"
      },
      openAssessments: {
        value: mockCases.filter(c => c.status === "assessment").length,
        context: "Blokkeren de volgende stap",
        status: "warning" as const,
        label: "Open beoordelingen",
        filter: "assessment"
      },
      placementsInProgress: {
        value: mockCases.filter(c => c.status === "placement").length,
        context: "Wachten op bevestiging",
        status: "good" as const,
        label: "Plaatsingen bezig",
        filter: "placement"
      },
      avgWaitingTime: {
        value: Math.round(mockCases.reduce((sum, c) => sum + c.waitingDays, 0) / mockCases.length),
        context: "Norm is 7 dagen",
        status: "warning" as const,
        label: "Gem. wachttijd",
        filter: "delayed"
      },
      highRiskCases: {
        value: mockCases.filter(c => c.risk === "high").length,
        context: "Extra regie vereist",
        status: "critical" as const,
        label: "Hoog risico casussen",
        filter: "highRisk"
      },
      capacityIssues: {
        value: 3,
        context: `Druk in regio ${systemState.busiestRegion}`,
        status: "critical" as const,
        label: "Capaciteitstekorten",
        filter: "capacity"
      }
    };
  }, [systemState.busiestRegion]);

  const highestPriority = useMemo(() => {
    if (systemState.openAssessmentCount > 0) {
      return {
        issue: `${systemState.urgentCount} casussen vereisen directe actie`,
        reason: `${systemState.openAssessmentCount} dossiers blokkeren matching en wachttijden lopen op`,
        actionLabel: "Aanbevolen actie",
        action: "Werk open beoordelingen af",
        cta: "Bekijk urgente casussen",
        tone: "critical" as const,
        apply: () => {
          setSelectedStatus("assessment");
          setSelectedUrgency("all");
          setActiveKPIFilter("assessment");
        }
      };
    }

    if (systemState.noMatchCount > 0) {
      return {
        issue: `${systemState.noMatchCount} casussen lopen vast in matching`,
        reason: "Beschikbare aanbieders ontbreken of reageren te traag voor een tijdige plaatsing",
        actionLabel: "Aanbevolen actie",
        action: "Herzie matching voor vastgelopen dossiers",
        cta: "Open matchings met blokkade",
        tone: "warning" as const,
        apply: () => {
          setSelectedStatus("matching");
          setSelectedUrgency("all");
          setActiveKPIFilter("noMatch");
        }
      };
    }

    return {
      issue: `${systemState.delayedCount} casussen wachten langer dan 7 dagen`,
      reason: "Wachttijd loopt op en regie moet bepalen welke dossiers eerst versneld worden opgepakt",
      actionLabel: "Aanbevolen actie",
      action: "Pak de langst wachtende dossiers eerst op",
      cta: "Bekijk wachtende casussen",
      tone: "info" as const,
      apply: () => {
        setSelectedUrgency("all");
        setSelectedStatus("all");
        setActiveKPIFilter("delayed");
      }
    };
  }, [systemState.delayedCount, systemState.noMatchCount, systemState.openAssessmentCount, systemState.urgentCount]);

  const secondarySignals = useMemo(() => {
    return [
      {
        id: "delayed",
        tone: "warning" as const,
        icon: Clock,
        text: `${systemState.delayedCount} casussen wachten langer dan 7 dagen`,
        onClick: () => {
          setActiveKPIFilter("delayed");
          setSelectedUrgency("all");
        }
      },
      {
        id: "nomatch",
        tone: "critical" as const,
        icon: AlertTriangle,
        text: `${systemState.noMatchCount} casussen zonder beschikbare aanbieder`,
        onClick: () => {
          setActiveKPIFilter("noMatch");
          setSelectedStatus("matching");
        }
      },
      {
        id: "capacity",
        tone: "info" as const,
        icon: MapPin,
        text: `Capaciteitstekort in regio ${systemState.busiestRegion}`,
        onClick: () => {
          setActiveKPIFilter("capacity");
          setSelectedRegion(systemState.busiestRegion);
        }
      }
    ];
  }, [systemState.busiestRegion, systemState.delayedCount, systemState.noMatchCount]);

  const filteredCases = useMemo(() => {
    return mockCases
      .filter(c => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (!(
            c.id.toLowerCase().includes(query) ||
            c.clientName.toLowerCase().includes(query) ||
            c.caseType.toLowerCase().includes(query)
          )) return false;
        }
        
        // Region filter
        if (selectedRegion !== "all" && c.region !== selectedRegion) return false;
        
        // Status filter
        if (selectedStatus !== "all" && c.status !== selectedStatus) return false;
        
        // Urgency filter
        if (selectedUrgency !== "all" && c.urgency !== selectedUrgency) return false;
        
        // KPI filter (when user clicks a KPI)
        if (activeKPIFilter) {
          if (activeKPIFilter === "noMatch" && c.status !== "matching" && c.status !== "blocked") return false;
          if (activeKPIFilter === "assessment" && c.status !== "assessment") return false;
          if (activeKPIFilter === "placement" && c.status !== "placement") return false;
          if (activeKPIFilter === "highRisk" && c.risk !== "high") return false;
          if (activeKPIFilter === "delayed" && c.waitingDays <= 7) return false;
          if (activeKPIFilter === "capacity" && c.region !== systemState.busiestRegion) return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const riskOrder = { high: 0, medium: 1, low: 2, none: 3 };
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        
        if (urgencyDiff !== 0) return urgencyDiff;

        const waitingDiff = b.waitingDays - a.waitingDays;
        if (waitingDiff !== 0) return waitingDiff;

        if (a.status === "blocked" && b.status !== "blocked") return -1;
        if (b.status === "blocked" && a.status !== "blocked") return 1;

        return riskOrder[a.risk] - riskOrder[b.risk];
      });
  }, [activeKPIFilter, searchQuery, selectedRegion, selectedStatus, selectedUrgency, systemState.busiestRegion]);

  const regions = ["all", ...Array.from(new Set(mockCases.map(c => c.region)))];

  // Get next action for a case
  const getNextAction = (caseItem: Case): { action: string; type: "urgent" | "normal" | "waiting" } => {
    if (caseItem.status === "intake") {
      return { action: "Start beoordeling", type: "urgent" };
    }
    if (caseItem.status === "assessment") {
      return { action: "Voltooi beoordeling", type: "urgent" };
    }
    if (caseItem.status === "matching") {
      return { action: "Herzie matching", type: "urgent" };
    }
    if (caseItem.status === "placement") {
      return { action: "Volg op bij aanbieder", type: "normal" };
    }
    if (caseItem.status === "blocked") {
      return { action: "Escaleer", type: "urgent" };
    }
    if (caseItem.status === "completed") {
      return { action: "Archiveren", type: "waiting" };
    }
    return { action: "Wacht op aanbieder reactie", type: "waiting" };
  };

  return (
    <div className="space-y-6 pb-24">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-semibold text-foreground">
            Regiekamer
          </h1>
          <p className="text-sm text-muted-foreground">
            Macro-overzicht voor prioritering, knelpunten en volgende beslissingen
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download size={16} />
          Exporteer rapport
        </Button>
      </div>

      <section className="premium-card overflow-hidden border border-border bg-card shadow-sm">
        <div className={`grid gap-5 p-6 md:grid-cols-[1.5fr_0.9fr] md:p-7 ${
          highestPriority.tone === "critical"
            ? "bg-[linear-gradient(135deg,rgba(254,242,242,0.96),rgba(255,255,255,1)_45%,rgba(255,251,235,0.88))]"
            : highestPriority.tone === "warning"
              ? "bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,1)_45%,rgba(239,246,255,0.88))]"
              : "bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,1)_45%,rgba(238,233,255,0.88))]"
        }`}>
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Siren size={14} className={highestPriority.tone === "critical" ? "text-red-base" : highestPriority.tone === "warning" ? "text-yellow-base" : "text-blue-base"} />
              Hoogste prioriteit
            </div>

            <div className="space-y-3">
              <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {highestPriority.issue}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                {highestPriority.reason}
              </p>
            </div>

            <div className="grid gap-4 rounded-2xl border border-white/70 bg-white/72 p-4 backdrop-blur md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {highestPriority.actionLabel}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {highestPriority.action}
                </p>
              </div>

              <Button onClick={highestPriority.apply} className="gap-2 self-start md:self-auto">
                {highestPriority.cta}
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/70 bg-white/72 p-4 backdrop-blur">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Waarom dit nu telt
              </p>
            </div>
            <PriorityStat
              icon={ClipboardList}
              label="Open beoordelingen"
              value={systemState.openAssessmentCount}
              tone="warning"
            />
            <PriorityStat
              icon={AlertTriangle}
              label="Geblokkeerde dossiers"
              value={systemState.blockedCount}
              tone="critical"
            />
            <PriorityStat
              icon={Clock}
              label="Langer dan 7 dagen"
              value={systemState.delayedCount}
              tone="info"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {secondarySignals.map((signal) => (
          <button
            key={signal.id}
            onClick={signal.onClick}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors hover:bg-card ${
              signal.tone === "critical"
                ? "border-red-border bg-red-light/70"
                : signal.tone === "warning"
                  ? "border-yellow-border bg-yellow-light/75"
                  : "border-blue-border bg-blue-light/75"
            }`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${
              signal.tone === "critical"
                ? "bg-red-light text-red-base"
                : signal.tone === "warning"
                  ? "bg-yellow-light text-yellow-base"
                  : "bg-blue-light text-blue-base"
            }`}>
              <signal.icon size={16} />
            </span>
            <span className="text-sm font-medium text-foreground">{signal.text}</span>
          </button>
        ))}
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          label={kpis.casesWithoutMatch.label}
          value={kpis.casesWithoutMatch.value}
          context={kpis.casesWithoutMatch.context}
          status={kpis.casesWithoutMatch.status}
          icon={<Users size={17} />}
          active={activeKPIFilter === kpis.casesWithoutMatch.filter}
          onClick={() => setActiveKPIFilter(activeKPIFilter === kpis.casesWithoutMatch.filter ? null : kpis.casesWithoutMatch.filter)}
        />
        <KPICard
          label={kpis.openAssessments.label}
          value={kpis.openAssessments.value}
          context={kpis.openAssessments.context}
          status={kpis.openAssessments.status}
          icon={<ClipboardList size={17} />}
          active={activeKPIFilter === kpis.openAssessments.filter}
          onClick={() => setActiveKPIFilter(activeKPIFilter === kpis.openAssessments.filter ? null : kpis.openAssessments.filter)}
        />
        <KPICard
          label={kpis.placementsInProgress.label}
          value={kpis.placementsInProgress.value}
          context={kpis.placementsInProgress.context}
          status={kpis.placementsInProgress.status}
          icon={<TrendingUp size={17} />}
          active={activeKPIFilter === kpis.placementsInProgress.filter}
          onClick={() => setActiveKPIFilter(activeKPIFilter === kpis.placementsInProgress.filter ? null : kpis.placementsInProgress.filter)}
        />
        <KPICard
          label={kpis.avgWaitingTime.label}
          value={kpis.avgWaitingTime.value}
          suffix="d"
          context={kpis.avgWaitingTime.context}
          status={kpis.avgWaitingTime.status}
          icon={<Clock size={17} />}
          active={activeKPIFilter === kpis.avgWaitingTime.filter}
          onClick={() => setActiveKPIFilter(activeKPIFilter === kpis.avgWaitingTime.filter ? null : kpis.avgWaitingTime.filter)}
        />
        <KPICard
          label={kpis.highRiskCases.label}
          value={kpis.highRiskCases.value}
          context={kpis.highRiskCases.context}
          status={kpis.highRiskCases.status}
          icon={<ShieldAlert size={17} />}
          active={activeKPIFilter === kpis.highRiskCases.filter}
          onClick={() => setActiveKPIFilter(activeKPIFilter === kpis.highRiskCases.filter ? null : kpis.highRiskCases.filter)}
        />
        <KPICard
          label={kpis.capacityIssues.label}
          value={kpis.capacityIssues.value}
          context={kpis.capacityIssues.context}
          status={kpis.capacityIssues.status}
          icon={<MapPin size={17} />}
          active={activeKPIFilter === kpis.capacityIssues.filter}
          onClick={() => setActiveKPIFilter(activeKPIFilter === kpis.capacityIssues.filter ? null : kpis.capacityIssues.filter)}
        />
      </div>

      <section className="rounded-2xl border border-border bg-muted/35 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Zoek op casus ID, naam of type zorg..."
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
              <option value="intake">Intake</option>
              <option value="assessment">Beoordeling</option>
              <option value="matching">Matching</option>
              <option value="placement">Plaatsing</option>
              <option value="blocked">Geblokkeerd</option>
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
              Actieve filters
            </span>

            {searchQuery && <ActiveFilterChip label={`Zoekterm: ${searchQuery}`} />}
            {selectedRegion !== "all" && <ActiveFilterChip label={`Regio: ${selectedRegion}`} />}
            {selectedStatus !== "all" && <ActiveFilterChip label={`Status: ${selectedStatus}`} />}
            {selectedUrgency !== "all" && <ActiveFilterChip label={`Urgentie: ${selectedUrgency}`} />}
            {activeKPIFilter && (
              <ActiveFilterChip
                label={
                  activeKPIFilter === "noMatch" ? "Zonder match" :
                  activeKPIFilter === "assessment" ? "Open beoordelingen" :
                  activeKPIFilter === "placement" ? "Plaatsingen bezig" :
                  activeKPIFilter === "highRisk" ? "Hoog risico" :
                  activeKPIFilter === "capacity" ? `Capaciteit ${systemState.busiestRegion}` :
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
          {filteredCases.map((caseItem) => {
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

interface PriorityStatProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  tone: "critical" | "warning" | "info";
}

function PriorityStat({ icon: Icon, label, value, tone }: PriorityStatProps) {
  const toneClasses = {
    critical: "bg-red-light text-red-base border-red-border",
    warning: "bg-yellow-light text-yellow-base border-yellow-border",
    info: "bg-blue-light text-blue-base border-blue-border"
  };

  return (
    <div className={`flex items-center justify-between rounded-xl border px-3 py-3 ${toneClasses[tone]}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70">
          <Icon size={16} />
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-xl font-semibold">{value}</span>
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
  status: "good" | "normal" | "warning" | "critical";
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  suffix?: string;
}

function KPICard({ label, value, context, status, icon, active, onClick, suffix }: KPICardProps) {
  const cardStyles = {
    good: "border-green-border bg-green-light/45",
    normal: "border-blue-border bg-blue-light/38",
    warning: "border-yellow-border bg-yellow-light/45",
    critical: "border-red-border bg-red-light/42"
  };

  const iconStyles = {
    good: "text-green-base bg-white/75",
    normal: "text-blue-base bg-white/75",
    warning: "text-yellow-base bg-white/75",
    critical: "text-red-base bg-white/75"
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${cardStyles[status]} ${active ? "ring-2 ring-primary/35" : ""}`}
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
      </div>
    </button>
  );
}

interface CaseRowProps {
  caseItem: Case;
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

  const statusBadge = {
    intake: "careon-badge-blue",
    assessment: "careon-badge-purple",
    matching: "careon-badge-yellow",
    placement: "bg-green-light text-green-base border border-green-border",
    blocked: "careon-badge-red",
    completed: "bg-muted text-muted-foreground border border-border"
  };

  const riskIcon =
    caseItem.risk === "high" ? <AlertCircle size={16} className="text-red-base" /> :
    caseItem.risk === "medium" ? <AlertTriangle size={16} className="text-yellow-base" /> :
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
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadge[caseItem.status]}`}>
              {caseItem.status === "intake" ? "Intake" : caseItem.status === "assessment" ? "Beoordeling" : caseItem.status === "matching" ? "Matching" : caseItem.status === "placement" ? "Plaatsing" : caseItem.status === "blocked" ? "Geblokkeerd" : "Afgerond"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {caseItem.caseType} · {caseItem.region} · Eigenaar: {caseItem.assignedTo}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Blokkade / issue
          </p>
          <p className="text-sm font-medium text-foreground">
            {caseItem.signal}
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
            {riskIcon}
            <span>
              Risico {caseItem.risk === "high" ? "hoog" : caseItem.risk === "medium" ? "gemiddeld" : "laag"}
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
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white/70 text-muted-foreground transition-colors hover:text-primary">
            <ChevronRight size={18} />
          </div>
        </div>
      </div>
    </button>
  );
}
