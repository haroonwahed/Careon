import type { RegiekamerDecisionOverviewTotals } from "./regiekamerDecisionOverview";

/**
 * Deterministic Regiekamer Next Best Action (no AI).
 * Priority: 1 blokkades → 2 SLA → 3 matching → 4 intake → (then risico’s, stable, optimization).
 */
export type RegiekamerNbaActionKey =
  | "FOCUS_BLOCKERS"
  | "FOCUS_SLA"
  | "FOCUS_MATCHING"
  | "FOCUS_INTAKE"
  | "FOCUS_RISKS"
  | "OPEN_WORKQUEUE"
  | "OPEN_REPORTS"
  | "REVIEW_STABLE"
  /** SLA + aanbieder-fase — zelfde gedrag als bestaande “reminders” flow. */
  | "SLA_PROVIDER_REMINDERS";

export type RegiekamerNbaUiMode = "crisis" | "intervention" | "stable" | "optimization";

export type DominantNbaTone = "calm" | "attention" | "urgent";

/** Risico’s uit totals tellen mee vanaf deze drempel (eenvoudige regel). */
export const REGIEKAMER_NBA_RISK_THRESHOLD = 1;
/** Genoeg volume om optimalisatie / analyse te rechtvaardigen. */
export const REGIEKAMER_NBA_OPTIMIZATION_MIN_ACTIVE = 8;

function r(n: number): number {
  return Math.max(0, Math.round(n));
}

/**
 * Optional drill-down for `reasons[]` (deterministic; populated by caller from overview items).
 */
