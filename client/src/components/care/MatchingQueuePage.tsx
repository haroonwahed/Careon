import { useMemo, useState } from "react";
import { ArrowRight, Search, Shuffle } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases } from "../../lib/workflowUi";

interface MatchingQueuePageProps {
  onCaseClick: (caseId: string) => void;
  onNavigateToCasussen?: () => void;
}

export function MatchingQueuePage({ onCaseClick, onNavigateToCasussen }: MatchingQueuePageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");

  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const queueCases = useMemo(() => {
    return buildWorkflowCases(cases, providers)
      .filter((item) => item.readyForMatching)
      .filter((item) => selectedRegion === "all" || item.region === selectedRegion)
      .sort((left, right) => right.daysInCurrentPhase - left.daysInCurrentPhase);
  }, [cases, providers, selectedRegion]);

  const regions = useMemo(() => ["all", ...Array.from(new Set(queueCases.map((item) => item.region)))], [queueCases]);
  const urgentCount = queueCases.filter((item) => item.urgency === "critical" || item.urgency === "warning").length;
  const blockedCount = queueCases.filter((item) => item.isBlocked).length;
  const totalProviderOptions = queueCases.reduce((total, item) => total + item.recommendedProvidersCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">Matching</h1>
        <p className="text-sm text-muted-foreground">Queue van casussen die klaar zijn om aan een aanbieder gekoppeld te worden.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Klaar voor matching</p>
          <p className="text-2xl font-semibold text-foreground">{queueCases.length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Urgente casussen</p>
          <p className="text-2xl font-semibold text-amber-400">{urgentCount}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Aanbevolen providers</p>
          <p className="text-2xl font-semibold text-green-400">{totalProviderOptions}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-2xl border border-border bg-muted/35 p-3 flex items-center gap-2">
          <Search className="text-muted-foreground flex-shrink-0" size={18} />
          <Input type="text" placeholder="Zoek op casus, cliënt of regio..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 p-0 text-sm text-foreground placeholder:text-muted-foreground" />
        </div>
        <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)} className="w-44 px-3 py-3 pr-10 appearance-none bg-card border border-border rounded-2xl text-sm text-foreground">
          {regions.map((region) => (
            <option key={region} value={region}>{region === "all" ? "Alle regio's" : region}</option>
          ))}
        </select>
      </div>

      {loading && <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">Matching-queue laden…</div>}
      {!loading && error && (
        <div className="rounded-2xl border bg-card p-10 text-center space-y-3">
          <p className="text-base font-semibold text-foreground">Matching-queue kon niet geladen worden</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>
        </div>
      )}

      {!loading && !error && queueCases.length === 0 && (
        <div className="rounded-2xl border bg-card p-12 text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Geen casussen klaar voor matching</p>
          <p className="text-sm text-muted-foreground">Matching start pas nadat een beoordeling is afgerond.</p>
          <Button onClick={() => onNavigateToCasussen?.()}>Ga naar casussen</Button>
        </div>
      )}

      {!loading && !error && queueCases.length > 0 && (
        <div className="space-y-3">
          {queueCases.map((item) => (
            <button key={item.id} type="button" onClick={() => onCaseClick(item.id)} className="w-full rounded-2xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-sm">
              <div className="flex items-start justify-between gap-6">
                <div className="grid flex-1 grid-cols-[140px_80px_1fr_1fr] gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.id}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.clientLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Leeftijd</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{item.clientAge}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Regio</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{item.region}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Probleemtags</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="min-w-[260px] text-right">
                  <p className="text-xs text-muted-foreground">Readiness</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{item.phaseLabel}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.recommendedProvidersCount} aanbevolen aanbieders</p>
                  <div className="mt-4 flex justify-end">
                    <Button size="sm" className="gap-2">
                      Start matching
                      <ArrowRight size={14} />
                    </Button>
                  </div>
                </div>
              </div>
              {item.isBlocked && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-300">
                  {item.blockReason ?? "Deze casus vraagt handmatige opvolging voordat matching kan doorgaan."}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="icon-surface flex h-10 w-10 items-center justify-center rounded-full border border-border">
            <Shuffle className="text-primary" size={20} />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Werk vanuit assessment-output</p>
            <p className="text-sm text-muted-foreground">Gebruik matching pas zodra de casus inhoudelijk klaar is voor providerkeuze.</p>
          </div>
        </div>
      </div>
    </div>
  );
}