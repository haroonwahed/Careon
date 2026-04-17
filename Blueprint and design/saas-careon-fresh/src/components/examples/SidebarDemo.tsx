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
import { RegiekamerControlCenter } from "../care/RegiekamerControlCenter";
import { RegiosPage } from "../care/RegiosPage";
import { ProviderProfilePage } from "../care/ProviderProfilePage";
import { mockProviders } from "../../lib/casesData";

type Page = 
  | "regiekamer" 
  | "casussen" 
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
        <div className="max-w-[1920px] mx-auto">
          
          {/* REGIEKAMER */}
          {currentPage === "regiekamer" && (
            <div className="p-6">
              <RegiekamerControlCenter onCaseClick={handleCaseClick} />
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
                    Alle actieve casussen in het systeem
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">
                    Casussen page - To be implemented
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
                    Acties page - To be implemented
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
                    Overzicht van alle zorgaanbieders
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">
                    Zorgaanbieders page - To be implemented
                  </p>
                  <button
                    onClick={() => {
                      // Demo: show provider profile
                      alert("Would show provider profile page");
                    }}
                    className="mt-4 px-4 py-2 bg-primary rounded-lg text-white hover:bg-primary/90"
                  >
                    Demo: View Provider Profile
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
                    Overzicht van gemeenten en casussen
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">
                    Gemeenten page - To be implemented
                  </p>
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
                    5 signalen vereisen aandacht
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">
                    Signalen page - To be implemented
                  </p>
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
                    Genereer en bekijk rapporten
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">
                    Rapportages page - To be implemented
                  </p>
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
                    Documenten en templates
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">
                    Documenten page - To be implemented
                  </p>
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
                    Systeem activiteiten en wijzigingen
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">
                    Audittrail page - To be implemented
                  </p>
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
                    Systeem en gebruikersinstellingen
                  </p>
                </div>
                
                <div className="premium-card p-12 text-center">
                  <p className="text-muted-foreground">
                    Instellingen page - To be implemented
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* DEMO INDICATOR */}
      <div className="fixed bottom-4 right-4 premium-card p-4 bg-card/95 backdrop-blur z-50">
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
          Current Page
        </p>
        <p className="text-sm font-bold text-primary">
          {currentPage}
        </p>
      </div>
    </div>
  );
}
