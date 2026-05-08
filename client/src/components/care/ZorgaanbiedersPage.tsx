import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { cn } from "../ui/utils";
import { useProviders, type SpaProvider } from "../../hooks/useProviders";
import { tokens } from "../../design/tokens";
import { ProviderNetworkMap } from "./ProviderNetworkMap";
import {
  CareAttentionBar,
  CareInfoPopover,
  CareMetaChip,
  CarePageScaffold,
  CareSection,
  CareSectionBody,
  CareSectionHeader,
  CareSearchFiltersBar,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
} from "./CareDesignPrimitives";

type ProviderSortOption = "best-match" | "shortest-wait" | "most-capacity" | "nearby";

interface ActiveCaseContext {
  region: string;
  careType: string;
  urgency: string;
}

function inferTypeFilterFromCaseType(careType: string): "all" | "residentieel" | "ambulant" | "dagbehandeling" | "crisis" {
  const normalized = careType.trim().toLowerCase();
  if (normalized.includes("resident")) return "residentieel";
  if (normalized.includes("ambul")) return "ambulant";
  if (normalized.includes("dag")) return "dagbehandeling";
  if (normalized.includes("crisis")) return "crisis";
  return "all";
}

const selectTriggerClass =
  "border-border bg-card text-foreground hover:bg-muted/35 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30";

/** Aligns with CareSection shells — avoids global `.panel-surface` hairlines (hardcoded rgba) stacking with Tailwind borders. */
const networkResultsShell = "rounded-xl border border-border/55 bg-card/30";

interface ZorgaanbiedersPageProps {
  theme: "light" | "dark";
  activeCaseContext?: ActiveCaseContext | null;
  /** Shell: opent Matching — knop staat op de kaart bij de geselecteerde marker. */
  onNavigateToMatching?: () => void;
}

