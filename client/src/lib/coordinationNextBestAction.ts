import type { CoordinationDecisionOverviewTotals } from "./coordinationDecisionOverview";

/**
 * Deterministic Coordination Next Best Action (no AI).
 * Priority: 1 blokkades → 2 SLA → 3 matching → 4 intake → risico’s → doorstroom-coördinatie → stabiel.
 */
export type CoordinationNbaActionKey =
  | "FOCUS_BLOCKERS"
  | "FOCUS_SLA"
  | "FOCUS_MATCHING"
  | "FOCUS_INTAKE"
  | "FOCUS_RISKS"
  | "OPEN_WORKQUEUE"
  | "FOCUS_PIPELINE"
  | "REVIEW_STABLE"
  /** SLA + aanbieder-fase — zelfde gedrag als bestaande “reminders” flow. */
  | "SLA_PROVIDER_REMINDERS";

export type CoordinationNbaUiMode = "crisis" | "intervention" | "stable" | "coordination";

export type DominantNbaTone = "calm" | "attention" | "urgent";

/** Risico’s uit totals tellen mee vanaf deze drempel (eenvoudige regel). */
export const REGIEKAMER_NBA_RISK_THRESHOLD = 1;
/** Genoeg volume om doorstroom-coördinatie (geen rapportages) te rechtvaardigen. */
export const REGIEKAMER_NBA_COORDINATION_MIN_ACTIVE = 8;

function r(n: number): number {
  return Math.max(0, Math.round(n));
}

function nlWachtUpstream(w: number): string {
  const x = r(w);
  return x === 1 ? "1 casus wacht upstream" : `${x} casussen wachten upstream`;
}

function nlBlokkeertBijAanbieder(p: number): string {
  const x = r(p);
  return x === 1 ? "1 casus blokkeert bij aanbieder" : `${x} casussen blokkeren bij aanbieder`;
}

function nlMetKritiekeBlokkade(b: number): string {
  const x = r(b);
  return x === 1 ? "1 casus met kritieke blokkade" : `${x} casussen met kritieke blokkade`;
}

function nlMetIntakeVertraging(d: number): string {
  const x = r(d);
  return x === 1 ? "1 casus met intake-vertraging" : `${x} casussen met intake-vertraging`;
}

/** Titel zonder getal: het aantal staat in `panel.linkCount` / CareAlertCard-metric. */
function nlMetVerhoogdRisicoHeading(risks: number): string {
  const x = r(risks);
  return x === 1 ? "Casus met verhoogd risico" : "Casussen met verhoogd risico";
}

function nlMatchingRegieTitel(m: number): string {
  const x = r(m);
  return x === 1 ? "Matching vraagt coördinatie (1 casus)" : `Matching vraagt coördinatie (${x} casussen)`;
}

/**
 * Optional drill-down for `reasons[]` (deterministic; populated by caller from overview items).
 */
export type CoordinationNbaExplainInput = {
  /** Casussen met kritieke blokkade die upstream wachten (niet primair bij aanbieder-beoordeling). */
  blockerWaitingCases?: number;
  /** Casussen met kritieke blokkade in aanbieder-beoordeling. */
  blockedProviderCases?: number;
  /** Matching-urgent zonder zichtbare aanbieder / kandidaat. */
  matchingMissingCandidates?: number;
  /** SLA-te laat (default: gelijk aan provider-SLA-teller in SLA-tier). */
  slaOverdueCount?: number;
  /** Intake-vertraagd (default: gelijk aan intake_delays in intake-tier). */
  intakeDelayedStart?: number;
};

export type CoordinationNbaInput = {
  totals: Pick<
    CoordinationDecisionOverviewTotals,
    "critical_blockers" | "provider_sla_breaches" | "high_priority_alerts" | "intake_delays"
  >;
  activeCases: number;
  /** Matching-urgent count: matching phase + hoog/kritiek urgent (same as Coordination UI). */
  noMatchUrgentCount: number;
  explain?: CoordinationNbaExplainInput;
};

