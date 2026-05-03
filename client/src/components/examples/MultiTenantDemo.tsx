/**
 * MultiTenantDemo - Full Platform with Role Switching
 * 
 * Demonstrates:
 * - Role/context switching in top bar
 * - Role-based sidebar navigation
 * - Different navigation per role
 * - Platform-level multi-tenancy
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { TopBar } from "../navigation/TopBar";
import { Sidebar } from "../navigation/Sidebar";
import { SystemAwarenessPage } from "../care/SystemAwarenessPage";
import { RegiosPage } from "../care/RegiosPage";
import { AssessmentQueuePage } from "../care/AssessmentQueuePage";
import { AanbiederBeoordelingPage } from "../care/AanbiederBeoordelingPage";
import { MatchingPageWrapper } from "../care/MatchingPageWrapper";
import { PlacementPageWrapper } from "../care/PlacementPageWrapper";
import { IntakeListPage } from "../care/IntakeListPage";
import { WorkloadPage } from "../care/WorkloadPage";
import { NieuweCasusPage } from "../care/NieuweCasusPage";
import { ZorgaanbiedersPage } from "../care/ZorgaanbiedersPage";
import { GemeentenPage } from "../care/GemeentenPage";
import { CaseExecutionPage } from "../care/CaseExecutionPage";
import { SignalenPage } from "../care/SignalenPage";
import { ActiesPage } from "../care/ActiesPage";
import { DocumentenPage } from "../care/DocumentenPage";
import { AudittrailPage } from "../care/AudittrailPage";
import { RapportagesPage } from "../care/RapportagesPage";
import { InstellingenPage } from "../care/InstellingenPage";
import { CareAppFrame } from "../care/CareAppFrame";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { useTasks } from "../../hooks/useTasks";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { countOpenCareTasks } from "../../lib/actiesTaskSemantics";
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

const PAGE_TO_HREF: Record<Page, string> = {
  regiekamer: "/regiekamer",
  casussen: "/casussen",
  "nieuwe-casus": "/casussen/nieuw",
  beoordelingen: "/beoordelingen",
  matching: "/matching",
  plaatsingen: "/plaatsingen",
  acties: "/acties",
  zorgaanbieders: "/zorgaanbieders",
  gemeenten: "/gemeenten",
  regios: "/regios",
  signalen: "/signalen",
  rapportages: "/rapportages",
  documenten: "/documenten",
  audittrail: "/audittrail",
  instellingen: "/instellingen",
  intake: "/intake",
  "mijn-casussen": "/mijn-casussen",
  gebruikers: "/gebruikers",
};

const GEMEENTE_PAGES: readonly Page[] = [
  "regiekamer",
  "casussen",
  "nieuwe-casus",
  "beoordelingen",
  "matching",
  "plaatsingen",
  "acties",
  "zorgaanbieders",
  "gemeenten",
  "regios",
  "signalen",
  "rapportages",
  "documenten",
  "audittrail",
  "instellingen",
];

const ZORGAANBIEDER_PAGES: readonly Page[] = ["intake", "mijn-casussen", "beoordelingen", "documenten"];

const ADMIN_PAGES: readonly Page[] = [
  "regiekamer",
  "regios",
  "gebruikers",
  "beoordelingen",
  "casussen",
  "matching",
  "plaatsingen",
  "acties",
  "signalen",
  "nieuwe-casus",
  "rapportages",
  "instellingen",
];

function normalizePageForRole(page: Page, role: RoleType): Page {
  const allowed = role === "gemeente" ? GEMEENTE_PAGES : role === "zorgaanbieder" ? ZORGAANBIEDER_PAGES : ADMIN_PAGES;
  if ((allowed as readonly string[]).includes(page)) {
    return page;
  }
  return role === "zorgaanbieder" ? "intake" : "regiekamer";
}

function pathWithoutTrailingSlash(path: string): string {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path || "/";
}

/** Resolve shell page + optional case overlay from URL (legacy /care/… and canonical /… paths). */
function getInitialNavigation(pathname: string): { page: Page; caseId: string | null } {
  const path = pathWithoutTrailingSlash(pathname.split("?")[0] ?? pathname);

  const casesSpaMatch = path.match(/^\/care\/cases\/(\d+)$/);
  if (casesSpaMatch) {
    return { page: "casussen", caseId: casesSpaMatch[1] };
  }
  if (path.startsWith("/care/casussen/new")) {
    return { page: "nieuwe-casus", caseId: null };
  }
  if (path.startsWith("/care/casussen")) {
    return { page: "casussen", caseId: null };
  }
  if (path.startsWith("/care/beoordelingen")) {
    return { page: "beoordelingen", caseId: null };
  }
  if (path.startsWith("/care/matching")) {
    return { page: "matching", caseId: null };
  }
  if (path.startsWith("/care/plaatsingen")) {
    return { page: "plaatsingen", caseId: null };
  }
  if (path.startsWith("/care/zorgaanbieders")) {
    return { page: "zorgaanbieders", caseId: null };
  }
  if (path.startsWith("/care/gemeenten")) {
    return { page: "gemeenten", caseId: null };
  }
  if (path.startsWith("/care/regio")) {
    return { page: "regios", caseId: null };
  }
  if (path.startsWith("/settings")) {
    return { page: "instellingen", caseId: null };
  }

  const shellMap: Record<string, Page> = {
    "/regiekamer": "regiekamer",
    "/casussen": "casussen",
    "/casussen/nieuw": "nieuwe-casus",
    "/beoordelingen": "beoordelingen",
    "/matching": "matching",
    "/plaatsingen": "plaatsingen",
    "/acties": "acties",
    "/zorgaanbieders": "zorgaanbieders",
    "/gemeenten": "gemeenten",
    "/regios": "regios",
    "/signalen": "signalen",
    "/rapportages": "rapportages",
    "/documenten": "documenten",
    "/audittrail": "audittrail",
    "/instellingen": "instellingen",
    "/intake": "intake",
    "/mijn-casussen": "mijn-casussen",
    "/gebruikers": "gebruikers",
  };

  const shellPage = shellMap[path];
  if (shellPage) {
    return { page: shellPage, caseId: null };
  }

  return { page: "regiekamer", caseId: null };
}

