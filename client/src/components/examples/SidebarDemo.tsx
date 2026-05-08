/**
 * SidebarDemo - Full Application Layout with Elite Sidebar
 * 
 * Demonstrates:
 * - 4-section hierarchy
 * - Active state management
 * - Context awareness
 * - Collapse behavior
 * - Notification badges
 */

import { useState } from "react";
import { Sidebar } from "../navigation/Sidebar";
import { SystemAwarenessPage } from "../care/SystemAwarenessPage";
import { RegiosPage } from "../care/RegiosPage";
import { ProviderProfilePage } from "../care/ProviderProfilePage";
import { CareAppFrame } from "../care/CareAppFrame";
import { mockProviders } from "../../lib/casesData";

type Page = 
  | "regiekamer" 
  | "casussen" 
  | "matching"
  | "acties" 
  | "zorgaanbieders" 
  | "gemeenten" 
  | "regios"
  | "signalen"
  | "rapportages"
  | "documenten"
  | "audittrail"
  | "instellingen";

export function SidebarDemo() {
  const [currentPage, setCurrentPage] = useState<Page>("regiekamer");

  const handleNavigate = (itemId: string, href: string) => {
    console.log("Navigate to:", itemId, href);
    setCurrentPage(itemId as Page);
  };

  const handleCaseClick = (caseId: string) => {
    console.log("Open case:", caseId);
  };

  const handleRegionClick = (regionId: string) => {
    console.log("Open region:", regionId);
  };

  const handleViewGemeenten = (regionId: string) => {
    console.log("View gemeenten in region:", regionId);
  };

  const handleViewProviders = (regionId: string) => {
    console.log("View providers in region:", regionId);
  };

  const handleProviderBack = () => {
    setCurrentPage("zorgaanbieders");
  };

  const handleProviderSelect = () => {
    console.log("Provider selected");
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* SIDEBAR */}
      <Sidebar
        activeItemId={currentPage}
        onNavigate={handleNavigate}
      />

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto">
        <CareAppFrame className="min-h-full">
          <div className="rounded-xl border border-border/70 bg-card/80 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Current Page
            </p>
            <p className="mt-1 text-sm font-semibold text-primary">
              {currentPage}
            </p>
          </div>
          
          {/* REGIEKAMER */}
          {currentPage === "regiekamer" && (
            <div className="p-6">
              <SystemAwarenessPage onCaseClick={handleCaseClick} />
            </div>
          )}

          {/* MATCHING */}
          {currentPage === "matching" && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    Matching
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Demo-placeholder
                  </p>
                </div>
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">Nog te bouwen.</p>
                </div>
              </div>
            </div>
          )}

          {/* CASUSSEN */}
          {currentPage === "casussen" && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    Casussen
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Actieve casussen
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">
                    Nog te bouwen.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ACTIES */}
          {currentPage === "acties" && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    Acties
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    12 acties vereisen uw aandacht
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">
                    Nog te bouwen.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ZORGAANBIEDERS */}
          {currentPage === "zorgaanbieders" && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    Zorgaanbieders
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Zorgaanbieders
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">Nog te bouwen.</p>
                  <button
                    onClick={() => {
                      // Demo: show provider profile
                      alert("Profiel bekijken");
                    }}
                    className="mt-4 px-4 py-2 bg-primary rounded-lg text-white hover:bg-primary/90"
                  >
                    Profiel bekijken
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GEMEENTEN */}
          {currentPage === "gemeenten" && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    Gemeenten
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Gemeenten en casussen
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">Nog te bouwen.</p>
                </div>
              </div>
            </div>
          )}

          {/* REGIO'S */}
          {currentPage === "regios" && (
            <div className="p-6">
              <RegiosPage
                onRegionClick={handleRegionClick}
                onViewGemeenten={handleViewGemeenten}
                onViewProviders={handleViewProviders}
                onNavigateToSignalen={() => {
                  setCurrentPage("signalen");
                }}
                onNavigateToMatching={() => {
                  setCurrentPage("matching");
                }}
              />
            </div>
          )}

          {/* SIGNALEN */}
          {currentPage === "signalen" && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    Signalen
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    5 signalen
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">Nog te bouwen.</p>
                </div>
              </div>
            </div>
          )}

          {/* RAPPORTAGES */}
          {currentPage === "rapportages" && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    Rapportages
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Rapporten
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">Nog te bouwen.</p>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENTEN */}
          {currentPage === "documenten" && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    Documenten
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Documenten
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">Nog te bouwen.</p>
                </div>
              </div>
            </div>
          )}

          {/* AUDITTRAIL */}
          {currentPage === "audittrail" && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    Audittrail
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Activiteiten en wijzigingen
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">Nog te bouwen.</p>
                </div>
              </div>
            </div>
          )}

          {/* INSTELLINGEN */}
          {currentPage === "instellingen" && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    Instellingen
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Systeeminstellingen
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">Nog te bouwen.</p>
                </div>
              </div>
            </div>
          )}

        </CareAppFrame>
      </main>

    </div>
  );
}
