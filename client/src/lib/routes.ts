export const PUBLIC_LANDING_URL = "/";
export const SPA_DASHBOARD_URL = "/dashboard/";
export const SPA_LANDING_URL = "/";
export const LOGIN_URL = "/login/";
export const REGISTER_URL = "/register/";
export const LOGOUT_URL = "/logout/";

/** Paths that must be served as Django HTML (auth), not the React demo shell. */
const AUTH_DOCUMENT_PATHS = new Set(
  [LOGIN_URL, REGISTER_URL, LOGOUT_URL].map((u) => u.replace(/\/+$/, "") || "/"),
);

export function isAuthDocumentPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return AUTH_DOCUMENT_PATHS.has(p);
}

/** Full URL to Django for the current auth path (login/register/logout), or null if not an auth path. */
export function getDjangoAuthDocumentRedirectUrl(): string | null {
  if (typeof window === "undefined" || !isAuthDocumentPath(window.location.pathname)) {
    return null;
  }
  const djangoOrigin =
    import.meta.env.VITE_DJANGO_DEV_ORIGIN ??
    (import.meta.env.DEV ? "http://127.0.0.1:8000" : window.location.origin);
  const normalizedOrigin = String(djangoOrigin).replace(/\/+$/, "");
  return `${normalizedOrigin}${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export const CARE_PATHS = {
  REGIEKAMER: "/regiekamer",
  MATCHING: "/care/matching",
  SETTINGS: "/instellingen",
  CASES_BASE: "/care/cases",
  CASUSSEN_BASE: "/care/casussen",
  BEOORDELINGEN: "/care/beoordelingen",
  PLAATSINGEN: "/care/plaatsingen",
  ZORGAANBIEDERS: "/care/zorgaanbieders",
  GEMEENTEN: "/care/gemeenten",
  /** Prefix for `/care/regios` via `startsWith` */
  REGIO: "/care/regio",
  SIGNALEN: "/care/signalen",
} as const;

function escapeRegExpLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Demo shell: `/care/cases/<digits>` only (legacy MultiTenant path matching). */
export function matchCareCasesNumericDetailPath(path: string): string | null {
  const re = new RegExp(`^${escapeRegExpLiteral(CARE_PATHS.CASES_BASE)}/(\\d+)$`);
  const match = path.match(re);
  return match?.[1] ?? null;
}

export function toCareCaseDetail(caseId: string): string {
  return `${CARE_PATHS.CASES_BASE}/${encodeURIComponent(caseId)}/`;
}

export function toCareCaseEdit(caseId: string, section?: string): string {
  const base = `${CARE_PATHS.CASUSSEN_BASE}/${encodeURIComponent(caseId)}/edit/`;
  if (!section) {
    return base;
  }
  return `${base}?section=${encodeURIComponent(section)}`;
}

export function toCareMatching(caseId?: string): string {
  if (!caseId) {
    return CARE_PATHS.MATCHING;
  }
  return `${CARE_PATHS.MATCHING}?openCase=${encodeURIComponent(caseId)}`;
}

export function toCareSettingsSection(sectionId: string): string {
  return `${CARE_PATHS.SETTINGS}?section=${encodeURIComponent(sectionId)}`;
}

export function toCareCasussenPlacementAction(caseId: string): string {
  return `${CARE_PATHS.CASUSSEN_BASE}/${encodeURIComponent(caseId)}/placement/action/`;
}
