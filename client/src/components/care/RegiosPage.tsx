/**
 * RegiosPage - Geographical System Overview
 * 
 * System-level view of regional distribution:
 * - Understand case distribution
 * - Monitor regional capacity
 * - Identify shortages and imbalances
 * - Navigate to municipalities and providers
 * 
 * This is NOT a workflow page - it's a structural overview.
 */

import { useState, useMemo, useCallback } from "react";
import {
  MapPin,
  Users,
  Building2,
  Clock,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  CareAttentionBar,
  CareInfoPopover,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

import { useRegions, type SpaRegion } from "../../hooks/useRegions";
import { SPA_DASHBOARD_URL } from "../../lib/routes";

/** Token-aligned shells — avoids global `.panel-surface` light hairlines on dark backgrounds. */
const regionOverviewShell = "rounded-xl border border-border/55 bg-card/30";

interface RegiosPageProps {
  onRegionClick: (regionId: string) => void;
  onViewGemeenten: (regionId: string) => void;
  onViewProviders: (regionId: string) => void;
  /** SPA shell: navigate to Signalen without full reload. Falls back to `/signalen` if omitted. */
  onNavigateToSignalen?: () => void;
  /** SPA shell: navigate to Matching (kritieke belasting → herverdeling). Falls back to `/matching` if omitted. */
  onNavigateToMatching?: () => void;
}

export function RegiosPage({ 
  onRegionClick,
  onViewGemeenten,
  onViewProviders,
  onNavigateToSignalen,
  onNavigateToMatching,
}: RegiosPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [capacityFilter, setCapacityFilter] = useState<"all" | "stabiel" | "druk" | "tekort" | "kritiek">("all");
  const [sortBy, setSortBy] = useState<"cases" | "capacity" | "waittime">("cases");

  const { regions, loading, error, refetch } = useRegions({ q: searchQuery });

  const openSignalen = useCallback(() => {
    if (onNavigateToSignalen) {
      onNavigateToSignalen();
      return;
    }
    window.location.assign("/signalen");
  }, [onNavigateToSignalen]);

  const openMatching = useCallback(() => {
    if (onNavigateToMatching) {
      onNavigateToMatching();
      return;
    }
    window.location.assign("/matching");
  }, [onNavigateToMatching]);

  const openZorgaanbieders = () => {
    if (regions.length > 0) {
      onViewProviders(regions[0].id);
      return;
    }
    window.location.href = SPA_DASHBOARD_URL;
  };

  // System-level intelligence
  const systemState = useMemo(() => {
    const criticalRegions = regions.filter((region) => region.status === "kritiek");
    const shortageRegions = regions.filter((region) => region.heeft_tekort);
    const busyRegions = regions.filter((region) => region.status === "druk");
    const highWaitRegions = regions.filter((region) => region.heeft_hoge_wachttijd);
    const nearLimitRegions = regions.filter((region) => region.capaciteitsratio < 0.4 && region.actieve_casussen > 0);
    const noProviderRegions = regions.filter((region) => region.urgente_casussen_zonder_match > 0);
    
    const totalCases = regions.reduce((sum, region) => sum + region.actieve_casussen, 0);
    const totalCapacity = regions.reduce((sum, r) => sum + r.totalCapacity, 0);
    const totalUsed = regions.reduce((sum, r) => sum + r.usedCapacity, 0);
    const systemUtilization = totalCapacity > 0
      ? Math.round((totalUsed / totalCapacity) * 100)
      : 0;
    
    return {
      criticalRegions,
      shortageRegions,
      busyRegions,
      highWaitRegions,
      nearLimitRegions,
      noProviderRegions,
      totalCases,
      totalCapacity,
      totalUsed,
      systemUtilization
    };
  }, [regions]);

  const regieSignals = useMemo(() => {
    const signals: Array<{
      id: string;
      message: string;
      actionLabel?: string;
      onAction?: () => void;
    }> = [];

    if (systemState.criticalRegions.length > 0) {
      signals.push({
        id: "critical-health",
        message: `${systemState.criticalRegions.length} regio${systemState.criticalRegions.length === 1 ? "" : "'s"} heeft kritieke belasting`,
        actionLabel: "Naar matching",
        onAction: openMatching,
      });
    }

    if (systemState.nearLimitRegions.length > 0) {
      signals.push({
        id: "near-limit",
        message: `${systemState.nearLimitRegions.length} regio${systemState.nearLimitRegions.length === 1 ? "" : "'s"} onder capaciteitsdruk`,
        actionLabel: "Open regio's",
        onAction: () => setCapacityFilter("druk"),
      });
    }

    if (systemState.noProviderRegions.length > 0) {
      signals.push({
        id: "no-provider",
        message: `${systemState.noProviderRegions.length} regio${systemState.noProviderRegions.length === 1 ? "" : "'s"} heeft geen passende aanbieder`,
        actionLabel: "Ga naar zorgaanbieders",
        onAction: openZorgaanbieders,
      });
    }

    if (systemState.highWaitRegions.length > 0) {
      signals.push({
        id: "wait-rise",
        message: `Wachttijd stijgt in ${systemState.highWaitRegions.length} regio${systemState.highWaitRegions.length === 1 ? "" : "'s"}`,
        actionLabel: "Ga naar signalen",
        onAction: openSignalen,
      });
    }

    return signals.slice(0, 3);
  }, [systemState, regions, openSignalen, openMatching]);

  // Filter and sort regions
  const filteredRegions = useMemo(() => {
    return regions
      .filter(r => {
        // Search filter
        if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        
        // Capacity filter
        if (capacityFilter !== "all" && r.status !== capacityFilter) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "cases") return b.casesCount - a.casesCount;
        if (sortBy === "capacity") {
          return a.capaciteitsratio - b.capaciteitsratio;
        }
        if (sortBy === "waittime") return b.gemiddelde_wachttijd_dagen - a.gemiddelde_wachttijd_dagen;
        return 0;
      });
  }, [regions, searchQuery, capacityFilter, sortBy]);

  return (
    <CarePageScaffold
      archetype="worklist"
      className="pb-8"
      title="Regio's"
      subtitleInfoTestId="regios-page-info"
      subtitleAriaLabel="Uitleg regio-overzicht"
      subtitle="Structuur- en capaciteitsoverzicht van regio's. Gebruik signalen voor druk, tekort en herverdeling."
      dominantAction={
        <CareAttentionBar
          tone={systemState.criticalRegions.length > 0 || systemState.shortageRegions.length > 0 ? "critical" : "warning"}
          icon={<Activity size={16} />}
          message={
            systemState.criticalRegions.length > 0
              ? systemState.criticalRegions.length === 1
                ? "1 regio met kritieke druk — bekijk signalen en capaciteit"
                : `${systemState.criticalRegions.length} regio's met kritieke druk — bekijk signalen en capaciteit`
              : systemState.shortageRegions.length > 0
                ? `${systemState.shortageRegions.length} regio's hebben tekort`
                : `${systemState.highWaitRegions.length} regio's hebben hogere wachttijd`
          }
          action={
            <PrimaryActionButton onClick={openSignalen}>
              Ga naar signalen
            </PrimaryActionButton>
          }
        />
      }
    >
      <CareSection>
        <CareSectionHeader
          className="lg:flex-col lg:items-stretch"
          title="Werkvoorraad"
          meta={(
            <div className="w-full min-w-0 space-y-2">
              <span className="inline-flex w-fit items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[12px] font-semibold text-cyan-200">
                {filteredRegions.length} zichtbaar · {systemState.totalCases} casussen · {systemState.systemUtilization}% bezetting
              </span>
              <CareSearchFiltersBar
                className="px-0"
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Zoeken op regio..."
                secondaryFilters={(
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Select value={capacityFilter} onValueChange={setCapacityFilter}>
                      <SelectTrigger className="h-10 w-full border-border bg-card text-foreground hover:bg-muted/35 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30">
                        <SelectValue placeholder="Alle capaciteit statussen" />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-card text-foreground">
                        <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="all">Alle capaciteit statussen</SelectItem>
                        <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="stabiel">Stabiel</SelectItem>
                        <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="druk">Druk</SelectItem>
                        <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="tekort">Tekort</SelectItem>
                        <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="kritiek">Kritiek</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={(v: string) => setSortBy(v as "cases" | "capacity" | "waittime")}>
                      <SelectTrigger className="h-10 w-full border-border bg-card text-foreground hover:bg-muted/35 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30">
                        <SelectValue placeholder="Sorteer op casussen" />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-card text-foreground">
                        <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="cases">Sorteer op casussen</SelectItem>
                        <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="capacity">Sorteer op bezetting</SelectItem>
                        <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="waittime">Sorteer op wachttijd</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            </div>
          )}
        />
        <CareSectionBody className="space-y-4">
      <div className={`${regionOverviewShell} p-4`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Signalen</h2>
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={openSignalen}>
            Ga naar signalen
          </Button>
        </div>

        {regieSignals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen signalen in dit overzicht.</p>
        ) : (
          <div className="space-y-2">
            {regieSignals.map((signal) => (
              <div
                key={signal.id}
                className="flex flex-col gap-2 rounded-lg border border-border/55 bg-muted/15 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <p className="min-w-0 flex-1 text-sm text-foreground">{signal.message}</p>
                {signal.onAction && signal.actionLabel ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full shrink-0 px-3 text-xs sm:w-auto"
                    onClick={signal.onAction}
                  >
                    {signal.actionLabel}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`${regionOverviewShell} p-4`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">Capaciteit verdeling</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Bezetting per regio: hoeveel capaciteit in gebruik is versus beschikbaar.
            </p>
          </div>
          <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-400" /> Normaal
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Druk
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400" /> Tekort
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-600" /> Kritiek
            </span>
          </div>
        </div>

        {filteredRegions.length === 0 ? (
          <div className="rounded-xl border border-border/55 bg-card/30 p-4 text-center">
            <p className="text-sm font-medium text-foreground">Geen capaciteitsdata</p>
            <p className="mt-1 text-xs text-muted-foreground">Koppel aanbieders om de verdeling te tonen.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={openZorgaanbieders}>Ga naar zorgaanbieders</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRegions.map((region) => {
              const utilization = region.totalCapacity > 0
                ? Math.round((region.usedCapacity / region.totalCapacity) * 100)
                : 0;

              return (
                <div key={region.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{region.name}</span>
                    <span className="text-sm text-muted-foreground">{utilization}%</span>
                  </div>

                  <div className="relative h-2 bg-muted/20 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                        region.status === "kritiek" ? "bg-red-600" :
                        utilization >= 90 ? "bg-red-400" :
                        utilization >= 75 ? "bg-amber-400" :
                        "bg-green-400"
                      }`}
                      style={{ width: `${utilization}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{region.usedCapacity} gebruikt</span>
                    <span>{Math.max(region.totalCapacity - region.usedCapacity, 0)} beschikbaar</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">
            Alle regio's
          </h2>
          <span className="text-sm text-muted-foreground">
            {filteredRegions.length} {filteredRegions.length === 1 ? 'regio' : 'regio\'s'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRegions.map((region) => (
            <RegionCard
              key={region.id}
              region={region}
              onClick={() => onRegionClick(region.id)}
              onViewGemeenten={() => onViewGemeenten(region.id)}
              onViewProviders={() => onViewProviders(region.id)}
            />
          ))}
        </div>

        {loading && (
          <LoadingState title="Regio's laden…" copy="Overzicht wordt opgebouwd." />
        )}
        {!loading && error && (
          <ErrorState
            title="Kon regio's niet laden"
            copy={error}
            action={<Button variant="outline" size="sm" onClick={refetch}>Opnieuw proberen</Button>}
          />
        )}
        {!loading && !error && filteredRegions.length === 0 && (
          <EmptyState
            title="Geen regio's"
            copy="Er zijn geen regio's die passen bij de huidige filters."
            action={(
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                setSearchQuery("");
                setCapacityFilter("all");
              }}
            >
              Wis filters
            </Button>
            )}
          />
        )}
      </div>
      </CareSectionBody>
      </CareSection>
    </CarePageScaffold>
  );
}

// Region Card Component
interface RegionCardProps {
  region: SpaRegion;
  onClick: () => void;
  onViewGemeenten: () => void;
  onViewProviders: () => void;
}

function RegionCard({ region, onClick, onViewGemeenten, onViewProviders }: RegionCardProps) {
  const utilization = region.totalCapacity > 0
    ? Math.round((region.usedCapacity / region.totalCapacity) * 100)
    : 0;
  
  const statusConfig = {
    stabiel: {
      label: "Stabiel",
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/30"
    },
    druk: {
      label: "Druk",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30"
    },
    tekort: {
      label: "Tekort",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/30"
    },
    kritiek: {
      label: "Kritiek",
      color: "text-red-300",
      bg: "bg-red-600/15",
      border: "border-red-500/50"
    }
  };

  const status = statusConfig[region.status];
  const hasCapacityData = region.totalCapacity > 0;
  const hasWaitData = region.gemiddelde_wachttijd_dagen > 0;

  return (
    <div className={`${regionOverviewShell} p-4 transition-all hover:bg-muted/15 group`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <button
            onClick={onClick}
            className="text-lg font-bold text-foreground hover:text-primary transition-colors text-left"
          >
            {region.name}
          </button>
          
          {/* Status Badge */}
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded mt-2 border ${status.bg} ${status.border}`}>
            <Activity size={12} className={status.color} />
            <span className={`text-xs font-semibold ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Trend Indicator */}
        {region.trend === "up" && (
          <TrendingUp size={18} className="text-red-400" />
        )}
        {region.trend === "down" && (
          <TrendingDown size={18} className="text-green-400" />
        )}
        {region.trend === "stable" && (
          <Activity size={18} className="text-muted-foreground" />
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Casussen</p>
          <p className="text-xl font-bold text-foreground">{region.actieve_casussen}</p>
        </div>
        
        <div>
          <p className="text-xs text-muted-foreground mb-1">Gem. wachttijd</p>
          <p className={`text-xl font-bold ${
            hasWaitData && region.gemiddelde_wachttijd_dagen > 14 ? "text-red-400" : "text-foreground"
          }`}>
            {hasWaitData ? `${region.gemiddelde_wachttijd_dagen}d` : "—"}
          </p>
        </div>
        
        <div>
          <p className="text-xs text-muted-foreground mb-1">Gemeenten</p>
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">{region.gemeentenCount}</p>
          </div>
        </div>
        
        <div>
          <p className="text-xs text-muted-foreground mb-1">Aanbieders</p>
          <div className="flex items-center gap-1.5">
            <Building2 size={14} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">{region.providersCount}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border/55 bg-card/35 p-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Beschikbaar</p>
            <p className="mt-1 font-semibold text-foreground">{hasCapacityData ? region.beschikbare_capaciteit : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ratio</p>
            <p className="mt-1 font-semibold text-foreground">{region.actieve_casussen > 0 ? region.capaciteitsratio.toFixed(2) : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className={`mt-1 font-semibold ${status.color}`}>{status.label}</p>
          </div>
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">{region.signaal_samenvatting}</p>

      {/* Capacity Bar */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Capaciteit</p>
          <p className="text-xs font-semibold text-foreground">{utilization}%</p>
        </div>
        
        <div className="relative h-2 bg-muted/20 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
              utilization >= 90 ? "bg-red-400" :
              utilization >= 75 ? "bg-amber-400" :
              "bg-green-400"
            }`}
            style={{ width: `${utilization}%` }}
          />
        </div>
        
        <p className="text-xs text-muted-foreground">
          {hasCapacityData ? `${region.beschikbare_capaciteit} beschikbaar, ${region.actieve_casussen} actief` : "Capaciteit nog niet ingesteld"}
        </p>
      </div>

      <div className="flex gap-2 border-t border-border/50 pt-4">
        <Button onClick={onClick} className="flex-1">Open regio</Button>
        <Button variant="ghost" onClick={onViewProviders} className="flex-1">Aanbieders</Button>
      </div>
    </div>
  );
}
