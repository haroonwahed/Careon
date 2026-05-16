import { useMemo, useState } from "react";
import { Building2, ClipboardList, Clock3, Lock, ShieldAlert } from "lucide-react";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { cn } from "../ui/utils";
import { CareKPICard } from "./CareKPICard";
import {
  CareAttentionBar,
  CareDominantStatus,
  CareMetaChip,
  CareInfoPopover,
  CareMetricBadge,
  CarePageScaffold,
  CarePrimaryList,
  CareSection,
  CareSectionBody,
  CareSectionHeader,
  CareSearchFiltersBar,
  CareWorkListCard,
  CareWorkRow,
  EmptyState,
  ErrorState,
  FlowPhaseBadge,
  LoadingState,
  PrimaryActionButton,
  normalizeBoardColumnToPhaseId,
} from "./CareDesignPrimitives";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases } from "../../lib/workflowUi";
import type { WorkflowCaseView } from "../../lib/workflowUi";

interface MatchingQueuePageProps {
  onCaseClick: (caseId: string) => void;
  onNavigateToCasussen?: () => void;
}

type ListTab = "all" | "urgent" | "blocked";
type SortOption = "urgency" | "region" | "wait";

const URGENCY_KEYS = ["critical", "warning", "normal"] as const;
type UrgencyTier = (typeof URGENCY_KEYS)[number];

function urgencyRank(u: WorkflowCaseView["urgency"]): number {
  if (u === "critical") return 0;
  if (u === "warning") return 1;
  return 2;
}

function sortMatchingList(list: WorkflowCaseView[], sortBy: SortOption): WorkflowCaseView[] {
  const out = [...list];
  if (sortBy === "region") {
    out.sort((a, b) => a.region.localeCompare(b.region, "nl") || a.id.localeCompare(b.id));
    return out;
  }
  if (sortBy === "wait") {
    out.sort((a, b) => b.daysInCurrentPhase - a.daysInCurrentPhase || urgencyRank(a.urgency) - urgencyRank(b.urgency));
    return out;
  }
  out.sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency) || b.daysInCurrentPhase - a.daysInCurrentPhase);
  return out;
}

