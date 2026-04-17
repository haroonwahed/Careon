import { useState } from "react";
import { Language } from "../../lib/i18n";
import { TrackingLayout } from "./TrackingLayout";
import { AnalysisList, Analysis } from "./AnalysisList";
import { AddAnalysisModal } from "./AddAnalysisModal";
import { AnalysisHeader } from "./AnalysisHeader";
import { StatisticsTab } from "./StatisticsTab";
import { NichesTab } from "./NichesTab";
import { HistoryTab } from "./HistoryTab";
import { toast } from "sonner@2.0.3";

interface TrackingProductsPageProps {
  language: Language;
}

// Mock analyses
const mockAnalyses: Analysis[] = [
  {
    id: "1",
    name: "Pull d'hiver Boutique Italiana",
    thumbnail: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=200&h=200&fit=crop",
    status: "running",
    createdAt: "15 déc. 2024",
    url: "https://www.vinted.fr/catalog?search_text=pull+hiver",
  },
  {
    id: "2",
    name: "Veste en jean vintage",
    thumbnail: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=200&h=200&fit=crop",
    status: "completed",
    createdAt: "10 déc. 2024",
    url: "https://www.vinted.fr/catalog?search_text=veste+jean",
  },
  {
    id: "3",
    name: "Sneakers Nike Air Max",
    thumbnail: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop",
    status: "completed",
    createdAt: "5 déc. 2024",
    url: "https://www.vinted.fr/catalog?search_text=nike+air+max",
  },
];

export function TrackingProductsPage({ language }: TrackingProductsPageProps) {
  const [analyses, setAnalyses] = useState<Analysis[]>(mockAnalyses);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>(mockAnalyses[0]?.id);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"statistics" | "niches" | "history">("statistics");

  const selectedAnalysis = analyses.find((a) => a.id === selectedAnalysisId);

  const handleAddAnalysis = (name: string, url: string) => {
    const newAnalysis: Analysis = {
      id: Date.now().toString(),
      name,
      thumbnail: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=200&h=200&fit=crop",
      status: "running",
      createdAt: new Date().toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      url,
    };
    setAnalyses([newAnalysis, ...analyses]);
    setSelectedAnalysisId(newAnalysis.id);
    toast.success(
      language === "fr"
        ? "Analyse créée avec succès"
        : "Analysis created successfully"
    );
  };

  const handleExport = () => {
    toast.success(
      language === "fr"
        ? "Export en cours..."
        : "Exporting..."
    );
  };

  const handleRename = () => {
    toast.info(
      language === "fr"
        ? "Fonctionnalité de renommage à venir"
        : "Rename feature coming soon"
    );
  };

  const handleStop = () => {
    if (selectedAnalysis) {
      setAnalyses(
        analyses.map((a) =>
          a.id === selectedAnalysis.id ? { ...a, status: "completed" as const } : a
        )
      );
      toast.success(
        language === "fr"
          ? "Analyse arrêtée"
          : "Analysis stopped"
      );
    }
  };

  return (
    <>
      <TrackingLayout
        sidebar={
          <AnalysisList
            analyses={analyses}
            selectedId={selectedAnalysisId}
            onSelect={setSelectedAnalysisId}
            onAdd={() => setIsAddModalOpen(true)}
            onExport={handleExport}
            language={language}
            type="products"
          />
        }
        language={language}
      >
        {selectedAnalysis ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <AnalysisHeader
              analysis={selectedAnalysis}
              language={language}
              onRename={handleRename}
              onStop={handleStop}
            />

            {/* Tabs */}
            <div className="border-b dark:border-[rgba(168,85,247,0.15)] border-border px-6">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab("statistics")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "statistics"
                      ? "dark:text-primary text-primary dark:border-primary border-primary"
                      : "dark:text-[#9CA3AF] text-muted-foreground border-transparent hover:dark:text-[#E7E7F0] hover:text-foreground"
                  }`}
                >
                  {language === "fr" ? "Statistiques" : "Statistics"}
                </button>
                <button
                  onClick={() => setActiveTab("niches")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "niches"
                      ? "dark:text-primary text-primary dark:border-primary border-primary"
                      : "dark:text-[#9CA3AF] text-muted-foreground border-transparent hover:dark:text-[#E7E7F0] hover:text-foreground"
                  }`}
                >
                  {language === "fr" ? "Niches" : "Niches"}
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "history"
                      ? "dark:text-primary text-primary dark:border-primary border-primary"
                      : "dark:text-[#9CA3AF] text-muted-foreground border-transparent hover:dark:text-[#E7E7F0] hover:text-foreground"
                  }`}
                >
                  {language === "fr" ? "Historique des ventes" : "Sales history"}
                </button>
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto">
              {activeTab === "statistics" && (
                <StatisticsTab
                  language={language}
                  isLoading={selectedAnalysis.status === "running"}
                />
              )}
              {activeTab === "niches" && <NichesTab language={language} />}
              {activeTab === "history" && <HistoryTab language={language} />}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-lg dark:text-[#9CA3AF] text-muted-foreground mb-4">
                {language === "fr"
                  ? "Aucune analyse sélectionnée"
                  : "No analysis selected"}
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-6 py-3 rounded-xl dark:bg-primary bg-primary dark:text-white text-white font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  boxShadow: "0 0 20px rgba(139,92,246,0.3)",
                }}
              >
                {language === "fr" ? "Créer une analyse" : "Create analysis"}
              </button>
            </div>
          </div>
        )}
      </TrackingLayout>

      <AddAnalysisModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddAnalysis}
        language={language}
        type="products"
      />
    </>
  );
}
