export const tokens = {
  layout: {
    pageMaxWidth: "1536px",
    contentMeasure: "48rem",
    contentMeasureNarrow: "40rem",
    contentMeasureTight: "20rem",
    dialogMaxWidth: "34rem",
    dialogWideMaxWidth: "35rem",
    dialogNarrowMaxWidth: "32rem",
    dialogContentMaxWidth: "26rem",
    phaseBadgeMaxWidth: "11rem",
    /** Fixed leading column on md+ work rows — keeps titles/status aligned across rows. */
    worklistLeadingColumnWidth: "13rem",
    /** Reserved column for dominant status chip on md+ work rows. */
    worklistStatusColumnWidth: "14rem",
    /** Minimum width for row CTA so ghost vs primary labels share one vertical edge. */
    worklistActionColumnMinWidth: "10.5rem",
    chipMeasure: "8.75rem",
    chipMeasureWide: "12.5rem",
    rowLabelMaxWidth: "60%",
    tooltipMaxWidth: "16.25rem",
    matchingGridLeftMinWidth: "520px",
    matchingGridRightMinWidth: "680px",
    matchingWorkspaceMinHeight: "620px",
    matchingWorkspaceDesktopHeight: "calc(100vh - 170px)",
    /** Regiekamer: main + right rail without crunching the doorstroom strip. */
    regiekamerWorkspaceMaxWidth: "96rem",
    /**
     * Regiekamer right rail (`aside`): max height inside the main scroll region.
     * Shell scrollport sits below `TopBar` (`h-16` = 4rem); rail uses `sticky` + `top-4` (1rem).
     */
    regiekamerRailMaxHeight: "calc(100dvh - 5rem)",
    timelineConnectorTop: "2.5rem",
    edgeZero: "0px",
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

    /** Casussen high-fidelity mock (dark chrome): use via WorkloadPage only — keeps brand purple consistent with designs. */
    casussenAccent: "#6D5DFC",
    casussenSurfaceRaised: "#161B22",
    casussenPageChrome: "#0B0E14",
    casussenMetricBg: "rgba(22, 27, 34, 0.92)",
    casussenMetricBorder: "rgba(125, 211, 252, 0.45)",
    casussenMetricText: "#E0F2FE",
    casussenMetricDot: "#7DD3FC",
    casussenUrgencyNormal: "#00C853",
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

  /** Settings workspace: sidebar width and editorial content measure inside main pane. */
  settingsWorkspace: {
    sidebarWidth: "240px",
    contentMeasure: "40rem",
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
