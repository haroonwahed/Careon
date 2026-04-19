/**
 * RegiosPage - Regional Pressure Monitor
 *
 * Scan-first drill-down interface for regional capacity and operational pressure.
 * Replaces the passive static list with a pressure-sorted accordion monitor.
 */

import { useState, useMemo } from "react";
import {
  Search,
  MapPin,
  Building2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
} from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

import { useRegions, type SpaRegion } from "../../hooks/useRegions";
import { Loader2 } from "lucide-react";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  stabiel: { label: "Normaal",  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", dot: "bg-emerald-400", priority: 3 },
  druk:    { label: "Druk",     color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25",  dot: "bg-amber-400",   priority: 2 },
  tekort:  { label: "Tekort",   color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/25", dot: "bg-orange-400",  priority: 1 },
  kritiek: { label: "Kritiek",  color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30",    dot: "bg-red-400",     priority: 0 },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

function statusOf(region: SpaRegion): StatusKey {
  const s = region.status as string;
  return (s in STATUS_CONFIG ? s : "stabiel") as StatusKey;
}

function utilization(region: SpaRegion): number {
  return region.totalCapacity > 0
    ? Math.round((region.usedCapacity / region.totalCapacity) * 100)
    : 0;
}

// ─── Sort regions by operational pressure ─────────────────────────────────────

function sortByPressure(regions: SpaRegion[]): SpaRegion[] {
  return [...regions].sort((a, b) => {
    const pa = STATUS_CONFIG[statusOf(a)].priority;
    const pb = STATUS_CONFIG[statusOf(b)].priority;
    if (pa !== pb) return pa - pb;
    const ua = utilization(a);
    const ub = utilization(b);
    if (ua !== ub) return ub - ua;
    if (a.urgente_casussen_zonder_match !== b.urgente_casussen_zonder_match)
      return b.urgente_casussen_zonder_match - a.urgente_casussen_zonder_match;
    return b.gemiddelde_wachttijd_dagen - a.gemiddelde_wachttijd_dagen;
  });
}

interface RegiosPageProps {
  onRegionClick: (regionId: string) => void;
  onViewGemeenten: (regionId: string) => void;
  onViewProviders: (regionId: string) => void;
}

// ─── Quick filter pills ───────────────────────────────────────────────────────

type QuickFilter = "all" | "kritiek" | "tekort" | "druk" | "stabiel" | "signalen" | "hoge_wachttijd";

const QUICK_FILTER_LABELS: Record<QuickFilter, string> = {
  all: "Alle",
  kritiek: "Kritiek",
  tekort: "Tekort",
  druk: "Druk",
  stabiel: "Normaal",
  signalen: "Met signalen",
  hoge_wachttijd: "Hoge wachttijd",
};

// ─── Main page ────────────────────────────────────────────────────────────────

export function RegiosPage({
  onRegionClick,
  onViewGemeenten,
  onViewProviders,
}: RegiosPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null);

  const { regions, loading, error, refetch } = useRegions({ q: searchQuery });

  const openSignalen = () => { window.location.href = "/care/signalen/"; };
  const openCasussen = () => { window.location.href = "/care/casussen/"; };
  const openZorgaanbieders = () => {
    if (regions.length > 0) { onViewProviders(regions[0].id); return; }
    window.location.href = "/dashboard/";
  };

  // ── System-level intelligence ───────────────────────────────────────────────
  const systemState = useMemo(() => {
    const criticalRegions = regions.filter((r) => r.status === "kritiek");
    const shortageRegions = regions.filter((r) => r.heeft_tekort);
    const busyRegions = regions.filter((r) => r.status === "druk");
    const highWaitRegions = regions.filter((r) => r.heeft_hoge_wachttijd);
    const nearLimitRegions = regions.filter((r) => r.capaciteitsratio < 0.4 && r.actieve_casussen > 0);
    const noMatchRegions = regions.filter((r) => r.urgente_casussen_zonder_match > 0);
    const totalCases = regions.reduce((s, r) => s + r.actieve_casussen, 0);
    const totalCapacity = regions.reduce((s, r) => s + r.totalCapacity, 0);
    const totalUsed = regions.reduce((s, r) => s + r.usedCapacity, 0);
    const systemUtilization = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;
    return { criticalRegions, shortageRegions, busyRegions, highWaitRegions, nearLimitRegions, noMatchRegions, totalCases, totalCapacity, totalUsed, systemUtilization };
  }, [regions]);

  // ── Regie insight messages ──────────────────────────────────────────────────
  const regieInsights = useMemo(() => {
    const msgs: Array<{ id: string; severity: "critical" | "warning" | "info"; message: string; actionLabel?: string; onAction?: () => void }> = [];

    if (systemState.criticalRegions.length > 0) {
      msgs.push({ id: "crit", severity: "critical",
        message: `${systemState.criticalRegions.length} regio${systemState.criticalRegions.length > 1 ? "'s" : ""} in kritieke staat — directe actie vereist`,
        actionLabel: "Bekijk signalen", onAction: openSignalen });
    }
    if (systemState.shortageRegions.length > 0) {
      msgs.push({ id: "short", severity: "warning",
        message: `Capaciteitstekort in ${systemState.shortageRegions.length} regio${systemState.shortageRegions.length > 1 ? "'s" : ""}`,
        actionLabel: "Toon tekort", onAction: () => setQuickFilter("tekort") });
    }
    if (systemState.nearLimitRegions.length > 0) {
      const names = systemState.nearLimitRegions.slice(0, 2).map((r) => r.name).join(", ");
      msgs.push({ id: "near", severity: "warning",
        message: `${names} naderen de capaciteitsgrens`,
        actionLabel: "Toon druk", onAction: () => setQuickFilter("druk") });
    }
    if (systemState.noMatchRegions.length > 0) {
      msgs.push({ id: "nomatch", severity: "warning",
        message: `${systemState.noMatchRegions.length} regio${systemState.noMatchRegions.length > 1 ? "'s" : ""} heeft urgente casussen zonder passend aanbod`,
        actionLabel: "Ga naar matching", onAction: openCasussen });
    }
    if (systemState.highWaitRegions.length > 0 && msgs.length < 3) {
      msgs.push({ id: "wait", severity: "info",
        message: `Wachttijd boven norm in ${systemState.highWaitRegions.length} regio${systemState.highWaitRegions.length > 1 ? "'s" : ""}`,
        actionLabel: "Hoge wachttijd", onAction: () => setQuickFilter("hoge_wachttijd") });
    }
    return msgs.slice(0, 3);
  }, [systemState]);

  // ── Filter + sort ───────────────────────────────────────────────────────────
  const filteredRegions = useMemo(() => {
    const base = regions.filter((r) => {
      if (quickFilter === "kritiek") return r.status === "kritiek";
      if (quickFilter === "tekort") return r.status === "tekort" || r.heeft_tekort;
      if (quickFilter === "druk") return r.status === "druk";
      if (quickFilter === "stabiel") return r.status === "stabiel";
      if (quickFilter === "signalen") return r.urgente_casussen_zonder_match > 0 || r.heeft_tekort || r.status === "kritiek";
      if (quickFilter === "hoge_wachttijd") return r.heeft_hoge_wachttijd;
      return true;
    });
    return sortByPressure(base);
  }, [regions, quickFilter]);

  const toggleRegion = (id: string) => {
    setExpandedRegionId((prev) => (prev === id ? null : id));
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-24">

      {/* HEADER + COMPACT METRICS STRIP */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Regio's</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Druk-monitor per regio — sorteer op operationele urgentie
            </p>
          </div>
        </div>

        {/* Compact stats strip */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Regio's", value: regions.length },
            { label: "Actieve casussen", value: systemState.totalCases },
            {
              label: "Systeem bezetting",
              value: `${systemState.systemUtilization}%`,
              accent: systemState.systemUtilization >= 85 ? "text-red-400" : systemState.systemUtilization >= 70 ? "text-amber-400" : "text-emerald-400",
            },
            {
              label: "Tekort",
              value: systemState.shortageRegions.length,
              accent: systemState.shortageRegions.length > 0 ? "text-red-400" : "text-emerald-400",
            },
            {
              label: "Hoge wachttijd",
              value: systemState.highWaitRegions.length,
              accent: systemState.highWaitRegions.length > 0 ? "text-amber-400" : "text-emerald-400",
            },
          ].map(({ label, value, accent }) => (
            <div key={label} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className={`text-sm font-bold ${accent ?? "text-foreground"}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* REGIE INZICHT */}
      <div className="premium-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Regie inzicht</h2>
          <button type="button" onClick={openSignalen} className="text-xs text-primary hover:text-primary/80">
            Alle signalen →
          </button>
        </div>

        {regieInsights.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-400 font-medium">Alle regio's binnen norm — geen drukpunten gedetecteerd</p>
          </div>
        ) : (
          <div className="space-y-2">
            {regieInsights.map((insight) => (
              <div key={insight.id} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                insight.severity === "critical" ? "border-red-500/30 bg-red-500/8" :
                insight.severity === "warning"  ? "border-amber-500/25 bg-amber-500/8" :
                "border-border bg-card/35"
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  {insight.severity !== "info" && (
                    <AlertTriangle size={13} className={insight.severity === "critical" ? "text-red-400 flex-shrink-0" : "text-amber-400 flex-shrink-0"} />
                  )}
                  <p className={`text-sm truncate ${
                    insight.severity === "critical" ? "text-red-300" :
                    insight.severity === "warning" ? "text-amber-300" : "text-foreground"
                  }`}>{insight.message}</p>
                </div>
                {insight.onAction && insight.actionLabel && (
                  <button type="button" onClick={insight.onAction} className="flex-shrink-0 text-xs text-primary hover:text-primary/80">
                    {insight.actionLabel} →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SEARCH + QUICK FILTERS */}
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card/90 p-3 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.35)] backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="min-w-0 flex-1 rounded-2xl border border-border bg-muted/40 px-3 py-2.5 flex items-center gap-2">
          <Search className="text-muted-foreground flex-shrink-0" size={18} />
          <Input
            type="text"
            placeholder="Zoek regio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 p-0 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["all", "kritiek", "tekort", "druk", "stabiel", "signalen", "hoge_wachttijd"] as QuickFilter[]).map((f) => {
            const isActive = quickFilter === f;
            const accentClass =
              f === "kritiek" ? (isActive ? "bg-red-500 text-white border-red-500" : "border-red-500/40 text-red-400 hover:bg-red-500/10") :
              f === "tekort"  ? (isActive ? "bg-orange-500 text-white border-orange-500" : "border-orange-500/40 text-orange-400 hover:bg-orange-500/10") :
              f === "druk"    ? (isActive ? "bg-amber-500 text-white border-amber-500" : "border-amber-500/40 text-amber-400 hover:bg-amber-500/10") :
              isActive ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground";
            return (
              <button
                key={f}
                type="button"
                onClick={() => setQuickFilter(f)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${accentClass}`}
              >
                {QUICK_FILTER_LABELS[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* REGIO MONITOR ACCORDION */}
      <div className="premium-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-foreground">Regio monitor</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Gesorteerd op operationele druk</p>
          </div>
          <span className="text-xs text-muted-foreground">{filteredRegions.length} regio{filteredRegions.length !== 1 ? "'s" : ""}</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Regio's laden…</span>
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-destructive space-y-2">
            <p className="text-sm">Kon regio's niet laden: {error}</p>
            <button className="text-sm underline text-muted-foreground" onClick={refetch}>Opnieuw proberen</button>
          </div>
        )}

        {!loading && !error && filteredRegions.length === 0 && (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-foreground">Geen regio's gevonden</p>
            <p className="text-xs text-muted-foreground">Pas de filters aan of voeg regio's toe.</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setQuickFilter("all"); }}>Reset filters</Button>
              <Button variant="outline" size="sm" onClick={openZorgaanbieders}>Zorgaanbieders</Button>
            </div>
          </div>
        )}

        {!loading && !error && filteredRegions.length > 0 && (
          <div className="divide-y divide-border">
            {filteredRegions.map((region) => (
              <RegioMonitorRow
                key={region.id}
                region={region}
                isExpanded={expandedRegionId === region.id}
                onToggle={() => toggleRegion(region.id)}
                onRegionClick={() => onRegionClick(region.id)}
                onViewGemeenten={() => onViewGemeenten(region.id)}
                onViewProviders={() => onViewProviders(region.id)}
                onViewCasussen={openCasussen}
                onViewSignalen={openSignalen}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RegioMonitorRow ──────────────────────────────────────────────────────────

interface RegioMonitorRowProps {
  region: SpaRegion;
  isExpanded: boolean;
  onToggle: () => void;
  onRegionClick: () => void;
  onViewGemeenten: () => void;
  onViewProviders: () => void;
  onViewCasussen: () => void;
  onViewSignalen: () => void;
}

function RegioMonitorRow({
  region,
  isExpanded,
  onToggle,
  onRegionClick,
  onViewGemeenten,
  onViewProviders,
  onViewCasussen,
  onViewSignalen,
}: RegioMonitorRowProps) {
  const status = STATUS_CONFIG[statusOf(region)];
  const util = utilization(region);
  const hasCapacity = region.totalCapacity > 0;
  const hasWait = region.gemiddelde_wachttijd_dagen > 0;
  const hasNoMatch = region.urgente_casussen_zonder_match > 0;

  return (
    <div className={`transition-colors ${isExpanded ? "bg-muted/10" : "hover:bg-muted/5"}`}>
      {/* ── Collapsed summary row ── */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left"
      >
        {/* Status dot */}
        <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${status.dot}`} />

        {/* Region name */}
        <span className="flex-1 min-w-0 text-sm font-semibold text-foreground truncate">{region.name}</span>

        {/* Bezetting */}
        <span className={`hidden sm:block text-xs font-mono font-semibold w-10 text-right ${
          util >= 85 ? "text-red-400" : util >= 70 ? "text-amber-400" : "text-emerald-400"
        }`}>{hasCapacity ? `${util}%` : "—"}</span>

        {/* Status badge */}
        <span className={`hidden sm:inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.bg} ${status.border} ${status.color}`}>
          {status.label}
        </span>

        {/* Casussen */}
        <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground w-20 justify-end">
          <Users size={12} />
          {region.actieve_casussen} casussen
        </span>

        {/* Aanbieders */}
        <span className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground w-24 justify-end">
          <Building2 size={12} />
          {region.providersCount} aanbieders
        </span>

        {/* Alert if no-match */}
        {hasNoMatch && (
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" title={`${region.urgente_casussen_zonder_match} urgente casussen zonder match`} />
        )}

        {/* Trend */}
        {region.trend === "up" && <TrendingUp size={14} className="text-red-400 flex-shrink-0" />}
        {region.trend === "down" && <TrendingDown size={14} className="text-emerald-400 flex-shrink-0" />}

        {/* Chevron */}
        <span className="flex-shrink-0 ml-1 text-muted-foreground">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* ── Expanded detail panel ── */}
      {isExpanded && (
        <div className="border-t border-border bg-card/20 px-5 py-4 space-y-4">

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: "Bezetting",
                value: hasCapacity ? `${util}%` : "—",
                accent: util >= 85 ? "text-red-400" : util >= 70 ? "text-amber-400" : "text-emerald-400",
              },
              { label: "Beschikbare cap.", value: hasCapacity ? String(region.beschikbare_capaciteit) : "—" },
              { label: "Actieve casussen", value: String(region.actieve_casussen) },
              {
                label: "Zonder match",
                value: String(region.urgente_casussen_zonder_match),
                accent: region.urgente_casussen_zonder_match > 0 ? "text-amber-400" : undefined,
              },
              {
                label: "Gem. wachttijd",
                value: hasWait ? `${region.gemiddelde_wachttijd_dagen}d` : "—",
                accent: hasWait && region.gemiddelde_wachttijd_dagen > 14 ? "text-red-400" : undefined,
              },
              { label: "Aanbieders", value: String(region.providersCount) },
            ].map(({ label, value, accent }) => (
              <div key={label} className="rounded-xl border border-border bg-card/40 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
                <p className={`text-base font-bold ${accent ?? "text-foreground"}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Capacity bar */}
          {hasCapacity && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Capaciteitsbenutting</span>
                <span className={util >= 85 ? "text-red-400 font-semibold" : util >= 70 ? "text-amber-400 font-semibold" : "text-emerald-400"}>{util}%</span>
              </div>
              <div className="relative h-2 rounded-full bg-muted/20 overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${util >= 85 ? "bg-red-400" : util >= 70 ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{ width: `${Math.min(util, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {region.usedCapacity} gebruikt · {region.beschikbare_capaciteit} beschikbaar
              </p>
            </div>
          )}

          {/* Signal summary */}
          {region.signaal_samenvatting && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">{region.signaal_samenvatting}</p>
          )}

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="default" size="sm" onClick={onRegionClick}>
              Bekijk regio
            </Button>
            <Button variant="outline" size="sm" onClick={onViewSignalen}>
              Bekijk signalen
            </Button>
            <Button variant="outline" size="sm" onClick={onViewCasussen}>
              Toon casussen
            </Button>
            <Button variant="outline" size="sm" onClick={onViewGemeenten}>
              <MapPin size={13} className="mr-1.5" />
              Gemeenten
            </Button>
            <Button variant="outline" size="sm" onClick={onViewProviders}>
              <Building2 size={13} className="mr-1.5" />
              Aanbieders
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