export type RegiekamerNbaExplainInput = {
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

export type RegiekamerNbaInput = {
  totals: Pick<
    RegiekamerDecisionOverviewTotals,
    "critical_blockers" | "provider_sla_breaches" | "high_priority_alerts" | "intake_delays"
  >;
  activeCases: number;
  /** Matching-urgent count: matching phase + hoog/kritiek urgent (same as Regiekamer UI). */
  noMatchUrgentCount: number;
  explain?: RegiekamerNbaExplainInput;
};

/**
 * Public contract: single dominant action + copy.
 * `panel` holds presentation wiring for DominantActionPanel without changing layout.
 */
export type RegiekamerNbaDecision = {
  title: string;
  description: string;
  /** Korte deterministische “waarom”-regels voor transparantie (UI plakt ze achter `description`). */
  reasons: string[];
  primaryAction: { label: string; actionKey: RegiekamerNbaActionKey };
  secondaryAction?: { label: string; actionKey: RegiekamerNbaActionKey };
  impactHint?: string;
  panel: {
    tone: DominantNbaTone;
    linkCount: number;
    showCasesLink: boolean;
    uiMode: RegiekamerNbaUiMode;
  };
};

function blockerReasons(b: number, explain: RegiekamerNbaExplainInput | undefined): string[] {
  const w = r(explain?.blockerWaitingCases ?? 0);
  const p = r(explain?.blockedProviderCases ?? 0);
  const out: string[] = [];
  if (w > 0) {
    out.push(`${w} casussen wachten upstream`);
  }
  if (p > 0) {
    out.push(`${p} casussen blokkeren bij aanbieder`);
  }
  if (out.length === 0 && b > 0) {
    out.push(`${b} casussen met kritieke blokkade`);
  }
  return out;
}

function slaReasons(s: number, explain: RegiekamerNbaExplainInput | undefined): string[] {
  const n = r(explain?.slaOverdueCount ?? s);
  if (n <= 0) {
    return [];
  }
  return [`${n} SLA-signal(en) te laat bij aanbieder`];
}

function matchingReasons(m: number, explain: RegiekamerNbaExplainInput | undefined): string[] {
  const mcRaw = explain?.matchingMissingCandidates;
  const mc = mcRaw != null ? r(mcRaw) : null;
  if (mc != null && mc > 0) {
    return [`${mc} zonder passende kandidaat`];
  }
  return [`${m} urgent in matching (hoog/kritiek)`];
}

function intakeReasons(d: number, explain: RegiekamerNbaExplainInput | undefined): string[] {
  const n = r(explain?.intakeDelayedStart ?? d);
  return [`${n} met vertraagde intake-start`];
}

/**
 * Rule-ordered decision. When both blokkades and SLA exist, blokkades win; SLA is surfaced in `impactHint`.
 */
export function computeRegiekamerNextBestAction(input: RegiekamerNbaInput): RegiekamerNbaDecision {
  const ex = input.explain;
  const b = r(input.totals.critical_blockers);
  const s = r(input.totals.provider_sla_breaches);
  const m = r(input.noMatchUrgentCount);
  const d = r(input.totals.intake_delays);
  const risks = r(input.totals.high_priority_alerts);
  const active = r(input.activeCases);

  // 1 — Blokkades
  if (b > 0) {
    const title =
      b === 1 ? "1 kritieke blokkade actief" : `${b} kritieke blokkades actief`;
    const description = "Zonder oplossing blijft de keten stilstaan.";
    const impactHint =
      s > 0
        ? `Daarnaast: ${s} SLA-signal(en) — plan regie zodra de blokkade is opgelost.`
        : undefined;
    return {
      title,
      description,
      reasons: blockerReasons(b, ex),
      primaryAction: { label: "Los blokkades op", actionKey: "FOCUS_BLOCKERS" },
      secondaryAction: { label: "Prioriteer werkvoorraad", actionKey: "OPEN_WORKQUEUE" },
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
      title: `${s} SLA-signal(en) vragen directe regie`,
      description: "Reactietijd of capaciteit schuurt tegen de afspraak.",
      reasons: slaReasons(s, ex),
      primaryAction: { label: "Pak SLA-signalen aan", actionKey: "FOCUS_SLA" },
      secondaryAction: { label: "Prioriteer werkvoorraad", actionKey: "OPEN_WORKQUEUE" },
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
      title: `Matching vraagt regie (${m} casussen)`,
      description:
        "Zwak signaal of geen passende match. De primaire knop zet filters op matching-urgenties in de Regiekamer; validatie of her-matching doe je per casus, niet via deze knop.",
      reasons: matchingReasons(m, ex),
      primaryAction: { label: "Bekijk matching-urgenties", actionKey: "FOCUS_MATCHING" },
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
      title: `${d} casussen met intake-vertraging`,
      description: "Start van zorg vertraagt na plaatsing.",
      reasons: intakeReasons(d, ex),
      primaryAction: { label: "Bekijk intake-vertraging", actionKey: "FOCUS_INTAKE" },
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
      title: `${risks} casussen met verhoogd risico`,
      description: "Signalen kunnen doorstroom of kwaliteit onder druk zetten.",
      reasons: [`${risks} casussen met verhoogd risico`],
      primaryAction: { label: "Bekijk risico's", actionKey: "FOCUS_RISKS" },
      secondaryAction: {
        label: "Stuur reminders naar aanbieders",
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

  // Volume-kansen
  if (active >= REGIEKAMER_NBA_OPTIMIZATION_MIN_ACTIVE) {
    return {
      title: "Volume hoog genoeg voor ketenanalyse",
      description: `${active} actieve casussen — waar kun je tijd of capaciteit winnen?`,
      reasons: [`${active} actieve casussen in keten`],
      primaryAction: { label: "Analyseer doorstroom", actionKey: "OPEN_REPORTS" },
      secondaryAction: { label: "Prioriteer werkvoorraad", actionKey: "OPEN_WORKQUEUE" },
      panel: {
        tone: "calm",
        linkCount: 0,
        showCasesLink: false,
        uiMode: "optimization",
      },
    };
  }

  return {
    title: "Keten stabiel",
    description: "Geen blokkades of SLA-druk; risico's zijn beperkt.",
    reasons: [],
    primaryAction: { label: "Prioriteer werkvoorraad", actionKey: "REVIEW_STABLE" },
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
export function formatRegiekamerDominantDescription(
  decision: Pick<RegiekamerNbaDecision, "description" | "reasons" | "impactHint">,
): string {
  const reasonPart =
    decision.reasons.length > 0 ? ` ${decision.reasons.map((x) => `• ${x}`).join(" ")}` : "";
  const base = `${decision.description}${reasonPart}`;
  return decision.impactHint ? `${base} ${decision.impactHint}` : base;
}
