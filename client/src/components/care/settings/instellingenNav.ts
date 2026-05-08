/**
 * Settings workspace navigation — grouped sidebar for Instellingen (operational governance).
 */

export type SettingsSectionId =
  | "algemeen"
  | "organisatie"
  | "gebruikers-rollen"
  | "workflow-regie"
  | "matching-engine"
  | "documenten-privacy"
  | "meldingen"
  | "integraties"
  | "audit-compliance"
  | "security"
  | "api-developers"
  | "facturatie";

export type SettingsNavGroup = {
  readonly label: string;
  readonly items: readonly { readonly id: SettingsSectionId; readonly label: string }[];
};

export const SETTINGS_NAV_GROUPS: readonly SettingsNavGroup[] = [
  {
    label: "Organisatie",
    items: [
      { id: "algemeen", label: "Algemeen" },
      { id: "organisatie", label: "Organisatie" },
    ],
  },
  {
    label: "Mensen & keten",
    items: [
      { id: "gebruikers-rollen", label: "Gebruikers & rollen" },
      { id: "workflow-regie", label: "Workflow & regie" },
      { id: "matching-engine", label: "Matching engine" },
    ],
  },
  {
    label: "Gegevens",
    items: [
      { id: "documenten-privacy", label: "Documenten & privacy" },
      { id: "meldingen", label: "Meldingen" },
    ],
  },
  {
    label: "Vertrouwen",
    items: [
      { id: "integraties", label: "Integraties" },
      { id: "audit-compliance", label: "Audit & compliance" },
      { id: "security", label: "Security" },
    ],
  },
  {
    label: "Platform",
    items: [
      { id: "api-developers", label: "API & developers" },
      { id: "facturatie", label: "Facturatie" },
    ],
  },
] as const;

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = "algemeen";

const ALL_SECTION_IDS: SettingsSectionId[] = SETTINGS_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));

export function getAllSettingsSectionIds(): readonly SettingsSectionId[] {
  return ALL_SECTION_IDS;
}

export function isSettingsSectionId(id: string): id is SettingsSectionId {
  return (ALL_SECTION_IDS as readonly string[]).includes(id);
}
