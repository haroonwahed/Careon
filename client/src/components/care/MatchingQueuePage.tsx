import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases } from "../../lib/workflowUi";
import type { WorkflowCaseView } from "../../lib/workflowUi";
import {
  CareDominantStatus,
  CareOperationalSelect,
  CareQueueInlineAction,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import {
  CareCommandShell,
  CareMetricStrip,
  CareMetricCard,
  CareWorklist,
  CareWorklistTabs,
  CareWorklistToolbar,
  CareWorklistFilterPanel,
  CareWorklistColumnHeader,
  CareWorklistBody,
  CareWorklistRow,
  CareWorklistRowAction,
  CareWorklistPagination,
  ROW_ACTION_CLASSES,
} from "./CareCommandPrimitives";
import {
  DECISION_UI_PHASE_LABELS,
  DECISION_WORKSPACE_FLOW_STEPS,
  mapApiPhaseToDecisionUiPhase,
  type DecisionUiPhaseId,
} from "../../lib/decisionPhaseUi";
import { getShortReasonLabel } from "../../lib/uxCopy";

interface MatchingQueuePageProps {
  onCaseClick: (caseId: string) => void;
  onNavigateToCasussen?: () => void;
}

type UrgencyFilter = "all" | "critical" | "warning" | "normal";

const URGENCY_FILTERS: Array<{ key: UrgencyFilter; label: string }> = [
  { key: "all", label: "Alle urgenties" },
  { key: "critical", label: "Spoed" },
  { key: "warning", label: "Hoog" },
  { key: "normal", label: "Normaal" },
];

function urgencyLabel(item: WorkflowCaseView): string {
  return item.placementPressureLabel || item.urgencyLabel || "Normaal";
}

function urgencyMatchesFilter(item: WorkflowCaseView, filter: UrgencyFilter): boolean {
  if (filter === "all") return true;
  if (filter === "critical") return item.urgency === "critical";
  if (filter === "warning") return item.urgency === "warning";
  return item.urgency === "normal";
}

function phaseOf(item: WorkflowCaseView): DecisionUiPhaseId {
  return mapApiPhaseToDecisionUiPhase(item.boardColumn);
}

function sortMatchingCases(list: WorkflowCaseView[]): WorkflowCaseView[] {
  return [...list].sort((a, b) => {
    const urgencyOrder = { critical: 0, warning: 1, normal: 2, low: 3 } as const;
    return (
      urgencyOrder[a.urgency] - urgencyOrder[b.urgency] ||
      b.daysInCurrentPhase - a.daysInCurrentPhase ||
      a.id.localeCompare(b.id, "nl")
    );
  });
}

function countByPhase(items: WorkflowCaseView[]): Record<DecisionUiPhaseId, number> {
  const counts: Record<DecisionUiPhaseId, number> = {
    aanmelding: 0,
    matching: 0,
    aanbiederreactie: 0,
    plaatsing: 0,
    intake: 0,
  };
  for (const item of items) {
    counts[phaseOf(item)] += 1;
  }
  return counts;
}

function matchingRowActionLabel(item: WorkflowCaseView): "Bekijk onderbouwing" | "Vraag gegevens op" {
  if (item.isBlocked || item.missingDataItems.length > 0) return "Vraag gegevens op";
  return "Bekijk onderbouwing";
}

function matchingStatusLabel(item: WorkflowCaseView): string {
  if (item.matchConfidenceLabel) {
    const label = item.matchConfidenceLabel.toLowerCase();
    if (label.includes("afstemming")) return "Afstemming";
    if (label.includes("capaciteit")) return "Capaciteit";
    if (label.includes("onderbouwing")) return "Onderbouwing";
    if (label.includes("sterke aansluiting") || label.includes("passend")) return "Passend";
    if (label.includes("voorlopige")) return "Voorlopig";
    return item.matchConfidenceLabel;
  }
  if (item.isBlocked) return "Capaciteit";
  return "Voorlopig";
}

function matchingReasonLabel(item: WorkflowCaseView): string {
  const source = item.matchAdvisoryHint || item.whyInThisStep || item.primaryActionReason || item.nextBestActionLabel;
  return getShortReasonLabel(source, 58);
}

const MATCHING_COLS = "minmax(12rem,2fr) minmax(8rem,1.2fr) minmax(8rem,1fr) minmax(10rem,1.5fr) minmax(9rem,1fr)";

export function MatchingQueuePage({ onCaseClick, onNavigateToCasussen }: MatchingQueuePageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<DecisionUiPhaseId>("matching");
  const [regionFilter, setRegionFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");

  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const workflowCases = useMemo(() => buildWorkflowCases(cases, providers), [cases, providers]);
  const phaseCounts = useMemo(() => countByPhase(workflowCases), [workflowCases]);

  const regionOptions = useMemo(() => {
    const regions = Array.from(new Set(workflowCases.map((item) => item.region).filter(Boolean)));
    regions.sort((a, b) => a.localeCompare(b, "nl"));
    return regions;
  }, [workflowCases]);

  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = workflowCases.filter((item) => phaseOf(item) === phaseFilter);
    if (regionFilter !== "all") list = list.filter((item) => item.region === regionFilter);
    list = list.filter((item) => urgencyMatchesFilter(item, urgencyFilter));
    if (q) {
      list = list.filter((item) => {
        const hay = [item.id, item.title, item.region, item.careType, item.matchConfidenceLabel, item.matchAdvisoryHint, item.whyInThisStep, item.nextBestActionLabel]
          .filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    return sortMatchingCases(list);
  }, [workflowCases, phaseFilter, regionFilter, urgencyFilter, searchQuery]);

  const hasMatchableCases = workflowCases.some((item) => phaseOf(item) === "matching");
  const filtersActive = Boolean(searchQuery.trim()) || regionFilter !== "all" || urgencyFilter !== "all";
  const clearFilters = () => { setSearchQuery(""); setRegionFilter("all"); setUrgencyFilter("all"); };

  const tabs = DECISION_WORKSPACE_FLOW_STEPS.map((step) => ({
    id: step.id,
    label: DECISION_UI_PHASE_LABELS[step.id],
    count: phaseCounts[step.id],
  }));

  return (
    <CareCommandShell
      title="Matching"
      actions={onNavigateToCasussen ? (
        <Button type="button" variant="outline" className="h-9 rounded-[10px] border-border/70 px-4 text-[13px] font-medium" onClick={onNavigateToCasussen}>
          Bekijk aanmeldingen
        </Button>
      ) : undefined}
    >
      <CareMetricStrip>
        <CareMetricCard
          value={phaseCounts.matching}
          label="Klaar voor matching"
          tone="neutral"
          isActive={phaseFilter === "matching"}
          onClick={() => setPhaseFilter("matching")}
        />
        <CareMetricCard
          value={phaseCounts.aanbiederreactie}
          label="Aanbiederreactie"
          tone="warning"
          isActive={phaseFilter === "aanbiederreactie"}
          onClick={() => setPhaseFilter("aanbiederreactie")}
        />
        <CareMetricCard
          value={phaseCounts.plaatsing}
          label="Plaatsing"
          tone="neutral"
          isActive={phaseFilter === "plaatsing"}
          onClick={() => setPhaseFilter("plaatsing")}
        />
      </CareMetricStrip>

      {loading && <LoadingState title="Matching laden…" copy="Aanmeldingen en aanbieders worden gecontroleerd." />}

      {!loading && error && (
        <ErrorState
          title="Matching kon niet worden geladen"
          copy={error}
          action={<Button variant="outline" onClick={() => refetch()}>Opnieuw proberen</Button>}
        />
      )}

      {!loading && !error && (
        <CareWorklist testId="matching-uitvoerlijst">
          <CareWorklistTabs
            tabs={tabs}
            activeId={phaseFilter}
            onChange={(id) => setPhaseFilter(id as DecisionUiPhaseId)}
          />

          <CareWorklistToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Zoek casussen, regio's, aanbieders..."
            filtersActive={filtersActive}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters((v) => !v)}
          />

          <CareWorklistFilterPanel open={showFilters}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
                Regio
                <CareOperationalSelect
                  aria-label="Regio"
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                >
                  <option value="all">Alle regio&apos;s</option>
                  {regionOptions.map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </CareOperationalSelect>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
                Urgentie
                <CareOperationalSelect
                  aria-label="Urgentie"
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value as UrgencyFilter)}
                >
                  {URGENCY_FILTERS.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </CareOperationalSelect>
              </label>
            </div>
          </CareWorklistFilterPanel>

          <div className="overflow-x-auto">
            <CareWorklistColumnHeader
              columns={["Casus", "Regio", "Advies", "Afwegingen", "Actie"]}
              cols={MATCHING_COLS}
              minWidth="820px"
            />
            <CareWorklistBody>
              {filteredCases.length === 0 ? (
                <EmptyState
                  title={hasMatchableCases ? "Geen casussen in deze weergave" : "Geen casussen klaar voor matching"}
                  copy={hasMatchableCases
                    ? "Pas filters aan om de matchende werkvoorraad zichtbaar te maken."
                    : "Er zijn op dit moment geen complete aanmeldingen die naar matching kunnen."}
                  action={onNavigateToCasussen ? (
                    <CareQueueInlineAction type="button" onClick={filtersActive ? clearFilters : onNavigateToCasussen}>
                      {filtersActive ? "Wis filters" : "Bekijk aanmeldingen"}
                    </CareQueueInlineAction>
                  ) : filtersActive ? (
                    <CareQueueInlineAction type="button" onClick={clearFilters}>Wis filters</CareQueueInlineAction>
                  ) : undefined}
                />
              ) : filteredCases.map((item) => {
                const nextActionLabel = matchingRowActionLabel(item);
                const statusLabel = matchingStatusLabel(item);
                const accentTone = item.isBlocked ? "urgent" as const : item.urgency === "critical" ? "warning" as const : "neutral" as const;
                return (
                  <CareWorklistRow
                    key={item.id}
                    cols={MATCHING_COLS}
                    minWidth="820px"
                    accentTone={accentTone}
                    onRowClick={() => onCaseClick(item.id)}
                  >
                    {/* Casus */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium shrink-0",
                          item.isBlocked
                            ? "border-care-urgent-border/60 bg-care-urgent-bg text-care-urgent-text"
                            : "border-border/60 bg-card/55 text-muted-foreground",
                        )}>
                          <span className={cn("size-1.5 rounded-full", item.isBlocked ? "bg-care-urgent-solid" : item.urgency === "critical" ? "bg-care-warning-solid" : "bg-primary")} aria-hidden />
                          {urgencyLabel(item)}
                        </span>
                      </div>
                      <span className="mt-0.5 block truncate font-mono text-[13px] font-medium leading-tight text-foreground">{item.id}</span>
                      {item.title && <span className="block truncate text-[11px] text-muted-foreground/80">{item.title}</span>}
                    </div>

                    {/* Regio */}
                    <div className="min-w-0">
                      {item.region && <div className="truncate text-[12px] font-medium text-foreground">{item.region}</div>}
                      {item.careType && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.careType}</div>}
                    </div>

                    {/* Advies */}
                    <div className="flex items-start">
                      <CareDominantStatus className={cn(item.isBlocked ? "border bg-care-urgent-bg text-care-urgent-text border-care-urgent-border" : undefined)}>
                        {statusLabel}
                      </CareDominantStatus>
                    </div>

                    {/* Afwegingen */}
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground/85">{matchingReasonLabel(item)}</p>
                    </div>

                    {/* Actie */}
                    <CareWorklistRowAction>
                      <button
                        type="button"
                        className={ROW_ACTION_CLASSES.default}
                        onClick={(e) => { e.stopPropagation(); onCaseClick(item.id); }}
                      >
                        {nextActionLabel}
                        <ChevronRight size={12} className="shrink-0 opacity-60" aria-hidden />
                      </button>
                    </CareWorklistRowAction>
                  </CareWorklistRow>
                );
              })}
            </CareWorklistBody>
          </div>

          <CareWorklistPagination count={filteredCases.length} singular="casus" plural="casussen" />
        </CareWorklist>
      )}
    </CareCommandShell>
  );
}
