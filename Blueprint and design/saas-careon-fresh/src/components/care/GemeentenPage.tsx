/**
 * GemeentenPage - Municipal Overview
 * 
 * System-level view of all municipalities:
 * - Understand case distribution per municipality
 * - Monitor municipal capacity and pressure
 * - Identify municipalities with issues
 * - Navigate to regional or case views
 */

import { useState, useMemo } from "react";
import { 
  Search,
  MapPin,
  Users,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Building2,
  Filter
} from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

// AI Components
import { SystemInsight } from "../ai";

interface Gemeente {
  id: string;
  name: string;
  region: string;
  casesCount: number;
  activeCases: number;
  avgWaitingTime: number;
  capacityStatus: "normal" | "busy" | "shortage";
  urgentCases: number;
  blockedCases: number;
  population: number;
  providersCount: number;
  trend: "up" | "down" | "stable";
}

// Mock municipal data
const mockGemeenten: Gemeente[] = [
  {
    id: "utrecht-stad",
    name: "Utrecht",
    region: "Utrecht",
    casesCount: 45,
    activeCases: 38,
    avgWaitingTime: 9,
    capacityStatus: "shortage",
    urgentCases: 8,
    blockedCases: 3,
    population: 361924,
    providersCount: 12,
    trend: "up"
  },
  {
    id: "amsterdam",
    name: "Amsterdam",
    region: "Amsterdam",
    casesCount: 132,
    activeCases: 115,
    avgWaitingTime: 5,
    capacityStatus: "busy",
    urgentCases: 15,
    blockedCases: 5,
    population: 872680,
    providersCount: 28,
    trend: "up"
  },
  {
    id: "rotterdam",
    name: "Rotterdam",
    region: "Rotterdam",
    casesCount: 95,
    activeCases: 82,
    avgWaitingTime: 6,
    capacityStatus: "normal",
    urgentCases: 9,
    blockedCases: 2,
    population: 651446,
    providersCount: 22,
    trend: "stable"
  },
  {
    id: "den-haag",
    name: "Den Haag",
    region: "Den Haag",
    casesCount: 78,
    activeCases: 68,
    avgWaitingTime: 7,
    capacityStatus: "normal",
    urgentCases: 6,
    blockedCases: 1,
    population: 544766,
    providersCount: 18,
    trend: "down"
  },
  {
    id: "eindhoven",
    name: "Eindhoven",
    region: "Eindhoven",
    casesCount: 64,
    activeCases: 55,
    avgWaitingTime: 8,
    capacityStatus: "busy",
    urgentCases: 7,
    blockedCases: 2,
    population: 234456,
    providersCount: 15,
    trend: "up"
  },
  {
    id: "amersfoort",
    name: "Amersfoort",
    region: "Utrecht",
    casesCount: 23,
    activeCases: 20,
    avgWaitingTime: 6,
    capacityStatus: "normal",
    urgentCases: 2,
    blockedCases: 0,
    population: 158896,
    providersCount: 8,
    trend: "stable"
  },
  {
    id: "nijmegen",
    name: "Nijmegen",
    region: "Gelderland",
    casesCount: 34,
    activeCases: 29,
    avgWaitingTime: 7,
    capacityStatus: "normal",
    urgentCases: 3,
    blockedCases: 1,
    population: 177659,
    providersCount: 10,
    trend: "down"
  },
  {
    id: "groningen",
    name: "Groningen",
    region: "Groningen",
    casesCount: 42,
    activeCases: 36,
    avgWaitingTime: 5,
    capacityStatus: "normal",
    urgentCases: 4,
    blockedCases: 1,
    population: 233218,
    providersCount: 11,
    trend: "stable"
  }
];

interface GemeentenPageProps {
  onGemeenteClick?: (gemeenteId: string) => void;
}

