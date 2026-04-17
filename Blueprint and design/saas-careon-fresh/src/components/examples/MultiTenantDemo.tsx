/**
 * MultiTenantDemo - Full Platform with Role Switching
 * 
 * Demonstrates:
 * - Role/context switching in top bar
 * - Role-based sidebar navigation
 * - Different navigation per role
 * - Platform-level multi-tenancy
 */

import { useState } from "react";
import { TopBar } from "../navigation/TopBar";
import { Sidebar } from "../navigation/Sidebar";
import { RegiekamerControlCenter } from "../care/RegiekamerControlCenter";
import { RegiosPage } from "../care/RegiosPage";
import { BeoordelingenPage } from "../care/BeoordelingenPage";
import { MatchingPageWrapper } from "../care/MatchingPageWrapper";
import { PlacementPageWrapper } from "../care/PlacementPageWrapper";
import { IntakeListPage } from "../care/IntakeListPage";
import { CasussenPage } from "../care/CasussenPage";
import { ZorgaanbiedersPage } from "../care/ZorgaanbiedersPage";
import { GemeentenPage } from "../care/GemeentenPage";
import { CaseDetailPage } from "../care/CaseDetailPage";
import { SignalenPage } from "../care/SignalenPage";
import { ActiesPage } from "../care/ActiesPage";
import { DocumentenPage } from "../care/DocumentenPage";
import { AudittrailPage } from "../care/AudittrailPage";

type RoleType = "gemeente" | "zorgaanbieder" | "admin";

interface Context {
  id: string;
  type: RoleType;
  name: string;
  subtitle?: string;
}

const availableContexts: Context[] = [
  {
    id: "gemeente-utrecht",
    type: "gemeente",
    name: "Utrecht",
    subtitle: "Gemeente"
  },
  {
    id: "gemeente-amsterdam",
    type: "gemeente",
    name: "Amsterdam",
    subtitle: "Gemeente"
  },
  {
    id: "provider-horizon",
    type: "zorgaanbieder",
    name: "Horizon Jeugdzorg",
    subtitle: "Zorgaanbieder"
  },
  {
    id: "admin-system",
    type: "admin",
    name: "Systeem Beheer",
    subtitle: "Administrator"
  }
];

type Page = 
  | "regiekamer" 
  | "casussen" 
  | "beoordelingen"
  | "matching"
  | "plaatsingen"
  | "acties"
  | "zorgaanbieders"
  | "gemeenten"
  | "regios"
  | "signalen"
  | "rapportages"
  | "documenten"
  | "audittrail"
  | "instellingen"
  | "intake"
  | "mijn-casussen"
  | "gebruikers";

