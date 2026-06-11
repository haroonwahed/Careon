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
    /** Coordination: main + right rail without crunching the doorstroom strip. */
    coordinationWorkspaceMaxWidth: "96rem",
    /**
     * Coordination right rail (`aside`): max height inside the main scroll region.
     * Shell scrollport sits below `TopBar` (`h-16` = 4rem); rail uses `sticky` + `top-4` (1rem).
     */
    coordinationRailMaxHeight: "calc(100dvh - 5rem)",
    timelineConnectorTop: "2.25rem",
    edgeZero: "0px",
    sectionSpacing: "24px",
    blockSpacing: "16px",
  },

  spacing: {
    pageGap: "24px",
    sectionGap: "16px",
    rowGap: "8px",
    inlineGap: "12px",
    /**
     * Semantic operational rhythm — mirrored as `--care-rhythm-*` in globals.css.
     * Use via `CARE_RHYTHM` / `care-page-rhythm`; avoid ad-hoc `space-y-*` on queue shells.
     */
    rhythm: {
      /** Page stack: header → attention → filters → main */
      page: "24px",
      pageMobile: "20px",
      /** Major blocks (werklijst section, doorstroom → list) */
      section: "20px",
      sectionMobile: "16px",
      /** Extra pause between workflow lanes (e.g. doorstroom strip → werkvoorraad) */
      quiet: "20px",
      /** Stacked attention / escalation bands */
      band: "16px",
      /** Controls in a group (search row, filter chips, meta under title) */
      control: "12px",
      /** Search / filter toolbar → queue grid header */
      filterQueue: "12px",
      /** Inside queue card: toolbar area → column headers */
      queueLead: "10px",
      queueHeader: "8px",
      /** Empty / loading / error blocks in main column */
      empty: "16px",
      /** Side rail offset from main column (xl+) */
      layoutRail: "24px",
    },
  },

  colors: {
    bg: "#0B1020",
    surface: "#151B2E",
    surfaceSubtle: "#111827",
    surfaceElevated: "#20283D",
    border: "rgba(255,255,255,0.06)",

    textPrimary: "#E8ECF3",
    textSecondary: "#94A3B8",

    accentPrimary: "#7C4DFF",
    accentSecondary: "#8B7CFF",
    accentWarning: "#D9A441",
    accentDanger: "#C96B6B",
    accentSuccess: "#3FA37C",
    accentInfo: "#6B9AD4",

    /** Casussen list chrome — aligned with operational shell (accent used sparingly). */
    casussenAccent: "#7C4DFF",
    casussenSurfaceRaised: "#1B2236",
    casussenPageChrome: "#0B1020",
    casussenMetricBg: "rgba(21, 27, 46, 0.92)",
    casussenMetricBorder: "rgba(255, 255, 255, 0.08)",
    casussenMetricText: "#E8ECF3",
    casussenMetricDot: "#6B9AD4",
    casussenUrgencyNormal: "#3FA37C",
  },

  visualContract: {
    sidebarWidth: "280px",
    topbarHeight: "72px",
    mainContentMaxWidth: "none",
    pageHorizontalPadding: "32px",
    pageTopPadding: "56px",
    cardRadius: "24px",
    sectionCardRadius: "22px",
    primaryCta: "#7C4DFF",
    warningCta: "#F5A900",
    background: "#070B18",
    surface1: "#0E1424",
    surface2: "#121A2C",
    border: "rgba(148,163,184,0.12)",
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
    processTimelineHeight: "56px",
    contextPanelSectionSpacing: "16px",
    rowHeight: "56px",
    compactRowHeight: "44px",
  },
} as const;