export function GemeentenPage({ onGemeenteClick }: GemeentenPageProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Filter gemeenten
  const filteredGemeenten = useMemo(() => {
    return mockGemeenten.filter(g => {
      const matchesSearch = searchQuery === "" || 
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.region.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = selectedStatus === "all" ||
        (selectedStatus === "shortage" && g.capacityStatus === "shortage") ||
        (selectedStatus === "busy" && g.capacityStatus === "busy") ||
        (selectedStatus === "urgent" && g.urgentCases > 5) ||
        (selectedStatus === "blocked" && g.blockedCases > 0);
      
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, selectedStatus]);

  // Calculate totals
  const totals = useMemo(() => {
    return {
      totalCases: mockGemeenten.reduce((acc, g) => acc + g.casesCount, 0),
      totalUrgent: mockGemeenten.reduce((acc, g) => acc + g.urgentCases, 0),
      totalBlocked: mockGemeenten.reduce((acc, g) => acc + g.blockedCases, 0),
      avgWaitTime: Math.round(
        mockGemeenten.reduce((acc, g) => acc + g.avgWaitingTime, 0) / mockGemeenten.length
      )
    };
  }, []);

  const getStatusColor = (status: Gemeente["capacityStatus"]) => {
    switch (status) {
      case "shortage":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "busy":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "normal":
        return "bg-green-500/10 text-green-500 border-green-500/20";
    }
  };

  const getStatusLabel = (status: Gemeente["capacityStatus"]) => {
    switch (status) {
      case "shortage":
        return "Tekort";
      case "busy":
        return "Druk";
      case "normal":
        return "Normaal";
    }
  };

  const getTrendIcon = (trend: Gemeente["trend"]) => {
    if (trend === "up") return <TrendingUp size={14} className="text-red-500" />;
    if (trend === "down") return <TrendingDown size={14} className="text-green-500" />;
    return <Activity size={14} className="text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Gemeenten
        </h1>
        <p className="text-sm text-muted-foreground">
          {mockGemeenten.length} gemeenten in het netwerk
        </p>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="premium-card p-6">
          <p className="text-sm text-muted-foreground mb-2">Totaal casussen</p>
          <p className="text-3xl font-bold text-foreground">{totals.totalCases}</p>
        </div>
        <div className="premium-card p-6">
          <p className="text-sm text-muted-foreground mb-2">Urgente casussen</p>
          <p className="text-3xl font-bold text-red-500">{totals.totalUrgent}</p>
        </div>
        <div className="premium-card p-6">
          <p className="text-sm text-muted-foreground mb-2">Geblokkeerde casussen</p>
          <p className="text-3xl font-bold text-amber-500">{totals.totalBlocked}</p>
        </div>
        <div className="premium-card p-6">
          <p className="text-sm text-muted-foreground mb-2">Gem. wachttijd</p>
          <p className="text-3xl font-bold text-foreground">{totals.avgWaitTime}d</p>
        </div>
      </div>

      {/* AI INSIGHT */}
      <SystemInsight
        message="3 gemeenten hebben capaciteitstekort. Utrecht en Amsterdam tonen stijgende trend in urgente casussen. Overweeg regionale samenwerking."
        type="warning"
      />

      {/* SEARCH & FILTERS */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Zoek gemeente of regio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Quick Filters */}
        <div className="flex gap-2">
          <Button
            variant={selectedStatus === "all" ? "default" : "outline"}
            onClick={() => setSelectedStatus("all")}
            size="sm"
          >
            Alle
          </Button>
          <Button
            variant={selectedStatus === "shortage" ? "default" : "outline"}
            onClick={() => setSelectedStatus("shortage")}
            size="sm"
          >
            Tekort
          </Button>
          <Button
            variant={selectedStatus === "urgent" ? "default" : "outline"}
            onClick={() => setSelectedStatus("urgent")}
            size="sm"
          >
            Urgent
          </Button>
          <Button
            variant={selectedStatus === "blocked" ? "default" : "outline"}
            onClick={() => setSelectedStatus("blocked")}
            size="sm"
          >
            Geblokkeerd
          </Button>
        </div>
      </div>

      {/* GEMEENTEN TABLE */}
      <div className="premium-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">
                  Gemeente
                </th>
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">
                  Regio
                </th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                  Casussen
                </th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                  Urgent
                </th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                  Geblokkeerd
                </th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                  Wachttijd
                </th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">
                  Status
                </th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                  Trend
                </th>
                <th className="text-right p-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredGemeenten.map((gemeente) => (
                <tr 
                  key={gemeente.id}
                  className="border-b border-border hover:bg-card/50 transition-colors cursor-pointer"
                  onClick={() => onGemeenteClick?.(gemeente.id)}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MapPin className="text-primary" size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{gemeente.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {gemeente.population.toLocaleString()} inwoners
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-muted-foreground">{gemeente.region}</p>
                  </td>
                  <td className="p-4 text-right">
                    <p className="font-semibold text-foreground">{gemeente.casesCount}</p>
                    <p className="text-xs text-muted-foreground">{gemeente.activeCases} actief</p>
                  </td>
                  <td className="p-4 text-right">
                    {gemeente.urgentCases > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-semibold">
                        <AlertTriangle size={12} />
                        {gemeente.urgentCases}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {gemeente.blockedCases > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-semibold">
                        {gemeente.blockedCases}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <p className="text-sm font-medium text-foreground">{gemeente.avgWaitingTime}d</p>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(gemeente.capacityStatus)}`}>
                        {getStatusLabel(gemeente.capacityStatus)}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end">
                      {getTrendIcon(gemeente.trend)}
                    </div>
                  </td>
                  <td className="p-4">
                    <ChevronRight className="text-muted-foreground" size={18} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty state */}
      {filteredGemeenten.length === 0 && (
        <div className="premium-card p-12 text-center">
          <MapPin className="mx-auto mb-4 text-muted-foreground" size={48} />
          <p className="text-lg font-semibold text-foreground mb-2">Geen gemeenten gevonden</p>
          <p className="text-sm text-muted-foreground">
            Probeer een andere zoekopdracht of pas de filters aan
          </p>
        </div>
      )}
    </div>
  );
}