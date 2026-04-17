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
  Search,
  MapPin,
  Users,
  Building2,
  Clock,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity
} from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

// AI Components
import { SystemInsight } from "../ai";

interface Region {
  id: string;
  name: string;
  casesCount: number;
  gemeentenCount: number;
  providersCount: number;
  avgWaitingTime: number;
  capacityStatus: "normal" | "busy" | "shortage";
  totalCapacity: number;
  usedCapacity: number;
  trend: "up" | "down" | "stable";
}

// Mock regional data
const mockRegions: Region[] = [
  {
    id: "utrecht",
    name: "Utrecht",
    casesCount: 87,
    gemeentenCount: 26,
    providersCount: 34,
    avgWaitingTime: 8,
    capacityStatus: "shortage",
    totalCapacity: 120,
    usedCapacity: 105,
    trend: "up"
  },
  {
    id: "amsterdam",
    name: "Amsterdam",
    casesCount: 132,
    gemeentenCount: 15,
    providersCount: 52,
    avgWaitingTime: 5,
    capacityStatus: "busy",
    totalCapacity: 180,
    usedCapacity: 142,
    trend: "up"
  },
  {
    id: "rotterdam",
    name: "Rotterdam",
    casesCount: 95,
    gemeentenCount: 18,
    providersCount: 41,
    avgWaitingTime: 6,
    capacityStatus: "normal",
    totalCapacity: 150,
    usedCapacity: 98,
    trend: "stable"
  },
  {
    id: "den-haag",
    name: "Den Haag",
    casesCount: 78,
    gemeentenCount: 12,
    providersCount: 29,
    avgWaitingTime: 7,
    capacityStatus: "normal",
    totalCapacity: 110,
    usedCapacity: 81,
    trend: "down"
  },
  {
    id: "eindhoven",
    name: "Eindhoven",
    casesCount: 64,
    gemeentenCount: 21,
    providersCount: 28,
    avgWaitingTime: 9,
    capacityStatus: "shortage",
    totalCapacity: 90,
    usedCapacity: 78,
    trend: "up"
  },
  {
    id: "groningen",
    name: "Groningen",
    casesCount: 52,
    gemeentenCount: 19,
    providersCount: 22,
    avgWaitingTime: 5,
    capacityStatus: "normal",
    totalCapacity: 85,
    usedCapacity: 55,
    trend: "stable"
  }
];

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
  const [capacityFilter, setCapacityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"cases" | "capacity" | "waittime">("cases");

  // System-level intelligence
  const systemState = useMemo(() => {
    const shortageRegions = mockRegions.filter(r => r.capacityStatus === "shortage");
    const busyRegions = mockRegions.filter(r => r.capacityStatus === "busy");
    const highWaitRegions = mockRegions.filter(r => r.avgWaitingTime > 7);
    
    const totalCases = mockRegions.reduce((sum, r) => sum + r.casesCount, 0);
    const totalCapacity = mockRegions.reduce((sum, r) => sum + r.totalCapacity, 0);
    const totalUsed = mockRegions.reduce((sum, r) => sum + r.usedCapacity, 0);
    const systemUtilization = Math.round((totalUsed / totalCapacity) * 100);
    
    return {
      shortageRegions,
      busyRegions,
      highWaitRegions,
      totalCases,
      totalCapacity,
      totalUsed,
      systemUtilization
    };
  }, []);

  // Filter and sort regions
  const filteredRegions = useMemo(() => {
    return mockRegions
      .filter(r => {
        // Search filter
        if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        
        // Capacity filter
        if (capacityFilter !== "all" && r.capacityStatus !== capacityFilter) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "cases") return b.casesCount - a.casesCount;
        if (sortBy === "capacity") {
          const aUtil = (a.usedCapacity / a.totalCapacity);
          const bUtil = (b.usedCapacity / b.totalCapacity);
          return bUtil - aUtil;
        }
        if (sortBy === "waittime") return b.avgWaitingTime - a.avgWaitingTime;
        return 0;
      });
  }, [searchQuery, capacityFilter, sortBy]);

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
            {mockRegions.length} regio's
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
          <p className="text-2xl font-bold text-red-400">{systemState.shortageRegions.length}</p>
          <p className="text-xs text-red-400 mt-1">
            {systemState.shortageRegions.map(r => r.name).join(", ") || "Geen"}
          </p>
        </div>
        
        <div className="premium-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Hoge wachttijd</p>
          <p className="text-2xl font-bold text-amber-400">{systemState.highWaitRegions.length}</p>
          <p className="text-xs text-amber-400 mt-1">
            {systemState.highWaitRegions.length > 0 ? ">7 dagen gemiddeld" : "Binnen norm"}
          </p>
        </div>
      </div>

      {/* SYSTEM INSIGHTS */}
      {systemState.shortageRegions.length > 0 && (
        <SystemInsight
          type="warning"
          message={`${systemState.shortageRegions.length} regio's hebben capaciteitstekort: ${systemState.shortageRegions.map(r => r.name).join(", ")}`}
        />
      )}

      {systemState.systemUtilization > 85 && (
        <SystemInsight
          type="warning"
          message={`Systeem bezetting is ${systemState.systemUtilization}% - boven advies norm van 85%`}
        />
      )}

      {/* SEARCH + FILTERS */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Zoek regio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Capacity Filter */}
        <select
          value={capacityFilter}
          onChange={(e) => setCapacityFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-card border border-border text-foreground text-sm"
        >
          <option value="all">Alle capaciteit statussen</option>
          <option value="normal">Normaal</option>
          <option value="busy">Druk</option>
          <option value="shortage">Tekort</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-2 rounded-lg bg-card border border-border text-foreground text-sm"
        >
          <option value="cases">Sorteer op casussen</option>
          <option value="capacity">Sorteer op bezetting</option>
          <option value="waittime">Sorteer op wachttijd</option>
        </select>
      </div>

      {/* VISUALIZATION - HEAT INDICATORS */}
      <div className="premium-card p-6">
        <h2 className="text-sm font-bold text-foreground mb-4">Capaciteit verdeling</h2>
        
        <div className="space-y-3">
          {filteredRegions.map((region) => {
            const utilization = Math.round((region.usedCapacity / region.totalCapacity) * 100);
            
            return (
              <div key={region.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{region.name}</span>
                  <span className="text-sm text-muted-foreground">{utilization}%</span>
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
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{region.usedCapacity} gebruikt</span>
                  <span>{region.totalCapacity - region.usedCapacity} beschikbaar</span>
                </div>
              </div>
            );
          })}
        </div>
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

        {filteredRegions.length === 0 && (
          <div className="premium-card p-12 text-center">
            <p className="text-muted-foreground">
              Geen regio's gevonden met de huidige filters
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
              Reset filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Region Card Component
interface RegionCardProps {
  region: Region;
  onClick: () => void;
  onViewGemeenten: () => void;
  onViewProviders: () => void;
}

function RegionCard({ region, onClick, onViewGemeenten, onViewProviders }: RegionCardProps) {
  const utilization = Math.round((region.usedCapacity / region.totalCapacity) * 100);
  
  const statusConfig = {
    normal: {
      label: "Normaal",
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/30"
    },
    busy: {
      label: "Druk",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30"
    },
    shortage: {
      label: "Tekort",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/30"
    }
  };

  const status = statusConfig[region.capacityStatus];

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
          <p className="text-xl font-bold text-foreground">{region.casesCount}</p>
        </div>
        
        <div>
          <p className="text-xs text-muted-foreground mb-1">Gem. wachttijd</p>
          <p className={`text-xl font-bold ${
            region.avgWaitingTime > 7 ? "text-red-400" : "text-foreground"
          }`}>
            {region.avgWaitingTime}d
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
          {region.usedCapacity} / {region.totalCapacity} in gebruik
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
