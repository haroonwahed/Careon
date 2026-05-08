/**
 * RegiosDemo - Regions System Overview Demonstration
 * 
 * Shows the geographical structure with:
 * - Region overview page
 * - Region detail page
 * - Navigation flows
 */

import { useState } from "react";
import { RegiosPage } from "../care/RegiosPage";
import { CareAppFrame } from "../care/CareAppFrame";

type View = "overview" | "detail";

export function RegiosDemo() {
  const [currentView, setCurrentView] = useState<View>("overview");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const handleRegionClick = (regionId: string) => {
    console.log("View region detail:", regionId);
    setSelectedRegion(regionId);
    setCurrentView("detail");
  };

  const handleViewGemeenten = (regionId: string) => {
    console.log("Navigate to gemeenten in region:", regionId);
    alert(`Gemeenten in ${regionId}`);
  };

  const handleViewProviders = (regionId: string) => {
    console.log("Navigate to providers in region:", regionId);
    alert(`Zorgaanbieders in ${regionId}`);
  };

  const handleBack = () => {
    setCurrentView("overview");
    setSelectedRegion(null);
  };

  const handleGemeenteClick = (gemeenteId: string) => {
    console.log("Navigate to gemeente:", gemeenteId);
    alert(`Gemeente: ${gemeenteId}`);
  };

  const handleProviderClick = (providerId: string) => {
    console.log("Navigate to provider:", providerId);
    alert(`Profiel: ${providerId}`);
  };

  const handleViewAllGemeenten = () => {
    console.log("Navigate to all gemeenten");
    alert("Alle gemeenten");
  };

  const handleViewAllProviders = () => {
    console.log("Navigate to all providers");
    alert("Alle zorgaanbieders");
  };

  return (
    <div className="min-h-screen bg-background">
      <CareAppFrame>
        <div className="rounded-xl border border-border/70 bg-card/80 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              <p className="font-semibold uppercase tracking-[0.08em]">Demo</p>
              <p className="mt-1 text-foreground">
                View: {currentView === "overview" ? "Overzicht" : `Detail: ${selectedRegion}`}
              </p>
            </div>
            {currentView === "detail" && (
              <button
                onClick={handleBack}
                className="text-xs text-primary hover:underline"
              >
                ← Terug
              </button>
            )}
          </div>
        </div>

        {currentView === "overview" ? (
          <RegiosPage
            onRegionClick={handleRegionClick}
            onViewGemeenten={handleViewGemeenten}
            onViewProviders={handleViewProviders}
          />
        ) : (
          <div className="premium-card p-6">
            <p className="text-sm text-muted-foreground">
              Gebruik de actieve Regio's flow via RegiosPage.
            </p>
            <button onClick={handleBack} className="mt-3 text-sm text-primary hover:underline">
              Terug naar overzicht
            </button>
          </div>
        )}
      </CareAppFrame>
    </div>
  );
}