/**
 * Public contract: single dominant action + copy.
 * `panel` holds presentation wiring for DominantActionPanel without changing layout.
 */
export type CoordinationNbaDecision = {
  title: string;
  description: string;
  /** Korte deterministische “waarom”-regels voor transparantie (UI plakt ze achter `description`). */
  reasons: string[];
  primaryAction: { label: string; actionKey: CoordinationNbaActionKey };
  secondaryAction?: { label: string; actionKey: CoordinationNbaActionKey };
  impactHint?: string;
  panel: {
    tone: DominantNbaTone;
    linkCount: number;
    showCasesLink: boolean;
    uiMode: CoordinationNbaUiMode;
  };
};

function blockerReasons(b: number, explain: CoordinationNbaExplainInput | undefined): string[] {
  const w = r(explain?.blockerWaitingCases ?? 0);
  const p = r(explain?.blockedProviderCases ?? 0);
  const out: string[] = [];
  if (w > 0) {
    out.push(nlWachtUpstream(w));
  }
  if (p > 0) {
    out.push(nlBlokkeertBijAanbieder(p));
  }
  if (out.length === 0 && b > 0) {
    out.push(nlMetKritiekeBlokkade(b));
  }
  return out;
}

function slaReasons(s: number, explain: CoordinationNbaExplainInput | undefined): string[] {
  const n = r(explain?.slaOverdueCount ?? s);
  if (n <= 0) {
    return [];
  }
  return [`${n} SLA-signal(en) te laat bij aanbieder`];
}

function matchingReasons(m: number, explain: CoordinationNbaExplainInput | undefined): string[] {
  const mcRaw = explain?.matchingMissingCandidates;
  const mc = mcRaw != null ? r(mcRaw) : null;
  if (mc != null && mc > 0) {
    return [`${mc} zonder passende kandidaat`];
  }
  return [`${m} urgent in matching (hoog/kritiek)`];
}

function intakeReasons(d: number, explain: CoordinationNbaExplainInput | undefined): string[] {
  const n = r(explain?.intakeDelayedStart ?? d);
  return [`${n} met vertraagde intake-start`];
}

/**
 * Rule-ordered decision. When both blokkades and SLA exist, blokkades win; SLA is surfaced in `impactHint`.
 */
