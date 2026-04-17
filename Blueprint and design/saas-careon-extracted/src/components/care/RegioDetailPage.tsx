/**
 * RegioDetailPage - Detailed Regional View
 * 
 * Deep-dive into a specific region showing:
 * - Overview statistics
 * - Municipalities in this region
 * - Providers in this region
 * - Capacity signals and bottlenecks
 */

import { useState } from "react";
import { 
  ArrowLeft,
  MapPin,
  Building2,
  Users,
  Clock,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Filter
} from "lucide-react";
import { Button } from "../ui/button";
import { SystemInsight } from "../ai";

interface Gemeente {
  id: string;
  name: string;
  casesCount: number;
  status: "normal" | "busy" | "problem";
}

interface Provider {
  id: string;
  name: string;
  type: string;
  capacity: number;
  used: number;
  availableSpots: number;
}

interface RegioDetail {
  id: string;
  name: string;
  casesCount: number;
  totalCapacity: number;
  usedCapacity: number;
  avgWaitingTime: number;
  capacityStatus: "normal" | "busy" | "shortage";
  gemeenten: Gemeente[];
  providers: Provider[];
  signals: {
    type: "warning" | "info" | "critical";
    message: string;
  }[];
}

// Mock data
const mockRegioDetail: RegioDetail = {
  id: "utrecht",
  name: "Utrecht",
  casesCount: 87,
  totalCapacity: 120,
  usedCapacity: 105,
  avgWaitingTime: 8,
  capacityStatus: "shortage",
  gemeenten: [
    { id: "utrecht-stad", name: "Utrecht (stad)", casesCount: 45, status: "busy" },
    { id: "amersfoort", name: "Amersfoort", casesCount: 23, status: "normal" },
    { id: "nieuwegein", name: "Nieuwegein", casesCount: 12, status: "normal" },
    { id: "veenendaal", name: "Veenendaal", casesCount: 7, status: "problem" }
  ],
  providers: [
    { 
      id: "p1", 
      name: "Jeugdzorg Plus Utrecht", 
      type: "Residentieel",
      capacity: 30,
      used: 28,
      availableSpots: 2
    },
    { 
      id: "p2", 
      name: "Ambulante Zorg Utrecht", 
      type: "Ambulant",
      capacity: 45,
      used: 38,
      availableSpots: 7
    },
    { 
      id: "p3", 
      name: "Thuisbegeleiding Centraal", 
      type: "Thuisbegeleiding",
      capacity: 25,
      used: 22,
      availableSpots: 3
    },
    { 
      id: "p4", 
      name: "Crisis Interventie Utrecht", 
      type: "Crisis",
      capacity: 20,
      used: 17,
      availableSpots: 3
    }
  ],
  signals: [
    {
      type: "critical",
      message: "Capaciteitstekort: 15 casussen wachten op plaatsing zonder beschikbare plekken"
    },
    {
      type: "warning",
      message: "Gemiddelde wachttijd (8 dagen) ligt boven norm van 7 dagen"
    },
    {
      type: "info",
      message: "Gemeente Veenendaal heeft verhoogd aantal casussen (+40% afgelopen maand)"
    }
  ]
};

interface RegioDetailPageProps {
  regionId: string;
  onBack: () => void;
  onGemeenteClick: (gemeenteId: string) => void;
  onProviderClick: (providerId: string) => void;
  onViewAllGemeenten: () => void;
  onViewAllProviders: () => void;
}

