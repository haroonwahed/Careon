import { useMemo, useState } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases } from "../../lib/workflowUi";
import type { WorkflowCaseView } from "../../lib/workflowUi";
import {
  CareAlertCard,
  CareDominantStatus,
  CareFilterTabButton,
  CareFilterTabGroup,
  CareMetaChip,
  CareOperationalQueueHeader,
  CareOperationalSelect,
  CarePageScaffold,
  CarePrimaryList,
  CareQueueInlineAction,
  CareSearchFiltersBar,
  CareSectionHeader,
  CareWorkListCard,
  CareWorkRow,
  CareWorkspaceSection,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
} from "./CareDesignPrimitives";
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

function matchingPrimaryActionLabel(item: WorkflowCaseView): "Start matching" | "Vraag gegevens op" {
  if (item.isBlocked || item.missingDataItems.length > 0) {
    return "Vraag gegevens op";
  }
  return "Start matching";
}

function matchingRowActionLabel(item: WorkflowCaseView): "Bekijk onderbouwing" | "Vraag gegevens op" {
  if (item.isBlocked || item.missingDataItems.length > 0) {
    return "Vraag gegevens op";
  }
  return "Bekijk onderbouwing";
}

function matchingStatusLabel(item: WorkflowCaseView): string {
  if (item.matchConfidenceLabel) {
    const label = item.matchConfidenceLabel.toLowerCase();
    if (label.includes("afstemming")) {
      return "Afstemming";
    }
    if (label.includes("capaciteit")) {
      return "Capaciteit";
    }
    if (label.includes("onderbouwing")) {
      return "Onderbouwing";
    }
    if (label.includes("sterke aansluiting") || label.includes("passend")) {
      return "Passend";
    }
    if (label.includes("voorlopige")) {
      return "Voorlopig";
    }
    return item.matchConfidenceLabel;
  }
  if (item.isBlocked) {
    return "Capaciteit";
  }
  return "Voorlopig";
}

function matchingReasonLabel(item: WorkflowCaseView): string {
  const source = item.matchAdvisoryHint || item.whyInThisStep || item.primaryActionReason || item.nextBestActionLabel;
  return getShortReasonLabel(source, 58);
}

