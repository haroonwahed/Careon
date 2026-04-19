import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Plus, Search, Send, Shuffle, SlidersHorizontal, UserCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases, type WorkflowCaseView } from "../../lib/workflowUi";
import { CasusList } from "./CasusList";

interface CasussenWorkflowPageProps {
  onCaseClick: (caseId: string) => void;
  onCreateCase?: () => void;
  canCreateCase?: boolean;
}

type SmartFocus = "ready" | "matching" | "provider" | "urgent" | null;

const WAITING_TIME_THRESHOLD_DAYS = 10;
const OLD_CASE_THRESHOLD_DAYS = 3;

function isUrgentWithoutMatch(item: WorkflowCaseView): boolean {
  return item.urgency === "critical" && item.isBlocked;
}

function isWaitingExceeded(item: WorkflowCaseView): boolean {
  return item.daysInCurrentPhase >= WAITING_TIME_THRESHOLD_DAYS;
}

function isOldCase(item: WorkflowCaseView): boolean {
  return item.daysInCurrentPhase >= OLD_CASE_THRESHOLD_DAYS;
}

function cardClasses(isUrgent: boolean, isActive: boolean): string {
  const base = "rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm";
  if (isUrgent) {
    return `${base} ${isActive ? "ring-2 ring-red-500/35 border-red-500/40" : "border-red-500/35 hover:border-red-500/55"}`;
  }
  return `${base} ${isActive ? "ring-2 ring-primary/35 border-primary/40" : "border-border hover:border-primary/45"}`;
}

