import {
  DEFAULT_SETTINGS_SECTION,
  isSettingsSectionId,
  type SettingsSectionId,
} from "../components/care/settings/instellingenNav";

/** URL query: `?section=workflow-regie` */
export const SETTINGS_SECTION_QUERY_PARAM = "section";

export const SETTINGS_SECTION_STORAGE_KEY = "careon-settings-active-section";

export const SETTINGS_PREFERENCES_STORAGE_KEY = "careon-settings-preferences-v1";

export type SettingsPreferencesSnapshot = {
  organizationName: string;
  defaultRegion: string;
  dailyDigest: boolean;
  criticalAlerts: boolean;
  mfaRequired: boolean;
  autoEscalation: boolean;
};

export function readSectionFromSearch(search: string): SettingsSectionId | null {
  const qs = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(qs);
  const raw = params.get(SETTINGS_SECTION_QUERY_PARAM);
  return raw && isSettingsSectionId(raw) ? raw : null;
}

/** Prioriteit: URL → sessionStorage → default. Alleen in browser. */
export function readInitialSettingsSection(): SettingsSectionId {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS_SECTION;
  }
  const fromUrl = readSectionFromSearch(window.location.search);
  if (fromUrl) {
    return fromUrl;
  }
  try {
    const stored = sessionStorage.getItem(SETTINGS_SECTION_STORAGE_KEY);
    if (stored && isSettingsSectionId(stored)) {
      return stored;
    }
  } catch {
    /* ignore quota / private mode */
  }
  return DEFAULT_SETTINGS_SECTION;
}

export function persistSectionToUrlAndStorage(section: SettingsSectionId): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(SETTINGS_SECTION_STORAGE_KEY, section);
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href);
  url.searchParams.set(SETTINGS_SECTION_QUERY_PARAM, section);
  window.history.replaceState(window.history.state, "", url.toString());
}

export function readStoredPreferences(): Partial<SettingsPreferencesSnapshot> | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(SETTINGS_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as Partial<SettingsPreferencesSnapshot>;
  } catch {
    return null;
  }
}

export function persistPreferences(prefs: SettingsPreferencesSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(SETTINGS_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}
