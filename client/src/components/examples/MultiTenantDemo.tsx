/**
 * MultiTenantDemo - Full Platform with Role Switching
 * 
 * Demonstrates:
 * - Role/context switching in top bar
 * - Role-based sidebar navigation
 * - Different navigation per role
 * - Platform-level multi-tenancy
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { tokens } from "../../design/tokens";
import {
  CARE_PATHS,
  matchCareCasesNumericDetailPath,
  SPA_DASHBOARD_URL,
  toCareCaseDetail,
} from "../../lib/routes";
import { apiClient } from "../../lib/apiClient";
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

/** Maps UI workspace chips to Django Organization.slug (pilot uses one tenant for all demo chips). */
const CONTEXT_ORGANIZATION_SLUG: Record<string, string> = {
  "gemeente-demo": "gemeente-demo",
  "gemeente-utrecht": "gemeente-demo",
  "gemeente-amsterdam": "gemeente-demo",
  "provider-horizon": "gemeente-demo",
  "admin-system": "gemeente-demo",
};

const availableContexts: Context[] = [
  {
    id: "gemeente-demo",
    type: "gemeente",
    name: "Gemeente Demo",
    subtitle: "Demo gemeente",
  },
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
  regiekamer: SPA_DASHBOARD_URL,
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
  instellingen: CARE_PATHS.SETTINGS,
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
  "zorgaanbieders",
  "gemeenten",
  "signalen",
  "audittrail",
  "nieuwe-casus",
  "rapportages",
  "documenten",
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

  const casesSpaCaseId = matchCareCasesNumericDetailPath(path);
  if (casesSpaCaseId) {
    return { page: "casussen", caseId: casesSpaCaseId };
  }
  if (path.startsWith(`${CARE_PATHS.CASUSSEN_BASE}/new`)) {
    return { page: "nieuwe-casus", caseId: null };
  }
  if (path.startsWith(CARE_PATHS.CASUSSEN_BASE)) {
    return { page: "casussen", caseId: null };
  }
  if (path.startsWith(CARE_PATHS.BEOORDELINGEN)) {
    return { page: "beoordelingen", caseId: null };
  }
  if (path.startsWith(CARE_PATHS.MATCHING)) {
    return { page: "matching", caseId: null };
  }
  if (path.startsWith(CARE_PATHS.PLAATSINGEN)) {
    return { page: "plaatsingen", caseId: null };
  }
  if (path.startsWith(CARE_PATHS.ZORGAANBIEDERS)) {
    return { page: "zorgaanbieders", caseId: null };
  }
  if (path.startsWith(CARE_PATHS.GEMEENTEN)) {
    return { page: "gemeenten", caseId: null };
  }
  if (path.startsWith(CARE_PATHS.REGIO)) {
    return { page: "regios", caseId: null };
  }
  if (path.startsWith(CARE_PATHS.SIGNALEN)) {
    return { page: "signalen", caseId: null };
  }
  if (path.startsWith("/settings")) {
    return { page: "instellingen", caseId: null };
  }

  const shellMap: Record<string, Page> = {
    "/dashboard": "regiekamer",
    [CARE_PATHS.REGIEKAMER]: "regiekamer",
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
    [CARE_PATHS.SETTINGS]: "instellingen",
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
    return toCareCaseDetail(caseId);
  }
  return PAGE_TO_HREF[page];
}

