import { useMemo, useState } from "react";
import { ArrowRight, Clock3, SlidersHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases, effectivePlacementCanonicalState, type WorkflowCaseView } from "../../lib/workflowUi";
import {
  CareAlertCard,
  CareDominantStatus,
  CareFilterTabButton,
  CareFilterTabGroup,
  CareOperationalQueueHeader,
  CarePageScaffold,
  CarePrimaryList,
  CareQueueInlineAction,
  CareSearchFiltersBar,
  CareSectionHeader,
  CareWorkRow,
  CareWorkspaceSection,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
} from "./CareDesignPrimitives";

interface PlacementTrackingPageProps {
  onCaseClick: (caseId: string) => void;
  onNavigateToMatching?: () => void;
  onNavigateToAanbiederreacties?: () => void;
}

type PlacementFilterKey =
  | "all"
  | "prepare"
  | "confirmed"
  | "startdate"
  | "startdetails"
  | "planintake"
  | "planned"
  | "archive";

type PlacementStatusTone = "critical" | "warning" | "info" | "good" | "neutral";

interface PlacementRowView {
  item: WorkflowCaseView;
  filterKey: PlacementFilterKey;
  statusLabel: string;
  statusTone: PlacementStatusTone;
  nextActionLabel: string;
  nextActionVariant: "primary" | "ghost";
  attentionReason: string;
  startDateLabel: string;
  lastActivityLabel: string;
  providerLabel: string;
  regionLabel: string;
  isArchive: boolean;
  accentTone: "critical" | "warning" | "neutral";
  sortRank: number;
}

const FILTERS: Array<{ key: PlacementFilterKey; label: string }> = [
  { key: "all", label: "Alle plaatsingen" },
  { key: "prepare", label: "Plaatsing voorbereid" },
  { key: "confirmed", label: "Plaatsing bevestigd" },
  { key: "startdate", label: "Startdatum gepland" },
  { key: "startdetails", label: "Wacht op startdetails" },
  { key: "planintake", label: "Intake plannen" },
  { key: "planned", label: "Intake gepland" },
  { key: "archive", label: "Archief" },
];

const NEXT_ACTION_PRIORITY: Record<string, number> = {
  "Bevestig plaatsing": 0,
  "Vraag startdetails op": 1,
  "Plan intake": 2,
  "Werk plaatsing bij": 3,
  "Bekijk plaatsingsdetails": 4,
};

function formatCaseReference(caseId: string): string {
  return caseId || "—";
}

