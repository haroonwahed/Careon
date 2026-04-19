/**
 * MultiTenantDemo - Full Platform with Role Switching
 * 
 * Demonstrates:
 * - Role/context switching in top bar
 * - Role-based sidebar navigation
 * - Different navigation per role
 * - Platform-level multi-tenancy
 */

import { useMemo, useState } from "react";
import { TopBar } from "../navigation/TopBar";
import { Sidebar } from "../navigation/Sidebar";
import { RegiekamerControlCenter } from "../care/RegiekamerControlCenter";
import { RegiosPage } from "../care/RegiosPage";
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
    | "nieuwe-aanvragen"
  | "matching"
  | "plaatsingen"
    | "plaatsingsreacties"
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
  if (pathname.startsWith("/care/clients") || pathname.startsWith("/care/zorgaanbieders")) {
    return "zorgaanbieders";
  }
  if (pathname.startsWith("/care/documents")) {
    return "documenten";
  }
  if (pathname.startsWith("/care/taken") || pathname.startsWith("/care/tasks")) {
    return "acties";
  }
  if (pathname.startsWith("/care/signalen") || pathname.startsWith("/care/risks")) {
    return "signalen";
  }
  if (pathname.startsWith("/care/audit-log")) {
    return "audittrail";
  }
  if (pathname.startsWith("/care/reports") || pathname.startsWith("/care/workflows")) {
    return "rapportages";
  }
  if (pathname.startsWith("/care/organizations") || pathname.startsWith("/care/profile")) {
    return "instellingen";
  }
  if (pathname.startsWith("/care/beoordelingen/")) {
    return "matching";
  }
  if (pathname.startsWith("/care/matching/")) {
    return "matching";
  }
  if (pathname.startsWith("/care/plaatsingen/")) {
    return "plaatsingen";
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

function getInitialPageFromLocation(): Page {
  const params = new URLSearchParams(window.location.search);
  const requestedPage = params.get("page");
  const allowedPages: ReadonlySet<string> = new Set([
    "regiekamer",
    "casussen",
    "nieuwe-casus",
    "nieuwe-aanvragen",
    "matching",
    "plaatsingen",
    "plaatsingsreacties",
    "acties",
    "zorgaanbieders",
    "gemeenten",
    "regios",
    "signalen",
    "rapportages",
    "documenten",
    "audittrail",
    "instellingen",
    "intake",
    "mijn-casussen",
    "gebruikers",
  ]);

  if (requestedPage && allowedPages.has(requestedPage)) {
      return requestedPage as Page;
  }
  setCurrentPage(current.type === "gemeente" ? "regiekamer" : current.type === "zorgaanbieder" ? "nieuwe-aanvragen" : "regiekamer");

  return getInitialPageFromPath(window.location.pathname);
}

function getInitialSelectedCaseFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  const caseFromQuery = params.get("case");
  if (caseFromQuery) {
    return caseFromQuery;
  }

  const detailPathMatch = window.location.pathname.match(/^\/care\/casussen\/(\d+)\/?$/);
  if (detailPathMatch) {
    return detailPathMatch[1];
  }

  return null;
}

function buildDashboardUrl(page: Page, selectedCase: string | null): string {
  const params = new URLSearchParams();
  params.set("page", page);
  if (selectedCase) {
    params.set("case", selectedCase);
  }

  const query = params.toString();
  return query ? `/dashboard/?${query}` : "/dashboard/";
}

