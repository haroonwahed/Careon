export const tokens = {
  layout: {
    pageMaxWidth: "1280px",
    sectionSpacing: "24px",
    blockSpacing: "16px",
  },

  spacing: {
    pageGap: "24px",
    sectionGap: "16px",
    rowGap: "8px",
    inlineGap: "12px",
  },

  colors: {
    bg: "#0B0F1A",
    surface: "#121826",
    surfaceSubtle: "#0F1523",
    border: "rgba(255,255,255,0.08)",

    textPrimary: "#E5E7EB",
    textSecondary: "#9CA3AF",

    accentPrimary: "#7C3AED",
    accentWarning: "#F59E0B",
    accentDanger: "#EF4444",
    accentInfo: "#06B6D4",
  },

  radius: {
    sm: "8px",
    md: "12px",
  },

  /** Shared search / filter control strip (care list pages). */
  searchControl: {
    rowMinHeight: "40px",
    radius: "16px",
    tabHeight: "36px",
  },

  density: {
    pageHeaderMaxHeight: "96px",
    compactHeaderMaxHeight: "72px",
    metricStripHeight: "48px",
    metricItemMinWidth: "120px",
    operationalSignalHeight: "56px",
    worklistRowHeight: "64px",
    compactWorklistRowHeight: "56px",
    nextBestActionMinHeight: "112px",
    nextBestActionMaxHeight: "156px",
    processTimelineHeight: "64px",
    contextPanelSectionSpacing: "16px",
    rowHeight: "56px",
    compactRowHeight: "44px",
  },
} as const;