function formatDateLabel(raw: string | null | undefined): string {
  if (!raw) {
    return "Nog niet gepland";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function getStatusClass(statusTone: PlacementStatusTone): string {
  switch (statusTone) {
    case "critical":
      return "border-red-500/25 bg-red-500/10 text-red-100";
    case "warning":
      return "border-amber-500/25 bg-amber-500/10 text-amber-100";
    case "info":
      return "border-sky-500/20 bg-sky-500/10 text-sky-100";
    case "good":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
    case "neutral":
      return "border-border/60 bg-card/35 text-muted-foreground";
  }
}

function getUrgencyClass(item: WorkflowCaseView): string {
  if (item.urgency === "critical") {
    return "border-red-500/35 bg-red-500/10 text-red-200";
  }
  if (item.urgency === "warning") {
    return "border-amber-500/35 bg-amber-500/10 text-amber-100";
  }
  return "border-border/60 bg-card/40 text-foreground";
}

function getPlacementSortRank(nextActionLabel: string): number {
  return NEXT_ACTION_PRIORITY[nextActionLabel] ?? 99;
}

function derivePlacementRow(item: WorkflowCaseView): PlacementRowView {
  const canonical = effectivePlacementCanonicalState(item);
  const isArchive = item.phase === "afgerond" || canonical === "ARCHIVED";
  const hasStartDate = Boolean(item.intakeStartDate?.trim());
  const providerName = item.arrangementProvider?.trim() || item.recommendedProviderName?.trim() || "Nog niet gekozen";
  const regionLabel = item.region || "Onbekende regio";
  const lastActivityLabel = item.lastUpdatedLabel ? `Laatste activiteit: ${item.lastUpdatedLabel}` : "Laatste activiteit: Onbekend";
  const startDateLabel = hasStartDate
    ? `Startdatum: ${formatDateLabel(item.intakeStartDate)}`
    : "Startdatum: Nog niet gepland";

  if (isArchive) {
    return {
      item,
      filterKey: "archive",
      statusLabel: "Archief",
      statusTone: "neutral",
      nextActionLabel: "Bekijk plaatsingsdetails",
      nextActionVariant: "ghost",
      attentionReason: "Afgeronde plaatsing blijft terugvindbaar voor audit en nazorg.",
      startDateLabel,
      lastActivityLabel,
      providerLabel: providerName,
      regionLabel,
      isArchive: true,
      accentTone: "neutral",
      sortRank: 99,
    };
  }

  if (canonical === "PROVIDER_ACCEPTED") {
    return {
      item,
      filterKey: "prepare",
      statusLabel: "Plaatsing voorbereid",
      statusTone: "warning",
      nextActionLabel: "Bevestig plaatsing",
      nextActionVariant: "primary",
      attentionReason: "Aanbieder heeft bevestigd; de plaatsing moet nog definitief worden vastgelegd.",
      startDateLabel,
      lastActivityLabel,
      providerLabel: providerName,
      regionLabel,
      isArchive: false,
      accentTone: "warning",
      sortRank: getPlacementSortRank("Bevestig plaatsing"),
    };
  }

  if (canonical === "PLACEMENT_CONFIRMED") {
    if (hasStartDate) {
      return {
        item,
        filterKey: "startdate",
        statusLabel: "Startdatum gepland",
        statusTone: "good",
        nextActionLabel: "Plan intake",
        nextActionVariant: "primary",
        attentionReason: "De startdatum staat vast; de intake kan nu worden gepland.",
        startDateLabel,
        lastActivityLabel,
        providerLabel: providerName,
        regionLabel,
        isArchive: false,
        accentTone: "warning",
        sortRank: getPlacementSortRank("Plan intake"),
      };
    }

    return {
      item,
      filterKey: "startdetails",
      statusLabel: "Wacht op startdetails",
      statusTone: "warning",
      nextActionLabel: "Vraag startdetails op",
      nextActionVariant: "primary",
      attentionReason: "Plaatsing is bevestigd, maar de startdetails ontbreken nog.",
      startDateLabel,
      lastActivityLabel,
      providerLabel: providerName,
      regionLabel,
      isArchive: false,
      accentTone: "warning",
      sortRank: getPlacementSortRank("Vraag startdetails op"),
    };
  }

  if (canonical === "INTAKE_STARTED" || canonical === "ACTIVE_PLACEMENT") {
    return {
      item,
      filterKey: "planned",
      statusLabel: "Intake gepland",
      statusTone: "good",
      nextActionLabel: "Bekijk plaatsingsdetails",
      nextActionVariant: "ghost",
      attentionReason: "De intake loopt of is afgerond; controleer de plaatsingsdetails.",
      startDateLabel,
      lastActivityLabel,
      providerLabel: providerName,
      regionLabel,
      isArchive: false,
      accentTone: "neutral",
      sortRank: getPlacementSortRank("Bekijk plaatsingsdetails"),
    };
  }

  if (item.placementRequestStatus?.trim() === "APPROVED") {
    return {
      item,
      filterKey: "confirmed",
      statusLabel: "Plaatsing bevestigd",
      statusTone: "info",
      nextActionLabel: hasStartDate ? "Plan intake" : "Vraag startdetails op",
      nextActionVariant: "primary",
      attentionReason: hasStartDate
        ? "Plaatsing is bevestigd; plan de intake."
        : "Plaatsing is bevestigd, maar de startdetails moeten nog worden opgehaald.",
      startDateLabel,
      lastActivityLabel,
      providerLabel: providerName,
      regionLabel,
      isArchive: false,
      accentTone: "warning",
      sortRank: getPlacementSortRank(hasStartDate ? "Plan intake" : "Vraag startdetails op"),
    };
  }

  return {
    item,
    filterKey: "prepare",
    statusLabel: "Plaatsing voorbereid",
    statusTone: "warning",
    nextActionLabel: "Bevestig plaatsing",
    nextActionVariant: "primary",
    attentionReason: "Aanbiederreactie is binnen; de plaatsing moet nog worden bevestigd.",
    startDateLabel,
    lastActivityLabel,
    providerLabel: providerName,
    regionLabel,
    isArchive: false,
    accentTone: "warning",
    sortRank: getPlacementSortRank("Bevestig plaatsing"),
  };
}

function sortPlacementRows(rows: PlacementRowView[]): PlacementRowView[] {
  const urgencyRank: Record<WorkflowCaseView["urgency"], number> = {
    critical: 0,
    warning: 1,
    normal: 2,
    stable: 3,
  };

  return [...rows].sort((left, right) => {
    return (
      left.sortRank - right.sortRank ||
      urgencyRank[left.item.urgency] - urgencyRank[right.item.urgency] ||
      right.item.daysInCurrentPhase - left.item.daysInCurrentPhase ||
      left.item.id.localeCompare(right.item.id, "nl")
    );
  });
}

function filterPlacementRows(rows: PlacementRowView[], activeFilter: PlacementFilterKey): PlacementRowView[] {
  if (activeFilter === "all") {
    return rows.filter((row) => !row.isArchive);
  }
  if (activeFilter === "archive") {
    return rows.filter((row) => row.isArchive);
  }
  return rows.filter((row) => row.filterKey === activeFilter);
}

function countByFilter(rows: PlacementRowView[]): Record<PlacementFilterKey, number> {
  const base: Record<PlacementFilterKey, number> = {
    all: 0,
    prepare: 0,
    confirmed: 0,
    startdate: 0,
    startdetails: 0,
    planintake: 0,
    planned: 0,
    archive: 0,
  };

  for (const row of rows) {
    if (row.isArchive) {
      base.archive += 1;
      continue;
    }
    base.all += 1;
    base[row.filterKey] += 1;
  }

  return base;
}

function buildEmptyDescription(activeFilter: PlacementFilterKey): string {
  if (activeFilter === "archive") {
    return "Er zijn op dit moment geen gearchiveerde plaatsingen zichtbaar.";
  }
  return "Er zijn geen goedgekeurde aanvragen die nu plaatsingscoördinatie vragen.";
}

function buildEmptyTitle(activeFilter: PlacementFilterKey): string {
  return activeFilter === "archive" ? "Geen gearchiveerde plaatsingen" : "Geen openstaande plaatsingen";
}

function compactStatusLabel(label: string): string {
  switch (label) {
    case "Plaatsing voorbereid":
      return "Voorbereid";
    case "Plaatsing bevestigd":
      return "Bevestigd";
    case "Startdatum gepland":
      return "Startdatum";
    case "Wacht op startdetails":
      return "Startdetails";
    case "Intake gepland":
      return "Intake";
    default:
      return label;
  }
}

export function PlacementTrackingPage({
  onCaseClick,
  onNavigateToMatching,
  onNavigateToAanbiederreacties,
}: PlacementTrackingPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<PlacementFilterKey>("all");
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const [regionFilter, setRegionFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const placementRows = useMemo(() => {
    return buildWorkflowCases(cases, providers)
      .filter((item) => item.phase === "plaatsing" || item.phase === "afgerond")
      .map(derivePlacementRow);
  }, [cases, providers]);

  const regionOptions = useMemo(() => {
    return Array.from(
      new Set(placementRows.map((row) => row.regionLabel).filter((value) => value && value !== "Onbekende regio")),
    ).sort((left, right) => left.localeCompare(right, "nl"));
  }, [placementRows]);

  const providerOptions = useMemo(() => {
    return Array.from(
      new Set(placementRows.map((row) => row.providerLabel).filter((value) => value && value !== "Nog niet gekozen")),
    ).sort((left, right) => left.localeCompare(right, "nl"));
  }, [placementRows]);

  const scopedRows = useMemo(() => {
    let rows = placementRows;
    if (regionFilter !== "all") {
      rows = rows.filter((row) => row.regionLabel === regionFilter);
    }
    if (providerFilter !== "all") {
      rows = rows.filter((row) => row.providerLabel === providerFilter);
    }
    return sortPlacementRows(rows);
  }, [placementRows, regionFilter, providerFilter]);

  const counts = useMemo(() => countByFilter(scopedRows), [scopedRows]);
  const visibleRows = useMemo(
    () => filterPlacementRows(scopedRows, activeFilter),
    [scopedRows, activeFilter],
  );

  const topRow = visibleRows[0] ?? null;
  const hasVisibleRows = visibleRows.length > 0;

  const attentionCard =
    hasVisibleRows && activeFilter !== "archive" && topRow ? (
      <CareAlertCard
        density="compact"
        tone="warning"
        icon={<Clock3 size={18} aria-hidden />}
        metric={visibleRows.length}
        showMetric={false}
        title={visibleRows.length === 1 ? "1 casus heeft jouw aandacht nodig" : `${visibleRows.length} casussen hebben jouw aandacht nodig`}
        description={topRow.attentionReason}
        primaryAction={(
          <PrimaryActionButton type="button" onClick={() => onCaseClick(topRow.item.id)}>
            {topRow.nextActionLabel}
            <ArrowRight size={16} aria-hidden className="ml-2" />
          </PrimaryActionButton>
        )}
        secondaryAction={
          onNavigateToAanbiederreacties ? (
            <CareQueueInlineAction onClick={onNavigateToAanbiederreacties}>Bekijk aanbiederreacties</CareQueueInlineAction>
          ) : onNavigateToMatching ? (
            <CareQueueInlineAction onClick={onNavigateToMatching}>Bekijk matching</CareQueueInlineAction>
          ) : undefined
        }
      />
    ) : undefined;

  const filterTabs = (
    <CareFilterTabGroup aria-label="Plaatsingsstatus filters" className="overflow-x-auto">
      {FILTERS.map((filter) => (
        <CareFilterTabButton
          key={filter.key}
          selected={activeFilter === filter.key}
          accentSelected
          onClick={() => setActiveFilter(filter.key)}
        >
          {filter.label} ({counts[filter.key]})
        </CareFilterTabButton>
      ))}
    </CareFilterTabGroup>
  );

  const workSurface = (
    <CareWorkspaceSection
      testId="plaatsingen-werkvoorraad"
      aria-labelledby="plaatsingen-werkvoorraad-heading"
      bodyBleedX
      header={(
        <CareSectionHeader
          className="lg:items-center"
          title={(
            <div id="plaatsingen-werkvoorraad-heading" className="inline-flex items-center gap-2">
              <span>Werkvoorraad</span>
              <span className="inline-flex items-center rounded-full border border-border/60 bg-card/55 px-2.5 py-0.5 text-[12px] font-semibold text-muted-foreground">
                {visibleRows.length}
              </span>
            </div>
          )}
          meta={(
            <CareSearchFiltersBar
              variant="workspace"
              className="px-0"
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Zoek casus, aanbieder of regio..."
              showSecondaryFilters={showSecondaryFilters}
              onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
              secondaryFiltersLabel="Filters"
              secondaryFilters={(
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Regio</span>
                    <select
                      className="h-10 min-w-[14rem] rounded-xl border border-border/60 bg-card/35 px-3 text-[13px] text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
                      value={regionFilter}
                      onChange={(event) => setRegionFilter(event.target.value)}
                    >
                      <option value="all">Alle regio&apos;s</option>
                      {regionOptions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Aanbieder</span>
                    <select
                      className="h-10 min-w-[14rem] rounded-xl border border-border/60 bg-card/35 px-3 text-[13px] text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
                      value={providerFilter}
                      onChange={(event) => setProviderFilter(event.target.value)}
                    >
                      <option value="all">Alle aanbieders</option>
                      {providerOptions.map((provider) => (
                        <option key={provider} value={provider}>
                          {provider}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              rightAction={(
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-9 rounded-xl border-border/45 bg-card/20 p-0 text-primary hover:bg-muted/18 hover:text-foreground"
                    onClick={() => {
                      setShowSecondaryFilters((current) => !current);
                    }}
                    aria-label="Meer filters"
                  >
                    <SlidersHorizontal size={14} aria-hidden />
                  </Button>
                </div>
              )}
            />
          )}
        />
      )}
    >
      <CarePrimaryList
        header={(
          <CareOperationalQueueHeader
            labels={["Urgentie", "Casus", "Regio", "Status", "Details", "Volgende actie"]}
          />
        )}
      >
        {hasVisibleRows ? (
          visibleRows.map((row) => (
            <CareWorkRow
              key={row.item.id}
              density="operational"
              accentTone={row.accentTone}
              leading={(
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", getUrgencyClass(row.item))}>
                  {row.item.urgency === "critical" ? "Spoed" : row.item.urgency === "warning" ? "Hoog" : "Normaal"}
                </span>
              )}
              title={formatCaseReference(row.item.id)}
              context={row.regionLabel}
              status={(
                <span title={row.statusLabel}>
                  <CareDominantStatus className={cn("text-[12px] font-medium", getStatusClass(row.statusTone))}>
                    {compactStatusLabel(row.statusLabel)}
                  </CareDominantStatus>
                </span>
              )}
              owner={<span className="min-w-0 truncate text-foreground">{row.providerLabel}</span>}
              nextAction={<span className="min-w-0 truncate text-muted-foreground">{row.attentionReason}</span>}
              time={<span className="min-w-0 truncate text-muted-foreground">{row.lastActivityLabel}</span>}
              contextInfo={<span className="min-w-0 truncate text-muted-foreground">{row.startDateLabel}</span>}
              actionLabel={row.nextActionLabel}
              actionVariant={row.nextActionVariant}
              onOpen={() => onCaseClick(row.item.id)}
              onAction={(event) => {
                event.stopPropagation();
                onCaseClick(row.item.id);
              }}
              titleAriaLabel={`Open casus ${row.item.id}`}
            />
          ))
        ) : (
          <EmptyState
            title={buildEmptyTitle(activeFilter)}
            copy={buildEmptyDescription(activeFilter)}
            action={
              onNavigateToAanbiederreacties ? (
                <CareQueueInlineAction onClick={onNavigateToAanbiederreacties}>Bekijk aanbiederreacties</CareQueueInlineAction>
              ) : onNavigateToMatching ? (
                <CareQueueInlineAction onClick={onNavigateToMatching}>Bekijk matching</CareQueueInlineAction>
              ) : null
            }
          />
        )}
      </CarePrimaryList>
    </CareWorkspaceSection>
  );

  return (
    <CarePageScaffold
      archetype="queue"
      className="pb-8"
      titleClassName="text-[32px] sm:text-[36px] lg:text-[38px]"
      title="Plaatsingen"
      subtitle="Bevestig plaatsingen, coördineer startdetails en bereid intake voor."
      actions={(
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-border/70 bg-background/20 px-4 text-[14px] font-medium text-foreground hover:bg-muted/25"
            onClick={() => void refetch()}
          >
            Ververs
          </Button>
        </div>
      )}
      workflow={filterTabs}
      dominantAction={attentionCard}
    >
      {loading && <LoadingState title="Plaatsingen laden…" copy="De lijst wordt opgebouwd." />}
      {!loading && error && (
        <ErrorState
          title="Plaatsingsgegevens niet beschikbaar"
          copy={error}
          action={<Button variant="outline" onClick={() => refetch()}>Opnieuw</Button>}
        />
      )}

      {!loading && !error && workSurface}
    </CarePageScaffold>
  );
}
