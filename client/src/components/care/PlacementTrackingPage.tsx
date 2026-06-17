import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases, effectivePlacementCanonicalState, type WorkflowCaseView } from "../../lib/workflowUi";
import {
  CareDominantStatus,
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
import { CareSlaCountdown } from "./CareSlaCountdown";
import { slaCountdownFromHours, SLA_TARGET_HOURS } from "../../lib/careSla";

const INTAKE_SLA_FILTER_KEYS = new Set(["startdate", "startdetails", "confirmed"]);

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
  accentTone: "urgent" | "warning" | "neutral";
  sortRank: number;
}

const FILTERS: Array<{ key: PlacementFilterKey; label: string }> = [
  { key: "all", label: "Alle plaatsingen" },
  { key: "prepare", label: "Voorbereid" },
  { key: "confirmed", label: "Bevestigd" },
  { key: "startdate", label: "Startdatum" },
  { key: "startdetails", label: "Startdetails" },
  { key: "planintake", label: "Intake plannen" },
  { key: "planned", label: "Gepland" },
  { key: "archive", label: "Archief" },
];

const NEXT_ACTION_PRIORITY: Record<string, number> = {
  "Bevestig plaatsing": 0,
  "Vraag startdetails op": 1,
  "Plan intake": 2,
  "Werk plaatsing bij": 3,
  "Bekijk plaatsingsdetails": 4,
};