export function RegioDetailPage({
  regionId,
  onBack,
  onGemeenteClick,
  onProviderClick,
  onViewAllGemeenten,
  onViewAllProviders
}: RegioDetailPageProps) {
  const region = mockRegioDetail; // In real app, fetch by regionId
  const utilization = Math.round((region.usedCapacity / region.totalCapacity) * 100);

  const [gemeenteFilter, setGemeenteFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");

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

  const filteredGemeenten = region.gemeenten.filter(g => 
    gemeenteFilter === "all" || g.status === gemeenteFilter
  );

  const filteredProviders = region.providers.filter(p => {
    if (providerFilter === "all") return true;
    if (providerFilter === "available") return p.availableSpots > 0;
    if (providerFilter === "full") return p.availableSpots === 0;
    return true;
  });

  return (
    <div className="space-y-6 pb-24">
      
      {/* TOP BAR */}
      <div className="premium-card p-4 border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="gap-2 hover:bg-primary/10 hover:text-primary"
          >
            <ArrowLeft size={16} />
            Terug naar regio's
          </Button>
        </div>
      </div>

      {/* REGION HEADER */}
      <div className="premium-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {region.name}
            </h1>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${status.bg} ${status.border}`}>
              <Activity size={16} className={status.color} />
              <span className={`text-sm font-semibold ${status.color}`}>
                {status.label}
              </span>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Actieve casussen</p>
            <p className="text-2xl font-bold text-foreground">{region.casesCount}</p>
          </div>
          
          <div>
            <p className="text-xs text-muted-foreground mb-1">Capaciteit</p>
            <p className="text-2xl font-bold text-foreground">{utilization}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {region.usedCapacity} / {region.totalCapacity}
            </p>
          </div>
          
          <div>
            <p className="text-xs text-muted-foreground mb-1">Gem. wachttijd</p>
            <p className={`text-2xl font-bold ${
              region.avgWaitingTime > 7 ? "text-red-400" : "text-foreground"
            }`}>
              {region.avgWaitingTime}d
            </p>
          </div>
          
          <div>
            <p className="text-xs text-muted-foreground mb-1">Beschikbare plekken</p>
            <p className={`text-2xl font-bold ${
              (region.totalCapacity - region.usedCapacity) < 10 ? "text-red-400" : "text-green-400"
            }`}>
              {region.totalCapacity - region.usedCapacity}
            </p>
          </div>
        </div>

        {/* Capacity Visualization */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Capaciteit verdeling</p>
            <p className="text-sm text-muted-foreground">{utilization}% in gebruik</p>
          </div>
          
          <div className="relative h-3 bg-muted/20 rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                utilization >= 90 ? "bg-red-400" :
                utilization >= 75 ? "bg-amber-400" :
                "bg-green-400"
              }`}
              style={{ width: `${utilization}%` }}
            />
          </div>
        </div>
      </div>

      {/* SIGNALS */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Signalen</h2>
        
        <div className="space-y-3">
          {region.signals.map((signal, index) => (
            <SystemInsight
              key={index}
              type={signal.type}
              message={signal.message}
            />
          ))}
        </div>
      </div>

      {/* GEMEENTEN IN REGION */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">
            Gemeenten in {region.name}
          </h2>
          
          <div className="flex items-center gap-3">
            <select
              value={gemeenteFilter}
              onChange={(e) => setGemeenteFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-card border border-border text-foreground text-xs"
            >
              <option value="all">Alle gemeenten</option>
              <option value="normal">Normaal</option>
              <option value="busy">Druk</option>
              <option value="problem">Probleem</option>
            </select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onViewAllGemeenten}
              className="gap-2"
            >
              Bekijk alle gemeenten
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredGemeenten.map((gemeente) => (
            <button
              key={gemeente.id}
              onClick={() => onGemeenteClick(gemeente.id)}
              className="premium-card p-4 hover:bg-muted/20 transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-primary" />
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {gemeente.name}
                  </span>
                </div>
                
                <div className={`w-2 h-2 rounded-full ${
                  gemeente.status === "normal" ? "bg-green-400" :
                  gemeente.status === "busy" ? "bg-amber-400" :
                  "bg-red-400"
                }`} />
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Casussen</p>
                <p className="text-sm font-bold text-foreground">{gemeente.casesCount}</p>
              </div>
            </button>
          ))}
        </div>

        {filteredGemeenten.length === 0 && (
          <div className="premium-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Geen gemeenten gevonden met de huidige filters
            </p>
          </div>
        )}
      </div>

      {/* PROVIDERS IN REGION */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">
            Aanbieders in {region.name}
          </h2>
          
          <div className="flex items-center gap-3">
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-card border border-border text-foreground text-xs"
            >
              <option value="all">Alle aanbieders</option>
              <option value="available">Met capaciteit</option>
              <option value="full">Vol</option>
            </select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onViewAllProviders}
              className="gap-2"
            >
              Bekijk alle aanbieders
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {filteredProviders.map((provider) => {
            const providerUtil = Math.round((provider.used / provider.capacity) * 100);
            
            return (
              <button
                key={provider.id}
                onClick={() => onProviderClick(provider.id)}
                className="w-full premium-card p-4 hover:bg-muted/20 transition-all text-left group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 size={16} className="text-primary" />
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {provider.name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{provider.type}</p>
                  </div>
                  
                  <div className={`px-2 py-1 rounded text-xs font-semibold ${
                    provider.availableSpots > 3 ? "bg-green-500/10 text-green-400" :
                    provider.availableSpots > 0 ? "bg-amber-500/10 text-amber-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>
                    {provider.availableSpots} beschikbaar
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Capaciteit</span>
                    <span className="font-semibold text-foreground">
                      {provider.used} / {provider.capacity} ({providerUtil}%)
                    </span>
                  </div>
                  
                  <div className="relative h-2 bg-muted/20 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                        providerUtil >= 90 ? "bg-red-400" :
                        providerUtil >= 75 ? "bg-amber-400" :
                        "bg-green-400"
                      }`}
                      style={{ width: `${providerUtil}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filteredProviders.length === 0 && (
          <div className="premium-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Geen aanbieders gevonden met de huidige filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
