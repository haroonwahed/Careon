import { useState } from "react";
import { Search, Plus, Download, MoreVertical } from "lucide-react";
import { Language } from "../../lib/i18n";
import { Badge } from "../ui/badge";

export interface Analysis {
  id: string;
  name: string;
  thumbnail: string;
  status: "running" | "completed" | "error";
  createdAt: string;
  url?: string;
}

interface AnalysisListProps {
  analyses: Analysis[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onExport: () => void;
  language: Language;
  type: "products" | "vendors" | "publics";
}

export function AnalysisList({
  analyses,
  selectedId,
  onSelect,
  onAdd,
  onExport,
  language,
  type,
}: AnalysisListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const runningAnalyses = analyses.filter((a) => a.status === "running");
  const completedAnalyses = analyses.filter((a) => a.status === "completed");

  const getStatusBadge = (status: Analysis["status"]) => {
    switch (status) {
      case "running":
        return (
          <Badge className="dark:bg-primary/20 bg-primary/10 dark:text-primary text-primary border-0 text-xs">
            {language === "fr" ? "En cours" : "Running"}
          </Badge>
        );
      case "completed":
        return (
          <Badge className="dark:bg-green-500/20 bg-green-500/10 dark:text-green-400 text-green-600 border-0 text-xs">
            {language === "fr" ? "Terminée" : "Completed"}
          </Badge>
        );
      case "error":
        return (
          <Badge className="dark:bg-red-500/20 bg-red-500/10 dark:text-red-400 text-red-600 border-0 text-xs">
            {language === "fr" ? "Erreur" : "Error"}
          </Badge>
        );
    }
  };

  const filteredRunning = runningAnalyses.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredCompleted = completedAnalyses.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header with search */}
      <div className="p-6 border-b dark:border-[rgba(168,85,247,0.15)] border-border">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-[#9CA3AF] text-muted-foreground" />
          <input
            type="text"
            placeholder={
              language === "fr" ? "Rechercher une analyse..." : "Search analysis..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl dark:bg-[#1A1A24] bg-muted/50 border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground placeholder:dark:text-[#9CA3AF] placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onAdd}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl dark:bg-primary bg-primary dark:text-white text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              boxShadow: "0 0 20px rgba(139,92,246,0.3)",
            }}
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">
              {language === "fr" ? "Ajouter" : "Add"}
            </span>
          </button>
          <button
            onClick={onExport}
            className="px-4 py-2.5 rounded-xl dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground transition-all duration-200 hover:dark:bg-[#242430] hover:bg-muted/70"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable lists */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Running section */}
        {filteredRunning.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold dark:text-primary text-primary uppercase tracking-wide">
                {language === "fr" ? "En cours" : "Running"}
              </h3>
              <span className="text-xs dark:text-[#9CA3AF] text-muted-foreground tabular-nums">
                {filteredRunning.length}/{runningAnalyses.length}
              </span>
            </div>
            <div className="space-y-2">
              {filteredRunning.map((analysis) => (
                <AnalysisCard
                  key={analysis.id}
                  analysis={analysis}
                  isSelected={selectedId === analysis.id}
                  onSelect={() => onSelect(analysis.id)}
                  getStatusBadge={getStatusBadge}
                  menuOpen={menuOpen === analysis.id}
                  onMenuToggle={() =>
                    setMenuOpen(menuOpen === analysis.id ? null : analysis.id)
                  }
                  language={language}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed section */}
        {filteredCompleted.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold dark:text-[#9CA3AF] text-muted-foreground uppercase tracking-wide mb-3">
              {language === "fr" ? "Terminées" : "Completed"}
            </h3>
            <div className="space-y-2">
              {filteredCompleted.map((analysis) => (
                <AnalysisCard
                  key={analysis.id}
                  analysis={analysis}
                  isSelected={selectedId === analysis.id}
                  onSelect={() => onSelect(analysis.id)}
                  getStatusBadge={getStatusBadge}
                  menuOpen={menuOpen === analysis.id}
                  onMenuToggle={() =>
                    setMenuOpen(menuOpen === analysis.id ? null : analysis.id)
                  }
                  language={language}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {filteredRunning.length === 0 && filteredCompleted.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
              {searchQuery
                ? language === "fr"
                  ? "Aucune analyse trouvée"
                  : "No analysis found"
                : language === "fr"
                ? "Aucune analyse pour le moment"
                : "No analysis yet"}
            </p>
          </div>
        )}
      </div>

      {/* Footer - Account info */}
      <div className="p-6 border-t dark:border-[rgba(168,85,247,0.15)] border-border">
        <div className="text-xs dark:text-[#6B7280] text-muted-foreground">
          <p className="mb-1">user@vintsy.com</p>
          <p className="opacity-60">v2.4.1</p>
        </div>
      </div>
    </div>
  );
}

interface AnalysisCardProps {
  analysis: Analysis;
  isSelected: boolean;
  onSelect: () => void;
  getStatusBadge: (status: Analysis["status"]) => JSX.Element;
  menuOpen: boolean;
  onMenuToggle: () => void;
  language: Language;
}

function AnalysisCard({
  analysis,
  isSelected,
  onSelect,
  getStatusBadge,
  menuOpen,
  onMenuToggle,
  language,
}: AnalysisCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        relative group cursor-pointer p-3 rounded-xl border transition-all duration-200
        ${
          isSelected
            ? "dark:bg-[#1A1A24] bg-muted dark:border-primary border-primary"
            : "dark:bg-[#0E0E14] bg-card dark:border-[rgba(168,85,247,0.10)] border-border hover:dark:border-[rgba(168,85,247,0.25)] hover:border-border/60"
        }
      `}
      style={
        isSelected
          ? {
              boxShadow: "0 0 0 1px rgba(139,92,246,0.3), 0 0 20px rgba(139,92,246,0.15)",
            }
          : {}
      }
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 dark:bg-[#1A1A24] bg-muted">
          <img
            src={analysis.thumbnail}
            alt={analysis.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <h4 className="text-sm dark:text-[#E7E7F0] text-foreground line-clamp-1 pr-2">
              {analysis.name}
            </h4>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMenuToggle();
              }}
              className="p-1 rounded-md dark:text-[#9CA3AF] text-muted-foreground hover:dark:bg-[#242430] hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-2">
            {getStatusBadge(analysis.status)}
          </div>

          <p className="text-xs dark:text-[#9CA3AF] text-muted-foreground">
            {analysis.createdAt}
          </p>
        </div>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          className="absolute right-3 top-14 z-10 w-48 rounded-xl dark:bg-[#1A1A24] bg-card border dark:border-[rgba(168,85,247,0.25)] border-border shadow-lg"
          style={{
            boxShadow: "0 0 0 1px rgba(139,92,246,0.25), 0 8px 24px rgba(0,0,0,0.4)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="w-full px-4 py-2.5 text-left text-sm dark:text-[#E7E7F0] text-foreground hover:dark:bg-[#242430] hover:bg-muted/50 first:rounded-t-xl">
            {language === "fr" ? "Renommer" : "Rename"}
          </button>
          <button className="w-full px-4 py-2.5 text-left text-sm dark:text-[#E7E7F0] text-foreground hover:dark:bg-[#242430] hover:bg-muted/50">
            {language === "fr" ? "Relancer" : "Restart"}
          </button>
          <button className="w-full px-4 py-2.5 text-left text-sm dark:text-red-400 text-red-600 hover:dark:bg-red-500/10 hover:bg-red-500/5 last:rounded-b-xl">
            {language === "fr" ? "Supprimer" : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}
