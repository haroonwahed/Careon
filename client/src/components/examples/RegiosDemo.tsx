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
      {/* Demo Controls */}
      <div className="fixed top-4 right-4 z-50 premium-card p-4 bg-card/95 backdrop-blur space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase">
          Demo
        </p>
        
        <div className="text-xs text-muted-foreground">
          <p>View:</p>
          <p className="font-semibold text-foreground mt-1">
            {currentView === "overview" ? "Overzicht" : `Detail: ${selectedRegion}`}
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

      <div className="max-w-[1920px] mx-auto p-6">
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
      </div>
    </div>
  );
}
