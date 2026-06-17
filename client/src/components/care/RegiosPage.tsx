import { useState, useMemo, useCallback } from "react";
import {
  MapPin,
  Building2,
  Activity,
  ChevronRight,
  ChevronDown,
  Check,
  TrendingUp,
  TrendingDown,
  Search,
} from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  CareInfoPopover,
  CareQueueInlineAction,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import {
  CareCommandShell,
  CareMetricStrip,
  CareMetricCard,
  CareWorklistFilterPanel,
} from "./CareCommandPrimitives";
import { useRegions, type SpaRegion } from "../../hooks/useRegions";
import { SPA_DASHBOARD_URL } from "../../lib/routes";

const regionOverviewShell = "rounded-[16px] border border-border/55 bg-card/30";

const selectTriggerClass = "h-10 w-full border-border bg-card text-foreground hover:bg-muted/35 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30";

interface RegiosPageProps {
  onRegionClick: (regionId: string) => void;
  onViewGemeenten: (regionId: string) => void;
  onViewProviders: (regionId: string) => void;
  onNavigateToSignalen?: () => void;
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
  const [showFilters, setShowFilters] = useState(false);
  const [capacityFilter, setCapacityFilter] = useState<"all" | "stabiel" | "druk" | "tekort" | "kritiek">("all");
  const [sortBy, setSortBy] = useState<"cases" | "capacity" | "waittime">("cases");

  const { regions, loading, error, refetch } = useRegions({ q: searchQuery, regionType: "JEUGDREGIO" });

  const openSignalen = useCallback(() => {
    if (onNavigateToSignalen) { onNavigateToSignalen(); return; }
    window.location.assign("/signalen");
  }, [onNavigateToSignalen]);

  const openMatching = useCallback(() => {
    if (onNavigateToMatching) { onNavigateToMatching(); return; }
    window.location.assign("/matching");
  }, [onNavigateToMatching]);

  const openZorgaanbieders = (regionId?: string) => {
    if (regionId) { onViewProviders(regionId); return; }
    if (regions.length > 0) { onViewProviders(regions[0].id); return; }
    window.location.href = SPA_DASHBOARD_URL;
  };

  const systemState = useMemo(() => {
    const criticalRegions = regions.filter((r) => r.status === "kritiek");
    const shortageRegions = regions.filter((r) => r.heeft_tekort);
    const busyRegions = regions.filter((r) => r.status === "druk");
    const highWaitRegions = regions.filter((r) => r.heeft_hoge_wachttijd);
    const nearLimitRegions = regions.filter((r) => r.capaciteitsratio < 0.4 && r.actieve_casussen > 0);
    const noProviderRegions = regions.filter((r) => r.urgente_casussen_zonder_match > 0);
    const totalCases = regions.reduce((sum, r) => sum + r.actieve_casussen, 0);
    const totalCapacity = regions.reduce((sum, r) => sum + r.totalCapacity, 0);
    const totalUsed = regions.reduce((sum, r) => sum + r.usedCapacity, 0);
    const systemUtilization = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;
    return { criticalRegions, shortageRegions, busyRegions, highWaitRegions, nearLimitRegions, noProviderRegions, totalCases, totalCapacity, totalUsed, systemUtilization };
  }, [regions]);