export function ZorgaanbiedersPage({
  theme,
  activeCaseContext,
  onNavigateToMatching,
}: ZorgaanbiedersPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);
  const [mapView, setMapView] = useState<"split" | "full">("split");
  const [sortBy, setSortBy] = useState<ProviderSortOption>("best-match");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCapacity, setSelectedCapacity] = useState<string>("all");
  const lastPrefilledCaseKeyRef = useRef<string | null>(null);

  const { providers, loading, error, refetch, networkSummary, lastUpdatedAt } = useProviders({
    q: searchQuery,
    autoRefreshMs: 30_000,
  });

  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      const matchesSearch =
        searchQuery === "" ||
        provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        provider.specializations.some((specialization) =>
          specialization.toLowerCase().includes(searchQuery.toLowerCase()),
        );
      const matchesRegion = selectedRegion === "all" || provider.region === selectedRegion;
      const matchesType = selectedType === "all" || provider.type.toLowerCase().includes(selectedType.toLowerCase());
      const matchesCapacity =
        selectedCapacity === "all" ||
        (selectedCapacity === "available" && provider.availableSpots > 2) ||
        (selectedCapacity === "limited" && provider.availableSpots > 0 && provider.availableSpots <= 2) ||
        (selectedCapacity === "full" && provider.availableSpots === 0);

      return matchesSearch && matchesRegion && matchesType && matchesCapacity;
    });
  }, [providers, searchQuery, selectedRegion, selectedType, selectedCapacity]);

  const sortedProviders = useMemo(() => {
    const normalize = (value: string) => value.trim().toLowerCase();

    const scoreBestMatch = (provider: (typeof filteredProviders)[number]) => {
      let score = 0;

      if (activeCaseContext) {
        const caseRegion = normalize(activeCaseContext.region);
        const providerRegions = [provider.region, provider.regionLabel, ...(provider.allRegionLabels ?? [])]
          .filter(Boolean)
          .map(normalize);
        if (providerRegions.includes(caseRegion)) {
          score += 45;
        }

        const caseCareType = normalize(activeCaseContext.careType);
        const providerType = normalize(provider.type);
        const providerSpecs = provider.specializations.map(normalize);
        if (providerType.includes(caseCareType) || providerSpecs.some((spec) => spec.includes(caseCareType))) {
          score += 35;
        }

        const urgency = normalize(activeCaseContext.urgency);
        if (urgency.includes("kritiek")) {
          if (provider.availableSpots > 0) score += 12;
          if ((provider.averageWaitDays ?? 999) <= 7) score += 8;
        }
      }

      score += Math.min(provider.availableSpots, 10) * 2;
      score -= Math.max(provider.averageWaitDays ?? 0, 0) * 0.8;
      return score;
    };

    const sorted = [...filteredProviders];
    sorted.sort((left, right) => {
      if (sortBy === "shortest-wait") {
        const waitDiff = (left.averageWaitDays ?? Number.MAX_SAFE_INTEGER) - (right.averageWaitDays ?? Number.MAX_SAFE_INTEGER);
        if (waitDiff !== 0) return waitDiff;
        return right.availableSpots - left.availableSpots;
      }

      if (sortBy === "most-capacity") {
        const capacityDiff = right.availableSpots - left.availableSpots;
        if (capacityDiff !== 0) return capacityDiff;
        return (left.averageWaitDays ?? Number.MAX_SAFE_INTEGER) - (right.averageWaitDays ?? Number.MAX_SAFE_INTEGER);
      }

      if (sortBy === "nearby") {
        if (activeCaseContext?.region) {
          const caseRegion = normalize(activeCaseContext.region);
          const leftNear = [left.region, left.regionLabel, ...(left.allRegionLabels ?? [])]
            .filter(Boolean)
            .map(normalize)
            .includes(caseRegion);
          const rightNear = [right.region, right.regionLabel, ...(right.allRegionLabels ?? [])]
            .filter(Boolean)
            .map(normalize)
            .includes(caseRegion);
          if (leftNear !== rightNear) return leftNear ? -1 : 1;
        }
        return (left.averageWaitDays ?? Number.MAX_SAFE_INTEGER) - (right.averageWaitDays ?? Number.MAX_SAFE_INTEGER);
      }

      return scoreBestMatch(right) - scoreBestMatch(left);
    });

    return sorted;
  }, [filteredProviders, sortBy, activeCaseContext]);

  const stats = useMemo(() => {
    const availableCapacity = providers.reduce((total, provider) => total + provider.availableSpots, 0);
    const averageWaitDays =
      providers.length > 0
        ? Math.round(providers.reduce((total, provider) => total + (provider.averageWaitDays ?? 0), 0) / providers.length)
        : null;

    return {
      total: providers.length,
      availableCapacity,
      averageWaitDays,
    };
  }, [providers]);

  const regionOptions = useMemo(() => {
    const dynamicRegions = Array.from(new Set(providers.map((provider) => provider.region).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right),
    );
    return ["all", ...dynamicRegions];
  }, [providers]);

  const availableCapacityValue = networkSummary?.total_open_slots ?? stats.availableCapacity;
  const visibleCountValue = sortedProviders.length;
  const waitDaysLabel = stats.averageWaitDays !== null ? `${stats.averageWaitDays} dgn` : "n.v.t.";
  const lastUpdatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
    : null;

  const hiddenProvidersCount = Math.max(0, providers.length - filteredProviders.length);
  const hasActiveFilters =
    searchQuery !== "" || selectedRegion !== "all" || selectedType !== "all" || selectedCapacity !== "all";
  const resultHeaderText = hasActiveFilters
    ? `${sortedProviders.length} resultaten voor jouw filters`
    : `${sortedProviders.length} zorgaanbieders beschikbaar`;

  /** Must match `onClick`: clear when filters exist; otherwise narrow to beschikbare capaciteit (no case) or focus beste match (case). */
  const dominantActionLabel = hasActiveFilters
    ? "Wis filters"
    : activeCaseContext
      ? "Selecteer beste match"
      : "Selecteer alternatief";

  useEffect(() => {
    if (!activeCaseContext) return;

    const caseKey = `${activeCaseContext.region}|${activeCaseContext.careType}|${activeCaseContext.urgency}`;
    if (lastPrefilledCaseKeyRef.current === caseKey) return;

    if (searchQuery !== "" || selectedRegion !== "all" || selectedType !== "all" || selectedCapacity !== "all") {
      return;
    }

    const normalizedCaseRegion = activeCaseContext.region.trim().toLowerCase();
    const matchedRegion = regionOptions.find((option) => option !== "all" && option.trim().toLowerCase() === normalizedCaseRegion) ?? "all";
    const inferredType = inferTypeFilterFromCaseType(activeCaseContext.careType);

    if (matchedRegion !== "all") {
      setSelectedRegion(matchedRegion);
    }
    if (inferredType !== "all") {
      setSelectedType(inferredType);
    }

    lastPrefilledCaseKeyRef.current = caseKey;
  }, [activeCaseContext, regionOptions, searchQuery, selectedRegion, selectedType, selectedCapacity]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedRegion("all");
    setSelectedType("all");
    setSelectedCapacity("all");
    setSelectedProvider(null);
  };

  const showBestAlternatives = () => {
    setSearchQuery("");
    setSelectedRegion("all");
    setSelectedType("all");
    setSelectedCapacity("available");
    setSelectedProvider(null);
    setShowFilters(false);
  };

  const getCapacityTone = (spots: number) => {
    if (spots > 2) return "text-emerald-700 bg-emerald-500/10 border-emerald-500/30 dark:text-emerald-300";
    if (spots > 0) return "text-amber-700 bg-amber-500/10 border-amber-500/30 dark:text-amber-300";
    return "text-rose-700 bg-rose-500/10 border-rose-500/30 dark:text-rose-300";
  };

  const getCapacityLabel = (spots: number) => {
    if (spots > 2) return `${spots} plekken`;
    if (spots > 0) return `${spots} plek${spots > 1 ? "ken" : ""}`;
    return "Geen capaciteit";
  };

  const getRecommendationBadge = (providerId: string, index: number) => {
    if (selectedProvider === providerId) return "Aanbevolen";
    if (sortBy === "best-match" && index === 0) return "Beste match";
    return null;
  };

  const getReasoningLine = (provider: (typeof filteredProviders)[number]) => {
    const tags = provider.specializations.slice(0, 2);
    const regionLabel = provider.regionLabel || provider.region;

    if (tags.length >= 2) {
      return `Sterke match op ${tags[0].toLowerCase()} en ${tags[1].toLowerCase()}`;
    }
    if (provider.availableSpots > 0 && provider.averageWaitDays <= 7) {
      return "Beschikbaar binnen 7 dagen";
    }
    if (regionLabel) {
      return `Regionaal passend voor ${regionLabel}`;
    }
    if (provider.availableSpots > 0) {
      return `Directe capaciteit: ${provider.availableSpots} plek${provider.availableSpots > 1 ? "ken" : ""}`;
    }
    return "Match op basis van zorgvorm en regionale dekking";
  };

  /** Kaart + uitklapdetails — zonder toast (verkennen). */
  const highlightProviderOnMap = (providerId: string) => {
    setSelectedProvider(providerId);
  };

  /** Expliciete koppel-keuze — zelfde state als highlight + bevestiging aan gebruiker. */
  const confirmProviderSelection = (provider: SpaProvider, event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setSelectedProvider(provider.id);
    toast.success(`${provider.name} uitgelicht op de kaart`);
  };

  return (
    <CarePageScaffold
      archetype="worklist"
      className="pb-8"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Zorgaanbieders
          <CareInfoPopover ariaLabel="Uitleg zorgaanbiedersnetwerk" testId="zorgaanbieders-page-info">
            <p className="text-muted-foreground">
              Capaciteit en regionale dekking — voorkeur in de keten leg je vast via Matching bij een casus.
            </p>
          </CareInfoPopover>
        </span>
      }
      dominantAction={
        <CareAttentionBar
          tone={activeCaseContext ? "info" : "warning"}
          icon={<Building2 size={16} />}
          message={
            activeCaseContext
              ? `${activeCaseContext.region} · ${activeCaseContext.careType} · ${activeCaseContext.urgency}`
              : `${sortedProviders.length} aanbieders in beeld · gebruik filters om de volgende actie te vinden`
          }
          action={
            <PrimaryActionButton onClick={hasActiveFilters ? resetFilters : showBestAlternatives}>
              {dominantActionLabel}
            </PrimaryActionButton>
          }
        />
      }
    >
      <CareSection>
        <CareSectionHeader
          title="Werklijst"
          meta={
            <CareMetaChip>
              {visibleCountValue} zichtbaar · {availableCapacityValue} plekken · {waitDaysLabel}
              {lastUpdatedLabel ? ` · ${lastUpdatedLabel}` : ""}
            </CareMetaChip>
          }
        />
        <CareSectionBody className="space-y-4">
          <CareSearchFiltersBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Zoeken op naam, specialisatie of regio..."
            showSecondaryFilters={showFilters}
            onToggleSecondaryFilters={() => setShowFilters((current) => !current)}
            secondaryFiltersLabel="Filters"
            secondaryFilters={
              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">Regio</label>
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger className={cn("h-10 w-full", selectTriggerClass)}>
                      <SelectValue placeholder="Alle regio's" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card text-foreground">
                      {regionOptions.map((region) => (
                        <SelectItem
                          key={region}
                          className="text-foreground focus:bg-muted focus:text-foreground"
                          value={region}
                        >
                          {region === "all" ? "Alle regio's" : region}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">Type zorg</label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className={cn("h-10 w-full", selectTriggerClass)}>
                      <SelectValue placeholder="Alle types" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card text-foreground">
                      <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="all">Alle types</SelectItem>
                      <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="residentieel">Residentieel</SelectItem>
                      <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="ambulant">Ambulant</SelectItem>
                      <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="dagbehandeling">Dagbehandeling</SelectItem>
                      <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="crisis">Crisis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">Capaciteit</label>
                  <Select value={selectedCapacity} onValueChange={setSelectedCapacity}>
                    <SelectTrigger className={cn("h-10 w-full", selectTriggerClass)}>
                      <SelectValue placeholder="Alle niveaus" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card text-foreground">
                      <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="all">Alle niveaus</SelectItem>
                      <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="available">Beschikbaar (3+)</SelectItem>
                      <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="limited">Beperkt (1-2)</SelectItem>
                      <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="full">Vol</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            }
            rightAction={
              <>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as ProviderSortOption)}>
                  <SelectTrigger className={cn("h-10 min-w-[170px]", selectTriggerClass)}>
                    <SelectValue placeholder="Sorteer op" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card text-foreground">
                    <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="best-match">Beste match</SelectItem>
                    <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="shortest-wait">Kortste wachttijd</SelectItem>
                    <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="most-capacity">Meeste capaciteit</SelectItem>
                    <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="nearby">Dichtbij</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 shrink-0 border-border"
                  onClick={() => setMapView((current) => (current === "split" ? "full" : "split"))}
                >
                  <Maximize2 size={16} className="mr-2" />
                  {mapView === "split" ? "Kaart" : "Split view"}
                </Button>
              </>
            }
          />
      {mapView === "full" ? (
        <div className={cn(networkResultsShell, "overflow-hidden")}>
          <div className="border-b border-border/50 bg-muted/40 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kaartweergave</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Volledige kaartmodus · {sortedProviders.length} van {providers.length} aanbieders zichtbaar
            </p>
          </div>
          <div className="h-[calc(100vh-12rem)] min-h-[32rem]">
            <ProviderNetworkMap
              providers={sortedProviders}
              selectedProviderId={selectedProvider}
              hoveredProviderId={hoveredProvider}
              onSelectProvider={setSelectedProvider}
              onNavigateToMatching={onNavigateToMatching}
              theme={theme}
            />
          </div>
        </div>
      ) : (
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.08fr)_minmax(480px,0.92fr)] 2xl:gap-4 2xl:items-start">
            <div className="order-1 min-w-0 space-y-3 2xl:min-h-[calc(100vh-15rem)] 2xl:overflow-y-auto 2xl:pr-2">
              {!loading && !error && (
                <div className="space-y-1 rounded-xl border border-border/55 bg-muted/25 px-3 py-2.5">
                  <p className="text-2xl font-semibold text-foreground">{resultHeaderText}</p>
                  <p className="text-sm text-muted-foreground">Split view toont resultaten links en de kaart rechts.</p>
                </div>
              )}

              {loading && <LoadingState title="Aanbieders laden…" copy="Het netwerk wordt opgebouwd." />}

              {!loading && error && (
                <ErrorState title="Laden mislukt" copy={error} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
              )}

              {!loading && !error && sortedProviders.length === 0 && (
                <EmptyState
                  title="Geen directe match gevonden"
                  copy={hiddenProvidersCount > 0 ? "Er zijn aanbieders buiten de huidige filters." : "Er zijn geen zichtbare aanbieders in deze selectie."}
                  action={
                    <PrimaryActionButton onClick={hasActiveFilters ? resetFilters : showBestAlternatives}>
                      {hasActiveFilters ? "Wis filters" : "Selecteer alternatief"}
                    </PrimaryActionButton>
                  }
                />
              )}

              {!loading && !error && sortedProviders.length > 0 && (
                <div className="grid grid-cols-1 gap-4">
                  {sortedProviders.map((provider, index) => {
                    const isSelected = provider.id === selectedProvider;
                    const recommendation = getRecommendationBadge(provider.id, index);
                    const reasoningLine = getReasoningLine(provider);
                    return (
                      <article
                        key={provider.id}
                        onMouseEnter={() => setHoveredProvider(provider.id)}
                        onMouseLeave={() => setHoveredProvider(null)}
                        className={cn(
                          "rounded-xl border bg-card/35 p-4 text-left transition-colors hover:border-primary/35",
                          isSelected ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20" : "border-border/60",
                        )}
                      >
                        <button
                          type="button"
                          aria-label={`Selecteer ${provider.name}`}
                          aria-pressed={isSelected}
                          onClick={() => highlightProviderOnMap(provider.id)}
                          className="w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <div className="mb-2.5 flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-[15px] font-semibold text-foreground">{provider.name}</h3>
                                {recommendation && (
                                  <span className="rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary">
                                    {recommendation}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{provider.type}</p>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getCapacityTone(provider.availableSpots)}`}>
                              {getCapacityLabel(provider.availableSpots)}
                            </span>
                          </div>

                          <div className="mb-2.5 flex flex-wrap gap-1.5">
                            {provider.specializations.slice(0, 3).map((specialization) => (
                              <span
                                key={specialization}
                                className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-foreground"
                              >
                                {specialization}
                              </span>
                            ))}
                          </div>

                          <div className="mb-2.5 rounded-xl border border-border/50 bg-muted/35 px-2.5 py-2 text-xs font-medium text-foreground">
                            {reasoningLine}
                          </div>

                          <div className="grid grid-cols-3 gap-2 border-t border-border/45 pt-2.5 text-xs">
                            <div>
                              <p className="text-muted-foreground">Regio</p>
                              <p className="mt-1 text-sm font-medium text-foreground">{provider.region}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Wachttijd</p>
                              <p className="mt-1 text-sm font-medium text-foreground">{provider.averageWaitDays ?? 0} dgn</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Wachtlijst</p>
                              <p className="mt-1 text-sm font-medium text-foreground">{provider.waitingListLength}</p>
                            </div>
                          </div>
                        </button>

                        <div className="mt-3 flex gap-2 border-t border-border/45 pt-3">
                          <Button
                            type="button"
                            size="sm"
                            className="flex-1"
                            onClick={(event) => confirmProviderSelection(provider, event)}
                          >
                            Selecteer
                          </Button>
                        </div>

                        {isSelected && (
                          <div className="mt-3 space-y-3 border-t border-border/45 pt-3">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">Stad</p>
                                <p className="mt-1 font-medium text-foreground">{provider.city || provider.region}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Capaciteit</p>
                                <p className="mt-1 font-medium text-foreground">
                                  {provider.currentCapacity} / {provider.maxCapacity} bezet
                                </p>
                              </div>
                            </div>

                            {(provider.offersOutpatient || provider.offersDayTreatment || provider.offersResidential || provider.offersCrisis) && (
                              <div>
                                <p className="mb-1.5 text-xs text-muted-foreground">Zorgvormen</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {provider.offersOutpatient && (
                                    <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs text-foreground">Ambulant</span>
                                  )}
                                  {provider.offersDayTreatment && (
                                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs text-primary">Dagbehandeling</span>
                                  )}
                                  {provider.offersResidential && (
                                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200">
                                      Residentieel
                                    </span>
                                  )}
                                  {provider.offersCrisis && (
                                    <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                                      Crisis
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {provider.specialFacilities && <p className="text-xs text-muted-foreground">{provider.specialFacilities}</p>}

                            <p className="rounded-xl border border-border/50 bg-muted/35 px-2.5 py-2 text-xs text-muted-foreground">
                              Kaart en kaartmarker zijn gesynchroniseerd. Bij een geselecteerde aanbieder verschijnt{" "}
                              <span className="font-medium text-foreground">Naar Matching</span> op de kaart bij de marker.
                            </p>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="order-2 min-w-0 2xl:sticky" style={{ top: tokens.layout.edgeZero }}>
              <div className={cn(networkResultsShell, "overflow-hidden bg-muted/20")}>
                <div className="border-b border-border/50 bg-card px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Kaartweergave</p>
                      <p className="mt-1 text-sm font-medium text-foreground">Aanbieders op de kaart</p>
                    </div>
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Live sync</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Split modus · {sortedProviders.length} van {providers.length} aanbieders zichtbaar
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-800 dark:text-emerald-200">
                      Veel capaciteit
                    </span>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-800 dark:text-amber-200">
                      Beperkt
                    </span>
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-800 dark:text-rose-200">
                      Vol
                    </span>
                  </div>
                </div>
                <div className="h-[18rem] sm:h-[22rem] 2xl:h-[calc(100vh-11rem)] 2xl:min-h-[33rem]">
                  <ProviderNetworkMap
                    providers={sortedProviders}
                    selectedProviderId={selectedProvider}
                    hoveredProviderId={hoveredProvider}
                    onSelectProvider={setSelectedProvider}
                    onNavigateToMatching={onNavigateToMatching}
                    theme={theme}
                  />
                </div>
              </div>
            </div>
          </div>
      )}
        </CareSectionBody>
      </CareSection>
    </CarePageScaffold>
  );
}