function formatDateLabel(raw: string | null | undefined): string {
  if (!raw) return "Nog niet gepland";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function getStatusClass(statusTone: PlacementStatusTone): string {
  switch (statusTone) {
    case "critical": return "border bg-care-urgent-bg text-care-urgent-text border-care-urgent-border";
    case "warning": return "border bg-care-warning-bg text-care-warning-text border-care-warning-border";
    case "info": return "border bg-care-info-bg text-care-info-text border-care-info-border";
    case "good": return "border bg-care-success-bg text-care-success-text border-care-success-border";
    case "neutral": return "border-border/60 bg-card/35 text-muted-foreground";
  }
}

function getUrgencyClass(item: WorkflowCaseView): string {
  if (item.urgency === "critical") return "border bg-care-urgent-bg text-care-urgent-text border-care-urgent-border";
  if (item.urgency === "warning") return "border bg-care-warning-bg text-care-warning-text border-care-warning-border";
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
  const lastActivityLabel = item.lastUpdatedLabel ? `Laatste activiteit: ${item.lastUpdatedLabel}` : "Onbekend";
  const startDateLabel = hasStartDate
    ? `Startdatum: ${formatDateLabel(item.intakeStartDate)}`
    : "Startdatum: Nog niet gepland";

  if (isArchive) {
    return { item, filterKey: "archive", statusLabel: "Archief", statusTone: "neutral", nextActionLabel: "Bekijk plaatsingsdetails", nextActionVariant: "ghost", attentionReason: "Afgeronde plaatsing blijft terugvindbaar voor audit en nazorg.", startDateLabel, lastActivityLabel, providerLabel: providerName, regionLabel, isArchive: true, accentTone: "neutral", sortRank: 99 };
  }
  if (canonical === "PROVIDER_ACCEPTED") {
    return { item, filterKey: "prepare", statusLabel: "Plaatsing voorbereid", statusTone: "warning", nextActionLabel: "Bevestig plaatsing", nextActionVariant: "primary", attentionReason: "Aanbieder heeft bevestigd; de plaatsing moet nog definitief worden vastgelegd.", startDateLabel, lastActivityLabel, providerLabel: providerName, regionLabel, isArchive: false, accentTone: "warning", sortRank: getPlacementSortRank("Bevestig plaatsing") };
  }
  if (canonical === "PLACEMENT_CONFIRMED") {
    if (hasStartDate) {
      return { item, filterKey: "startdate", statusLabel: "Startdatum gepland", statusTone: "good", nextActionLabel: "Plan intake", nextActionVariant: "primary", attentionReason: "De startdatum staat vast; de intake kan nu worden gepland.", startDateLabel, lastActivityLabel, providerLabel: providerName, regionLabel, isArchive: false, accentTone: "warning", sortRank: getPlacementSortRank("Plan intake") };
    }
    return { item, filterKey: "startdetails", statusLabel: "Wacht op startdetails", statusTone: "warning", nextActionLabel: "Vraag startdetails op", nextActionVariant: "primary", attentionReason: "Plaatsing is bevestigd, maar de startdetails ontbreken nog.", startDateLabel, lastActivityLabel, providerLabel: providerName, regionLabel, isArchive: false, accentTone: "warning", sortRank: getPlacementSortRank("Vraag startdetails op") };
  }
  if (canonical === "INTAKE_STARTED" || canonical === "ACTIVE_PLACEMENT") {
    return { item, filterKey: "planned", statusLabel: "Intake gepland", statusTone: "good", nextActionLabel: "Bekijk plaatsingsdetails", nextActionVariant: "ghost", attentionReason: "De intake loopt of is afgerond; controleer de plaatsingsdetails.", startDateLabel, lastActivityLabel, providerLabel: providerName, regionLabel, isArchive: false, accentTone: "neutral", sortRank: getPlacementSortRank("Bekijk plaatsingsdetails") };
  }
  if (item.placementRequestStatus?.trim() === "APPROVED") {
    const nextLabel = hasStartDate ? "Plan intake" : "Vraag startdetails op";
    return { item, filterKey: "confirmed", statusLabel: "Plaatsing bevestigd", statusTone: "info", nextActionLabel: nextLabel, nextActionVariant: "primary", attentionReason: hasStartDate ? "Plaatsing is bevestigd; plan de intake." : "Plaatsing is bevestigd, maar de startdetails moeten nog worden opgehaald.", startDateLabel, lastActivityLabel, providerLabel: providerName, regionLabel, isArchive: false, accentTone: "warning", sortRank: getPlacementSortRank(nextLabel) };
  }
  return { item, filterKey: "prepare", statusLabel: "Plaatsing voorbereid", statusTone: "warning", nextActionLabel: "Bevestig plaatsing", nextActionVariant: "primary", attentionReason: "Aanbiederreactie is binnen; de plaatsing moet nog worden bevestigd.", startDateLabel, lastActivityLabel, providerLabel: providerName, regionLabel, isArchive: false, accentTone: "warning", sortRank: getPlacementSortRank("Bevestig plaatsing") };
}

function sortPlacementRows(rows: PlacementRowView[]): PlacementRowView[] {
  const urgencyRank: Record<WorkflowCaseView["urgency"], number> = { critical: 0, warning: 1, normal: 2, stable: 3 };
  return [...rows].sort((l, r) =>
    l.sortRank - r.sortRank ||
    urgencyRank[l.item.urgency] - urgencyRank[r.item.urgency] ||
    r.item.daysInCurrentPhase - l.item.daysInCurrentPhase ||
    l.item.id.localeCompare(r.item.id, "nl"),
  );
}

function filterPlacementRows(rows: PlacementRowView[], active: PlacementFilterKey): PlacementRowView[] {
  if (active === "all") return rows.filter((r) => !r.isArchive);
  if (active === "archive") return rows.filter((r) => r.isArchive);
  return rows.filter((r) => r.filterKey === active);
}

function countByFilter(rows: PlacementRowView[]): Record<PlacementFilterKey, number> {
  const base: Record<PlacementFilterKey, number> = { all: 0, prepare: 0, confirmed: 0, startdate: 0, startdetails: 0, planintake: 0, planned: 0, archive: 0 };
  for (const row of rows) {
    if (row.isArchive) { base.archive += 1; continue; }
    base.all += 1;
    base[row.filterKey] += 1;
  }
  return base;
}

const PLACEMENT_COLS = "minmax(12rem,2fr) minmax(9rem,1.2fr) minmax(8rem,1fr) minmax(9rem,1.1fr) minmax(9rem,1fr)";

export function PlacementTrackingPage({
  onCaseClick,
  onNavigateToMatching,
  onNavigateToAanbiederreacties: _onNavigateToAanbiederreacties,
}: PlacementTrackingPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<PlacementFilterKey>("all");
  const [breachOnly, setBreachOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [regionFilter, setRegionFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");

  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const placementRows = useMemo(() => {
    return buildWorkflowCases(cases, providers)
      .filter((item) => item.phase === "plaatsing" || item.phase === "afgerond")
      .map(derivePlacementRow);
  }, [cases, providers]);

  const regionOptions = useMemo(() =>
    Array.from(new Set(placementRows.map((r) => r.regionLabel).filter((v) => v && v !== "Onbekende regio")))
      .sort((a, b) => a.localeCompare(b, "nl")), [placementRows]);

  const providerOptions = useMemo(() =>
    Array.from(new Set(placementRows.map((r) => r.providerLabel).filter((v) => v && v !== "Nog niet gekozen")))
      .sort((a, b) => a.localeCompare(b, "nl")), [placementRows]);

  const scopedRows = useMemo(() => {
    let rows = placementRows;
    if (regionFilter !== "all") rows = rows.filter((r) => r.regionLabel === regionFilter);
    if (providerFilter !== "all") rows = rows.filter((r) => r.providerLabel === providerFilter);
    return sortPlacementRows(rows);
  }, [placementRows, regionFilter, providerFilter]);

  const counts = useMemo(() => countByFilter(scopedRows), [scopedRows]);
  const allVisibleRows = useMemo(() => filterPlacementRows(scopedRows, activeFilter), [scopedRows, activeFilter]);
  const breachedRows = useMemo(() =>
    allVisibleRows.filter((row) =>
      INTAKE_SLA_FILTER_KEYS.has(row.filterKey) &&
      slaCountdownFromHours(row.item.daysInCurrentPhase * 24, SLA_TARGET_HOURS.intakeStart).status === "breached",
    ), [allVisibleRows]);

  const visibleRows = breachOnly ? breachedRows : allVisibleRows;
  const filtersActive = regionFilter !== "all" || providerFilter !== "all";

  const tabs = FILTERS.map((f) => ({ id: f.key, label: f.label, count: counts[f.key] }));

  return (
    <CareCommandShell
      title="Plaatsingen"
      onRefresh={() => void refetch()}
    >
      <CareMetricStrip>
        <CareMetricCard
          value={counts.prepare}
          label="Bevestiging nodig"
          tone="warning"
          isActive={activeFilter === "prepare"}
          onClick={() => setActiveFilter(activeFilter === "prepare" ? "all" : "prepare")}
        />
        <CareMetricCard
          value={counts.startdetails}
          label="Startdetails nodig"
          tone="warning"
          isActive={activeFilter === "startdetails"}
          onClick={() => setActiveFilter(activeFilter === "startdetails" ? "all" : "startdetails")}
        />
        <CareMetricCard
          value={breachedRows.length}
          label="Verlopen SLA"
          tone="urgent"
          isActive={breachOnly}
          onClick={() => setBreachOnly((v) => !v)}
        />
      </CareMetricStrip>

      {loading && <LoadingState title="Plaatsingen laden…" copy="De lijst wordt opgebouwd." />}

      {!loading && error && (
        <ErrorState
          title="Plaatsingsgegevens niet beschikbaar"
          copy={error}
          action={<Button variant="outline" onClick={() => refetch()}>Opnieuw</Button>}
        />
      )}

      {!loading && !error && (
        <CareWorklist testId="plaatsingen-werkvoorraad">
          <CareWorklistTabs
            tabs={tabs}
            activeId={activeFilter}
            onChange={(id) => { setActiveFilter(id as PlacementFilterKey); setBreachOnly(false); }}
          />

          <CareWorklistToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Zoek casus, aanbieder of regio..."
            filtersActive={filtersActive}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters((v) => !v)}
          />

          <CareWorklistFilterPanel open={showFilters}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
                Regio
                <select
                  className="h-9 rounded-[10px] border border-border/50 bg-transparent px-3 text-[13px] text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                >
                  <option value="all">Alle regio&apos;s</option>
                  {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
                Aanbieder
                <select
                  className="h-9 rounded-[10px] border border-border/50 bg-transparent px-3 text-[13px] text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                >
                  <option value="all">Alle aanbieders</option>
                  {providerOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>
          </CareWorklistFilterPanel>

          <div className="overflow-x-auto">
            <CareWorklistColumnHeader
              columns={["Casus", "Aanbieder", "Status", "Termijn", "Actie"]}
              cols={PLACEMENT_COLS}
              minWidth="820px"
            />
            <CareWorklistBody>
              {visibleRows.length === 0 ? (
                <EmptyState
                  title={activeFilter === "archive" ? "Geen gearchiveerde plaatsingen" : "Geen openstaande plaatsingen"}
                  copy={activeFilter === "archive"
                    ? "Er zijn op dit moment geen gearchiveerde plaatsingen zichtbaar."
                    : "Er zijn geen goedgekeurde aanvragen die nu plaatsingscoördinatie vragen."}
                  action={onNavigateToMatching ? (
                    <button type="button" className={ROW_ACTION_CLASSES.default} onClick={onNavigateToMatching}>Bekijk matching</button>
                  ) : undefined}
                />
              ) : visibleRows.map((row) => (
                <CareWorklistRow
                  key={row.item.id}
                  cols={PLACEMENT_COLS}
                  minWidth="820px"
                  accentTone={row.accentTone}
                  onRowClick={() => onCaseClick(row.item.id)}
                >
                  {/* Casus */}
                  <div className="min-w-0">
                    <span className={cn(
                      "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                      getUrgencyClass(row.item),
                    )}>
                      {row.item.urgency === "critical" ? "Spoed" : row.item.urgency === "warning" ? "Hoog" : "Normaal"}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[13px] font-medium leading-tight text-foreground">{row.item.id}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{row.regionLabel}</span>
                  </div>

                  {/* Aanbieder */}
                  <div className="min-w-0">
                    <span className="block truncate text-[12px] font-medium text-foreground">{row.providerLabel}</span>
                    <span className="block truncate text-[11px] text-muted-foreground/80">{row.attentionReason.split(";")[0]}</span>
                  </div>

                  {/* Status */}
                  <div className="flex items-start">
                    <CareDominantStatus className={cn("text-[12px]", getStatusClass(row.statusTone))}>
                      {row.statusLabel}
                    </CareDominantStatus>
                  </div>

                  {/* Termijn */}
                  <div className="flex items-start">
                    {INTAKE_SLA_FILTER_KEYS.has(row.filterKey) ? (
                      <CareSlaCountdown
                        elapsedHours={row.item.daysInCurrentPhase * 24}
                        targetHours={SLA_TARGET_HOURS.intakeStart}
                      />
                    ) : (
                      <span className="text-[12px] text-muted-foreground">{row.lastActivityLabel}</span>
                    )}
                  </div>

                  {/* Actie */}
                  <CareWorklistRowAction>
                    <button
                      type="button"
                      className={row.nextActionVariant === "primary" ? ROW_ACTION_CLASSES.primary : ROW_ACTION_CLASSES.default}
                      onClick={(e) => { e.stopPropagation(); onCaseClick(row.item.id); }}
                    >
                      {row.nextActionLabel}
                      <ChevronRight size={12} className="shrink-0 opacity-60" aria-hidden />
                    </button>
                  </CareWorklistRowAction>
                </CareWorklistRow>
              ))}
            </CareWorklistBody>
          </div>

          <CareWorklistPagination count={visibleRows.length} singular="plaatsing" plural="plaatsingen" />
        </CareWorklist>
      )}
    </CareCommandShell>
  );
}
