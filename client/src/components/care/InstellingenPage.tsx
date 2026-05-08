import { useCallback, useEffect, useState } from "react";
import { InstellingenSettingsExperience } from "./settings/InstellingenSettingsExperience";
import { DEFAULT_SETTINGS_SECTION, type SettingsSectionId } from "./settings/instellingenNav";
import {
  persistPreferences,
  persistSectionToUrlAndStorage,
  readInitialSettingsSection,
  readSectionFromSearch,
  readStoredPreferences,
  type SettingsPreferencesSnapshot,
} from "../../lib/settingsWorkspace";
import { SPA_DASHBOARD_URL } from "../../lib/routes";

function initialPrefs(): Partial<SettingsPreferencesSnapshot> | null {
  return typeof window !== "undefined" ? readStoredPreferences() : null;
}

export function InstellingenPage() {
  const stored = initialPrefs();

  const [activeSection, setActiveSection] = useState<SettingsSectionId>(() => readInitialSettingsSection());
  const [organizationName, setOrganizationName] = useState(
    () => stored?.organizationName ?? "Gemeente Utrecht",
  );
  const [defaultRegion, setDefaultRegion] = useState(() => stored?.defaultRegion ?? "Utrecht");
  const [dailyDigest, setDailyDigest] = useState(() => stored?.dailyDigest ?? true);
  const [criticalAlerts, setCriticalAlerts] = useState(() => stored?.criticalAlerts ?? true);
  const [mfaRequired, setMfaRequired] = useState(() => stored?.mfaRequired ?? true);
  const [autoEscalation, setAutoEscalation] = useState(() => stored?.autoEscalation ?? true);
  const [designMode, setDesignMode] = useState<"spa">("spa");
  const [designModeSaving, setDesignModeSaving] = useState(false);
  const [designModeMessage, setDesignModeMessage] = useState<string | null>(null);
  const [orgSaveMessage, setOrgSaveMessage] = useState<string | null>(null);

  const systemStateStrip = !criticalAlerts
    ? { label: "Kritieke signalen uit — het team ziet blokkades niet direct.", warn: true }
    : autoEscalation
      ? { label: "Automatische escalatie staat aan; stilstand in de keten wordt beperkt.", warn: false }
      : { label: "Escalatie deels handmatig — controleer eigenaarschap in de regiekamer.", warn: false };

  const activeToggles = [dailyDigest, criticalAlerts, mfaRequired, autoEscalation].filter(Boolean).length;

  useEffect(() => {
    persistSectionToUrlAndStorage(activeSection);
  }, [activeSection]);

  useEffect(() => {
    const onPopState = () => {
      const fromUrl = readSectionFromSearch(window.location.search);
      setActiveSection(fromUrl ?? DEFAULT_SETTINGS_SECTION);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    persistPreferences({
      organizationName,
      defaultRegion,
      dailyDigest,
      criticalAlerts,
      mfaRequired,
      autoEscalation,
    });
  }, [organizationName, defaultRegion, dailyDigest, criticalAlerts, mfaRequired, autoEscalation]);

  useEffect(() => {
    let ignore = false;

    const bootstrapDesignMode = async () => {
      try {
        const response = await fetch("/settings/design-mode/", {
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        });
        if (!response.ok) {
          throw new Error("Kon ontwerpmodus niet laden.");
        }
        const payload = (await response.json()) as { design_mode?: "spa" };
        const nextMode: "spa" = payload.design_mode === "spa" ? "spa" : "spa";
        if (!ignore) {
          setDesignMode(nextMode);
          try {
            window.localStorage.setItem("careon-design-mode", nextMode);
          } catch {
            // Ignore storage failures.
          }
        }
      } catch {
        const storedMode = window.localStorage.getItem("careon-design-mode");
        if (!ignore && storedMode === "spa") {
          setDesignMode("spa");
        }
      }
    };

    bootstrapDesignMode();
    return () => {
      ignore = true;
    };
  }, []);

  const getCsrfToken = () => {
    const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  };

  const handleDesignModeSave = async () => {
    setDesignModeSaving(true);
    setDesignModeMessage(null);

    try {
      const response = await fetch("/settings/design-mode/", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken(),
          Accept: "application/json",
        },
        body: JSON.stringify({ design_mode: designMode }),
      });

      if (!response.ok) {
        throw new Error("Kon ontwerpmodus niet opslaan.");
      }

      try {
        window.localStorage.setItem("careon-design-mode", designMode);
      } catch {
        // Ignore storage failures.
      }

      setDesignModeMessage("Workspace vastgelegd. Bezig met verversen…");
      window.location.href = SPA_DASHBOARD_URL;
    } catch {
      setDesignModeMessage("Opslaan is mislukt. Probeer opnieuw.");
      setDesignModeSaving(false);
    }
  };

  const handleOrgProfileSave = () => {
    const label = organizationName.trim() || "de organisatie";
    setOrgSaveMessage(
      `Ketenvoorkeuren voor ${label} zijn in deze browser vastgelegd (sessie): o.a. organisatie/regio, meldingen, MFA en escalatie waar van toepassing. Server-side opslag volgt wanneer de API beschikbaar is.`,
    );
  };

  const handleSectionChange = useCallback((id: SettingsSectionId) => {
    setActiveSection(id);
  }, []);

  return (
    <div
      data-testid="instellingen-page-root"
      className="w-full min-w-0 rounded-2xl border border-border/25 bg-gradient-to-b from-card/[0.08] via-background/20 to-background/40 p-4 shadow-[0_24px_80px_-48px_rgba(124,92,255,0.35)] md:p-6"
    >
      <InstellingenSettingsExperience
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        organizationName={organizationName}
        onOrganizationNameChange={setOrganizationName}
        defaultRegion={defaultRegion}
        onDefaultRegionChange={setDefaultRegion}
        themeLabel="Donker (operationeel)"
        languageLabel="Nederlands (NL)"
        timezoneLabel="Europe/Amsterdam"
        dailyDigest={dailyDigest}
        onDailyDigestChange={setDailyDigest}
        criticalAlerts={criticalAlerts}
        onCriticalAlertsChange={setCriticalAlerts}
        mfaRequired={mfaRequired}
        onMfaRequiredChange={setMfaRequired}
        autoEscalation={autoEscalation}
        onAutoEscalationChange={setAutoEscalation}
        designModeSaving={designModeSaving}
        designModeMessage={designModeMessage}
        onDesignModeSave={handleDesignModeSave}
        orgSaveMessage={orgSaveMessage}
        onOrgProfileSave={handleOrgProfileSave}
        systemStrip={systemStateStrip}
        activeToggles={activeToggles}
      />
    </div>
  );
}
