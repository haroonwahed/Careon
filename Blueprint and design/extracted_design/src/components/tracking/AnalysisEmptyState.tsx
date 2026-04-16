import { FileSearch } from "lucide-react";
import { Language } from "../../lib/i18n";

interface AnalysisEmptyStateProps {
  language: Language;
}

export function AnalysisEmptyState({ language }: AnalysisEmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl dark:bg-[rgba(168,85,247,0.12)] bg-primary/10 mb-4">
          <FileSearch className="h-8 w-8 dark:text-primary text-primary" />
        </div>
        <h3 className="text-lg dark:text-[#E7E7F0] text-foreground mb-2">
          {language === "fr"
            ? "Aucune analyse sélectionnée"
            : "No analysis selected"}
        </h3>
        <p className="text-sm dark:text-[#9CA3AF] text-muted-foreground">
          {language === "fr"
            ? "Sélectionnez une analyse existante ou créez-en une nouvelle pour commencer."
            : "Select an existing analysis or create a new one to get started."}
        </p>
      </div>
    </div>
  );
}
