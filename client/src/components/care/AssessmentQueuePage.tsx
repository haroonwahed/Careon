import { useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { Button } from "../ui/button";
import { CareEmptyState } from "./CareSurface";
import {
  CareContextHint,
  CareMetricBadge,
  CarePageTemplate,
  CareSearchFiltersBar,
  CareUnifiedHeader,
} from "./CareUnifiedPage";
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
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const queueCases = useMemo(() => {
    return buildWorkflowCases(cases, providers)
      .filter((item) => item.phase === "intake" || item.phase === "provider_beoordeling")
      .filter((item) => selectedUrgency === "all" || item.urgency === selectedUrgency)
      .sort((left, right) => right.daysInCurrentPhase - left.daysInCurrentPhase);
  }, [cases, providers, selectedUrgency]);

  return (
    <CarePageTemplate
      header={
        <CareUnifiedHeader
          title="Beoordeling door aanbieder"
          subtitle="Open voor besluit."
          metric={
            <CareMetricBadge>
              {queueCases.length} {queueCases.length === 1 ? "casus in wachtrij" : "casussen in wachtrij"}
            </CareMetricBadge>
          }
        />
      }
      filters={
        <CareSearchFiltersBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Zoek casus, cliënt of regio..."
          showSecondaryFilters={showSecondaryFilters}
          onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
          secondaryFilters={
            <label className="block max-w-xs text-xs text-muted-foreground">
              <span className="mb-1 block font-medium uppercase tracking-[0.08em]">Urgentie</span>
              <select
                value={selectedUrgency}
                onChange={(event) => setSelectedUrgency(event.target.value)}
                className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground"
              >
                <option value="all">Alle urgentie</option>
                <option value="critical">Kritiek</option>
                <option value="warning">Hoog</option>
                <option value="normal">Normaal</option>
                <option value="stable">Laag</option>
              </select>
            </label>
          }
        />
      }
    >
      {loading && <CareEmptyState title="Casussen laden…" copy="De beoordelingswachtrij wordt opgebouwd." />}

      {!loading && error && (
        <CareEmptyState title="Laden mislukt" copy={error} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
      )}

      {!loading && !error && queueCases.length === 0 && (
        <CareEmptyState
          title="Geen open beoordelingen"
          copy="Zodra casussen intake of aanbieder-beoordeling ingaan, verschijnen ze hier."
          action={<Button onClick={() => onNavigateToCasussen?.()}>Ga naar werkvoorraad</Button>}
        />
      )}

      {!loading && !error && queueCases.length > 0 && (
        <div className="rounded-2xl border border-border/70 bg-card/75 overflow-hidden">
          <div className="grid grid-cols-[1fr_1.2fr_70px_0.9fr_90px_110px_132px] gap-3 border-b border-border/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <span>Casus</span>
            <span>Cliënt</span>
            <span>Leeftijd</span>
            <span>Regio</span>
            <span>Urgentie</span>
            <span>Wachttijd</span>
            <span className="text-right">Actie</span>
          </div>
          <div className="divide-y divide-border/70">
            {queueCases.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_1.2fr_70px_0.9fr_90px_110px_132px] gap-3 px-4 py-3 items-center transition-colors hover:bg-muted/15"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.id}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.phaseLabel}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.clientLabel}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.tags[0] ?? "Casus"}</p>
                </div>
                <p className="text-sm text-foreground">{item.clientAge}</p>
                <p className="text-sm text-foreground">{item.region}</p>
                <p className="text-sm text-foreground">{item.urgencyLabel}</p>
                <p className="text-sm text-foreground">{item.daysInCurrentPhase} dagen</p>
                <div className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-2 text-primary hover:bg-primary/10 hover:text-primary"
                    onClick={() => onCaseClick?.(item.id)}
                  >
                    Openen
                    <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CareContextHint
        icon={<ClipboardCheck className="text-primary" size={20} />}
        title="Zelfde casusflow"
        copy="Beoordeling blijft aan de casus gekoppeld."
      />
    </CarePageTemplate>
  );
}
