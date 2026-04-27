import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronDown, ChevronRight, Loader2, Maximize2, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useProviders } from "../../hooks/useProviders";
import { ProviderNetworkMap } from "./ProviderNetworkMap";

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

interface ZorgaanbiedersPageProps {
  theme: "light" | "dark";
  activeCaseContext?: ActiveCaseContext | null;
}

export function ZorgaanbiedersPage({ theme, activeCaseContext }: ZorgaanbiedersPageProps) {
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
    const dynamicRegions = Array.from(new Set(providers.map((provider) => provider.region).filter(Boolean))).sort((left, right) => left.localeCompare(right));
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
    if (spots > 2) return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/35 dark:border-emerald-700/50";
    if (spots > 0) return "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/35 dark:border-amber-700/50";
    return "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-900/35 dark:border-rose-700/50";
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

  return (
      <div className="mx-auto flex w-full max-w-[1650px] min-w-0 flex-col gap-4 lg:gap-5">
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-[0_14px_38px_-30px_rgba(15,23,42,0.45)] sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Zorgaanbieders</h1>
              <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">Selecteer een aanbieder voor deze casus</p>
              {activeCaseContext && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Regio: {activeCaseContext.region} • Zorgtype: {activeCaseContext.careType} • Urgentie: {activeCaseContext.urgency}
                </p>
              )}
            </div>

            {!loading && stats.total > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <strong className="text-slate-800 dark:text-slate-100">{availableCapacityValue}</strong> capaciteit
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <strong className="text-slate-800 dark:text-slate-100">{waitDaysLabel}</strong> gem. wachttijd
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  <strong className="text-slate-800 dark:text-slate-100">{visibleCountValue}</strong> zichtbaar
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/35 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <strong>Live</strong> 30s{lastUpdatedLabel ? ` · ${lastUpdatedLabel}` : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.35)] sm:p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1 rounded-2xl bg-slate-50/85 p-3 dark:bg-slate-800/80">
            <div className="flex items-center gap-2">
              <Search className="text-slate-400 dark:text-slate-500" size={18} />
              <Input
                type="text"
                placeholder="Zoek op naam, specialisatie of regio..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-8 border-0 bg-transparent p-0 text-sm text-slate-700 shadow-none focus-visible:ring-0 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
            <Button
              type="button"
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters((current) => !current)}
              className={`justify-center ${showFilters ? "shadow-sm" : "border-slate-300/70 bg-slate-100/85 text-slate-700 hover:bg-slate-100 dark:border-slate-700/70 dark:bg-slate-800/85 dark:text-slate-200 dark:hover:bg-slate-700"}`}
            >
              <SlidersHorizontal size={16} className="mr-2" />
              Filters
            </Button>

            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Gesorteerd op:</span>
              <div className="relative min-w-[170px]">
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as ProviderSortOption)}
                  className="w-full appearance-none rounded-lg bg-transparent px-2 py-1 pr-7 text-sm text-slate-700 dark:text-slate-200"
                >
                  <option value="best-match">Beste match</option>
                  <option value="shortest-wait">Kortste wachttijd</option>
                  <option value="most-capacity">Meeste capaciteit</option>
                  <option value="nearby">Dichtbij</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setMapView((current) => (current === "split" ? "full" : "split"))}
              className="justify-center text-slate-600 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-slate-800/70"
            >
              <Maximize2 size={16} className="mr-2" />
              {mapView === "split" ? "Kaart" : "Split view"}
            </Button>
          </div>
          </div>
        </div>

        {showFilters && (
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Regio</label>
                <div className="relative">
                <select
                  value={selectedRegion}
                  onChange={(event) => setSelectedRegion(event.target.value)}
                  className="w-full appearance-none rounded-xl bg-slate-50 px-3 py-2.5 pr-8 text-sm text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:bg-slate-800 dark:text-slate-200"
                >
                  {regionOptions.map((region) => (
                    <option key={region} value={region}>
                      {region === "all" ? "Alle regio's" : region}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Type zorg</label>
                <div className="relative">
                <select
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value)}
                  className="w-full appearance-none rounded-xl bg-slate-50 px-3 py-2.5 pr-8 text-sm text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="all">Alle types</option>
                  <option value="residentieel">Residentieel</option>
                  <option value="ambulant">Ambulant</option>
                  <option value="dagbehandeling">Dagbehandeling</option>
                  <option value="crisis">Crisis</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Capaciteit</label>
                <div className="relative">
                <select
                  value={selectedCapacity}
                  onChange={(event) => setSelectedCapacity(event.target.value)}
                  className="w-full appearance-none rounded-xl bg-slate-50 px-3 py-2.5 pr-8 text-sm text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="all">Alle niveaus</option>
                  <option value="available">Beschikbaar (3+)</option>
                  <option value="limited">Beperkt (1-2)</option>
                  <option value="full">Vol</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {mapView === "full" ? (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_36px_-30px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/80">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Kaartweergave</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Volledige kaartmodus · {sortedProviders.length} van {providers.length} aanbieders zichtbaar
              </p>
            </div>
            <div className="h-[calc(100vh-12rem)] min-h-[32rem]">
              <ProviderNetworkMap
                providers={sortedProviders}
                selectedProviderId={selectedProvider}
                hoveredProviderId={hoveredProvider}
                onSelectProvider={setSelectedProvider}
                theme={theme}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_24px_46px_-34px_rgba(15,23,42,0.42)] sm:p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.08fr)_minmax(480px,0.92fr)] 2xl:gap-5 2xl:items-start">
              <div className="order-1 min-w-0 space-y-3 2xl:min-h-[calc(100vh-15rem)] 2xl:overflow-y-auto 2xl:pr-2">
              {!loading && !error && (
                <div className="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/80">
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{resultHeaderText}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Split view toont resultaten links en de kaart rechts.</p>
                </div>
              )}

              {loading && (
                <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Aanbieders laden...
                </div>
              )}

              {!loading && error && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-base font-semibold text-foreground">Aanbieders konden niet geladen worden</p>
                  <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                  <Button variant="outline" className="mt-4 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600" onClick={refetch}>
                    Opnieuw proberen
                  </Button>
                </div>
              )}

              {!loading && !error && sortedProviders.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-800">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-700">
                    <Building2 size={22} className="text-muted-foreground" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">Geen directe match gevonden</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {hiddenProvidersCount > 0
                      ? "Er zijn aanbieders buiten de huidige filters."
                      : "Er zijn momenteel geen zichtbare aanbieders in deze selectie."}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Button onClick={showBestAlternatives}>Toon beste alternatieven</Button>
                    <Button
                      variant="outline"
                      className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                      onClick={() => (hasActiveFilters ? resetFilters() : setShowFilters(true))}
                    >
                      {hasActiveFilters ? "Reset filters" : "Open filters"}
                    </Button>
                  </div>
                </div>
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
                        className={`rounded-2xl border bg-white p-3 text-left shadow-[0_8px_24px_-22px_rgba(15,23,42,0.34)] transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_16px_34px_-24px_rgba(124,92,255,0.28)] dark:bg-slate-800 ${
                          isSelected ? "border-primary/50 bg-primary-light/30 ring-2 ring-primary/20 dark:bg-primary/20" : "border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <button
                          type="button"
                          aria-label={`Selecteer ${provider.name}`}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedProvider(provider.id)}
                          className="w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
                        >
                        <div className="mb-2.5 flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{provider.name}</h3>
                              {recommendation && (
                                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-violet-700 dark:border-violet-700/50 dark:bg-violet-900/35 dark:text-violet-300">
                                  {recommendation}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{provider.type}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getCapacityTone(provider.availableSpots)}`}>
                            {getCapacityLabel(provider.availableSpots)}
                          </span>
                        </div>

                        <div className="mb-2.5 flex flex-wrap gap-1.5">
                          {provider.specializations.slice(0, 3).map((specialization) => (
                            <span key={specialization} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300">
                              {specialization}
                            </span>
                          ))}
                        </div>

                        <div className="mb-2.5 rounded-xl border border-violet-200/70 bg-violet-50/70 px-2.5 py-2 text-xs font-medium text-violet-700 dark:border-violet-700/50 dark:bg-violet-900/35 dark:text-violet-300">
                          {reasoningLine}
                        </div>

                        <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-2.5 text-xs dark:border-slate-700">
                          <div>
                            <p className="text-slate-500 dark:text-slate-400">Regio</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{provider.region}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400">Wachttijd</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{provider.averageWaitDays ?? 0} dgn</p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400">Wachtlijst</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{provider.waitingListLength}</p>
                          </div>
                        </div>
                        </button>

                        <div className="mt-3 flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedProvider(provider.id);
                              toast.success(`${provider.name} geselecteerd voor koppeling`);
                            }}
                          >
                            Selecteer
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            onClick={() => toast.info(`Profiel van ${provider.name} openen — coming soon`)}
                          >
                            Bekijk profiel
                          </Button>
                        </div>

                        {isSelected && (
                          <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-slate-500 dark:text-slate-400">Stad</p>
                                <p className="mt-1 font-medium text-slate-800 dark:text-slate-200">{provider.city || provider.region}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 dark:text-slate-400">Capaciteit</p>
                                <p className="mt-1 font-medium text-slate-800 dark:text-slate-200">{provider.currentCapacity} / {provider.maxCapacity} bezet</p>
                              </div>
                            </div>

                            {(provider.offersOutpatient || provider.offersDayTreatment || provider.offersResidential || provider.offersCrisis) && (
                              <div>
                                <p className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">Zorgvormen</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {provider.offersOutpatient && <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:border-blue-700/50 dark:bg-blue-900/35 dark:text-blue-300">Ambulant</span>}
                                  {provider.offersDayTreatment && <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-700 dark:border-violet-700/50 dark:bg-violet-900/35 dark:text-violet-300">Dagbehandeling</span>}
                                  {provider.offersResidential && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/35 dark:text-amber-300">Residentieel</span>}
                                  {provider.offersCrisis && <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/35 dark:text-rose-300">Crisis</span>}
                                </div>
                              </div>
                            )}

                            {provider.specialFacilities && (
                              <p className="text-xs text-muted-foreground">{provider.specialFacilities}</p>
                            )}

                            <p className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300">
                              Kaart en kaartmarker zijn gesynchroniseerd met deze selectie.
                            </p>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
              </div>

              <div className="order-2 min-w-0 2xl:sticky 2xl:top-6">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/65">
                  <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Kaartweergave</p>
                        <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">Aanbieders op de kaart</p>
                      </div>
                      <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:border-violet-700/50 dark:bg-violet-900/35 dark:text-violet-300">
                        Live sync
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Split modus · {sortedProviders.length} van {providers.length} aanbieders zichtbaar
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/35 dark:text-emerald-300">Veel capaciteit</span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/35 dark:text-amber-300">Beperkt</span>
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/35 dark:text-rose-300">Vol</span>
                    </div>
                  </div>
                  <div className="h-[18rem] sm:h-[22rem] 2xl:h-[calc(100vh-11rem)] 2xl:min-h-[33rem]">
                    <ProviderNetworkMap
                      providers={sortedProviders}
                      selectedProviderId={selectedProvider}
                      hoveredProviderId={hoveredProvider}
                      onSelectProvider={setSelectedProvider}
                      theme={theme}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
