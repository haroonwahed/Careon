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
  CareAttentionBar,
  CareFilterTabButton,
  CareFilterTabGroup,
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
import { useMunicipalities } from "../../hooks/useMunicipalities";


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
    <CarePageScaffold
      archetype="worklist"
      className="pb-8"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Gemeenten
          <CareInfoPopover ariaLabel="Uitleg gemeentenoverzicht" testId="gemeenten-page-info">
            <p className="text-muted-foreground">Verdeling van casussen en druk per gemeente — voor regie en capaciteit.</p>
          </CareInfoPopover>
        </span>
      }
      dominantAction={
        <CareAttentionBar
          tone={totals.totalBlocked > 0 || totals.totalUrgent > 5 ? "critical" : "warning"}
          icon={<Building2 size={16} />}
          message={
            totals.totalBlocked > 0
              ? `${totals.totalBlocked} casussen zijn geblokkeerd`
              : totals.totalUrgent === 1
                ? "1 urgente casus — opvolging nodig"
                : `${totals.totalUrgent} urgente casussen — opvolging nodig`
          }
          action={
            <PrimaryActionButton onClick={() => setSelectedStatus(totals.totalBlocked > 0 ? "blocked" : "urgent")}>
              {totals.totalBlocked > 0 ? "Open blokkades" : "Open urgentie"}
            </PrimaryActionButton>
          }
        />
      }
    >
      <CareSection>
        <CareSectionHeader
          title="Werklijst"
          meta={<CareMetaChip>{filteredGemeenten.length} zichtbaar · {totals.totalCases} casussen · {totals.avgWaitTime}d</CareMetaChip>}
        />
        <CareSectionBody className="space-y-4">
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
            searchPlaceholder="Zoeken op gemeente of regio..."
          />
      {loading && (
        <LoadingState title="Gemeenten laden…" copy="Overzicht wordt opgebouwd." />
      )}
      {!loading && error && (
        <ErrorState
          title="Kon gemeenten niet laden"
          copy={error}
          action={<Button variant="outline" size="sm" onClick={refetch}>Opnieuw proberen</Button>}
        />
      )}
      {!loading && !error && filteredGemeenten.length === 0 && (
        <EmptyState
          title="Geen gemeenten"
          copy="Er zijn geen gemeenten die passen bij de huidige filters."
        />
      )}
      {!loading && !error && filteredGemeenten.length > 0 && (
        <div className="panel-surface overflow-hidden">
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
                  Wacht op
                </th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">Eigenaar</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">Volgende stap</th>
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
                      <span className="text-xs text-muted-foreground">
                        {gemeente.blockedCases > 0
                          ? "Blokkades oplossen"
                          : gemeente.urgentCases > 0
                            ? "Urgente opvolging"
                            : "Reguliere doorstroom"}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end text-xs text-muted-foreground">
                      {gemeente.blockedCases > 0 ? "Gemeente" : "Gemeente + aanbieder"}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant={gemeente.blockedCases > 0 || gemeente.urgentCases > 0 ? "default" : "ghost"}
                        onClick={(event) => {
                          event.stopPropagation();
                          onGemeenteClick?.(gemeente.id);
                        }}
                      >
                        Open
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      )}
      </CareSectionBody>
      </CareSection>
    </CarePageScaffold>
  );
}
