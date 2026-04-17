import { ExternalLink, Edit2, StopCircle } from "lucide-react";
import { Language } from "../../lib/i18n";
import { Badge } from "../ui/badge";
import { Analysis } from "./AnalysisList";

interface AnalysisHeaderProps {
  analysis: Analysis;
  language: Language;
  onRename: () => void;
  onStop: () => void;
}

export function AnalysisHeader({
  analysis,
  language,
  onRename,
  onStop,
}: AnalysisHeaderProps) {
  const getStatusBadge = () => {
    switch (analysis.status) {
      case "running":
        return (
          <Badge className="dark:bg-primary/20 bg-primary/10 dark:text-primary text-primary border-0">
            {language === "fr" ? "En cours" : "Running"}
          </Badge>
        );
      case "completed":
        return (
          <Badge className="dark:bg-green-500/20 bg-green-500/10 dark:text-green-400 text-green-600 border-0">
            {language === "fr" ? "Terminée" : "Completed"}
          </Badge>
        );
      case "error":
        return (
          <Badge className="dark:bg-red-500/20 bg-red-500/10 dark:text-red-400 text-red-600 border-0">
            {language === "fr" ? "Erreur" : "Error"}
          </Badge>
        );
    }
  };

  return (
    <div className="sticky top-0 z-10 dark:bg-[#0A0A10] bg-background border-b dark:border-[rgba(168,85,247,0.15)] border-border">
      {/* Main header */}
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Large thumbnail */}
          <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 dark:bg-[#1A1A24] bg-muted">
            <img
              src={analysis.thumbnail}
              alt={analysis.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h1 className="text-xl dark:text-[#E7E7F0] text-foreground line-clamp-1">
                  {analysis.name}
                </h1>
                {analysis.url && (
                  <a
                    href={analysis.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg dark:text-primary text-primary hover:dark:bg-primary/10 hover:bg-primary/5 transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button
                  onClick={onRename}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg dark:bg-[#1A1A24] bg-muted border dark:border-[rgba(168,85,247,0.20)] border-border dark:text-[#E7E7F0] text-foreground text-sm transition-all duration-200 hover:dark:bg-[#242430] hover:bg-muted/70"
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {language === "fr" ? "Renommer" : "Rename"}
                  </span>
                </button>
                {analysis.status === "running" && (
                  <button
                    onClick={onStop}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg dark:bg-red-500/10 bg-red-500/5 border dark:border-red-500/30 border-red-500/20 dark:text-red-400 text-red-600 text-sm transition-all duration-200 hover:dark:bg-red-500/20 hover:bg-red-500/10"
                  >
                    <StopCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {language === "fr" ? "Arrêter" : "Stop"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {getStatusBadge()}
              <span className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
                {language === "fr" ? "Créée le" : "Created on"} {analysis.createdAt}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="px-6 pb-4">
        <div className="flex items-start gap-3 p-3 rounded-xl dark:bg-blue-500/10 bg-blue-500/5 border dark:border-blue-500/20 border-blue-500/15">
          <div className="w-5 h-5 rounded-full dark:bg-blue-500/20 bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs dark:text-blue-400 text-blue-600">ℹ</span>
          </div>
          <p className="text-sm dark:text-blue-300 text-blue-700 leading-relaxed">
            {language === "fr"
              ? "Les statistiques sont mises à jour toutes les heures. Les données affichées peuvent avoir un délai de quelques minutes."
              : "Statistics are updated every hour. Displayed data may have a delay of a few minutes."}
          </p>
        </div>
      </div>
    </div>
  );
}
