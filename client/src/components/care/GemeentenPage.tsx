import { useState, useMemo } from "react";
import {
  MapPin,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Building2,
} from "lucide-react";
import { Button } from "../ui/button";
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
  CareWorklist,
  CareWorklistTabs,
  CareWorklistToolbar,
} from "./CareCommandPrimitives";
import { useMunicipalities } from "../../hooks/useMunicipalities";
import type { SpaMunicipality } from "../../hooks/useMunicipalities";

type GemeenteStatus = "all" | "shortage" | "urgent" | "blocked";

interface GemeentenPageProps {
  onGemeenteClick?: (gemeenteId: string) => void;
}

const GEMEENTEN_TABS: Array<{ id: GemeenteStatus; label: string }> = [
  { id: "all", label: "Alle" },
  { id: "shortage", label: "Tekort" },
  { id: "urgent", label: "Urgent" },
  { id: "blocked", label: "Geblokkeerd" },
];

export function GemeentenPage({ onGemeenteClick }: GemeentenPageProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<GemeenteStatus>("all");

  const { municipalities, loading, error, refetch } = useMunicipalities({ q: searchQuery });

  const filteredGemeenten = useMemo(() => {
    return municipalities.filter((g) => {
      const matchesSearch =
        searchQuery === "" ||
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.coordinator.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        selectedStatus === "all" ||
        (selectedStatus === "shortage" && g.capacityStatus === "shortage") ||
        (selectedStatus === "urgent" && g.urgentCases > 5) ||
        (selectedStatus === "blocked" && g.blockedCases > 0);
      return matchesSearch && matchesStatus;
    });
  }, [municipalities, searchQuery, selectedStatus]);

  const totals = useMemo(() => ({
    totalCases: municipalities.reduce((acc, g) => acc + g.casesCount, 0),
    totalUrgent: municipalities.reduce((acc, g) => acc + g.urgentCases, 0),
    totalBlocked: municipalities.reduce((acc, g) => acc + g.blockedCases, 0),
    avgWaitTime: municipalities.length
      ? Math.round(municipalities.reduce((acc, g) => acc + g.avgWaitingTime, 0) / municipalities.length)
      : 0,
  }), [municipalities]);

  const getStatusColor = (status: SpaMunicipality["capacityStatus"]) => {
    switch (status) {
      case "shortage": return "bg-care-urgent-bg text-care-urgent-text border-care-urgent-border";
      case "busy": return "bg-care-warning-bg text-care-warning-text border-care-warning-border";
      default: return "bg-care-success-bg text-care-success-text border-care-success-border";
    }
  };

  const getStatusLabel = (status: SpaMunicipality["capacityStatus"]) => {
    switch (status) {
      case "shortage": return "Tekort";
      case "busy": return "Druk";
      default: return "Normaal";
    }
  };

  const getTrendIcon = (trend: SpaMunicipality["trend"]) => {
    if (trend === "up") return <TrendingUp size={14} className="text-care-urgent-text" />;
    if (trend === "down") return <TrendingDown size={14} className="text-care-success-text" />;
    return <Activity size={14} className="text-muted-foreground" />;
  };

  const tabs = GEMEENTEN_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    count: municipalities.filter((g) => {
      if (t.id === "all") return true;
      if (t.id === "shortage") return g.capacityStatus === "shortage";
      if (t.id === "urgent") return g.urgentCases > 5;
      return g.blockedCases > 0;
    }).length,
  }));

  return (
    <CareCommandShell
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Gemeenten
          <CareInfoPopover ariaLabel="Uitleg gemeentenoverzicht" testId="gemeenten-page-info">
            <p className="text-muted-foreground">Verdeling van aanvragen en druk per gemeente — voor coördinatie en capaciteit.</p>
          </CareInfoPopover>
        </span>
      }
      actions={
        <Button variant="outline" onClick={() => void refetch()}>Ververs</Button>
      }
    >
      <CareMetricStrip>
        <CareMetricCard
          value={totals.totalBlocked}
          label="Geblokkeerd"
          tone="urgent"
          isActive={selectedStatus === "blocked"}
          onClick={() => setSelectedStatus((s) => (s === "blocked" ? "all" : "blocked"))}
        />
        <CareMetricCard
          value={totals.totalUrgent}
          label="Urgent"
          tone="warning"
          isActive={selectedStatus === "urgent"}
          onClick={() => setSelectedStatus((s) => (s === "urgent" ? "all" : "urgent"))}
        />
        <CareMetricCard
          value={municipalities.length}
          label={`Gemeenten · ${totals.avgWaitTime}d gem.`}
          tone="neutral"
          isActive={selectedStatus === "all"}
          onClick={() => setSelectedStatus("all")}
        />
      </CareMetricStrip>

      <div data-testid="gemeenten-netwerk">
        <CareWorklist>
          <CareWorklistTabs
            tabs={tabs}
            activeId={selectedStatus}
            onChange={(id) => setSelectedStatus(id as GemeenteStatus)}
          />
          <CareWorklistToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Zoeken op gemeente, coördinator of code..."
          />

          {loading && <LoadingState title="Gemeenten laden…" copy="Overzicht wordt opgebouwd." />}
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
              action={
                selectedStatus !== "all" ? (
                  <CareQueueInlineAction type="button" onClick={() => setSelectedStatus("all")}>Toon alle gemeenten</CareQueueInlineAction>
                ) : undefined
              }
            />
          )}
          {!loading && !error && filteredGemeenten.length > 0 && (
            <div className="overflow-hidden rounded-[16px] border border-border/55 bg-card/30">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="p-4 text-left text-sm font-medium text-muted-foreground">Gemeente</th>
                      <th className="p-4 text-left text-sm font-medium text-muted-foreground">Coördinator</th>
                      <th className="p-4 text-right text-sm font-medium text-muted-foreground">Aanvragen</th>
                      <th className="p-4 text-right text-sm font-medium text-muted-foreground">Urgent</th>
                      <th className="p-4 text-right text-sm font-medium text-muted-foreground">Geblokkeerd</th>
                      <th className="p-4 text-right text-sm font-medium text-muted-foreground">Wachttijd</th>
                      <th className="p-4 text-center text-sm font-medium text-muted-foreground">Status</th>
                      <th className="p-4 text-right text-sm font-medium text-muted-foreground">Wacht op</th>
                      <th className="p-4 text-right text-sm font-medium text-muted-foreground">Eigenaar</th>
                      <th className="p-4 text-right text-sm font-medium text-muted-foreground">Volgende stap</th>
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
                            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary/10">
                              <MapPin className="text-primary" size={20} />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{gemeente.name}</p>
                              <p className="text-xs text-muted-foreground">{gemeente.population.toLocaleString()} inwoners</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-muted-foreground">{gemeente.coordinator || "—"}</p>
                        </td>
                        <td className="p-4 text-right">
                          <p className="font-medium text-foreground">{gemeente.casesCount}</p>
                          <p className="text-xs text-muted-foreground">{gemeente.activeCases} actief</p>
                        </td>
                        <td className="p-4 text-right">
                          {gemeente.urgentCases > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-care-urgent-bg px-2 py-1 text-xs font-medium text-care-urgent-text">
                              <AlertTriangle size={12} />
                              {gemeente.urgentCases}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {gemeente.blockedCases > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-care-warning-bg px-2 py-1 text-xs font-medium text-care-warning-text">
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
                            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusColor(gemeente.capacityStatus)}`}>
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
        </CareWorklist>
      </div>
    </CareCommandShell>
  );
}