export function MatchingQueuePage({ onCaseClick, onNavigateToCasussen }: MatchingQueuePageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
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
    return ["all", ...regions];
  }, [workflowCases]);

  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = workflowCases.filter((item) => phaseOf(item) === phaseFilter);

    if (regionFilter !== "all") {
      list = list.filter((item) => item.region === regionFilter);
    }

    list = list.filter((item) => urgencyMatchesFilter(item, urgencyFilter));

    if (q) {
      list = list.filter((item) => {
        const hay = [
          item.id,
          item.title,
          item.region,
          item.careType,
          item.matchConfidenceLabel,
          item.matchAdvisoryHint,
          item.whyInThisStep,
          item.nextBestActionLabel,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return sortMatchingCases(list);
  }, [workflowCases, phaseFilter, regionFilter, urgencyFilter, searchQuery]);

  const topCase = filteredCases[0] ?? null;
  const visibleMatchingCases = workflowCases.filter((item) => phaseOf(item) === "matching");
  const hasMatchableCases = visibleMatchingCases.length > 0;
  const hasVisibleCases = filteredCases.length > 0;
  const filtersActive = Boolean(searchQuery.trim()) || regionFilter !== "all" || urgencyFilter !== "all";

  const clearSidebarFilters = () => {
    setSearchQuery("");
    setRegionFilter("all");
    setUrgencyFilter("all");
  };

  const headerAction = onNavigateToCasussen ? (
    <Button type="button" variant="outline" className="h-10 rounded-xl border-border/70 bg-background/20 px-4 text-[14px] font-medium text-foreground hover:bg-muted/25" onClick={onNavigateToCasussen}>
      Bekijk aanmeldingen
    </Button>
  ) : null;

  const attentionCard =
    phaseFilter === "matching" && topCase ? (
      <CareAlertCard
        density="compact"
        tone={topCase.isBlocked || topCase.urgency === "critical" ? "warning" : "info"}
        icon={<AlertCircle size={18} aria-hidden />}
        metric={filteredCases.length}
        showMetric={false}
        title={`${filteredCases.length} casus${filteredCases.length === 1 ? "" : "sen"} klaar voor matching`}
        description={`${topCase.region} · ${topCase.careType}. ${topCase.matchAdvisoryHint ?? "Vergelijk aanbieders, onderbouw afwegingen en stuur een passende aanvraag door."}`}
        primaryAction={(
          <PrimaryActionButton
            type="button"
            className="h-10 rounded-full px-5 text-[13px] font-semibold"
            onClick={() => onCaseClick(topCase.id)}
          >
            {matchingPrimaryActionLabel(topCase)}
            <ArrowRight size={16} aria-hidden className="ml-2" />
          </PrimaryActionButton>
        )}
      />
    ) : undefined;

  return (
    <CarePageScaffold
      archetype="queue"
      className="pb-4"
      title="Matching"
      subtitle="Vergelijk aanbieders, onderbouw keuzes en stuur passende aanvragen door."
      titleClassName="text-[32px] sm:text-[36px] lg:text-[38px]"
      actions={headerAction}
      workflow={(
        <CareFilterTabGroup aria-label="Workflow fases" className="overflow-x-auto">
          {DECISION_WORKSPACE_FLOW_STEPS.map((step) => (
            <CareFilterTabButton
              key={step.id}
              selected={phaseFilter === step.id}
              accentSelected
              onClick={() => setPhaseFilter(step.id)}
            >
              {DECISION_UI_PHASE_LABELS[step.id]} ({phaseCounts[step.id]})
            </CareFilterTabButton>
          ))}
        </CareFilterTabGroup>
      )}
      dominantAction={attentionCard}
    >
      {loading && <LoadingState title="Matching laden…" copy="Aanmeldingen en aanbieders worden gecontroleerd." />}
      {!loading && error && (
        <ErrorState
          title="Matching kon niet worden geladen"
          copy={error}
          action={<Button variant="outline" onClick={() => refetch()}>Opnieuw proberen</Button>}
        />
      )}

      {!loading && !error && (
        <CareWorkspaceSection
          testId="matching-uitvoerlijst"
          aria-labelledby="matching-werkvoorraad-heading"
          bodyBleedX
          header={(
            <CareSectionHeader
              className="lg:flex-col lg:items-stretch"
              title={<span id="matching-werkvoorraad-heading">Werkvoorraad</span>}
              meta={(
                <CareSearchFiltersBar
                  variant="workspace"
                  className="px-0"
                  searchValue={searchQuery}
                  onSearchChange={setSearchQuery}
                  searchPlaceholder="Zoek casussen, regio's, aanbieders..."
                  showSecondaryFilters={showSecondaryFilters}
                  onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
                  secondaryFiltersLabel="Filters"
                  secondaryFilters={(
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] leading-snug text-muted-foreground">
                          Verfijn op regio en urgentie zonder de werkvoorraad te verstoren.
                        </p>
                        <CareQueueInlineAction type="button" onClick={clearSidebarFilters}>
                          Wissen
                        </CareQueueInlineAction>
                      </div>
                      <div className="grid items-end gap-2 md:grid-cols-2">
                        <label className="flex min-w-0 flex-col gap-1">
                          <span className="text-[11px] font-medium text-muted-foreground">Regio</span>
                          <CareOperationalSelect
                            aria-label="Regio"
                            value={regionFilter}
                            onChange={(event) => setRegionFilter(event.target.value)}
                            className="h-10 border-border bg-card text-foreground hover:bg-muted/35 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            <option value="all">Alle regio's</option>
                            {regionOptions
                              .filter((region) => region !== "all")
                              .map((region) => (
                                <option key={region} value={region}>
                                  {region}
                                </option>
                              ))}
                          </CareOperationalSelect>
                        </label>
                        <label className="flex min-w-0 flex-col gap-1">
                          <span className="text-[11px] font-medium text-muted-foreground">Urgentie</span>
                          <CareOperationalSelect
                            aria-label="Urgentie"
                            value={urgencyFilter}
                            onChange={(event) => setUrgencyFilter(event.target.value as UrgencyFilter)}
                            className="h-10 border-border bg-card text-foreground hover:bg-muted/35 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            {URGENCY_FILTERS.map((item) => (
                              <option key={item.key} value={item.key}>
                                {item.label}
                              </option>
                            ))}
                          </CareOperationalSelect>
                        </label>
                      </div>
                    </div>
                  )}
                />
              )}
            />
          )}
        >
          <CareWorkListCard
            header={
              <CareOperationalQueueHeader
                labels={["Urgentie", "Casus", "Regio", "Advies", "Afwegingen", "Volgende actie"]}
              />
            }
          >
            {!hasVisibleCases ? (
              <div className="p-4 md:p-5">
                <EmptyState
                  title={hasMatchableCases ? "Geen casussen in deze weergave" : "Geen casussen klaar voor matching"}
                  copy={
                    hasMatchableCases
                      ? "Pas filters aan om de matchende werkvoorraad zichtbaar te maken."
                      : "Er zijn op dit moment geen complete aanmeldingen die naar matching kunnen."
                  }
                  action={
                    onNavigateToCasussen ? (
                      <CareQueueInlineAction type="button" onClick={filtersActive ? clearSidebarFilters : onNavigateToCasussen}>
                        {filtersActive ? "Wis filters" : "Bekijk aanmeldingen"}
                      </CareQueueInlineAction>
                    ) : filtersActive ? (
                      <CareQueueInlineAction type="button" onClick={clearSidebarFilters}>
                        Wis filters
                      </CareQueueInlineAction>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <CarePrimaryList>
                {filteredCases.map((item) => {
                  const nextActionLabel = matchingRowActionLabel(item);
                  const statusLabel = matchingStatusLabel(item);
                  const accentTone = item.isBlocked ? "critical" : item.urgency === "critical" ? "warning" : "neutral";
                  return (
                    <CareWorkRow
                      key={item.id}
                      titleAriaLabel={item.id}
                      leading={(
                        <CareMetaChip className={cn(
                          "inline-flex h-7 items-center gap-1.5 px-2.5 text-[11px] font-semibold",
                          item.isBlocked ? "border-red-500/45 bg-red-500/10 text-foreground" : "border-border/60 bg-card/55 text-muted-foreground",
                        )}>
                          <span className={cn("size-2 rounded-full", item.isBlocked ? "bg-red-500" : item.urgency === "critical" ? "bg-amber-400" : "bg-primary")} aria-hidden />
                          {urgencyLabel(item)}
                        </CareMetaChip>
                      )}
                      title={<span className="block truncate text-[18px] font-semibold tracking-tight text-foreground">{item.id}</span>}
                      context={(
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <CareMetaChip>{item.region}</CareMetaChip>
                          <span className="min-w-0 truncate text-[11px] text-muted-foreground">{item.careType}</span>
                        </div>
                      )}
                      status={(
                        <span title={item.matchConfidenceLabel ?? statusLabel}>
                          <CareDominantStatus className={cn(item.isBlocked ? "border bg-care-urgent-bg text-care-urgent-text border-care-urgent-border" : undefined)}>
                            {statusLabel}
                          </CareDominantStatus>
                        </span>
                      )}
                      owner={<span className="truncate">Rol: {item.responsibleParty}</span>}
                      nextAction={<span className="truncate">Volgende actie: {nextActionLabel}</span>}
                      time={<span className="truncate">Laatste activiteit: {item.lastUpdatedLabel}</span>}
                      contextInfo={<span className="truncate text-muted-foreground/80">Reden: {matchingReasonLabel(item)}</span>}
                      actionLabel={nextActionLabel}
                      actionVariant="ghost"
                      onOpen={() => onCaseClick(item.id)}
                      onAction={(event) => {
                        event.stopPropagation();
                        onCaseClick(item.id);
                      }}
                      accentTone={accentTone}
                    />
                  );
                })}
              </CarePrimaryList>
            )}
          </CareWorkListCard>
        </CareWorkspaceSection>
      )}
    </CarePageScaffold>
  );
}