function pageToHref(page: Page, caseId: string | null): string {
  if (caseId) {
    return `/care/cases/${caseId}/`;
  }
  return PAGE_TO_HREF[page];
}

interface MultiTenantDemoProps {
  theme: "light" | "dark";
  onThemeToggle: () => void;
}

export function MultiTenantDemo({ theme, onThemeToggle }: MultiTenantDemoProps) {
  const { me } = useCurrentUser();
  const [currentContext, setCurrentContext] = useState<Context>(availableContexts[0]);
  const [currentPage, setCurrentPage] = useState<Page>(() =>
    normalizePageForRole(
      getInitialNavigation(typeof window !== "undefined" ? window.location.pathname : "/").page,
      availableContexts[0].type,
    ),
  );
  const [selectedCase, setSelectedCase] = useState<string | null>(() =>
    typeof window !== "undefined" ? getInitialNavigation(window.location.pathname).caseId : null,
  );
  const { cases } = useCases({ q: "" });
  const { providers } = useProviders({ q: "" });
  const { tasks: careTasks } = useTasks({ q: "" });
  /** Sidebar badges must match the same datasets as the pages they point to (e.g. Acties = CareTask list). */
  const queueCounts = useMemo(() => {
    const wf = buildWorkflowCases(cases, providers);
    return {
      casussen: wf.filter((casus) => casus.phase !== "afgerond").length,
      beoordelingen: wf.filter((casus) => casus.phase === "provider_beoordeling" && casus.daysInCurrentPhase >= 3).length,
      matching: wf.filter((casus) => casus.readyForMatching).length,
      plaatsingen: wf.filter((casus) => casus.readyForPlacement).length,
      acties: countOpenCareTasks(careTasks),
      signalen: wf.filter((casus) => casus.isBlocked || casus.urgency === "critical" || casus.daysInCurrentPhase > 7).length,
    };
  }, [cases, providers, careTasks]);

  const goToPage = useCallback(
    (page: Page) => {
      const normalized = normalizePageForRole(page, currentContext.type);
      setCurrentPage(normalized);
      setSelectedCase(null);
      window.history.pushState({}, "", pageToHref(normalized, null));
    },
    [currentContext.type],
  );

  useEffect(() => {
    const onPop = () => {
      const { page, caseId } = getInitialNavigation(window.location.pathname);
      const normalized = normalizePageForRole(page, currentContext.type);
      setCurrentPage(normalized);
      setSelectedCase(caseId);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [currentContext.type]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = getInitialNavigation(window.location.pathname);
    const normalized = normalizePageForRole(raw.page, currentContext.type);
    if (normalized === raw.page) {
      return;
    }
    window.history.replaceState(window.history.state, "", pageToHref(normalized, raw.caseId));
  }, [currentContext.type]);

  const handleContextSwitch = (contextId: string) => {
    const newContext = availableContexts.find((c) => c.id === contextId);
    if (newContext) {
      setCurrentContext(newContext);
      setSelectedCase(null);
      const home: Page = newContext.type === "zorgaanbieder" ? "intake" : "regiekamer";
      const normalized = normalizePageForRole(home, newContext.type);
      setCurrentPage(normalized);
      window.history.pushState({}, "", pageToHref(normalized, null));
    }
  };

  const handleNavigate = (itemId: string, _href: string) => {
    const normalized = normalizePageForRole(itemId as Page, currentContext.type);
    setCurrentPage(normalized);
    setSelectedCase(null);
    window.history.pushState({}, "", pageToHref(normalized, null));
  };

  const handleCaseClick = (caseId: string) => {
    setSelectedCase(caseId);
    const listPage = normalizePageForRole("casussen", currentContext.type);
    setCurrentPage(listPage);
    window.history.pushState({}, "", `/care/cases/${caseId}/`);
  };

  const handleCloseCaseDetail = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      setSelectedCase(null);
      const fallback = normalizePageForRole("casussen", currentContext.type);
      setCurrentPage(fallback);
      window.history.replaceState({}, "", pageToHref(fallback, null));
    }
  };

  const handleAppNavigate = useCallback(
    (path: string) => {
      const pathname = (path.split("?")[0] ?? path).split("#")[0] ?? "/";
      const { page, caseId } = getInitialNavigation(pathname);
      const normalized = normalizePageForRole(page, currentContext.type);
      setCurrentPage(normalized);
      setSelectedCase(caseId);
      window.history.pushState({}, "", path.startsWith("/") ? path : `/${path}`);
    },
    [currentContext.type],
  );

  const handleProviderSelect = (providerId: string) => {
    void providerId;
  };

  const handleRegionClick = (_regionId: string) => {
    goToPage("regios");
  };

  const handleViewGemeenten = (_regionId: string) => {
    goToPage("gemeenten");
  };

  const handleViewProviders = (_regionId: string) => {
    goToPage("zorgaanbieders");
  };

  /** Pilot / production: lock shell to Django session role when API disables switching. */
  useEffect(() => {
    if (!me || me.permissions.allowRoleSwitch) {
      return;
    }
    const subtitle =
      me.workflowRole === "zorgaanbieder"
        ? "Zorgaanbieder"
        : me.workflowRole === "admin"
          ? "Administrator"
          : "Gemeente";
    setCurrentContext({
      id: `session-${me.id}`,
      type: me.workflowRole,
      name: me.organization?.name ?? me.fullName,
      subtitle,
    });
  }, [me]);

  const handleOpenEntityFromAudit = (entry: any) => {
    if (entry.entityType === "casus" && entry.entityId) {
      handleCaseClick(entry.entityId);
      return;
    }
    if (entry.entityType === "document") {
      goToPage("documenten");
      return;
    }
    if (entry.entityType === "instellingen") {
      goToPage("instellingen");
    }
  };

  return (
    <div data-testid="care-app-shell" className="flex h-screen bg-background overflow-hidden">
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
          showRoleSwitcher={me?.permissions.allowRoleSwitch ?? true}
          notificationCount={0}
          onNotificationClick={() => {
            goToPage("acties");
          }}
          onSearch={() => undefined}
          userName={me?.fullName ?? "Jane Doe"}
          userRole="Regisseur"
          onProfileClick={() => {
            goToPage("instellingen");
          }}
          onSettingsClick={() => {
            goToPage("instellingen");
          }}
          onLogout={() => {
            const resetCtx = availableContexts[0];
            setCurrentContext(resetCtx);
            setSelectedCase(null);
            const home = normalizePageForRole("regiekamer", resetCtx.type);
            setCurrentPage(home);
            window.history.pushState({}, "", pageToHref(home, null));
          }}
        />

        {/* CONTENT */}
        <main data-testid="care-app-main" className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <CareAppFrame className="min-h-full">
            {selectedCase ? (
              <CaseExecutionPage
                caseId={selectedCase}
                role={currentContext.type}
                onBack={handleCloseCaseDetail}
              />
            ) : currentContext.type === "gemeente" ? (
              <>
                {currentPage === "regiekamer" && (
                  <SystemAwarenessPage onCaseClick={handleCaseClick} onAppNavigate={handleAppNavigate} />
                )}

                {currentPage === "casussen" && (
                  <WorkloadPage
                    onCaseClick={handleCaseClick}
                    onCreateCase={() => {
                      goToPage("nieuwe-casus");
                    }}
                    canCreateCase
                    role={currentContext.type}
                    onNavigateToWorkflow={(page) => {
                      goToPage(page as Page);
                    }}
                  />
                )}

                {currentPage === "nieuwe-casus" && (
                  <NieuweCasusPage
                    onCancel={() => {
                      goToPage("casussen");
                    }}
                    onCreated={() => {
                      goToPage("casussen");
                    }}
                  />
                )}

                {currentPage === "beoordelingen" && (
                  <AanbiederBeoordelingPage
                    role="gemeente"
                    onCaseClick={handleCaseClick}
                    onNavigateToMatching={() => {
                      goToPage("matching");
                    }}
                    onNavigateToPlaatsingen={() => {
                      goToPage("plaatsingen");
                    }}
                    onNavigateToCasussen={() => {
                      goToPage("casussen");
                    }}
                  />
                )}

                {currentPage === "matching" && (
                  <MatchingPageWrapper
                    onNavigateToCasussen={() => {
                      goToPage("casussen");
                    }}
                    onNavigateToBeoordelingen={() => {
                      goToPage("beoordelingen");
                    }}
                    onNavigateToCaseDetail={(id) => {
                      handleCaseClick(id);
                    }}
                  />
                )}

                {currentPage === "plaatsingen" && (
                  <PlacementPageWrapper
                    onNavigateToMatching={() => {
                      goToPage("matching");
                    }}
                  />
                )}

                {currentPage === "acties" && (
                  <ActiesPage onCaseClick={handleCaseClick} />
                )}

                {currentPage === "zorgaanbieders" && (
                  <ZorgaanbiedersPage theme={theme} />
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
                    onNavigateToWorkflow={(target) => {
                      if (target === "zorgaanbieders") {
                        goToPage("zorgaanbieders");
                      } else if (target === "matching") {
                        goToPage("matching");
                      } else if (target === "plaatsingen") {
                        goToPage("plaatsingen");
                      } else if (target === "beoordelingen") {
                        goToPage("beoordelingen");
                      } else if (target === "intake") {
                        goToPage("plaatsingen");
                      } else {
                        goToPage("casussen");
                      }
                    }}
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
            ) : currentContext.type === "zorgaanbieder" ? (
              <>
                {currentPage === "intake" && (
                  <IntakeListPage onCaseClick={handleCaseClick} role={currentContext.type as "gemeente" | "zorgaanbieder" | "admin"} />
                )}

                {currentPage === "mijn-casussen" && (
                  <WorkloadPage
                    onCaseClick={handleCaseClick}
                    role={currentContext.type}
                    onNavigateToWorkflow={(page) => {
                      goToPage(page as Page);
                    }}
                  />
                )}

                {currentPage === "beoordelingen" && (
                  <AanbiederBeoordelingPage
                    role="zorgaanbieder"
                    onCaseClick={handleCaseClick}
                    onNavigateToPlaatsingen={() => {
                      goToPage("intake");
                    }}
                    onNavigateToCasussen={() => {
                      goToPage("mijn-casussen");
                    }}
                  />
                )}

                {currentPage === "documenten" && (
                  <DocumentenPage />
                )}
              </>
            ) : (
              <>
                {currentPage === "regiekamer" && (
                  <SystemAwarenessPage onCaseClick={handleCaseClick} onAppNavigate={handleAppNavigate} />
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
                        Gebruikers en toegang
                      </p>
                    </div>

                    <div className="premium-card p-12 text-center">
                      <p className="mb-4 text-lg font-bold text-foreground">
                        Alleen beheerder
                      </p>
                      <p className="mb-8 text-muted-foreground">
                        Alleen voor beheerders.<br />
                        Beheer gebruikers, rechten en toegang.
                      </p>

                      <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="premium-card p-6">
                          <p className="mb-2 text-3xl font-bold text-foreground">24</p>
                          <p className="text-sm text-muted-foreground">Gemeente</p>
                        </div>
                        <div className="premium-card p-6">
                          <p className="mb-2 text-3xl font-bold text-foreground">18</p>
                          <p className="text-sm text-muted-foreground">Zorgaanbieder</p>
                        </div>
                        <div className="premium-card p-6">
                          <p className="mb-2 text-3xl font-bold text-primary">3</p>
                          <p className="text-sm text-muted-foreground">Admins</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentPage === "beoordelingen" && (
                  <AanbiederBeoordelingPage
                    role="admin"
                    onCaseClick={handleCaseClick}
                    onNavigateToMatching={() => {
                      goToPage("matching");
                    }}
                    onNavigateToPlaatsingen={() => {
                      goToPage("plaatsingen");
                    }}
                    onNavigateToCasussen={() => {
                      goToPage("casussen");
                    }}
                  />
                )}

                {(currentPage === "casussen" || currentPage === "matching" || currentPage === "plaatsingen" || currentPage === "acties" || currentPage === "signalen") && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="mb-2 text-3xl font-bold text-foreground">
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
                    onCancel={() => {
                      goToPage("casussen");
                    }}
                    onCreated={() => {
                      goToPage("casussen");
                    }}
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
            </CareAppFrame>
          </div>
        </main>
      </div>

    </div>
  );
}
