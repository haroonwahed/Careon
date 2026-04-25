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
import { AssessmentQueuePage } from "../care/AssessmentQueuePage";
import { AanbiederBeoordelingPage } from "../care/AanbiederBeoordelingPage";
import { MatchingPageWrapper } from "../care/MatchingPageWrapper";
import { PlacementPageWrapper } from "../care/PlacementPageWrapper";
import { IntakeListPage } from "../care/IntakeListPage";
import { CasussenWorkflowPage } from "../care/CasussenWorkflowPage";
import { NieuweCasusPage } from "../care/NieuweCasusPage";
import { ZorgaanbiedersPage } from "../care/ZorgaanbiedersPage";
import { GemeentenPage } from "../care/GemeentenPage";
import { CaseWorkflowDetailPage } from "../care/CaseWorkflowDetailPage";
import { SignalenPage } from "../care/SignalenPage";
import { ActiesPage } from "../care/ActiesPage";
import { DocumentenPage } from "../care/DocumentenPage";
import { AudittrailPage } from "../care/AudittrailPage";
import { RapportagesPage } from "../care/RapportagesPage";
import { InstellingenPage } from "../care/InstellingenPage";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases } from "../../lib/workflowUi";

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
  | "nieuwe-casus"
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
interface MultiTenantDemoProps {
  theme: "light" | "dark";
  onThemeToggle: () => void;
}

function getInitialPageFromPath(pathname: string): Page {
  if (pathname.startsWith("/care/casussen/new")) {
    return "nieuwe-casus";
  }
  if (pathname.startsWith("/care/casussen/")) {
    return "casussen";
  }
  if (pathname.startsWith("/care/beoordelingen/")) {
    return "beoordelingen";
  }
  if (pathname.startsWith("/care/matching/")) {
    return "matching";
  }
  if (pathname.startsWith("/care/plaatsingen/")) {
    return "plaatsingen";
  }
  if (pathname.startsWith("/care/zorgaanbieders/")) {
    return "zorgaanbieders";
  }
  if (pathname.startsWith("/care/gemeenten/")) {
    return "gemeenten";
  }
  if (pathname.startsWith("/care/regio")) {
    return "regios";
  }
  if (pathname.startsWith("/settings/")) {
    return "instellingen";
  }
  return "regiekamer";
}