export function MultiTenantDemo() {
  const [currentContext, setCurrentContext] = useState<Context>(availableContexts[0]);
  const [currentPage, setCurrentPage] = useState<Page>("regiekamer");
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const handleContextSwitch = (contextId: string) => {
    const newContext = availableContexts.find(c => c.id === contextId);
    if (newContext) {
      setCurrentContext(newContext);
      
      // Reset to appropriate home page for role
      if (newContext.type === "zorgaanbieder") {
        setCurrentPage("intake");
      } else {
        setCurrentPage("regiekamer");
      }
      
      console.log("Switched context to:", newContext.name, `(${newContext.type})`);
    }
  };

  const handleNavigate = (itemId: string, href: string) => {
    console.log("Navigate to:", itemId, href);
    setCurrentPage(itemId as Page);
    // Reset case/provider selection when navigating
    setSelectedCase(null);
    setSelectedProvider(null);
  };

  const handleCaseClick = (caseId: string) => {
    console.log("Open case:", caseId);
    setSelectedCase(caseId);
    // Don't change the page, just show the case detail overlay
  };

  const handleCloseCaseDetail = () => {
    setSelectedCase(null);
  };

  const handleStartMatching = (caseId: string) => {
    console.log("Start matching for case:", caseId);
    // In a real app, this would navigate to matching page with context
    setSelectedCase(null);
    setCurrentPage("matching");
  };

  const handleProviderSelect = (providerId: string) => {
    console.log("Provider selected:", providerId);
    setSelectedProvider(providerId);
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

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* SIDEBAR */}
      <Sidebar
        role={currentContext.type}
        activeItemId={currentPage}
        onNavigate={handleNavigate}
      />

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <TopBar
          currentContext={currentContext}
          availableContexts={availableContexts}
          onContextSwitch={handleContextSwitch}
          notificationCount={7}
          onNotificationClick={() => console.log("Open notifications")}
          onSearch={(query) => console.log("Search:", query)}
          userName="Jane Doe"
          userRole="Regisseur"
          onProfileClick={() => console.log("Open profile")}
          onSettingsClick={() => console.log("Open settings")}
          onLogout={() => console.log("Logout")}
        />

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            
            {/* GEMEENTE PAGES */}
            {currentContext.type === "gemeente" && (
              <>
                {currentPage === "regiekamer" && (
                  <RegiekamerControlCenter onCaseClick={handleCaseClick} />
                )}

                {currentPage === "casussen" && (
                  <CasussenPage onCaseClick={handleCaseClick} />
                )}

                {currentPage === "beoordelingen" && (
                  <BeoordelingenPage onCaseClick={handleCaseClick} />
                )}

                {currentPage === "matching" && (
                  <MatchingPageWrapper />
                )}

                {currentPage === "plaatsingen" && (
                  <PlacementPageWrapper />
                )}

                {currentPage === "acties" && (
                  <ActiesPage />
                )}

                {currentPage === "zorgaanbieders" && (
                  <ZorgaanbiedersPage />
                )}

                {currentPage === "gemeenten" && (
                  <GemeentenPage />
                )}

                {currentPage === "regios" && (
                  <RegiosPage
                    onRegionClick={handleRegionClick}
                    onViewGemeenten={handleViewGemeenten}
                    onViewProviders={handleViewProviders}
                  />
                )}

                {currentPage === "signalen" && (
                  <SignalenPage />
                )}

                {currentPage === "rapportages" && (
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
                        Rapportages page
                      </p>
                    </div>
                  </div>
                )}

                {currentPage === "documenten" && (
                  <DocumentenPage />
                )}

                {currentPage === "audittrail" && (
                  <AudittrailPage />
                )}

                {currentPage === "instellingen" && (
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
                        Instellingen page
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ZORGAANBIEDER PAGES */}
            {currentContext.type === "zorgaanbieder" && (
              <>
                {currentPage === "intake" && (
                  <IntakeListPage onCaseClick={handleCaseClick} />
                )}

                {currentPage === "mijn-casussen" && (
                  <CasussenPage onCaseClick={handleCaseClick} />
                )}

                {currentPage === "documenten" && (
                  <DocumentenPage />
                )}
              </>
            )}

            {/* ADMIN PAGES */}
            {currentContext.type === "admin" && (
              <>
                {/* Same as gemeente pages, plus: */}
                
                {currentPage === "regiekamer" && (
                  <RegiekamerControlCenter onCaseClick={handleCaseClick} />
                )}

                {currentPage === "regios" && (
                  <RegiosPage
                    onRegionClick={handleRegionClick}
                    onViewGemeenten={handleViewGemeenten}
                    onViewProviders={handleViewProviders}
                  />
                )}

                {currentPage === "gebruikers" && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-3xl font-bold text-foreground mb-2">
                        Gebruikers
                      </h1>
                      <p className="text-sm text-muted-foreground">
                        Beheer gebruikers en toegang
                      </p>
                    </div>
                    
                    <div className="premium-card p-12 text-center">
                      <p className="text-lg font-bold text-foreground mb-4">
                        Admin Only
                      </p>
                      <p className="text-muted-foreground mb-8">
                        This page is only available to administrators.<br />
                        Manage users, permissions, and system access.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                        <div className="premium-card p-6">
                          <p className="text-3xl font-bold text-foreground mb-2">24</p>
                          <p className="text-sm text-muted-foreground">Gemeente users</p>
                        </div>
                        <div className="premium-card p-6">
                          <p className="text-3xl font-bold text-foreground mb-2">18</p>
                          <p className="text-sm text-muted-foreground">Zorgaanbieder users</p>
                        </div>
                        <div className="premium-card p-6">
                          <p className="text-3xl font-bold text-primary mb-2">3</p>
                          <p className="text-sm text-muted-foreground">Admins</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Other admin pages... */}
                {(currentPage === "casussen" || currentPage === "beoordelingen" || currentPage === "matching" || currentPage === "plaatsingen" || currentPage === "acties" || currentPage === "signalen") && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-3xl font-bold text-foreground mb-2">
                        {currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}
                      </h1>
                      <p className="text-sm text-muted-foreground">
                        Admin view - all organizations
                      </p>
                    </div>
                    
                    <div className="premium-card p-12 text-center">
                      <p className="text-muted-foreground">
                        Admin page - showing data across all organizations
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </main>
      </div>

      {/* CASUS CONTROL CENTER - Modal Overlay */}
      {selectedCase && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen">
            <div className="p-6">
              <CaseDetailPage
                caseId={selectedCase}
                onBack={handleCloseCaseDetail}
                onStartMatching={handleStartMatching}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}