function buildProfileInitials(fullName: string, username: string): string {
  const name = (fullName || "").trim();
  if (name.length >= 2) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]?.[0] ?? "";
      const b = parts[parts.length - 1]?.[0] ?? "";
      return `${a}${b}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const u = (username || "").trim();
  if (u.length >= 2) {
    return u.slice(0, 2).toUpperCase();
  }
  return u ? u.slice(0, 1).toUpperCase() : "?";
}

interface MultiTenantDemoProps {
  theme: "light" | "dark";
  onThemeToggle: () => void;
}

export function MultiTenantDemo({ theme, onThemeToggle }: MultiTenantDemoProps) {
  const { me, refetch: refetchMe } = useCurrentUser();
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

  const sessionProfile = useMemo(() => {
    if (!me) {
      return { displayName: "Gebruiker", roleLabel: "Regisseur", initials: "?" };
    }
    const displayName = (me.fullName || "").trim() || me.username;
    const roleLabel =
      me.workflowRole === "zorgaanbieder"
        ? "Zorgaanbieder"
        : me.workflowRole === "admin"
          ? "Administrator"
          : "Regisseur";
    return {
      displayName,
      roleLabel,
      initials: buildProfileInitials(me.fullName || me.username, me.username),
    };
  }, [me]);

  /** Alleen gemeente en admin mogen een nieuwe casus starten vanuit shell (niet zorgaanbieder). */
  const workspaceAllowsNewCasus = currentContext.type === "gemeente" || currentContext.type === "admin";

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
    if (!newContext) {
      return;
    }
    const orgSlug = CONTEXT_ORGANIZATION_SLUG[contextId];
    if (orgSlug) {
      void apiClient
        .post<{ ok: boolean }>("/care/api/session/active-organization/", { organization_slug: orgSlug })
        .then(() => refetchMe())
        .catch(() => undefined);
    }
    setCurrentContext(newContext);
    setSelectedCase(null);
    const home: Page = newContext.type === "zorgaanbieder" ? "intake" : "regiekamer";
    const normalized = normalizePageForRole(home, newContext.type);
    setCurrentPage(normalized);
    window.history.pushState({}, "", pageToHref(normalized, null));
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
    window.history.pushState({}, "", toCareCaseDetail(caseId));
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

  /**
   * Align shell role with `/care/api/me/` (Django session).
   * - Pilot (`allowRoleSwitch: false`): always mirror session (no demo switching).
   * - Demo (`allowRoleSwitch: true`): mirror only when session identity/role changes (login),
   *   so manual TopBar switches are not overwritten on every render.
   */
  const sessionMeKeyRef = useRef<string | null>(null);
  const sessionOrgSyncedRef = useRef(false);
  const demoContextId = useMemo(() => {
    if (!me) {
      return null;
    }
    const orgSlug = me.organization?.slug?.toLowerCase() ?? "";
    const orgName = me.organization?.name?.toLowerCase() ?? "";
    const email = me.email.toLowerCase();
    // Only pin the demo gemeente context for actual gemeente sessions. Org names like
    // "Pilot Demo …" match `includes("demo")` for providers too — that incorrectly forced
    // gemeente UI after login as zorgaanbieder (e.g. golden-path E2E).
    if (
      me.workflowRole === "gemeente"
      && (orgSlug === "gemeente-demo" || orgName.includes("demo") || email === "test@gemeente-demo.nl")
    ) {
      return "gemeente-demo";
    }
    // Org slug fallback: only pin when the slug resolves to a context whose type
    // matches the session role. Otherwise (e.g. provider Kompas seeded inside the
    // shared "gemeente-demo" tenant) returning the slug would force a non-gemeente
    // user into the gemeente shell — golden-path E2E regression after da8dddb.
    const slug = me.organization?.slug ?? null;
    if (slug) {
      const matched = availableContexts.find((context) => context.id === slug);
      if (matched && matched.type !== me.workflowRole) {
        return null;
      }
    }
    return slug;
  }, [me]);

  useEffect(() => {
    if (!me) {
      sessionMeKeyRef.current = null;
      return;
    }
    const subtitle =
      me.workflowRole === "zorgaanbieder"
        ? "Zorgaanbieder"
        : me.workflowRole === "admin"
          ? "Administrator"
          : "Gemeente";
    const nextContext: Context = {
      id: `session-${me.id}`,
      type: me.workflowRole,
      name: me.organization?.name ?? me.fullName,
      subtitle,
    };
    if (!me.permissions.allowRoleSwitch) {
      setCurrentContext(nextContext);
      return;
    }
    const key = `${me.id}:${me.workflowRole}`;
    if (sessionMeKeyRef.current === key) {
      return;
    }
    sessionMeKeyRef.current = key;
    if (demoContextId) {
      const matched = availableContexts.find((context) => context.id === demoContextId);
      setCurrentContext(matched ?? nextContext);
    } else {
      setCurrentContext(nextContext);
    }
  }, [demoContextId, me]);

  /** When shell role changes (e.g. login as zorgaanbieder), drop pages that do not exist for that actor. */
  useEffect(() => {
    setCurrentPage((p) => normalizePageForRole(p, currentContext.type));
  }, [currentContext.type]);

  useEffect(() => {
    if (!me || !demoContextId) {
      return;
    }
    const matched = availableContexts.find((context) => context.id === demoContextId);
    if (!matched) {
      return;
    }
    if (currentContext.id !== matched.id) {
      setCurrentContext(matched);
      setCurrentPage(normalizePageForRole("regiekamer", matched.type));
      window.history.replaceState({}, "", pageToHref("regiekamer", null));
    }
  }, [currentContext.id, demoContextId, me]);

  /** Sync Django session `active_organization_id` so APIs see the same tenant as the shell (refresh-safe). */
  useEffect(() => {
    if (!me || sessionOrgSyncedRef.current) {
      return;
    }
    const slug = me.organization?.slug;
    if (!slug) {
      return;
    }
    sessionOrgSyncedRef.current = true;
    void apiClient
      .post<{ ok: boolean }>("/care/api/session/active-organization/", { organization_slug: slug })
      .then(() => {
        void refetchMe();
      })
      .catch(() => {
        sessionOrgSyncedRef.current = false;
      });
  }, [me, refetchMe]);

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
        badgeOverrides={
          currentContext.type === "gemeente" || currentContext.type === "admin" ? queueCounts : undefined
        }
        profileDisplayName={sessionProfile.displayName}
        profileSubtitle={currentContext.subtitle || sessionProfile.roleLabel}
        profileInitials={sessionProfile.initials}
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
          userName={sessionProfile.displayName}
          userRole={currentContext.subtitle || sessionProfile.roleLabel}
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
            <CareAppFrame
              className="min-h-full"
              layoutMaxWidth={currentPage === "regiekamer" ? tokens.layout.regiekamerWorkspaceMaxWidth : undefined}
            >
            {selectedCase ? (
              <CaseExecutionPage
                caseId={selectedCase}
                role={currentContext.type}
                onBack={handleCloseCaseDetail}
              />
            ) : currentContext.type === "gemeente" || currentContext.type === "admin" ? (
              <>
                {currentPage === "regiekamer" && (
                  <SystemAwarenessPage
                    onCaseClick={handleCaseClick}
                    onAppNavigate={handleAppNavigate}
                    canCreateCase={workspaceAllowsNewCasus}
                    onCreateCase={() => {
                      goToPage("nieuwe-casus");
                    }}
                  />
                )}

                {currentPage === "casussen" && (
                  <WorkloadPage
                    onCaseClick={handleCaseClick}
                    onCreateCase={() => {
                      goToPage("nieuwe-casus");
                    }}
                    canCreateCase={workspaceAllowsNewCasus}
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
                    role={currentContext.type === "admin" ? "admin" : "gemeente"}
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
                  <ActiesPage
                    onCaseClick={handleCaseClick}
                    onNavigateToCasussen={() => {
                      goToPage("casussen");
                    }}
                  />
                )}

                {currentPage === "zorgaanbieders" && (
                  <ZorgaanbiedersPage
                    theme={theme}
                    onNavigateToMatching={() => {
                      goToPage("matching");
                    }}
                  />
                )}

                {currentPage === "gemeenten" && (
                  <GemeentenPage />
                )}

                {currentPage === "regios" && (
                  <RegiosPage
                    onRegionClick={handleRegionClick}
                    onViewGemeenten={handleViewGemeenten}
                    onViewProviders={handleViewProviders}
                    onNavigateToSignalen={() => {
                      goToPage("signalen");
                    }}
                    onNavigateToMatching={() => {
                      goToPage("matching");
                    }}
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

                {currentContext.type === "admin" && currentPage === "gebruikers" && (
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

                      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
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
            ) : null}
            </CareAppFrame>
          </div>
        </main>
      </div>

    </div>
  );
}