export function MatchingQueuePage({ onCaseClick, onNavigateToCasussen }: MatchingQueuePageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const [listTab, setListTab] = useState<ListTab>("all");
  const [sortBy, setSortBy] = useState<SortOption>("urgency");

  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedUrgency, setSelectedUrgency] = useState<Record<UrgencyTier, boolean>>({
    critical: true,
    warning: true,
    normal: true,
  });

  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const pool = useMemo(() => {
    const sentinel = "9999-12-31";
    return buildWorkflowCases(cases, providers)
      .filter((item) => item.readyForMatching)
      .sort((a, b) => {
        const aBucket = a.waitlistBucket ?? 1;
        const bBucket = b.waitlistBucket ?? 1;
        if (aBucket !== bBucket) return aBucket - bBucket;
        if (aBucket === 0) {
          const aDate = a.urgencyGrantedDate ?? sentinel;
          const bDate = b.urgencyGrantedDate ?? sentinel;
          return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
        }
        const aStart = a.intakeStartDate ?? sentinel;
        const bStart = b.intakeStartDate ?? sentinel;
        return aStart < bStart ? -1 : aStart > bStart ? 1 : 0;
      });
  }, [cases, providers]);

  const counts = useMemo(() => {
    const critical = pool.filter((i) => i.urgency === "critical").length;
    const warning = pool.filter((i) => i.urgency === "warning").length;
    const blocked = pool.filter((i) => i.isBlocked).length;
    return {
      total: pool.length,
      critical,
      warning,
      blocked,
      normal: pool.filter((i) => i.urgency === "normal").length,
    };
  }, [pool]);

  const urgentCount = counts.critical + counts.warning;
  const blockedCount = counts.blocked;

  const regionOptions = useMemo(() => {
    const dynamic = Array.from(new Set(pool.map((item) => item.region))).sort((a, b) => a.localeCompare(b, "nl"));
    return ["all", ...dynamic];
  }, [pool]);

  const filteredCases = useMemo(() => {
    let list = pool;

    if (listTab === "urgent") {
      list = list.filter((item) => item.urgency === "critical" || item.urgency === "warning");
    } else if (listTab === "blocked") {
      list = list.filter((item) => item.isBlocked);
    }

    if (selectedRegion !== "all") {
      list = list.filter((item) => item.region === selectedRegion);
    }

    const anyUrgency =
      selectedUrgency.critical || selectedUrgency.warning || selectedUrgency.normal;
    if (anyUrgency) {
      list = list.filter((item) => {
        if (item.urgency === "critical") return selectedUrgency.critical;
        if (item.urgency === "warning") return selectedUrgency.warning;
        return selectedUrgency.normal;
      });
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => {
        const hay = `${item.clientLabel} ${item.title} ${item.id} ${item.region} ${item.nextBestActionLabel}`.toLowerCase();
        return hay.includes(q);
      });
    }

    return sortMatchingList(list, sortBy);
  }, [pool, listTab, selectedRegion, selectedUrgency, searchQuery, sortBy]);

  const clearSidebarFilters = () => {
    setSelectedRegion("all");
    const reset = { critical: true, warning: true, normal: true };
    setSelectedUrgency(reset);
  };

  const toggleUrgency = (key: UrgencyTier) => {
    setSelectedUrgency((current) => ({ ...current, [key]: !current[key] }));
  };

  const selectTriggerClass =
    "h-10 border-border bg-card text-foreground hover:bg-muted/35 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30";

  const kpiStrip = (
    <div className="grid gap-3 px-1 sm:grid-cols-2 xl:grid-cols-4">
      <CareKPICard
        title="Totaal in wachtrij"
        value={loading ? "—" : counts.total}
        subtitle="Zoek zorgcapaciteit"
        icon={ClipboardList}
        urgency="normal"
      />
      <CareKPICard
        title="Kritiek"
        value={loading ? "—" : counts.critical}
        subtitle="Hoogste urgentie"
        icon={ShieldAlert}
        urgency="critical"
      />
      <CareKPICard
        title="Hoog"
        value={loading ? "—" : counts.warning}
        subtitle="Vereist tempo"
        icon={Clock3}
        urgency="warning"
      />
      <CareKPICard
        title="Geblokkeerd"
        value={loading ? "—" : counts.blocked}
        subtitle="Eerst oorzaak oplossen"
        icon={Lock}
        urgency={counts.blocked > 0 ? "warning" : "normal"}
      />
    </div>
  );

  return (
    <CarePageScaffold
      archetype="worklist"
      className="pb-8"
      title="Matching"
      subtitleInfoTestId="matching-page-info"
      subtitleAriaLabel="Uitleg matchingwachtrij"
      subtitle="Overzicht van casussen in de matchingwachtrij — advies voor de gemeente, met topkandidaten; pas na gemeentelijke validatie gaat de casus door naar aanbiederbeoordeling."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToCasussen ? (
            <PrimaryActionButton onClick={onNavigateToCasussen}>Naar casussen</PrimaryActionButton>
          ) : null}
          <Button variant="outline" onClick={() => void refetch()}>
            Ververs
          </Button>
        </div>
      }
      metric={
        <CareMetricBadge>
          {loading ? "Laden…" : `${filteredCases.length} in deze weergave · ${counts.total} totaal`}
        </CareMetricBadge>
      }
      dominantAction={
        <CareAttentionBar
          visible
          tone={blockedCount > 0 ? "warning" : "info"}
          message={
            blockedCount > 0
              ? `${blockedCount} casus${blockedCount === 1 ? "" : "sen"} geblokkeerd — los dit eerst op voordat matching betrouwbaar is.`
              : "Matching is advisering; de gemeente valideert de selectie voordat een aanbieder de casus beoordeelt."
          }
        />
      }
      kpiStrip={kpiStrip}
    >
      <CareSection testId="matching-uitvoerlijst" aria-labelledby="matching-werkvoorraad-heading">
        <CareSectionHeader
          className="lg:flex-col lg:items-stretch"
          title={
            <span id="matching-werkvoorraad-heading">Werkvoorraad</span>
          }
          meta={
            <div className="w-full min-w-0 space-y-2">
              <span className="inline-flex w-fit items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[12px] font-semibold text-cyan-200">
                {loading ? "…" : `${filteredCases.length} casussen`}
              </span>
              <CareSearchFiltersBar
                className="px-0"
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Zoek casussen, regio's, aanbieders…"
                showSecondaryFilters={showSecondaryFilters}
                onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
                secondaryFiltersLabel="Filters"
                secondaryFilters={
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] leading-snug text-muted-foreground">
                        Verfijn regio en urgentie; filters worden direct toegepast.
                      </p>
                      <button
                        type="button"
                        className="shrink-0 text-[13px] font-semibold text-primary hover:text-foreground"
                        onClick={clearSidebarFilters}
                      >
                        Wissen
                      </button>
                    </div>
                    <div className="grid items-end gap-2 md:grid-cols-2">
                      <label className="flex min-w-0 flex-col gap-1">
                        <span className="text-[11px] font-medium text-muted-foreground">Weergave</span>
                        <Select value={listTab} onValueChange={(value) => setListTab(value as ListTab)}>
                          <SelectTrigger aria-label="Weergave" className={cn("h-10", selectTriggerClass)}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-card text-foreground">
                            <SelectItem value="all">Alle casussen</SelectItem>
                            <SelectItem value="urgent">Urgent ({loading ? "—" : urgentCount})</SelectItem>
                            <SelectItem value="blocked">Geblokkeerd ({loading ? "—" : blockedCount})</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="flex min-w-0 flex-col gap-1">
                        <span className="text-[11px] font-medium text-muted-foreground">Sorteren op</span>
                        <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                          <SelectTrigger aria-label="Sorteren op" className={cn("h-10", selectTriggerClass)}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-card text-foreground">
                            <SelectItem value="urgency">Urgentie</SelectItem>
                            <SelectItem value="region">Regio</SelectItem>
                            <SelectItem value="wait">Wachttijd in fase</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Urgentie</p>
                      {(
                        [
                          { key: "critical" as const, label: "Kritiek", tone: "text-red-400", count: counts.critical },
                          { key: "warning" as const, label: "Hoog", tone: "text-amber-400", count: counts.warning },
                          { key: "normal" as const, label: "Normaal", tone: "text-sky-300", count: counts.normal },
                        ] as const
                      ).map((row) => (
                        <label
                          key={row.key}
                          className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/30 px-2.5 py-2 text-[13px]"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedUrgency[row.key]}
                              onChange={() => toggleUrgency(row.key)}
                              className="size-4 rounded border-border accent-primary"
                            />
                            <span className={cn("font-medium text-foreground", row.tone)}>{row.label}</span>
                          </span>
                          <span className="tabular-nums text-muted-foreground">{row.count}</span>
                        </label>
                      ))}
                    </div>
                    <label className="block space-y-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">Regio</span>
                      <select
                        value={selectedRegion}
                        onChange={(event) => setSelectedRegion(event.target.value)}
                        className="h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                      >
                        {regionOptions.map((region) => (
                          <option key={region} value={region}>
                            {region === "all" ? "Alle regio's" : region}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">Fase</span>
                      <select disabled className="h-9 w-full rounded-xl border border-border/50 bg-muted/20 px-3 text-sm text-muted-foreground">
                        <option>Matching (vast)</option>
                      </select>
                    </label>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      <Building2 className="mr-1 inline size-3.5 align-text-bottom opacity-70" aria-hidden />
                      Selecties gelden direct voor de werkvoorraad.
                    </p>
                  </div>
                }
              />
            </div>
          }
        />
        <CareSectionBody className="space-y-3">
          {loading && <LoadingState title="Matching laden…" copy="De wachtrij wordt opgebouwd." />}
          {!loading && error && (
            <ErrorState title="Laden mislukt" copy={error} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
          )}

          {!loading && !error && filteredCases.length === 0 && (
            <EmptyState
              title={pool.length === 0 ? "Geen casussen in matching" : "Geen casussen in deze weergave"}
              copy={
                pool.length === 0
                  ? "Zodra samenvatting en voorbereiding klaar zijn, verschijnen casussen hier automatisch."
                  : "Pas tabblad, zoekopdracht of filters aan."
              }
              action={<PrimaryActionButton onClick={() => onNavigateToCasussen?.()}>Naar casussen</PrimaryActionButton>}
            />
          )}

          {!loading && !error && filteredCases.length > 0 && (
            <CareWorkListCard
              header={(
                <div className="hidden gap-y-3 gap-x-4 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid md:grid-cols-[88px_128px_minmax(220px,260px)_104px_112px_minmax(220px,1fr)] md:gap-x-5 md:px-5">
                  <span>Fase</span>
                  <span>Casus</span>
                  <span>Matchadvies</span>
                  <span>Wachttijd</span>
                  <span>Context</span>
                  <span>Volgende actie</span>
                </div>
              )}
            >
              <div className="divide-y divide-border/45">
                <CarePrimaryList>
                  {filteredCases.map((item) => (
                    <CareWorkRow
                      key={item.id}
                      leading={<FlowPhaseBadge phaseId={normalizeBoardColumnToPhaseId(item.boardColumn)} />}
                      title={item.clientLabel}
                      context={`${item.id} · ${item.region} · ${item.title}`}
                      status={
                        <CareDominantStatus
                          className={
                            item.matchConfidenceScore != null && item.matchConfidenceScore < 40
                              ? "border-destructive/35 bg-destructive/10 text-destructive"
                              : item.matchConfidenceScore != null && item.matchConfidenceScore < 65
                                ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                                : undefined
                          }
                        >
                          {item.matchConfidenceLabel ?? item.phaseLabel}
                        </CareDominantStatus>
                      }
                      time={
                        <CareMetaChip>
                          <Clock3 size={12} />
                          {item.daysInCurrentPhase}d in fase
                        </CareMetaChip>
                      }
                      contextInfo={
                        <>
                          <CareMetaChip>{item.recommendedProvidersCount} aanbieders</CareMetaChip>
                          {item.isBlocked ? (
                            <CareMetaChip className="border-destructive/30 text-destructive">
                              Geblokkeerd
                            </CareMetaChip>
                          ) : null}
                        </>
                      }
                      actionLabel={item.primaryActionEnabled ? "Vergelijk aanbieders" : "Controleer matchadvies"}
                      actionVariant={item.primaryActionEnabled ? "primary" : "ghost"}
                      onOpen={() => onCaseClick(item.id)}
                      onAction={(event) => {
                        event.stopPropagation();
                        onCaseClick(item.id);
                      }}
                      accentTone={item.isBlocked ? "critical" : item.urgency === "critical" ? "warning" : "neutral"}
                    />
                  ))}
                </CarePrimaryList>
              </div>
            </CareWorkListCard>
          )}
        </CareSectionBody>
      </CareSection>
    </CarePageScaffold>
  );
}
