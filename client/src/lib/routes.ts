export const PUBLIC_LANDING_URL = "/";
export const SPA_DASHBOARD_URL = "/dashboard/";
export const SPA_LANDING_URL = "/";
export const LOGIN_URL = "/login/";
export const REGISTER_URL = "/register/";
export const LOGOUT_URL = "/logout/";

export const CARE_PATHS = {
  REGIEKAMER: "/regiekamer",
  MATCHING: "/care/matching",
  SETTINGS: "/instellingen",
  CASES_BASE: "/care/cases",
  CASUSSEN_BASE: "/care/casussen",
} as const;

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
