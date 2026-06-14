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
import { cn } from "../ui/utils";
import {
  CareAttentionBar,
  CareFilterTabButton,
  CareFilterTabGroup,
  CareInfoPopover,
  CarePageScaffold,
  CareSectionHeader,
  CareSearchFiltersBar,
  CareWorkspaceSection,
  CareBadge,
  CareQueueInlineAction,
  CARE_RHYTHM,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import { useMunicipalities } from "../../hooks/useMunicipalities";


interface GemeentenPageProps {
  onGemeenteClick?: (gemeenteId: string) => void;
}

export function GemeentenPage({ onGemeenteClick }: GemeentenPageProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);

  const { municipalities, loading, error, refetch } = useMunicipalities({ q: searchQuery });

  // Filter gemeenten
  const filteredGemeenten = useMemo(() => {
    return municipalities.filter(g => {
      const matchesSearch = searchQuery === "" || 
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        // @ts-ignore
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

  // @ts-ignore
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

  // @ts-ignore
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

  // @ts-ignore
  const getTrendIcon = (trend: Gemeente["trend"]) => {
    if (trend === "up") return <TrendingUp size={14} className="text-red-500" />;
    if (trend === "down") return <TrendingDown size={14} className="text-green-500" />;
    return <Activity size={14} className="text-muted-foreground" />;
  };

  return (
    <CarePageScaffold
      archetype="network"
      className="pb-8"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Gemeenten
          <CareInfoPopover ariaLabel="Uitleg gemeentenoverzicht" testId="gemeenten-page-info">
            <p className="text-muted-foreground">Verdeling van aanvragen en druk per gemeente — voor coördinatie en capaciteit.</p>
          </CareInfoPopover>
        </span>
      }
      dominantAction={
        <CareAttentionBar
          tone={totals.totalBlocked > 0 || totals.totalUrgent > 5 ? "critical" : "warning"}
          icon={<Building2 size={16} />}
          message={
            totals.totalBlocked > 0
              ? `${totals.totalBlocked} aanvragen zijn geblokkeerd`
              : totals.totalUrgent === 1
                ? "1 urgente casus — opvolging nodig"
                : `${totals.totalUrgent} urgente aanvragen — opvolging nodig`
          }
          action={
            <CareQueueInlineAction onClick={() => setSelectedStatus(totals.totalBlocked > 0 ? "blocked" : "urgent")}>
              {totals.totalBlocked > 0 ? "Open blokkades" : "Open urgentie"}
            </CareQueueInlineAction>
          }
        />
      }
      actions={
        <Button variant="outline" onClick={() => void refetch()}>
          Ververs
        </Button>
      }
    >
      <CareWorkspaceSection
        testId="gemeenten-netwerk"
        aria-labelledby="gemeenten-netwerk-heading"
        bodyBleedX
        header={
          <CareSectionHeader
            className="lg:flex-col lg:items-stretch"
            title={<span id="gemeenten-netwerk-heading">Netwerkoverzicht</span>}
            meta={
              <div className={cn("w-full min-w-0", CARE_RHYTHM.metaStack)}>
                <CareBadge tone="cyan">{filteredGemeenten.length} zichtbaar · {totals.totalCases} aanvragen · {totals.avgWaitTime}d</CareBadge>
                <CareSearchFiltersBar
                  className="px-0"
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
                  showSecondaryFilters={showSecondaryFilters}
                  onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
                  secondaryFiltersLabel="Filters"
                  secondaryFilters={(
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                        Status
                        <select
                          aria-label="Status"
                          value={selectedStatus}
                          onChange={(event) => setSelectedStatus(event.target.value)}
                          className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                        >
                          <option value="all">Alle</option>
                          <option value="shortage">Tekort</option>
                          <option value="urgent">Urgent</option>
                          <option value="blocked">Geblokkeerd</option>
                        </select>
                      </label>
                    </div>
                  )}
                />
              </div>
            }
          />
        }
      >
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
            <div className="overflow-hidden rounded-xl border border-border/55 bg-card/30">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="p-4 text-left text-sm font-semibold text-muted-foreground">Gemeente</th>
                      <th className="p-4 text-left text-sm font-semibold text-muted-foreground">Regio</th>
                      <th className="p-4 text-right text-sm font-semibold text-muted-foreground">Aanvragen</th>
                      <th className="p-4 text-right text-sm font-semibold text-muted-foreground">Urgent</th>
                      <th className="p-4 text-right text-sm font-semibold text-muted-foreground">Geblokkeerd</th>
                      <th className="p-4 text-right text-sm font-semibold text-muted-foreground">Wachttijd</th>
                      <th className="p-4 text-center text-sm font-semibold text-muted-foreground">Status</th>
                      <th className="p-4 text-right text-sm font-semibold text-muted-foreground">Wacht op</th>
                      <th className="p-4 text-right text-sm font-semibold text-muted-foreground">Eigenaar</th>
                      <th className="p-4 text-right text-sm font-semibold text-muted-foreground">Volgende stap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGemeenten.map((gemeente) => (
                      <tr
                        key={gemeente.id}
                        className="border-b border-border/40 transition-colors hover:bg-muted/10 cursor-pointer"
                        onClick={() => onGemeenteClick?.(gemeente.id)}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <MapPin className="text-primary" size={20} />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{gemeente.name}</p>
                              <p className="text-xs text-muted-foreground">{gemeente.population.toLocaleString()} inwoners</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-muted-foreground">{(gemeente as any).region}</p>
                        </td>
                        <td className="p-4 text-right">
                          <p className="font-semibold text-foreground">{gemeente.casesCount}</p>
                          <p className="text-xs text-muted-foreground">{gemeente.activeCases} actief</p>
                        </td>
                        <td className="p-4 text-right">
                          {gemeente.urgentCases > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-500">
                              <AlertTriangle size={12} />
                              {gemeente.urgentCases}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {gemeente.blockedCases > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-500">
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
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusColor(gemeente.capacityStatus)}`}>
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
                              variant={gemeente.blockedCases > 0 || gemeente.urgentCases > 0 ? "outline" : "ghost"}
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
        </CareWorkspaceSection>
    </CarePageScaffold>
  );
}