  const coordinationSignals = useMemo(() => {
    const signals: Array<{ id: string; message: string; actionLabel?: string; onAction?: () => void }> = [];
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
      const affectedRegionId = systemState.noProviderRegions[0]?.id;
      signals.push({
        id: "no-provider",
        message: `${systemState.noProviderRegions.length} regio${systemState.noProviderRegions.length === 1 ? "" : "'s"} heeft geen passende aanbieder`,
        actionLabel: "Ga naar zorgaanbieders",
        onAction: () => openZorgaanbieders(affectedRegionId),
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

  const filteredRegions = useMemo(() => {
    return regions
      .filter((r) => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        if (normalizedQuery && !r.name.toLowerCase().includes(normalizedQuery) && !r.code.toLowerCase().includes(normalizedQuery)) return false;
        if (capacityFilter !== "all" && r.status !== capacityFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "cases") return b.casesCount - a.casesCount;
        if (sortBy === "capacity") return a.capaciteitsratio - b.capaciteitsratio;
        if (sortBy === "waittime") return b.gemiddelde_wachttijd_dagen - a.gemiddelde_wachttijd_dagen;
        return 0;
      });
  }, [regions, searchQuery, capacityFilter, sortBy]);

  return (
    <CareCommandShell
      title="Regio's"
      actions={
        <Button variant="outline" onClick={() => void refetch()}>Ververs</Button>
      }
    >
      <CareMetricStrip>
        <CareMetricCard
          value={systemState.criticalRegions.length}
          label="Kritiek"
          tone="urgent"
          isActive={capacityFilter === "kritiek"}
          onClick={() => setCapacityFilter((f) => (f === "kritiek" ? "all" : "kritiek"))}
        />
        <CareMetricCard
          value={systemState.shortageRegions.length}
          label="Tekort"
          tone="warning"
          isActive={capacityFilter === "tekort"}
          onClick={() => setCapacityFilter((f) => (f === "tekort" ? "all" : "tekort"))}
        />
        <CareMetricCard
          value={`${systemState.totalCases} (${systemState.systemUtilization}%)`}
          label="Aanvragen · bezetting"
          tone="neutral"
          isActive={capacityFilter === "all"}
          onClick={() => setCapacityFilter("all")}
        />
      </CareMetricStrip>

      <div data-testid="regios-netwerk" className="space-y-4">
        {/* Controls row */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <RegionTypeahead regions={regions} value={searchQuery} onChange={setSearchQuery} />
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-border/60 bg-card/35 px-3 text-[13px] font-medium text-primary shadow-sm transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              Filters
              <ChevronDown size={14} className={showFilters ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
            </button>
            {searchQuery ? (
              <Button type="button" variant="ghost" className="h-10 px-3 text-[13px] font-medium text-muted-foreground" onClick={() => setSearchQuery("")}>
                Wis jeugdregio
              </Button>
            ) : null}
          </div>
        </div>

        <CareWorklistFilterPanel open={showFilters}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select value={capacityFilter} onValueChange={setCapacityFilter as any}>
              <SelectTrigger className={selectTriggerClass}>
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
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Sorteer op aanvragen" />
              </SelectTrigger>
              <SelectContent className="border-border bg-card text-foreground">
                <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="cases">Sorteer op aanvragen</SelectItem>
                <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="capacity">Sorteer op bezetting</SelectItem>
                <SelectItem className="text-foreground focus:bg-muted focus:text-foreground" value="waittime">Sorteer op wachttijd</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CareWorklistFilterPanel>

        {/* Signalen panel */}
        <div className={`${regionOverviewShell} p-4`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-foreground">Signalen</h2>
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={openSignalen}>
              Ga naar signalen
            </Button>
          </div>
          {coordinationSignals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen signalen in dit overzicht.</p>
          ) : (
            <div className="space-y-2">
              {coordinationSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="flex flex-col gap-2 rounded-[10px] border border-border/55 bg-muted/15 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <p className="min-w-0 flex-1 text-sm text-foreground">{signal.message}</p>
                  {signal.onAction && signal.actionLabel ? (
                    <Button type="button" variant="outline" size="sm" className="h-8 w-full shrink-0 px-3 text-xs sm:w-auto" onClick={signal.onAction}>
                      {signal.actionLabel}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Capaciteit panel */}
        <div className={`${regionOverviewShell} p-4`}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-foreground">Capaciteit verdeling</h2>
              <p className="mt-1 text-xs text-muted-foreground">Bezetting per regio: hoeveel capaciteit in gebruik is versus beschikbaar.</p>
            </div>
            <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-care-success-solid" /> Normaal</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-care-warning-solid" /> Druk</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-care-urgent-solid" /> Tekort</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-care-urgent-solid opacity-80" /> Kritiek</span>
            </div>
          </div>

          {filteredRegions.length === 0 ? (
            <div className="rounded-[16px] border border-border/55 bg-card/30 p-4 text-center">
              <p className="text-sm font-medium text-foreground">Geen capaciteitsdata</p>
              <p className="mt-1 text-xs text-muted-foreground">Koppel aanbieders om de verdeling te tonen.</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={openZorgaanbieders as any}>Ga naar zorgaanbieders</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRegions.map((region) => {
                const utilization = region.totalCapacity > 0 ? Math.round((region.usedCapacity / region.totalCapacity) * 100) : 0;
                return (
                  <div key={region.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{region.name}</span>
                      <span className="text-sm text-muted-foreground">{utilization}%</span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-muted/20">
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                          region.status === "kritiek" ? "bg-care-urgent-solid opacity-80" :
                          utilization >= 90 ? "bg-care-urgent-solid" :
                          utilization >= 75 ? "bg-care-warning-solid" :
                          "bg-care-success-solid",
                        )}
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

        {/* Region cards */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">Alle regio's</h2>
            <span className="text-sm text-muted-foreground">
              {filteredRegions.length} {filteredRegions.length === 1 ? "regio" : "regio's"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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

          {loading && <LoadingState title="Regio's laden…" copy="Overzicht wordt opgebouwd." />}
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
              action={
                <Button variant="outline" size="sm" className="mt-2" onClick={() => { setSearchQuery(""); setCapacityFilter("all"); }}>
                  Wis filters
                </Button>
              }
            />
          )}
        </div>
      </div>
    </CareCommandShell>
  );
}

interface RegionCardProps {
  region: SpaRegion;
  onClick: () => void;
  onViewGemeenten: () => void;
  onViewProviders: () => void;
}

function RegionCard({ region, onClick, onViewGemeenten, onViewProviders }: RegionCardProps) {
  const utilization = region.totalCapacity > 0 ? Math.round((region.usedCapacity / region.totalCapacity) * 100) : 0;

  const statusConfig = {
    stabiel: { label: "Stabiel", color: "text-care-success-solid", bg: "bg-care-success-bg", border: "border-care-success-border" },
    druk: { label: "Druk", color: "text-care-warning-solid", bg: "bg-care-warning-bg", border: "border-care-warning-border" },
    tekort: { label: "Tekort", color: "text-care-urgent-solid", bg: "bg-care-urgent-bg", border: "border-care-urgent-border" },
    kritiek: { label: "Kritiek", color: "text-care-urgent-solid", bg: "bg-care-urgent-bg", border: "border-care-urgent-border" },
  };

  const status = statusConfig[region.status];
  const hasCapacityData = region.totalCapacity > 0;
  const hasWaitData = region.gemiddelde_wachttijd_dagen > 0;

  return (
    <div className={`${regionOverviewShell} p-4 transition-all hover:bg-muted/15 group`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <button onClick={onClick} className="text-lg font-medium text-foreground hover:text-primary transition-colors text-left">
            {region.name}
          </button>
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded mt-2 border ${status.bg} ${status.border}`}>
            <Activity size={12} className={status.color} />
            <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
          </div>
        </div>
        {region.trend === "up" && <TrendingUp size={18} className="text-care-urgent-solid" />}
        {region.trend === "down" && <TrendingDown size={18} className="text-care-success-solid" />}
        {region.trend === "stable" && <Activity size={18} className="text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Aanvragen</p>
          <p className="text-xl font-medium text-foreground">{region.actieve_casussen}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Gem. wachttijd</p>
          <p className={`text-xl font-medium ${hasWaitData && region.gemiddelde_wachttijd_dagen > 14 ? "text-care-urgent-solid" : "text-foreground"}`}>
            {hasWaitData ? `${region.gemiddelde_wachttijd_dagen}d` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Gemeenten</p>
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{region.gemeentenCount}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Aanbieders</p>
          <div className="flex items-center gap-1.5">
            <Building2 size={14} className="text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{region.providersCount}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-[10px] border border-border/55 bg-card/35 p-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Beschikbaar</p>
            <p className="mt-1 font-medium text-foreground">{hasCapacityData ? region.beschikbare_capaciteit : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ratio</p>
            <p className="mt-1 font-medium text-foreground">{region.actieve_casussen > 0 ? region.capaciteitsratio.toFixed(2) : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className={`mt-1 font-medium ${status.color}`}>{status.label}</p>
          </div>
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">{region.signaal_samenvatting}</p>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Capaciteit</p>
          <p className="text-xs font-medium text-foreground">{utilization}%</p>
        </div>
        <div className="relative h-2 bg-muted/20 rounded-full overflow-hidden">
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
              utilization >= 90 ? "bg-care-urgent-solid" :
              utilization >= 75 ? "bg-care-warning-solid" :
              "bg-care-success-solid",
            )}
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

function RegionTypeahead({
  regions,
  value,
  onChange,
}: {
  regions: SpaRegion[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const normalizedQuery = value.trim().toLowerCase();

  const filteredRegions = useMemo(() => {
    if (!normalizedQuery) return regions;
    return regions.filter((r) => r.name.toLowerCase().includes(normalizedQuery) || r.code.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, regions]);

  const selectedLabel = useMemo(() => {
    if (!value.trim()) return "";
    const exactMatch = regions.find((r) => r.name.trim().toLowerCase() === normalizedQuery || r.code.trim().toLowerCase() === normalizedQuery);
    return exactMatch?.name ?? value;
  }, [normalizedQuery, regions, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Zoek jeugdregio"
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex h-10 min-w-0 flex-1 items-center justify-between gap-3 rounded-[10px] border border-border/60 bg-card/55 px-3 text-left text-[13px] shadow-sm transition-colors hover:bg-muted/30"
        >
          <span className={value ? "truncate text-foreground" : "truncate text-muted-foreground"}>
            {selectedLabel || "Zoek jeugdregio..."}
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Search size={16} aria-hidden />
            <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] rounded-[20px] border border-border/80 bg-card p-0 shadow-xl" align="start">
        <Command shouldFilter={false} className="rounded-[20px]">
          <CommandInput value={value} onValueChange={onChange} placeholder="Typ een jeugdregio..." />
          <CommandList>
            <CommandEmpty>Geen jeugdregio gevonden.</CommandEmpty>
            <CommandGroup>
              {filteredRegions.map((region) => {
                const active = normalizedQuery === region.name.toLowerCase() || normalizedQuery === region.code.toLowerCase();
                return (
                  <CommandItem
                    key={region.id}
                    value={region.name}
                    onSelect={() => { onChange(region.name); setOpen(false); }}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{region.name}</span>
                    {active ? <Check size={14} className="text-primary" aria-hidden /> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
