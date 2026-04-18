import { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  AlertTriangle,
  Info,
  XCircle,
  ChevronRight,
  Users,
  Loader2
} from "lucide-react";
import { Button } from "../ui/button";
import { useSignals, SignalSeverity } from "../../hooks/useSignals";

export function SignalenPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<SignalSeverity | "all">("all");

  const { signals, loading, error, refetch } = useSignals({ q: searchQuery });

  const filteredSignals = signals.filter(signal => {
    if (selectedSeverity !== "all" && signal.severity !== selectedSeverity) return false;
    return true;
  });

  const criticalCount = signals.filter(s => s.severity === "critical").length;
  const warningCount = signals.filter(s => s.severity === "warning").length;
  const infoCount = signals.filter(s => s.severity === "info").length;

  const getSeverityIcon = (severity: SignalSeverity) => {
    switch (severity) {
      case "critical": return <XCircle size={20} className="text-red-400" />;
      case "warning":  return <AlertTriangle size={20} className="text-amber-400" />;
      case "info":     return <Info size={20} className="text-blue-400" />;
    }
  };

  const getSeverityColor = (severity: SignalSeverity) => {
    switch (severity) {
      case "critical": return "border-l-red-500 bg-red-500/5";
      case "warning":  return "border-l-amber-500 bg-amber-500/5";
      case "info":     return "border-l-blue-500 bg-blue-500/5";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Signalen
        </h1>
        <p className="text-muted-foreground">
          Automatische detectie van problemen en afwijkingen · {loading ? "…" : `${criticalCount} kritiek · ${warningCount} waarschuwing`}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setSelectedSeverity(selectedSeverity === "critical" ? "all" : "critical")}
          className={`premium-card p-4 text-left transition-all hover:scale-[1.02] ${
            selectedSeverity === "critical" ? "border-2 border-red-500 shadow-lg shadow-red-500/20" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle size={18} className="text-red-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">{loading ? "—" : criticalCount}</p>
          <p className="text-sm text-muted-foreground">Kritieke signalen</p>
        </button>

        <button
          onClick={() => setSelectedSeverity(selectedSeverity === "warning" ? "all" : "warning")}
          className={`premium-card p-4 text-left transition-all hover:scale-[1.02] ${
            selectedSeverity === "warning" ? "border-2 border-amber-500 shadow-lg shadow-amber-500/20" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle size={18} className="text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">{loading ? "—" : warningCount}</p>
          <p className="text-sm text-muted-foreground">Waarschuwingen</p>
        </button>

        <button
          onClick={() => setSelectedSeverity(selectedSeverity === "info" ? "all" : "info")}
          className={`premium-card p-4 text-left transition-all hover:scale-[1.02] ${
            selectedSeverity === "info" ? "border-2 border-blue-500 shadow-lg shadow-blue-500/20" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Info size={18} className="text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">{loading ? "—" : infoCount}</p>
          <p className="text-sm text-muted-foreground">Informatie</p>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Zoek signalen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-muted-foreground/20 
                     bg-background text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <Button variant="outline" className="border-2 border-muted-foreground/20">
          <SlidersHorizontal size={18} />
          Meer filters
        </Button>
      </div>

      {/* Signals List */}
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" />
            <span>Signalen laden…</span>
          </div>
        )}
        {error && (
          <div className="premium-card p-6 text-center text-destructive space-y-2">
            <p>Kon signalen niet laden: {error}</p>
            <Button variant="outline" size="sm" onClick={refetch}>Opnieuw proberen</Button>
          </div>
        )}
        {!loading && !error && filteredSignals.map((signal) => (
          <div
            key={signal.id}
            className={`premium-card p-5 border-l-4 ${getSeverityColor(signal.severity)} hover:bg-muted/20 transition-all cursor-pointer group`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                {getSeverityIcon(signal.severity)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {signal.title}
                      </h3>
                      {signal.signalType && (
                        <span className="text-xs px-2 py-0.5 rounded bg-muted/50 text-muted-foreground capitalize">
                          {signal.signalType}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{signal.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
                  <span>{new Date(signal.createdAt).toLocaleDateString("nl-NL")}</span>
                  {signal.linkedCaseTitle && (
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {signal.linkedCaseTitle}
                    </span>
                  )}
                  {signal.assignedTo && <span>{signal.assignedTo}</span>}
                </div>
              </div>
              <ChevronRight
                size={18}
                className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1"
              />
            </div>
          </div>
        ))}

        {!loading && !error && filteredSignals.length === 0 && (
          <div className="premium-card p-12 text-center">
            <p className="text-muted-foreground">
              Geen signalen gevonden met de huidige filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
