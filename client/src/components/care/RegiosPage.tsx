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

import { useState, useMemo } from "react";
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
import { CareSearchFiltersBar } from "./CareUnifiedPage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

import { useRegions, type SpaRegion } from "../../hooks/useRegions";
import { Loader2 } from "lucide-react";
import { SPA_DASHBOARD_URL } from "../../lib/routes";

interface RegiosPageProps {
  onRegionClick: (regionId: string) => void;
  onViewGemeenten: (regionId: string) => void;
  onViewProviders: (regionId: string) => void;
}

export function RegiosPage({ 
  onRegionClick,
  onViewGemeenten,
  onViewProviders
}: RegiosPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [capacityFilter, setCapacityFilter] = useState<"all" | "stabiel" | "druk" | "tekort" | "kritiek">("all");
  const [sortBy, setSortBy] = useState<"cases" | "capacity" | "waittime">("cases");

  const { regions, loading, error, refetch } = useRegions({ q: searchQuery });

  const openCasussen = () => {
    window.location.href = "/care/casussen/";
  };

  const openSignalen = () => {
    window.location.href = "/care/signalen/";
  };

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
        onAction: () => openSignalen(),
      });
    }

    if (systemState.nearLimitRegions.length > 0) {
      signals.push({
        id: "near-limit",
        message: `${systemState.nearLimitRegions.length} regio${systemState.nearLimitRegions.length === 1 ? "" : "'s"} onder capaciteitsdruk`,
        actionLabel: "Bekijk regio's",
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
  }, [systemState, regions]);

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
    <div className="space-y-6 pb-24">
      
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Regio's
        </h1>
        <p className="text-sm text-muted-foreground">
          Overzicht van capaciteit en casussen per regio
        </p>
      </div>

      {/* SYSTEM-LEVEL STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="premium-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Totaal casussen</p>
          <p className="text-2xl font-bold text-foreground">{systemState.totalCases}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {regions.length} regio's
          </p>
        </div>
        
        <div className="premium-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Systeem bezetting</p>
          <p className="text-2xl font-bold text-foreground">{systemState.systemUtilization}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            {systemState.totalUsed} / {systemState.totalCapacity}
          </p>
        </div>
        
        <div className="premium-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Regio's met tekort</p>
          <p className={`text-2xl font-bold ${systemState.shortageRegions.length > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {systemState.shortageRegions.length}
          </p>
          <p className={`text-xs mt-1 ${systemState.shortageRegions.length > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {systemState.shortageRegions.length > 0 ? "Actie vereist" : "Geen knelpunten"}
          </p>
          {systemState.shortageRegions.length > 0 && (
            <button
              type="button"
              onClick={() => setCapacityFilter("tekort")}
              className="mt-2 text-xs text-primary hover:text-primary/80"
            >
              Bekijk regio's
            </button>
          )}
        </div>
        
        <div className="premium-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Hoge wachttijd</p>
          <p className={`text-2xl font-bold ${systemState.highWaitRegions.length > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {systemState.highWaitRegions.length}
          </p>
          <p className={`text-xs mt-1 ${systemState.highWaitRegions.length > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {systemState.highWaitRegions.length > 0 ? "Boven norm" : "Binnen norm"}
          </p>
          {systemState.highWaitRegions.length > 0 && (
            <button
              type="button"
              onClick={() => setSortBy("waittime")}
              className="mt-2 text-xs text-primary hover:text-primary/80"
            >
              Bekijk regio's
            </button>
          )}
        </div>
      </div>

      {/* REGIE SIGNALS */}
      <div className="premium-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Regie inzicht</h2>
          <button
            type="button"
            onClick={openSignalen}
            className="text-xs text-primary hover:text-primary/80"
          >
            Ga naar signalen
          </button>
        </div>

        {regieSignals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen capaciteitsproblemen gedetecteerd</p>
        ) : (
          <div className="space-y-2">
            {regieSignals.map((signal) => (
              <div key={signal.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/35 px-3 py-2">
                <p className="text-sm text-foreground">{signal.message}</p>
                {signal.onAction && signal.actionLabel && (
                  <button
                    type="button"
                    onClick={signal.onAction}
                    className="text-xs text-primary hover:text-primary/80"
                  >
                    {signal.actionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SEARCH + FILTERS */}
      <div className="space-y-3">
        <CareSearchFiltersBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Zoek regio..."
        />
        <div className="flex flex-col gap-3 px-1 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={capacityFilter} onValueChange={setCapacityFilter}>
            <SelectTrigger className="w-full border-border bg-card text-foreground hover:bg-muted/35 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30 sm:w-56">
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
            <SelectTrigger className="w-full border-border bg-card text-foreground hover:bg-muted/35 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30 sm:w-52">
              <SelectValue placeholder="Sorteer op casussen" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card text-foreground">
              <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="cases">Sorteer op casussen</SelectItem>
              <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="capacity">Sorteer op bezetting</SelectItem>
              <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="waittime">Sorteer op wachttijd</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* VISUALIZATION - HEAT INDICATORS */}
      <div className="premium-card p-6">
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
          <div className="rounded-xl border border-border bg-card/30 p-6 text-center">
            <p className="text-sm font-medium text-foreground">Nog geen capaciteitsdata beschikbaar</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Zodra aanbieders en casussen gekoppeld zijn aan regio's, tonen we hier de bezettingsverdeling.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={openZorgaanbieders}>Ga naar zorgaanbieders</Button>
              <Button variant="outline" size="sm" onClick={openCasussen}>Ga naar casussen</Button>
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

      {/* REGION CARDS */}
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
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" />
            <span>Regio's laden…</span>
          </div>
        )}
        {error && (
          <div className="premium-card p-6 text-center text-destructive space-y-2">
            <p>Kon regio's niet laden: {error}</p>
            <button className="text-sm underline" onClick={refetch}>Opnieuw proberen</button>
          </div>
        )}
        {!loading && !error && filteredRegions.length === 0 && (
          <div className="premium-card p-12 text-center">
            <p className="text-base font-semibold text-foreground">
              Geen regio's beschikbaar
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Er zijn nog geen regio's met gekoppelde casussen of capaciteit.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setCapacityFilter("all");
              }}
            >
              Filters wissen
            </Button>
          </div>
        )}
      </div>
    </div>
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
    <div className="premium-card p-5 hover:bg-muted/20 transition-all group">
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

      <div className="mb-4 rounded-lg border border-border bg-card/35 p-3">
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

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-border">
        <button
          onClick={onViewGemeenten}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors"
        >
          <MapPin size={14} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Gemeenten</span>
        </button>
        
        <button
          onClick={onViewProviders}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors"
        >
          <Building2 size={14} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Aanbieders</span>
        </button>
      </div>
    </div>
  );
}
