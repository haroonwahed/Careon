import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import {
  CareQueueInlineAction,
  CareOperationalSelect,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import {
  CareCommandShell,
  CareWorklist,
  CareWorklistToolbar,
  CareWorklistFilterPanel,
  CareWorklistColumnHeader,
  CareWorklistBody,
  CareWorklistRow,
  CareWorklistRowAction,
  CareWorklistPagination,
  ROW_ACTION_CLASSES,
} from "./CareCommandPrimitives";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases } from "../../lib/workflowUi";

interface AssessmentQueuePageProps {
  onCaseClick?: (caseId: string) => void;
  onNavigateToCasussen?: () => void;
}

const ASSESSMENT_COLS = "7rem minmax(10rem,2fr) minmax(8rem,1.2fr) 8rem minmax(8rem,1fr)";

function urgencyChipClass(urgency: string): string {
  if (urgency === "critical") return "border border-care-urgent-border bg-care-urgent-bg text-care-urgent-text";
  if (urgency === "warning") return "border border-care-warning-border bg-care-warning-bg text-care-warning-text";
  return "border border-border/60 bg-card/40 text-foreground";
}

export function AssessmentQueuePage({ onCaseClick, onNavigateToCasussen }: AssessmentQueuePageProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUrgency, setSelectedUrgency] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const queueCases = useMemo(() => {
    return buildWorkflowCases(cases, providers)
      .filter((item) => item.phase === "intake" || item.phase === "provider_beoordeling")
      .filter((item) => selectedUrgency === "all" || item.urgency === selectedUrgency)
      .sort((left, right) => right.daysInCurrentPhase - left.daysInCurrentPhase);
  }, [cases, providers, selectedUrgency]);

  return (
    <CareCommandShell
      title="Reacties"
      subtitle="Beoordeel open reacties en keur casussen goed of af."
    >
      {loading && <LoadingState title="Casussen laden…" copy="De beoordelingswachtrij wordt opgebouwd." />}

      {!loading && error && (
        <ErrorState title="Laden mislukt" copy={error} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
      )}

      {!loading && !error && queueCases.length === 0 && (
        <EmptyState
          title="Geen open beoordelingen"
          copy="Zodra casussen intake of aanbieder-beoordeling ingaan, verschijnen ze hier."
          action={
            onNavigateToCasussen ? (
              <CareQueueInlineAction onClick={() => onNavigateToCasussen()}>Open werkvoorraad</CareQueueInlineAction>
            ) : undefined
          }
        />
      )}

      {!loading && !error && queueCases.length > 0 && (
        <CareWorklist testId="assessment-queue-worklist">
          <CareWorklistToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Zoek casus, regio of aanbieder..."
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters((v) => !v)}
          />

          <CareWorklistFilterPanel open={showFilters}>
            <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
              Urgentie
              <CareOperationalSelect
                aria-label="Urgentie"
                value={selectedUrgency}
                onChange={(e) => setSelectedUrgency(e.target.value)}
                className="max-w-xs"
              >
                <option value="all">Alle urgentie</option>
                <option value="critical">Kritiek</option>
                <option value="warning">Hoog</option>
                <option value="normal">Normaal</option>
                <option value="stable">Laag</option>
              </CareOperationalSelect>
            </label>
          </CareWorklistFilterPanel>

          <div className="overflow-x-auto">
            <CareWorklistColumnHeader
              columns={["Urgentie", "Casus", "Fase", "Wachttijd", "Actie"]}
              cols={ASSESSMENT_COLS}
              minWidth="800px"
            />
            <CareWorklistBody>
              {queueCases.map((item) => (
                <CareWorklistRow
                  key={item.id}
                  cols={ASSESSMENT_COLS}
                  minWidth="800px"
                  accentTone={item.urgency === "critical" ? "urgent" : item.urgency === "warning" ? "warning" : "neutral"}
                  onRowClick={() => onCaseClick?.(item.id)}
                >
                  {/* Urgentie */}
                  <div className="flex items-start">
                    <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium", urgencyChipClass(item.urgency))}>
                      {item.urgencyLabel}
                    </span>
                  </div>

                  {/* Casus */}
                  <div className="min-w-0">
                    <span className="block truncate text-[13px] font-medium leading-tight text-foreground">
                      {item.clientLabel}
                    </span>
                    <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[11px] text-muted-foreground">{item.id}</span>
                      {item.region && <span className="text-[11px] text-muted-foreground">{item.region}</span>}
                    </div>
                    {item.tags[0] && (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground/80 truncate">{item.tags[0]}</span>
                    )}
                  </div>

                  {/* Fase */}
                  <div className="flex items-start">
                    <span className="inline-flex items-center rounded-[10px] border border-border/60 bg-card/35 px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                      {item.phaseLabel}
                    </span>
                  </div>

                  {/* Wachttijd */}
                  <div className="flex items-start">
                    <span className="inline-flex items-center rounded-[10px] border border-border/60 bg-card/35 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {item.daysInCurrentPhase} dagen
                    </span>
                  </div>

                  {/* Actie */}
                  <CareWorklistRowAction>
                    <button
                      type="button"
                      className={ROW_ACTION_CLASSES.default}
                      onClick={(e) => { e.stopPropagation(); onCaseClick?.(item.id); }}
                    >
                      Openen
                      <ChevronRight size={12} className="shrink-0 opacity-60" aria-hidden />
                    </button>
                  </CareWorklistRowAction>
                </CareWorklistRow>
              ))}
            </CareWorklistBody>
          </div>

          <CareWorklistPagination count={queueCases.length} singular="casus" plural="casussen" />
        </CareWorklist>
      )}
    </CareCommandShell>
  );
}
