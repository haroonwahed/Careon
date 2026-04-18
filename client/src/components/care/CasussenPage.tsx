import { useState } from "react";
import { useCases } from "../../hooks/useCases";
import { 
  Search, 
  SlidersHorizontal, 
  List, 
  LayoutGrid,
  CheckSquare,
  GitMerge,
  UserPlus,
  AlertTriangle,
  ChevronDown,
  X,
  Loader2
} from "lucide-react";
import { Button } from "../ui/button";
import { CaseTriageCard } from "./CaseTriageCard";

type ViewMode = "list" | "board";
type QuickFilter = "no-match" | "delayed" | "high-risk" | "ready-placement" | null;

interface FilterState {
  regio: string[];
  status: string[];
  urgentie: string[];
  zorgtype: string[];
}

interface CasussenPageProps {
  onCaseClick: (caseId: string) => void;
}

export function CasussenPage({ onCaseClick }: CasussenPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    regio: [],
    status: [],
    urgentie: [],
    zorgtype: []
  });

  const { cases: allCases, loading, error, refetch } = useCases({ q: searchQuery });

  // Client-side filter on top of server-side search
  const filteredCases = allCases.filter(caseItem => {
    if (quickFilter === "no-match" && !caseItem.problems?.some(p => p.type === "no-match")) return false;
    if (quickFilter === "delayed" && caseItem.wachttijd <= 3) return false;
    if (quickFilter === "high-risk" && caseItem.urgency !== "critical") return false;
    if (quickFilter === "ready-placement" && caseItem.status !== "plaatsing") return false;
    return true;
  });

  // Sort by urgency, then wait time
  const sortedCases = [...filteredCases].sort((a, b) => {
    const urgencyOrder = { critical: 0, warning: 1, normal: 2, stable: 3 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return b.wachttijd - a.wachttijd;
  });

  const handleToggleSelect = (id: string, selected: boolean) => {
    if (selected) {
      setSelectedCases(prev => [...prev, id]);
    } else {
      setSelectedCases(prev => prev.filter(caseId => caseId !== id));
    }
  };

  const handleSelectAll = () => {
    if (selectedCases.length === sortedCases.length) {
      setSelectedCases([]);
    } else {
      setSelectedCases(sortedCases.map(c => c.id));
    }
  };

  const urgentCases = sortedCases.filter(c => c.urgency === "critical" || c.urgency === "warning");

  return (
    <div className="space-y-6">
      {/* TOP CONTROL BAR */}
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Casussen
        </h1>
        <p className="text-muted-foreground">
          Overzicht en triage van alle casussen · {sortedCases.length} actief · {urgentCases.length} aandacht nodig
        </p>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="flex gap-3">
        {/* Search Bar */}
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Zoek casussen, cliënten, regio's..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-muted-foreground/20 
                     bg-background text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Filter Toggle */}
        <Button
          onClick={() => setShowFilters(!showFilters)}
          variant="outline"
          className={`border-2 ${showFilters ? "border-primary/50 text-primary" : "border-muted-foreground/20"}`}
        >
          <SlidersHorizontal size={18} />
          Filters
        </Button>

        {/* View Mode Toggle */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted/30">
          <button
            onClick={() => setViewMode("list")}
            className={`p-2.5 rounded-md transition-colors ${
              viewMode === "list" 
                ? "bg-primary text-white" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setViewMode("board")}
            className={`p-2.5 rounded-md transition-colors ${
              viewMode === "board" 
                ? "bg-primary text-white" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {/* QUICK FILTER CHIPS */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setQuickFilter(quickFilter === "no-match" ? null : "no-match")}
          className={`
            px-4 py-2 rounded-lg font-medium text-sm transition-all
            flex items-center gap-2 border-2
            ${quickFilter === "no-match"
              ? "bg-red-500/20 border-red-500/40 text-red-300"
              : "bg-muted/30 border-muted-foreground/20 text-muted-foreground hover:border-red-500/40 hover:text-red-300"
            }
          `}
        >
          🔴 Zonder match
          {quickFilter === "no-match" && <X size={14} />}
        </button>

        <button
          onClick={() => setQuickFilter(quickFilter === "delayed" ? null : "delayed")}
          className={`
            px-4 py-2 rounded-lg font-medium text-sm transition-all
            flex items-center gap-2 border-2
            ${quickFilter === "delayed"
              ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
              : "bg-muted/30 border-muted-foreground/20 text-muted-foreground hover:border-amber-500/40 hover:text-amber-300"
            }
          `}
        >
          🟡 Wacht &gt; 3 dagen
          {quickFilter === "delayed" && <X size={14} />}
        </button>

        <button
          onClick={() => setQuickFilter(quickFilter === "high-risk" ? null : "high-risk")}
          className={`
            px-4 py-2 rounded-lg font-medium text-sm transition-all
            flex items-center gap-2 border-2
            ${quickFilter === "high-risk"
              ? "bg-red-500/20 border-red-500/40 text-red-300"
              : "bg-muted/30 border-muted-foreground/20 text-muted-foreground hover:border-red-500/40 hover:text-red-300"
            }
          `}
        >
          ⚠️ Hoog risico
          {quickFilter === "high-risk" && <X size={14} />}
        </button>

        <button
          onClick={() => setQuickFilter(quickFilter === "ready-placement" ? null : "ready-placement")}
          className={`
            px-4 py-2 rounded-lg font-medium text-sm transition-all
            flex items-center gap-2 border-2
            ${quickFilter === "ready-placement"
              ? "bg-green-500/20 border-green-500/40 text-green-300"
              : "bg-muted/30 border-muted-foreground/20 text-muted-foreground hover:border-green-500/40 hover:text-green-300"
            }
          `}
        >
          🟢 Klaar voor plaatsing
          {quickFilter === "ready-placement" && <X size={14} />}
        </button>
      </div>

      {/* BULK ACTIONS BAR */}
      {selectedCases.length > 0 && (
        <div className="premium-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground">
                {selectedCases.length} casus{selectedCases.length > 1 ? "sen" : ""} geselecteerd
              </span>
              <Button
                onClick={handleSelectAll}
                variant="ghost"
                className="text-xs"
              >
                Deselecteer alles
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => {
                  if (selectedCases[0]) {
                    onCaseClick(selectedCases[0]);
                  }
                }}
              >
                <GitMerge size={16} className="mr-2" />
                Start matching
              </Button>
              <Button
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => {
                  if (selectedCases[0]) {
                    onCaseClick(selectedCases[0]);
                  }
                }}
              >
                <UserPlus size={16} className="mr-2" />
                Assign beoordelaar
              </Button>
              <Button
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => {
                  if (selectedCases[0]) {
                    onCaseClick(selectedCases[0]);
                  }
                }}
              >
                <AlertTriangle size={16} className="mr-2" />
                Escaleren
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div className="space-y-6">
          {/* Loading state */}
          {loading && (
            <div className="premium-card p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <Loader2 size={36} className="animate-spin text-primary" />
                <p className="text-muted-foreground">Casussen laden…</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="premium-card p-8 text-center border-red-500/30">
              <div className="flex flex-col items-center gap-3">
                <AlertTriangle size={32} className="text-red-400" />
                <p className="text-foreground font-medium">Laden mislukt</p>
                <p className="text-muted-foreground text-sm">{error}</p>
                <Button variant="outline" size="sm" onClick={refetch}>Opnieuw proberen</Button>
              </div>
            </div>
          )}

          {/* Case sections — only render when loaded */}
          {!loading && !error && (
            <>
          {/* Section: Cases that need attention */}
          {urgentCases.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Casussen die aandacht nodig hebben
                </h2>
                <span className="text-sm text-muted-foreground">
                  {urgentCases.length} urgent
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {urgentCases.map((caseItem) => (
                  <CaseTriageCard
                    key={caseItem.id}
                    {...caseItem}
                    isSelected={selectedCases.includes(caseItem.id)}
                    onSelect={(selected) => handleToggleSelect(caseItem.id, selected)}
                    onViewDetails={() => onCaseClick(caseItem.id)}
                    onTakeAction={() => onCaseClick(caseItem.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section: Other cases */}
          {sortedCases.filter(c => c.urgency === "normal" || c.urgency === "stable").length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Overige casussen
                </h2>
                <span className="text-sm text-muted-foreground">
                  {sortedCases.filter(c => c.urgency === "normal" || c.urgency === "stable").length} stabiel
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sortedCases
                  .filter(c => c.urgency === "normal" || c.urgency === "stable")
                  .map((caseItem) => (
                    <CaseTriageCard
                      key={caseItem.id}
                      {...caseItem}
                      isSelected={selectedCases.includes(caseItem.id)}
                      onSelect={(selected) => handleToggleSelect(caseItem.id, selected)}
                      onViewDetails={() => onCaseClick(caseItem.id)}
                      onTakeAction={() => onCaseClick(caseItem.id)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {sortedCases.length === 0 && (
            <div className="premium-card p-12 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div 
                  className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)",
                    border: "2px solid rgba(34, 197, 94, 0.3)"
                  }}
                >
                  <CheckSquare size={40} className="text-green-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">
                    Geen urgente casussen 🎯
                  </h3>
                  <p className="text-muted-foreground">
                    Alle casussen lopen volgens planning. Goed bezig!
                  </p>
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* BOARD VIEW */}
      {viewMode === "board" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {["intake", "beoordeling", "matching", "plaatsing", "afgerond"].map((statusKey) => {
              const statusCases = sortedCases.filter(c => c.status === statusKey);
              const statusLabels: Record<string, string> = {
                intake: "Intake",
                beoordeling: "Beoordeling",
                matching: "Matching",
                plaatsing: "Plaatsing",
                afgerond: "Intake afgerond"
              };

              return (
                <div key={statusKey} className="w-80 flex-shrink-0">
                  <div className="premium-card p-4 mb-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">{statusLabels[statusKey]}</h3>
                      <span className="text-sm font-medium text-muted-foreground">
                        {statusCases.length}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {statusCases.map((caseItem) => (
                      <CaseTriageCard
                        key={caseItem.id}
                        {...caseItem}
                        isSelected={selectedCases.includes(caseItem.id)}
                        onSelect={(selected) => handleToggleSelect(caseItem.id, selected)}
                        onViewDetails={() => onCaseClick(caseItem.id)}
                        onTakeAction={() => onCaseClick(caseItem.id)}
                      />
                    ))}
                    {statusCases.length === 0 && (
                      <div className="premium-card p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          Geen casussen
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
