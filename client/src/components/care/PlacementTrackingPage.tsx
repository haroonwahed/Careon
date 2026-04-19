import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases } from "../../lib/workflowUi";

interface PlacementTrackingPageProps {
  onCaseClick: (caseId: string) => void;
  onNavigateToMatching?: () => void;
}

type PlacementTab = "te-bevestigen" | "lopend" | "afgerond";

export function PlacementTrackingPage({ onCaseClick, onNavigateToMatching }: PlacementTrackingPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<PlacementTab>("te-bevestigen");
  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const placementCases = useMemo(() => {
    return buildWorkflowCases(cases, providers).filter((item) => item.phase === "plaatsing" || item.phase === "afgerond");
  }, [cases, providers]);

  const tabCounts = {
    "te-bevestigen": placementCases.filter((item) => item.phase === "plaatsing" && item.daysInCurrentPhase <= 2).length,
    lopend: placementCases.filter((item) => item.phase === "plaatsing" && item.daysInCurrentPhase > 2).length,
    afgerond: placementCases.filter((item) => item.phase === "afgerond").length,
  };

  const visibleCases = placementCases.filter((item) => {
    if (activeTab === "te-bevestigen") return item.phase === "plaatsing" && item.daysInCurrentPhase <= 2;
    if (activeTab === "lopend") return item.phase === "plaatsing" && item.daysInCurrentPhase > 2;
    return item.phase === "afgerond";
  });

  const emptyCopy = {
    "te-bevestigen": "Plaatsingen verschijnen hier zodra een aanbieder de match heeft geaccepteerd.",
    lopend: "Lopende plaatsingen volgen nadat intake en overdracht zijn gestart.",
    afgerond: "Afgeronde plaatsingen verschijnen nadat intake en overdracht zijn afgerond.",
  } as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">Plaatsingen</h1>
        <p className="text-sm text-muted-foreground">Volg de plaatsingsstap van bevestiging tot overdracht.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-2xl border border-border bg-muted/35 p-3 flex items-center gap-2">
          <Search className="text-muted-foreground flex-shrink-0" size={18} />
          <Input type="text" placeholder="Zoek op casus, provider of regio..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 p-0 text-sm text-foreground placeholder:text-muted-foreground" />
        </div>
      </div>

      <div className="flex gap-3">
        {(["te-bevestigen", "lopend", "afgerond"] as PlacementTab[]).map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${activeTab === tab ? "border-primary/45 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30"}`}>
            {tab === "te-bevestigen" ? "Te bevestigen" : tab === "lopend" ? "Lopend" : "Afgerond"} · {tabCounts[tab]}
          </button>
        ))}
      </div>

      {loading && <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">Plaatsingen laden…</div>}
      {!loading && error && (
        <div className="rounded-2xl border bg-card p-10 text-center space-y-3">
          <p className="text-base font-semibold text-foreground">Plaatsingen konden niet geladen worden</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>
        </div>
      )}

      {!loading && !error && visibleCases.length === 0 && (
        <div className="rounded-2xl border bg-card p-12 text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Geen plaatsingen gevonden</p>
          <p className="text-sm text-muted-foreground">{emptyCopy[activeTab]}</p>
          <Button onClick={() => onNavigateToMatching?.()}>Ga naar matching</Button>
        </div>
      )}

      {!loading && !error && visibleCases.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_1.4fr_1fr_1fr_1fr_1fr_160px] gap-4 border-b border-border px-5 py-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <span>Casus</span>
            <span>Provider</span>
            <span>Regio</span>
            <span>Status</span>
            <span>Intake</span>
            <span>Laatste update</span>
            <span className="text-right">Actie</span>
          </div>
          <div className="divide-y divide-border">
            {visibleCases.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_1.4fr_1fr_1fr_1fr_1fr_160px] gap-4 px-5 py-4 items-center transition-colors hover:bg-muted/20">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.id}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.clientLabel}</p>
                </div>
                <p className="text-sm text-foreground">{item.recommendedProviderName ?? "Nog niet gekozen"}</p>
                <p className="text-sm text-foreground">{item.region}</p>
                <p className="text-sm text-foreground">{activeTab === "te-bevestigen" ? "Te bevestigen" : activeTab === "lopend" ? "Lopend" : "Afgerond"}</p>
                <p className="text-sm text-foreground">{activeTab === "te-bevestigen" ? "Pending" : item.intakeDateLabel ?? "Volgt"}</p>
                <p className="text-sm text-foreground">{item.daysInCurrentPhase} dagen</p>
                <div className="text-right">
                  <Button size="sm" variant="ghost" className="gap-2 text-primary hover:bg-primary/10 hover:text-primary" onClick={() => onCaseClick(item.id)}>
                    Open plaatsing
                    <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="icon-surface flex h-10 w-10 items-center justify-center rounded-full border border-border">
            <CheckCircle2 className="text-primary" size={20} />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Plaatsingen volgen uit matching</p>
            <p className="text-sm text-muted-foreground">Bevestiging, intakeplanning en afronding blijven onderdeel van dezelfde casusworkflow.</p>
          </div>
        </div>
      </div>
    </div>
  );
}