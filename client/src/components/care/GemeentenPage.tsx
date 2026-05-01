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
  MapPin,
  Users,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Building2,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  CareFilterTabButton,
  CareFilterTabGroup,
  CareSearchFiltersBar,
} from "./CareUnifiedPage";

// AI Components
import { SystemInsight } from "../ai";
import { useMunicipalities } from "../../hooks/useMunicipalities";
import { Loader2 } from "lucide-react";


interface GemeentenPageProps {
  onGemeenteClick?: (gemeenteId: string) => void;
}

export function GemeentenPage({ onGemeenteClick }: GemeentenPageProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const { municipalities, loading, error, refetch } = useMunicipalities({ q: searchQuery });

  // Filter gemeenten
  const filteredGemeenten = useMemo(() => {
    return municipalities.filter(g => {
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
  }, [municipalities, searchQuery, selectedStatus]);

  // Calculate totals
  const totals = useMemo(() => {
    return {
      totalCases: municipalities.reduce((acc, g) => acc + g.casesCount, 0),
      totalUrgent: municipalities.reduce((acc, g) => acc + g.urgentCases, 0),
      totalBlocked: municipalities.reduce((acc, g) => acc + g.blockedCases, 0),
      avgWaitTime: municipalities.length
        ? Math.round(municipalities.reduce((acc, g) => acc + g.avgWaitingTime, 0) / municipalities.length)
        : 0
    };
  }, [municipalities]);

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
          {municipalities.length} gemeenten in het netwerk
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
      <CareSearchFiltersBar
        tabs={
          <CareFilterTabGroup aria-label="Status gemeenten">
            <CareFilterTabButton selected={selectedStatus === "all"} onClick={() => setSelectedStatus("all")}>
              Alle
            </CareFilterTabButton>
            <CareFilterTabButton selected={selectedStatus === "shortage"} onClick={() => setSelectedStatus("shortage")}>
              Tekort
            </CareFilterTabButton>
            <CareFilterTabButton selected={selectedStatus === "urgent"} onClick={() => setSelectedStatus("urgent")}>
              Urgent
            </CareFilterTabButton>
            <CareFilterTabButton selected={selectedStatus === "blocked"} onClick={() => setSelectedStatus("blocked")}>
              Geblokkeerd
            </CareFilterTabButton>
          </CareFilterTabGroup>
        }
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Zoek gemeente of regio..."
      />

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
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span>Gemeenten laden…</span>
        </div>
      )}
      {error && (
        <div className="premium-card p-6 text-center text-destructive space-y-2">
          <p>Kon gemeenten niet laden: {error}</p>
          <button className="text-sm underline" onClick={refetch}>Opnieuw proberen</button>
        </div>
      )}
      {!loading && !error && filteredGemeenten.length === 0 && (
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