export function MultiTenantDemo({ theme, onThemeToggle }: MultiTenantDemoProps) {
  const [currentContext, setCurrentContext] = useState<Context>(availableContexts[0]);
  const [currentPage, setCurrentPage] = useState<Page>(() => getInitialPageFromPath(window.location.pathname));
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const { cases } = useCases({ q: "" });
  const { providers } = useProviders({ q: "" });
  const workflowCases = buildWorkflowCases(cases, providers);
  const queueCounts = {
    casussen: workflowCases.filter((casus) => casus.phase !== "afgerond").length,
    beoordelingen: workflowCases.filter((casus) => casus.phase === "provider_beoordeling").length,
    matching: workflowCases.filter((casus) => casus.readyForMatching).length,
    plaatsingen: workflowCases.filter((casus) => casus.readyForPlacement).length,
    acties: workflowCases.filter((casus) => casus.isBlocked || casus.urgency === "critical" || casus.daysInCurrentPhase > 10).length,
  };

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

      setSelectedCase(null);
    }
  };

  const handleNavigate = (itemId: string, _href: string) => {
    setCurrentPage(itemId as Page);
    // Reset case/provider selection when navigating
    setSelectedCase(null);
  };

  const handleCaseClick = (caseId: string) => {
    setSelectedCase(caseId);
    // Don't change the page, just show the case detail overlay
  };

  const handleCloseCaseDetail = () => {
    setSelectedCase(null);
  };

  const handleStartMatching = (caseId: string) => {
    void caseId;
    setSelectedCase(null);
    setCurrentPage("matching");
  };

  const handleProviderSelect = (providerId: string) => {
    void providerId;
  };

  const handleRegionClick = (_regionId: string) => setCurrentPage("regios");

  const handleViewGemeenten = (_regionId: string) => setCurrentPage("gemeenten");

  const handleViewProviders = (_regionId: string) => setCurrentPage("zorgaanbieders");

  const handleOpenEntityFromAudit = (entry: any) => {
    if (entry.entityType === "casus" && entry.entityId) {
      handleCaseClick(entry.entityId);
      return;
    }
    if (entry.entityType === "document") {
      setCurrentPage("documenten");
      return;
    }
    if (entry.entityType === "instellingen") {
      setCurrentPage("instellingen");
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* SIDEBAR */}
      <Sidebar
        role={currentContext.type}
        activeItemId={currentPage === "nieuwe-casus" ? "casussen" : currentPage}
        onNavigate={handleNavigate}
        badgeOverrides={currentContext.type === "gemeente" ? queueCounts : undefined}
      />

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <TopBar
          theme={theme}
          onThemeToggle={onThemeToggle}
          currentContext={currentContext}
          availableContexts={availableContexts}
          onContextSwitch={handleContextSwitch}
          notificationCount={7}
          onNotificationClick={() => setCurrentPage("acties")}
          onSearch={() => undefined}
          userName="Jane Doe"
          userRole="Regisseur"
          onProfileClick={() => setCurrentPage("instellingen")}
          onSettingsClick={() => setCurrentPage("instellingen")}
          onLogout={() => {
            setCurrentContext(availableContexts[0]);
            setCurrentPage("regiekamer");
            setSelectedCase(null);
          }}
        />

        {/* CONTENT */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            
            {/* GEMEENTE PAGES */}
            {currentContext.type === "gemeente" && (
              <>
                {currentPage === "regiekamer" && (
                  <RegiekamerControlCenter onCaseClick={handleCaseClick} />
                )}

                {currentPage === "casussen" && (
                  <CasussenWorkflowPage
                    onCaseClick={handleCaseClick}
                    onCreateCase={() => setCurrentPage("nieuwe-casus")}
                    canCreateCase
                    role={currentContext.type}
                    onNavigateToWorkflow={(page) => setCurrentPage(page)}
                  />
                )}

                {currentPage === "nieuwe-casus" && (
                  <NieuweCasusPage
                    onCancel={() => setCurrentPage("casussen")}
                    onCreated={() => setCurrentPage("casussen")}
                  />
                )}

                {currentPage === "beoordelingen" && (
                  <AanbiederBeoordelingPage
                    role="gemeente"
                    onCaseClick={handleCaseClick}
                    onNavigateToMatching={() => setCurrentPage("matching")}
                    onNavigateToPlaatsingen={() => setCurrentPage("plaatsingen")}
                    onNavigateToCasussen={() => setCurrentPage("casussen")}
                  />
                )}

                {currentPage === "matching" && (
                  <MatchingPageWrapper
                    onNavigateToCasussen={() => setCurrentPage("casussen")}
                    onNavigateToBeoordelingen={() => setCurrentPage("beoordelingen")}
                  />
                )}

                {currentPage === "plaatsingen" && (
                  <PlacementPageWrapper onNavigateToMatching={() => setCurrentPage("matching")} />
                )}

                {currentPage === "acties" && (
                  <ActiesPage onCaseClick={handleCaseClick} />
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
                  <RapportagesPage />
                )}

                {currentPage === "documenten" && (
                  <DocumentenPage />
                )}

                {currentPage === "audittrail" && (
                  <AudittrailPage onOpenEntity={handleOpenEntityFromAudit} />
                )}

                {currentPage === "instellingen" && (
                  <InstellingenPage />
                )}
              </>
            )}

            {/* ZORGAANBIEDER PAGES */}
            {currentContext.type === "zorgaanbieder" && (
              <>
                {currentPage === "intake" && (
                  <IntakeListPage onCaseClick={handleCaseClick} role={currentContext.type as "gemeente" | "zorgaanbieder" | "admin"} />
                )}

                {currentPage === "mijn-casussen" && (
                  <CasussenWorkflowPage
                    onCaseClick={handleCaseClick}
                    role={currentContext.type}
                    onNavigateToWorkflow={(page) => setCurrentPage(page)}
                  />
                )}

                {currentPage === "beoordelingen" && (
                  <AanbiederBeoordelingPage
                    role="zorgaanbieder"
                    onCaseClick={handleCaseClick}
                    onNavigateToPlaatsingen={() => setCurrentPage("intake")}
                    onNavigateToCasussen={() => setCurrentPage("mijn-casussen")}
                  />
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
                {currentPage === "beoordelingen" && (
                  <AanbiederBeoordelingPage
                    role="admin"
                    onCaseClick={handleCaseClick}
                    onNavigateToMatching={() => setCurrentPage("matching")}
                    onNavigateToPlaatsingen={() => setCurrentPage("plaatsingen")}
                    onNavigateToCasussen={() => setCurrentPage("casussen")}
                  />
                )}

                {(currentPage === "casussen" || currentPage === "matching" || currentPage === "plaatsingen" || currentPage === "acties" || currentPage === "signalen") && (
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

                {currentPage === "nieuwe-casus" && (
                  <NieuweCasusPage
                    onCancel={() => setCurrentPage("casussen")}
                    onCreated={() => setCurrentPage("casussen")}
                  />
                )}

                {currentPage === "rapportages" && (
                  <RapportagesPage />
                )}

                {currentPage === "instellingen" && (
                  <InstellingenPage />
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
            <div className="p-6 max-w-[1400px] mx-auto">
              <CaseWorkflowDetailPage
                caseId={selectedCase}
                onBack={handleCloseCaseDetail}
                onStartMatching={handleStartMatching}
                onOpenWorkflow={(page) => {
                  setSelectedCase(null);
                  setCurrentPage(page as Page);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}