export function MultiTenantDemo({ theme, onThemeToggle }: MultiTenantDemoProps) {
  const [currentContext, setCurrentContext] = useState<Context>(availableContexts[0]);
  const [currentPage, setCurrentPage] = useState<Page>(() => getInitialPageFromLocation());
  const [selectedCase, setSelectedCase] = useState<string | null>(() => getInitialSelectedCaseFromLocation());
  const [matchingInitialCaseId, setMatchingInitialCaseId] = useState<string | null>(null);
  const [placementInitialCaseId, setPlacementInitialCaseId] = useState<string | null>(null);
  const { cases } = useCases({ q: "" });
  const { providers } = useProviders({ q: "" });
  const workflowCases = buildWorkflowCases(cases, providers);
  const activeCaseContext = useMemo(() => {
    if (!selectedCase) return null;
    const activeCase = workflowCases.find((item) => item.id === selectedCase);
    if (!activeCase) return null;

    return {
      region: activeCase.region,
      careType: activeCase.careType,
      urgency: activeCase.urgencyLabel,
    };
  }, [workflowCases, selectedCase]);
  const queueCounts = {
    casussen: workflowCases.filter((casus) => casus.phase !== "afgerond").length,
    beoordelingen: workflowCases.filter((casus) => casus.phase === "intake" || casus.phase === "beoordeling").length,
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
    const nextPage = itemId as Page;
    setCurrentPage(nextPage);
    // Reset case/provider selection when navigating
    setSelectedCase(null);
    setMatchingInitialCaseId(null);
    setPlacementInitialCaseId(null);
    window.history.replaceState(null, "", buildDashboardUrl(nextPage, null));
  };

  const handleCaseClick = (caseId: string) => {
    setSelectedCase(caseId);
    window.history.replaceState(null, "", buildDashboardUrl("casussen", caseId));
  };

  const handleAssessmentCaseClick = (caseId: string) => {
    setCurrentPage("matching");
    setMatchingInitialCaseId(caseId);
    setSelectedCase(null);
    window.history.replaceState(null, "", buildDashboardUrl("matching", null));
  };

  const handleCaseCreated = (caseId: string) => {
    setCurrentPage("casussen");
    setSelectedCase(caseId);
    window.history.replaceState(null, "", buildDashboardUrl("casussen", caseId));
  };

  const handleCloseCaseDetail = () => {
    const targetPage = currentPage === "matching" || currentPage === "plaatsingen" ? currentPage : "casussen";
    setSelectedCase(null);
    window.history.replaceState(null, "", buildDashboardUrl(targetPage, null));
  };

  const handleStartMatching = (caseId: string) => {
    setMatchingInitialCaseId(caseId);
    setSelectedCase(null);
    setCurrentPage("matching");
    window.history.replaceState(null, "", buildDashboardUrl("matching", null));
  };

  const handleEditCase = (caseId: string) => {
    // Navigate to case edit page or open modal
    // For now, just log the action - parent can implement specific edit behavior
    console.log("Edit case:", caseId);
    // Could navigate to: setCurrentPage("edit-case") or open an edit modal
  };

  const handleCloseCase = (caseId: string) => {
    // Close/archive the case
    // For now, just log the action - parent can implement specific close behavior
    console.log("Close case:", caseId);
    // Could show confirmation dialog, then navigate back: setSelectedCase(null)
    setSelectedCase(null);
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
                  <RegiekamerControlCenter
                    onCaseClick={handleCaseClick}
                    onNavigateToView={(view) => {
                      if (view === "signalen") {
                        setCurrentPage("signalen");
                        window.history.replaceState(null, "", buildDashboardUrl("signalen", null));
                        return;
                      }
                      setCurrentPage(view);
                      window.history.replaceState(null, "", buildDashboardUrl(view, null));
                    }}
                  />
                )}

                {currentPage === "casussen" && (
                  <CasussenWorkflowPage
                    onCaseClick={handleCaseClick}
                    onCreateCase={() => setCurrentPage("nieuwe-casus")}
                    canCreateCase
                  />
                )}

                {currentPage === "nieuwe-casus" && (
                  <NieuweCasusPage
                    onCancel={() => setCurrentPage("casussen")}
                    onCreated={handleCaseCreated}
                  />
                )}

                {currentPage === "matching" && (
                  <MatchingPageWrapper
                    initialCaseId={matchingInitialCaseId}
                    onNavigateToCasussen={() => setCurrentPage("casussen")}
                    onProviderReviewStarted={(caseId) => {
                      setMatchingInitialCaseId(null);
                      setCurrentPage("casussen");
                      setSelectedCase(caseId);
                      window.history.replaceState(null, "", buildDashboardUrl("casussen", caseId));
                    }}
                  />
                )}

                {currentPage === "plaatsingen" && (
                  <PlacementPageWrapper
                    initialCaseId={placementInitialCaseId}
                    onNavigateToMatching={() => {
                      setPlacementInitialCaseId(null);
                      setCurrentPage("matching");
                    }}
                  />
                )}

                {currentPage === "acties" && (
                  <ActiesPage onCaseClick={handleCaseClick} />
                )}

                {currentPage === "zorgaanbieders" && (
                  <ZorgaanbiedersPage theme={theme} activeCaseContext={activeCaseContext} />
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
                  <SignalenPage
                    onOpenCase={handleCaseClick}
                    onNavigateToWorkflow={(target) => setCurrentPage(target as Page)}
                  />
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
                {currentPage === "nieuwe-aanvragen" && (
                  <IntakeListPage
                    view="requests"
                    onCaseClick={handleCaseClick}
                    onRequestApproved={(caseId) => {
                      setCurrentPage("intake");
                      setSelectedCase(caseId);
                      window.history.replaceState(null, "", buildDashboardUrl("intake", caseId));
                    }}
                  />
                )}

                {currentPage === "plaatsingsreacties" && (
                  <IntakeListPage view="responses" onCaseClick={handleCaseClick} />
                )}

                {currentPage === "intake" && (
                  <IntakeListPage view="intake" onCaseClick={handleCaseClick} />
                )}

                {currentPage === "mijn-casussen" && (
                  <CasussenWorkflowPage onCaseClick={handleCaseClick} />
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

                {/* Shared workflow pages (same real components as gemeente) */}
                {currentPage === "casussen" && (
                  <CasussenWorkflowPage onCaseClick={handleCaseClick} />
                )}

                {currentPage === "matching" && (
                  <MatchingPageWrapper
                    initialCaseId={matchingInitialCaseId}
                    onNavigateToCasussen={() => setCurrentPage("casussen")}
                    onProviderReviewStarted={(caseId) => {
                      setMatchingInitialCaseId(null);
                      setCurrentPage("casussen");
                      setSelectedCase(caseId);
                      window.history.replaceState(null, "", buildDashboardUrl("casussen", caseId));
                    }}
                  />
                )}

                {currentPage === "plaatsingen" && (
                  <PlacementPageWrapper
                    initialCaseId={placementInitialCaseId}
                    onNavigateToMatching={() => {
                      setPlacementInitialCaseId(null);
                      setCurrentPage("matching");
                    }}
                  />
                )}

                {currentPage === "acties" && (
                  <ActiesPage onCaseClick={handleCaseClick} />
                )}

                {currentPage === "signalen" && (
                  <SignalenPage
                    onOpenCase={handleCaseClick}
                    onNavigateToWorkflow={(target) => setCurrentPage(target as Page)}
                  />
                )}

                {currentPage === "nieuwe-casus" && (
                  <NieuweCasusPage
                    onCancel={() => setCurrentPage("casussen")}
                    onCreated={handleCaseCreated}
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
                  if (page === "matching") {
                    setMatchingInitialCaseId(selectedCase);
                  } else {
                    setMatchingInitialCaseId(null);
                  }
                  setSelectedCase(null);
                  setCurrentPage(page as Page);
                }}
                onEditCase={handleEditCase}
                onCloseCase={handleCloseCase}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}