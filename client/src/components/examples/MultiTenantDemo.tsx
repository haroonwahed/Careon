/**
 * MultiTenantDemo - Full Platform shell for authenticated Care surfaces.
 *
 * The shell mirrors the active session context and keeps internal demo affordances
 * out of the stakeholder-facing UI.
 */

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "../navigation/TopBar";
import { Sidebar } from "../navigation/Sidebar";
import { CareAppFrame } from "../care/CareAppFrame";
// AanbiederreactiePage kept as eager because buildAanbiederreactieRows is also imported from it
import { AanbiederreactiePage } from "../care/AanbiederreactiePage";
import { buildAanbiederreactieRows } from "../care/AanbiederreactiePage";

// Route-level code splitting — each page loads only when first rendered
const SystemAwarenessPage = lazy(() => import("../care/SystemAwarenessPage").then(m => ({ default: m.SystemAwarenessPage })));
const RegiosPage = lazy(() => import("../care/RegiosPage").then(m => ({ default: m.RegiosPage })));
const AssessmentQueuePage = lazy(() => import("../care/AssessmentQueuePage").then(m => ({ default: m.AssessmentQueuePage })));
const MatchingPageWrapper = lazy(() => import("../care/MatchingPageWrapper").then(m => ({ default: m.MatchingPageWrapper })));
const PlacementPageWrapper = lazy(() => import("../care/PlacementPageWrapper").then(m => ({ default: m.PlacementPageWrapper })));
const IntakeListPage = lazy(() => import("../care/IntakeListPage").then(m => ({ default: m.IntakeListPage })));
const WorkloadPage = lazy(() => import("../care/WorkloadPage").then(m => ({ default: m.WorkloadPage })));
const NieuweCasusPage = lazy(() => import("../care/NieuweCasusPage").then(m => ({ default: m.NieuweCasusPage })));
const AccessDeniedPage = lazy(() => import("../care/AccessDeniedPage").then(m => ({ default: m.AccessDeniedPage })));
const ZorgaanbiedersPage = lazy(() => import("../care/ZorgaanbiedersPage").then(m => ({ default: m.ZorgaanbiedersPage })));
const GemeentenPage = lazy(() => import("../care/GemeentenPage").then(m => ({ default: m.GemeentenPage })));
const CaseExecutionPage = lazy(() => import("../care/CaseExecutionPage").then(m => ({ default: m.CaseExecutionPage })));
const SignalenPage = lazy(() => import("../care/SignalenPage").then(m => ({ default: m.SignalenPage })));
const ActiesPage = lazy(() => import("../care/ActiesPage").then(m => ({ default: m.ActiesPage })));
const DocumentenPage = lazy(() => import("../care/DocumentenPage").then(m => ({ default: m.DocumentenPage })));
const AudittrailPage = lazy(() => import("../care/AudittrailPage").then(m => ({ default: m.AudittrailPage })));
const RapportagesPage = lazy(() => import("../care/RapportagesPage").then(m => ({ default: m.RapportagesPage })));
const InstellingenPage = lazy(() => import("../care/InstellingenPage").then(m => ({ default: m.InstellingenPage })));
const GebruikersPage = lazy(() => import("../care/GebruikersPage").then(m => ({ default: m.GebruikersPage })));
const AanbiederPortaalPage = lazy(() => import("../care/AanbiederPortaalPage").then(m => ({ default: m.AanbiederPortaalPage })));
import { tokens } from "../../design/tokens";
import {
  CARE_PATHS,
  matchCareCasesNumericDetailPath,
  redirectIfAuthDocumentPath,
  SPA_DASHBOARD_URL,
  toCareCaseDetail,
} from "../../lib/routes";
import { apiClient } from "../../lib/apiClient";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { useTasks } from "../../hooks/useTasks";
import { useProviderEvaluations } from "../../hooks/useProviderEvaluations";
import { useAssessments } from "../../hooks/useAssessments";
import { useRegions } from "../../hooks/useRegions";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { countOpenCareTasks } from "../../lib/actiesTaskSemantics";
import { buildWorkflowCases } from "../../lib/workflowUi";
import { countActionSignals } from "../../lib/buildActionSignals";

type RoleType = "gemeente" | "zorgaanbieder" | "admin";

interface Context {
  id: string;
  type: RoleType;
  name: string;
  subtitle?: string;
}