export function CasussenWorkflowPage({ onCaseClick, onCreateCase, canCreateCase = false }: CasussenWorkflowPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedUrgency, setSelectedUrgency] = useState("all");
  const [smartFocus, setSmartFocus] = useState<SmartFocus>(null);

  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const workflowCases = useMemo(() => buildWorkflowCases(cases, providers), [cases, providers]);

  const regions = useMemo(() => {
    return ["all", ...Array.from(new Set(workflowCases.map((item) => item.region).filter(Boolean)))];
  }, [workflowCases]);

  const phases = useMemo(() => {
    return ["all", ...Array.from(new Set(workflowCases.map((item) => item.phase)))];
  }, [workflowCases]);

  const filteredCases = useMemo(() => {
    return workflowCases.filter((item) => {
      if (selectedPhase !== "all" && item.phase !== selectedPhase) return false;
      if (selectedRegion !== "all" && item.region !== selectedRegion) return false;
      if (selectedUrgency !== "all" && item.urgency !== selectedUrgency) return false;

      if (smartFocus === "ready" && item.phase !== "intake") return false;
      if (smartFocus === "matching" && item.phase !== "matching") return false;
      if (smartFocus === "provider" && item.phase !== "provider_beoordeling") return false;
      if (smartFocus === "urgent" && !isUrgentWithoutMatch(item)) return false;

      return true;
    });
  }, [workflowCases, selectedPhase, selectedRegion, selectedUrgency, smartFocus]);

  const sortedCases = useMemo(() => {
    const _sentinel = '9999-12-31';
    const rank = (item: WorkflowCaseView): number => {
      if (isUrgentWithoutMatch(item)) return 0;
      if (isWaitingExceeded(item)) return 1;
      if (isOldCase(item)) return 2;
      return 3;
    };

    return [...filteredCases].sort((left, right) => {
      // First: waitlist policy — validated urgent before FCFS
      const lBucket = left.waitlistBucket ?? 1;
      const rBucket = right.waitlistBucket ?? 1;
      if (lBucket !== rBucket) return lBucket - rBucket;
      if (lBucket === 0) {
        // Both validated urgent: earliest urgency_granted_date first
        const lDate = left.urgencyGrantedDate ?? _sentinel;
        const rDate = right.urgencyGrantedDate ?? _sentinel;
        if (lDate !== rDate) return lDate < rDate ? -1 : 1;
      } else {
        // Both normal FCFS: earliest intakeStartDate first
        const lStart = left.intakeStartDate ?? _sentinel;
        const rStart = right.intakeStartDate ?? _sentinel;
        if (lStart !== rStart) return lStart < rStart ? -1 : 1;
      }
      // Tiebreak: urgency rank then waiting days
      const leftRank = rank(left);
      const rightRank = rank(right);
      if (leftRank !== rightRank) return leftRank - rightRank;
      if (left.daysInCurrentPhase !== right.daysInCurrentPhase) {
        return right.daysInCurrentPhase - left.daysInCurrentPhase;
      }
      return left.id.localeCompare(right.id);
    });
  }, [filteredCases]);

  const stripMetrics = useMemo(() => ({
    readyMatching: workflowCases.filter((item) => item.phase === "intake").length,
    matchingInProgress: workflowCases.filter((item) => item.phase === "matching").length,
    waitingProviderReview: workflowCases.filter((item) => item.phase === "provider_beoordeling").length,
    urgentWithoutMatch: workflowCases.filter((item) => isUrgentWithoutMatch(item)).length,
  }), [workflowCases]);

  const recommendedCases = useMemo(() => {
    return sortedCases.filter((item) => item.phase === "intake" || item.phase === "matching");
  }, [sortedCases]);

  const handleCreateCase = () => {
    onCreateCase?.();
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedPhase("all");
    setSelectedRegion("all");
    setSelectedUrgency("all");
    setSmartFocus(null);
  };

  const toggleSmartFocus = (focus: SmartFocus) => {
    setSmartFocus((current) => (current === focus ? null : focus));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Casussen</h1>
          <p className="text-sm text-muted-foreground">Dagelijkse workflow van matching naar aanbiederbeoordeling en intake.</p>
        </div>
        {canCreateCase && (
          <Button onClick={handleCreateCase}>
            <Plus size={16} className="mr-2" />
            Nieuwe casus
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => toggleSmartFocus("ready")}
          className={cardClasses(false, smartFocus === "ready")}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Klaar voor matching</span>
            <UserCheck size={16} className="text-blue-400" />
          </div>
          <p className="text-xl font-semibold text-foreground">{stripMetrics.readyMatching}</p>
          <p className="mt-2 text-xs font-medium text-primary">Bekijk casussen →</p>
        </button>

        <button
          type="button"
          onClick={() => toggleSmartFocus("matching")}
          className={cardClasses(false, smartFocus === "matching")}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">In matching</span>
            <Shuffle size={16} className="text-amber-400" />
          </div>
          <p className="text-xl font-semibold text-foreground">{stripMetrics.matchingInProgress}</p>
          <p className="mt-2 text-xs font-medium text-primary">Bekijk casussen →</p>
        </button>

        <button
          type="button"
          onClick={() => toggleSmartFocus("provider")}
          className={cardClasses(false, smartFocus === "provider")}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Bij aanbieder</span>
            <Send size={16} className="text-cyan-400" />
          </div>
          <p className="text-xl font-semibold text-foreground">{stripMetrics.waitingProviderReview}</p>
          <p className="mt-2 text-xs font-medium text-primary">Bekijk casussen →</p>
        </button>

        <button
          type="button"
          onClick={() => toggleSmartFocus("urgent")}
          className={cardClasses(true, smartFocus === "urgent")}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Urgent zonder match</span>
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <p className="text-xl font-semibold text-foreground">{stripMetrics.urgentWithoutMatch}</p>
          <p className="mt-2 text-xs font-medium text-primary">Bekijk casussen →</p>
        </button>
      </div>

      <div className="sticky top-0 z-20 flex flex-col gap-2 rounded-3xl bg-card/90 p-3 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.35)] backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1 rounded-2xl bg-muted/45 px-3 py-2.5 flex items-center gap-2">
            <Search className="text-muted-foreground flex-shrink-0" size={18} />
            <Input
              type="text"
              placeholder="Zoek casus of cliënt"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 p-0 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters((v) => !v)}
              className={showFilters ? "shadow-sm" : "border-transparent bg-muted/45 text-foreground hover:bg-muted/70"}
            >
              <SlidersHorizontal size={16} className="mr-2" />
              Filters
              {(selectedPhase !== "all" || selectedUrgency !== "all" || selectedRegion !== "all") && (
                <span className="ml-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {[selectedPhase, selectedUrgency, selectedRegion].filter((v) => v !== "all").length}
                </span>
              )}
            </Button>
            {(selectedPhase !== "all" || selectedUrgency !== "all" || selectedRegion !== "all" || searchQuery !== "") && (
              <Button type="button" variant="ghost" onClick={resetFilters} className="text-muted-foreground hover:text-foreground">
                Reset
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Fase</label>
              <div className="relative">
                <select
                  value={selectedPhase}
                  onChange={(event) => setSelectedPhase(event.target.value)}
                  className="w-full appearance-none rounded-xl bg-muted/45 px-3 py-2.5 pr-8 text-sm text-foreground"
                >
                  <option value="all">Alle fases</option>
                  {phases.filter((phase) => phase !== "all").map((phase) => (
                    <option key={phase} value={phase}>{phase}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Urgentie</label>
              <div className="relative">
                <select
                  value={selectedUrgency}
                  onChange={(event) => setSelectedUrgency(event.target.value)}
                  className="w-full appearance-none rounded-xl bg-muted/45 px-3 py-2.5 pr-8 text-sm text-foreground"
                >
                  <option value="all">Alle urgentie</option>
                  <option value="critical">Kritiek</option>
                  <option value="warning">Hoog</option>
                  <option value="normal">Normaal</option>
                  <option value="stable">Laag</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Regio</label>
              <div className="relative">
                <select
                  value={selectedRegion}
                  onChange={(event) => setSelectedRegion(event.target.value)}
                  className="w-full appearance-none rounded-xl bg-muted/45 px-3 py-2.5 pr-8 text-sm text-foreground"
                >
                  <option value="all">Alle regio's</option>
                  {regions.filter((region) => region !== "all").map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>
        )}
      </div>

      {!loading && !error && recommendedCases.length > 0 && (
        <div className="rounded-2xl bg-card/55 p-4 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.35)] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Aanbevolen actie: {recommendedCases.length} casussen vragen om matching
            </p>
            <p className="text-xs text-muted-foreground">Start met de hoogste prioriteit in de huidige werkvoorraad.</p>
          </div>
          <Button variant="outline" onClick={() => onCaseClick(recommendedCases[0].id)}>
            Start met casus #{recommendedCases[0].id}
          </Button>
        </div>
      )}

      {loading && <div className="rounded-2xl bg-card p-10 text-center text-muted-foreground shadow-[0_10px_24px_-24px_rgba(15,23,42,0.35)]">Casussen laden…</div>}

      {!loading && error && (
        <div className="rounded-2xl bg-card p-10 text-center space-y-3 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.35)]">
          <p className="text-base font-semibold text-foreground">Casussen konden niet geladen worden</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>
        </div>
      )}

      {!loading && !error && (
        <CasusList
          cases={sortedCases}
          onCaseClick={onCaseClick}
          canCreateCase={canCreateCase}
          onCreateCase={handleCreateCase}
        />
      )}
    </div>
  );
}
