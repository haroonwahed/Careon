/**
 * Operational spacing rhythm — semantic layout zones for care list/command pages.
 * Values map to CSS custom properties in `globals.css` (`--care-rhythm-*`).
 *
 * @see tokens.spacing.rhythm in design/tokens.ts
 */
export const CARE_RHYTHM = {
  /** Page stack: header → attention → filters → main (CarePageTemplate). */
  pageStack: "care-page-rhythm",
  zoneHeader: "care-op-zone care-op-zone--header",
  zoneAlert: "care-op-zone care-op-zone--alert",
  zoneControl: "care-op-zone care-op-zone--control",
  zoneWorkflow: "care-op-zone care-op-zone--workflow",
  zoneMain: "care-op-zone care-op-zone--main",
  zoneContext: "care-op-zone care-op-zone--context",
  /** Extra pause between major sections (e.g. Doorstroom → Werkvoorraad). */
  quietGap: "care-quiet-gap",
  /** Queue surface: toolbar → header → rows (CareWorkListCard + filters). */
  queueShell: "care-queue-shell",
  queueToolbar: "care-queue-shell__toolbar",
  queueHeader: "care-queue-shell__header",
  queueRows: "care-queue-shell__rows",
  /** Section title row (CareSectionHeader). */
  sectionHeader: "care-section-header",
  /** Section body offset from header (CareSectionBody). */
  sectionBody: "care-section-body",
  /** Stacked attention bands (dominant + KPI). */
  attentionStack: "care-attention-stack",
  /** Vertical stack inside workspace / list body (empty + list + hints). */
  zoneStack: "care-zone-stack",
  /** Badge + search in werkvoorraad header meta. */
  metaStack: "care-meta-stack",
  /** CareSearchFiltersBar root. */
  searchStack: "care-search-control-stack",
  /** Main + right rail page layout (Casussen, Coordination). */
  layoutWithRail: "care-layout-with-rail",
  /** Empty / loading / error in main column. */
  emptyZone: "care-empty-zone",
} as const;

/** Canonical rhythm values (px) — keep in sync with globals.css. */
export const CARE_RHYTHM_PX = {
  page: 24,
  pageMobile: 20,
  section: 20,
  sectionMobile: 16,
  quiet: 20,
  band: 16,
  control: 12,
  filterQueue: 12,
  queueLead: 10,
  queueHeader: 8,
  empty: 16,
  layoutRail: 24,
} as const;
