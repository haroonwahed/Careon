import { useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases } from "../../lib/workflowUi";

interface AssessmentQueuePageProps {
  onCaseClick?: (caseId: string) => void;
  onNavigateToCasussen?: () => void;
}

export function AssessmentQueuePage({ onCaseClick, onNavigateToCasussen }: AssessmentQueuePageProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUrgency, setSelectedUrgency] = useState("all");
  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const queueCases = useMemo(() => {
    return buildWorkflowCases(cases, providers)
      .filter((item) => item.phase === "intake" || item.phase === "beoordeling")
      .filter((item) => selectedUrgency === "all" || item.urgency === selectedUrgency)
      .sort((left, right) => right.daysInCurrentPhase - left.daysInCurrentPhase);
  }, [cases, providers, selectedUrgency]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">Casussen voor matching</h1>
        <p className="text-sm text-muted-foreground">Operationele wachtrij van casussen die klaar zijn om doorgezet te worden.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-2xl border border-border bg-muted/35 p-3 flex items-center gap-2">
          <Search className="text-muted-foreground flex-shrink-0" size={18} />
          <Input type="text" placeholder="Zoek op casus, cliënt of regio..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 p-0 text-sm text-foreground placeholder:text-muted-foreground" />
        </div>
        <select value={selectedUrgency} onChange={(event) => setSelectedUrgency(event.target.value)} className="w-40 px-3 py-3 pr-10 appearance-none bg-card border border-border rounded-2xl text-sm text-foreground">
          <option value="all">Alle urgentie</option>
          <option value="critical">Kritiek</option>
          <option value="warning">Hoog</option>
          <option value="normal">Normaal</option>
          <option value="stable">Laag</option>
        </select>
      </div>

      {loading && <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">Casussen laden…</div>}
      {!loading && error && (
        <div className="rounded-2xl border bg-card p-10 text-center space-y-3">
          <p className="text-base font-semibold text-foreground">Casussen konden niet geladen worden</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>
        </div>
      )}

      {!loading && !error && queueCases.length === 0 && (
        <div className="rounded-2xl border bg-card p-12 text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Geen casussen klaar voor matching</p>
          <p className="text-sm text-muted-foreground">Casussen verschijnen hier zodra de samenvatting compleet is en doorgezet kan worden.</p>
          <Button onClick={() => onNavigateToCasussen?.()}>Ga naar casussen</Button>
        </div>
      )}

      {!loading && !error && queueCases.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="grid grid-cols-[1.1fr_1.4fr_80px_1fr_110px_150px_170px] gap-4 border-b border-border px-5 py-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <span>Casus</span>
            <span>Cliënt</span>
            <span>Leeftijd</span>
            <span>Regio</span>
            <span>Urgentie</span>
            <span>Wachttijd</span>
            <span className="text-right">Actie</span>
          </div>
          <div className="divide-y divide-border">
            {queueCases.map((item) => (
              <div key={item.id} className="grid grid-cols-[1.1fr_1.4fr_80px_1fr_110px_150px_170px] gap-4 px-5 py-4 items-center transition-colors hover:bg-muted/20">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.id}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.phaseLabel}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.clientLabel}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.tags[0] ?? "Casus"}</p>
                </div>
                <p className="text-sm text-foreground">{item.clientAge}</p>
                <p className="text-sm text-foreground">{item.region}</p>
                <p className="text-sm text-foreground">{item.urgencyLabel}</p>
                <p className="text-sm text-foreground">{item.daysInCurrentPhase} dagen</p>
                <div className="text-right">
                  <Button size="sm" variant="ghost" className="gap-2 text-primary hover:bg-primary/10 hover:text-primary" onClick={() => onCaseClick?.(item.id)}>
                    Open casus
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
            <ClipboardCheck className="text-primary" size={20} />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Werk vanuit de casus</p>
            <p className="text-sm text-muted-foreground">Elke stap is onderdeel van dezelfde casusworkflow en niet een los object.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