interface AuditEntry {
  entityType: string;
  entityId?: string;
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
    name: "Haroon Wahed's Regie",
    subtitle: "Administrator"
  }
];

type Page =
  | "coordination"
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
  | "gebruikers"
  | "geen-toegang";

const PAGE_TO_HREF: Record<Page, string> = {
  coordination: SPA_DASHBOARD_URL,
  casussen: "/casussen",
  "nieuwe-casus": "/casussen/nieuw",
  // Compatibility route for the Reacties / Aanbiederreactie surface.
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
  "geen-toegang": "/geen-toegang",
};

const GEMEENTE_PAGES: readonly Page[] = [
  "coordination",
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

const ZORGAANBIEDER_PAGES: readonly Page[] = ["intake", "mijn-casussen", "nieuwe-casus", "beoordelingen", "documenten"];

const ADMIN_PAGES: readonly Page[] = [
  "coordination",
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
  if (page === "geen-toegang") {
    return page;
  }
  const allowed = role === "gemeente" ? GEMEENTE_PAGES : role === "zorgaanbieder" ? ZORGAANBIEDER_PAGES : ADMIN_PAGES;
  if ((allowed as readonly string[]).includes(page)) {
    return page;
  }
  return role === "zorgaanbieder" ? "intake" : "coordination";
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
    "/dashboard": "coordination",
    [CARE_PATHS.COORDINATION]: "coordination",
    "/casussen": "casussen",
    "/casussen/nieuw": "nieuwe-casus",
    // Compatibility route for the Reacties / Aanbiederreactie surface.
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
    "/geen-toegang": "geen-toegang",
  };

  const shellPage = shellMap[path];
  if (shellPage) {
    return { page: shellPage, caseId: null };
  }

  return { page: "coordination", caseId: null };
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
  /** If the shell ever mounts on `/login` etc. (missed redirect), leave immediately for Django auth HTML. */
  useLayoutEffect(() => {
    redirectIfAuthDocumentPath();
  }, []);
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
  const { evaluations: providerEvaluations } = useProviderEvaluations();
  const { assessments } = useAssessments({ q: "" });
  const { regions } = useRegions({ q: "" });
  /** Sidebar badges must match the same datasets as the pages they point to (e.g. Acties = CareTask list). */
  const queueCounts = useMemo(() => {
    const wf = buildWorkflowCases(cases, providers);
    const aanbiederreacties = buildAanbiederreactieRows(cases, providerEvaluations);
    const signalen = countActionSignals(wf, assessments, providers, regions);
    return {
      casussen: wf.filter((casus) => casus.phase !== "afgerond").length,
      beoordelingen: aanbiederreacties.length,
      matching: wf.filter((casus) => casus.phase === "matching").length,
      plaatsingen: wf.filter((casus) => casus.phase === "plaatsing").length,
      acties: countOpenCareTasks(careTasks),
      signalen,
    };
  }, [cases, providers, careTasks, providerEvaluations, assessments, regions]);

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
          : me.workflowRole === "gemeente"
            ? "Gemeente"
            : "Regisseur";
    return {
      displayName,
      roleLabel,
      initials: buildProfileInitials(me.fullName || me.username, me.username),
    };
  }, [me]);

  const screenshotContext = currentContext;
  const screenshotProfile = sessionProfile;

  /** Gemeente, zorgaanbieder en admin kunnen een nieuwe casus (aanmelding) starten — zelfde API, andere ketenverwachting. */
  const workspaceAllowsNewCasus =
    currentContext.type === "gemeente" || currentContext.type === "admin" || currentContext.type === "zorgaanbieder";

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
    const home: Page = newContext.type === "zorgaanbieder" ? "intake" : "coordination";
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
      const fullPath = path.startsWith("/") ? path : `/${path}`;
      const url = new URL(fullPath, window.location.origin);
      const pathname = url.pathname;
      const caseFromPath = matchCareCasesNumericDetailPath(pathname);
      const { page } = getInitialNavigation(pathname);
      const normalized = normalizePageForRole(page, currentContext.type);
      setCurrentPage(normalized);
      setSelectedCase(caseFromPath);
      window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    },
    [currentContext.type],
  );

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
      setCurrentPage(normalizePageForRole("coordination", matched.type));
      window.history.replaceState({}, "", pageToHref("coordination", null));
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

  const handleOpenEntityFromAudit = (entry: AuditEntry) => {
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[9999] focus:rounded focus:bg-background focus:px-3 focus:py-1.5 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-md focus:ring-2 focus:ring-primary"
      >
        Ga naar hoofdinhoud
      </a>
      {/* SIDEBAR */}
      <Sidebar
        role={screenshotContext.type}
        activeItemId={
          currentPage === "nieuwe-casus"
            ? screenshotContext.type === "zorgaanbieder"
              ? "nieuwe-casus"
              : "casussen"
            : currentPage
        }
        onNavigate={handleNavigate}
        badgeOverrides={
          screenshotContext.type === "zorgaanbieder"
            ? { beoordelingen: queueCounts.beoordelingen }
            : screenshotContext.type === "gemeente" || screenshotContext.type === "admin"
              ? queueCounts
              : undefined
        }
        profileDisplayName={screenshotProfile.displayName}
        profileSubtitle={screenshotContext.subtitle || screenshotProfile.roleLabel}
        profileInitials={screenshotProfile.initials}
      />

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <TopBar
          theme={theme}
          onThemeToggle={onThemeToggle}
          currentContext={screenshotContext}
          availableContexts={availableContexts}
          onContextSwitch={handleContextSwitch}
          showRoleSwitcher={true}
          notificationCount={currentPage === "casussen" ? 2 : 0}
          onNotificationClick={() => {
            goToPage("acties");
          }}
          onSearch={() => undefined}
          userName={screenshotProfile.displayName}
          userRole={screenshotContext.subtitle || screenshotProfile.roleLabel}
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
            const home = normalizePageForRole("coordination", resetCtx.type);
            setCurrentPage(home);
            window.history.pushState({}, "", pageToHref(home, null));
          }}
        />

        {/* CONTENT */}
        <main data-testid="care-app-main" className="flex-1 flex flex-col overflow-hidden">
          <div
            id="main-content"
            className="flex-1 overflow-y-auto"
            style={{ backgroundColor: "var(--surface-2)" }}
          >
            <CareAppFrame
              className="min-h-full"
              noVerticalPadding={false}
              layoutMaxWidth={
                currentPage === "coordination"
                  ? tokens.layout.pageMaxWidth
                  : currentPage === "casussen"
                    ? "1280px"
                    : undefined
              }
            >
            <Suspense fallback={<div className="flex flex-1 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" /></div>}>
            {currentPage === "geen-toegang" ? (
              <AccessDeniedPage
                onGoDashboard={() => {
                  goToPage("coordination");
                }}
                onGoCasussen={() => {
                  goToPage(currentContext.type === "zorgaanbieder" ? "mijn-casussen" : "casussen");
                }}
              />
            ) : selectedCase ? (
              <CaseExecutionPage
                caseId={selectedCase}
                role={currentContext.type}
                onBack={handleCloseCaseDetail}
                onAppNavigate={handleAppNavigate}
              />
            ) : currentContext.type === "gemeente" || currentContext.type === "admin" ? (
              <>
                {currentPage === "coordination" && (
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
                    role={screenshotContext.type}
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
                  <AanbiederreactiePage
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
                    onNavigateToAanbiederreacties={() => {
                      goToPage("beoordelingen");
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
                  <GebruikersPage />
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
                    canCreateCase={workspaceAllowsNewCasus}
                    onCreateCase={() => {
                      goToPage("nieuwe-casus");
                    }}
                    onNavigateToWorkflow={(page) => {
                      goToPage(page as Page);
                    }}
                  />
                )}

                {currentPage === "nieuwe-casus" && (
                  <NieuweCasusPage
                    backLabel="Terug naar mijn aanvragen"
                    onCancel={() => {
                      goToPage("mijn-casussen");
                    }}
                    onCreated={() => {
                      goToPage("mijn-casussen");
                    }}
                  />
                )}

                {currentPage === "beoordelingen" && (
                  <AanbiederPortaalPage
                    onCaseClick={handleCaseClick}
                  />
                )}

                {currentPage === "documenten" && (
                  <DocumentenPage />
                )}
              </>
            ) : null}
            </Suspense>
            </CareAppFrame>
          </div>
        </main>
      </div>

    </div>
  );
}