export function computeCoordinationNextBestAction(input: CoordinationNbaInput): CoordinationNbaDecision {
  const ex = input.explain;
  const b = r(input.totals.critical_blockers);
  const s = r(input.totals.provider_sla_breaches);
  const m = r(input.noMatchUrgentCount);
  const d = r(input.totals.intake_delays);
  const risks = r(input.totals.high_priority_alerts);
  const active = r(input.activeCases);

  // 1 — Blokkades
  if (b > 0) {
    const title = "Verhoogde coördinatie-aandacht";
    const description =
      b === 1
        ? "1 casus vraagt directe afstemming."
        : `${b} aanvragen vragen directe afstemming.`;
    const impactHint =
      s > 0
        ? `Daarnaast: ${s} SLA-signal(en) — plan coördinatie zodra de blokkade is opgelost.`
        : undefined;
    return {
      title,
      description,
      reasons: blockerReasons(b, ex),
      primaryAction: { label: "Los blokkades op", actionKey: "FOCUS_BLOCKERS" },
      secondaryAction: { label: "Open werkvoorraad", actionKey: "OPEN_WORKQUEUE" },
      impactHint,
      panel: {
        tone: "urgent",
        linkCount: b,
        showCasesLink: true,
        uiMode: "crisis",
      },
    };
  }

  // 2 — SLA breaches
  if (s > 0) {
    return {
      title: "Verhoogde coördinatie-aandacht",
      description: `${s} SLA-signal(en) vragen directe afstemming.`,
      reasons: slaReasons(s, ex),
      primaryAction: { label: "Bekijk kritieke aanvragen", actionKey: "FOCUS_SLA" },
      secondaryAction: { label: "Open werkvoorraad", actionKey: "OPEN_WORKQUEUE" },
      panel: {
        tone: "urgent",
        linkCount: s,
        showCasesLink: true,
        uiMode: "crisis",
      },
    };
  }

  // 3 — Matching failures / zwak signaal
  if (m > 0) {
    return {
      title: nlMatchingRegieTitel(m),
      description:
        "Zwak signaal of geen passende zorgcapaciteit. De primaire knop zet filters op matching-urgenties; validatie of her-matching doe je per casus, niet via deze knop.",
      reasons: matchingReasons(m, ex),
      primaryAction: { label: "Bekijk matching-aanvragen", actionKey: "FOCUS_MATCHING" },
      secondaryAction: { label: "Bekijk risico's", actionKey: "FOCUS_RISKS" },
      panel: {
        tone: "attention",
        linkCount: m,
        showCasesLink: true,
        uiMode: "intervention",
      },
    };
  }

  // 4 — Intake delays
  if (d > 0) {
    return {
      title: nlMetIntakeVertraging(d),
      description: "Start van zorg vertraagt na plaatsing.",
      reasons: intakeReasons(d, ex),
      primaryAction: { label: "Bekijk intake-aanvragen", actionKey: "FOCUS_INTAKE" },
      secondaryAction: { label: "Bekijk risico's", actionKey: "FOCUS_RISKS" },
      panel: {
        tone: "attention",
        linkCount: d,
        showCasesLink: true,
        uiMode: "intervention",
      },
    };
  }

  // Risico’s (na de vier prioritaire signalen)
  if (risks >= REGIEKAMER_NBA_RISK_THRESHOLD) {
    return {
      title: "Verhoogde coördinatie-aandacht",
      description: "",
      reasons: [],
      primaryAction: { label: "Bekijk kritieke aanvragen", actionKey: "FOCUS_RISKS" },
      secondaryAction: {
        label: "Open SLA-signalen",
        actionKey: "SLA_PROVIDER_REMINDERS",
      },
      panel: {
        tone: "attention",
        linkCount: risks,
        showCasesLink: true,
        uiMode: "intervention",
      },
    };
  }

  // Hoge doorstroom zonder acute signalen — coördineer knelpunten (geen rapportages/BI)
  if (active >= REGIEKAMER_NBA_COORDINATION_MIN_ACTIVE) {
    return {
      title: "Hoge doorstroom — coördineer knelpunten",
      description: `${active} actieve aanvragen — richt coördinatie op wachtposities en doorstroom.`,
      reasons: [`${active} actieve aanvragen in doorstroom`],
      primaryAction: { label: "Bekijk knelpunt in stroom", actionKey: "FOCUS_PIPELINE" },
      secondaryAction: { label: "Open aanvragen", actionKey: "OPEN_WORKQUEUE" },
      panel: {
        tone: "calm",
        linkCount: 0,
        showCasesLink: false,
        uiMode: "coordination",
      },
    };
  }

  return {
    title: "Keten stabiel",
    description: "Geen blokkades of SLA-druk; risico's zijn beperkt.",
    reasons: [],
    primaryAction: { label: "Bekijk aanvragen", actionKey: "REVIEW_STABLE" },
    panel: {
      tone: "calm",
      linkCount: 0,
      showCasesLink: false,
      uiMode: "stable",
    },
  };
}

/**
 * Plakt deterministische redenen aan de beschrijving (inline bullets; werkt in één `<p>` zonder extra CSS).
 */
export function formatCoordinationDominantDescription(
  decision: Pick<CoordinationNbaDecision, "description" | "reasons" | "impactHint">,
): string {
  const reasonPart =
    decision.reasons.length > 0 ? ` ${decision.reasons.map((x) => `• ${x}`).join(" ")}` : "";
  const base = `${decision.description}${reasonPart}`;
  return decision.impactHint ? `${base} ${decision.impactHint}` : base;
}
