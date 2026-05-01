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

export type RegiekamerNbaInput = {
  totals: Pick<
    RegiekamerDecisionOverviewTotals,
    "critical_blockers" | "provider_sla_breaches" | "high_priority_alerts" | "intake_delays"
  >;
  activeCases: number;
  /** Matching-urgent count: matching phase + hoog/kritiek urgent (same as Regiekamer UI). */
  noMatchUrgentCount: number;
};

/**
 * Public contract: single dominant action + copy.
 * `panel` holds presentation wiring for DominantActionPanel without changing layout.
 */
export type RegiekamerNbaDecision = {
  title: string;
  description: string;
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

/**
 * Rule-ordered decision. When both blokkades and SLA exist, blokkades win; SLA is surfaced in `impactHint`.
 */
export function computeRegiekamerNextBestAction(input: RegiekamerNbaInput): RegiekamerNbaDecision {
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
      primaryAction: { label: "Los blokkades op", actionKey: "FOCUS_BLOCKERS" },
      secondaryAction: { label: "Bekijk werkvoorraad", actionKey: "OPEN_WORKQUEUE" },
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
      primaryAction: { label: "Pak SLA-signalen aan", actionKey: "FOCUS_SLA" },
      secondaryAction: { label: "Bekijk werkvoorraad", actionKey: "OPEN_WORKQUEUE" },
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
      description: "Zwak signaal of geen passende match — validatie of her-matching nodig.",
      primaryAction: { label: "Herstart matching", actionKey: "FOCUS_MATCHING" },
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
      primaryAction: { label: "Analyseer prestaties", actionKey: "OPEN_REPORTS" },
      secondaryAction: { label: "Bekijk werkvoorraad", actionKey: "OPEN_WORKQUEUE" },
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
    primaryAction: { label: "Bekijk werkvoorraad", actionKey: "REVIEW_STABLE" },
    panel: {
      tone: "calm",
      linkCount: 0,
      showCasesLink: false,
      uiMode: "stable",
    },
  };
}
