import type { Casus } from "./phaseEngine";
import { CARE_TERMS } from "./terminology";

export type RegiekamerSeverity = "critical" | "warning" | "info" | "good";
export type RegiekamerViewTarget = "matching" | "casussen" | "plaatsingen" | "signalen";
export type RegiekamerFilterTarget =
  | "noMatch"
  | "casussen"
  | "placement"
  | "waitingOverdue"
  | "capacity"
  | "highRisk"
  | "delayed"
  | "aanbieder_wacht"
  | "afgewezen";

export type RegiekamerBottleneckStage = "casussen" | "matching" | "plaatsingen" | "aanbieder_review" | "none";

export interface RegiekamerFlowCounts {
  casussen: number;
  klaar_voor_matching: number;
  matching: number;
  bij_aanbieder: number;
  intake_pending: number;
}

export interface RegiekamerIssueBuckets {
  klaar_voor_matching: number;
  wacht_op_aanbieder: number;
  afgewezen_door_aanbieder: number;
  blocked_cases: number;
  cases_without_match: number;
  waiting_time_exceeded: number;
  capacity_shortages: number;
  placements_pending: number;
  high_risk_cases: number;
}

export interface RegiekamerActionTarget {
  label: string;
  target_view: RegiekamerViewTarget;
  target_filter: RegiekamerFilterTarget;
  reason: string;
  cta_label: string;
  target_region?: string;
}

export interface RegiekamerCommandBarSummary {
  primary_message: string;
  why_it_matters: string;
  cta_label: string;
  tone: RegiekamerSeverity;
}

export interface RegiekamerPriorityCard {
  key:
    | "casussen_zonder_match"
    | "klaar_voor_matching"
    | "wacht_op_aanbieder"
    | "afgewezen_door_aanbieder"
    | "wachttijd_overschreden"
    | "plaatsingen_bezig"
    | "gem_wachttijd"
    | "capaciteitstekorten";
  title: string;
  value: number;
  subtitle: string;
  severity: RegiekamerSeverity;
  action: {
    target_view: RegiekamerViewTarget;
    target_filter: RegiekamerFilterTarget;
    label: string;
    target_region?: string;
  };
  suffix?: string;
}

export interface RegiekamerSignalStrip {
  key: string;
  text: string;
  tone: RegiekamerSeverity;
  action: {
    target_view: RegiekamerViewTarget;
    target_filter: RegiekamerFilterTarget;
    target_region?: string;
  };
}

export interface RegiekamerDecisionSummary {
  command_bar_summary: RegiekamerCommandBarSummary;
  recommended_action: RegiekamerActionTarget;
  recommended_action_reason: string;
  bottleneck_stage: RegiekamerBottleneckStage;
  priority_cards: RegiekamerPriorityCard[];
  signal_strips: RegiekamerSignalStrip[];
  flow_counts: RegiekamerFlowCounts;
  issue_buckets: RegiekamerIssueBuckets;
  capacity_region: string | null;
}

const DEFAULT_SLA_DAYS = 7;

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function topRegion(cases: Casus[]): string | null {
  if (cases.length === 0) return null;
  const counts = cases.reduce<Record<string, number>>((acc, caseItem) => {
    acc[caseItem.region] = (acc[caseItem.region] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function buildRegiekamerDecisionSummary(
  cases: Casus[],
  options?: { slaDays?: number }
): RegiekamerDecisionSummary {
  const slaDays = options?.slaDays ?? DEFAULT_SLA_DAYS;

  const casesInScope = cases.filter((caseItem) => caseItem.phase !== "afgerond");

  const flow_counts: RegiekamerFlowCounts = {
    casussen: casesInScope.filter((c) => c.phase === "casus").length,
    klaar_voor_matching: casesInScope.filter((c) => c.phase === "casus" || (c.status === "klaar_voor_matching" as string)).length,
    matching: casesInScope.filter((c) => c.phase === "matching" || c.phase === "aanbieder_selectie" || c.phase === "geblokkeerd").length,
    bij_aanbieder: casesInScope.filter((c) => c.phase === "provider_beoordeling").length,
    intake_pending: casesInScope.filter((c) => c.phase === "intake_provider" && c.intake?.status !== "completed").length,
  };

  const blockedCases = casesInScope.filter((c) => c.phase === "geblokkeerd" || c.status === "geblokkeerd");
  const casesKlaarVoorMatching = casesInScope.filter((c) => c.phase === "casus");
  const wachtOpAanbieder = casesInScope.filter((c) => c.phase === "provider_beoordeling");
  const afgewezenDoorAanbieder = casesInScope.filter((c) => c.status === "afgewezen_door_aanbieder" as string);
  const casesWithoutMatch = casesInScope.filter(
    (c) => (c.phase === "matching" || c.phase === "geblokkeerd") && !c.selectedProviderId
  );
  const waitingExceeded = casesInScope.filter((c) => c.waitingDays > slaDays);
  const placementPending = casesInScope.filter(
    (c) => c.phase === "provider_beoordeling" || c.placement?.status === "proposed" || c.placement?.status === "pending"
  );
  const highRisk = casesInScope.filter(
    (c) => c.urgency === "critical" || c.urgency === "high" || c.complexity === "high"
  );

  const capacityShortageCases = casesInScope.filter((c) => {
    if (c.phase !== "matching" && c.phase !== "geblokkeerd") return false;
    if (c.selectedProviderId) return false;
    if (c.matchResults.length === 0) return true;
    const hasCapacity = c.matchResults.some((result) => result.availableSpots > 0);
    return !hasCapacity;
  });

  const capacityRegion = topRegion(capacityShortageCases);

  const issue_buckets: RegiekamerIssueBuckets = {
    klaar_voor_matching: casesKlaarVoorMatching.length,
    wacht_op_aanbieder: wachtOpAanbieder.length,
    afgewezen_door_aanbieder: afgewezenDoorAanbieder.length,
    blocked_cases: blockedCases.length,
    cases_without_match: casesWithoutMatch.length,
    waiting_time_exceeded: waitingExceeded.length,
    capacity_shortages: capacityShortageCases.length,
    placements_pending: placementPending.length,
    high_risk_cases: highRisk.length,
  };

  const priorityOrder: Array<keyof RegiekamerIssueBuckets> = [
    "afgewezen_door_aanbieder",
    "blocked_cases",
    "cases_without_match",
    "capacity_shortages",
    "waiting_time_exceeded",
    "wacht_op_aanbieder",
    "placements_pending",
  ];

  const primaryIssue = priorityOrder.find((issueKey) => issue_buckets[issueKey] > 0) ?? "placements_pending";

  let command_bar_summary: RegiekamerCommandBarSummary;
  let recommended_action: RegiekamerActionTarget;

  if (primaryIssue === "afgewezen_door_aanbieder") {
    command_bar_summary = {
      primary_message: `${pluralize(issue_buckets.afgewezen_door_aanbieder, "casus", "casussen")} afgewezen door aanbieder`,
      why_it_matters: "Afgewezen casussen hebben opnieuw matching nodig",
      cta_label: "Herstart matching",
      tone: "critical",
    };

    recommended_action = {
      label: "Herstart matching voor afgewezen casussen",
      target_view: "matching",
      target_filter: "afgewezen",
      reason: `${pluralize(issue_buckets.afgewezen_door_aanbieder, "casus wacht", "casussen wachten")} op nieuwe aanbieder`,
      cta_label: "Herstart matching",
    };
  } else if (primaryIssue === "blocked_cases") {
    const impacted = Math.max(issue_buckets.blocked_cases, issue_buckets.cases_without_match);

    command_bar_summary = {
      primary_message: `${pluralize(issue_buckets.blocked_cases, "blokkade", "blokkades")} stopt doorstroom`,
      why_it_matters: `Daardoor wachten ${pluralize(impacted, "casus", "casussen")} op vervolgstap`,
      cta_label: "Los blokkades op",
      tone: "critical",
    };

    recommended_action = {
      label: "Los blokkades in matching op",
      target_view: "matching",
      target_filter: "noMatch",
      reason: `Hiermee ontgrendel je vervolgstappen voor ${pluralize(issue_buckets.cases_without_match, "casus", "casussen")}`,
      cta_label: "Los blokkades op",
    };
  } else if (primaryIssue === "cases_without_match") {
    command_bar_summary = {
      primary_message: `${pluralize(issue_buckets.cases_without_match, "casus", "casussen")} heeft nog geen match`,
      why_it_matters: "Wachttijd loopt op en plaatsing vertraagt",
      cta_label: "Bekijk matching",
      tone: "warning",
    };

    recommended_action = {
      label: "Controleer beschikbare aanbieders",
      target_view: "matching",
      target_filter: "noMatch",
      reason: "Minimaal 1 casus heeft geen passende aanbieder",
      cta_label: "Bekijk matching",
      target_region: capacityRegion ?? undefined,
    };
  } else if (primaryIssue === "capacity_shortages") {
    command_bar_summary = {
      primary_message: capacityRegion
        ? `Capaciteitstekort in regio ${capacityRegion}`
        : `${pluralize(issue_buckets.capacity_shortages, "casus", "casussen")} zonder beschikbare capaciteit`,
      why_it_matters: `${pluralize(issue_buckets.capacity_shortages, "casus kan", "casussen kunnen")} niet worden geplaatst`,
      cta_label: "Bekijk capaciteit",
      tone: "critical",
    };

    recommended_action = {
      label: "Vergroot zoekgebied of heroverweeg criteria",
      target_view: "matching",
      target_filter: "capacity",
      reason: "Geen beschikbare aanbieder binnen huidige selectie",
      cta_label: "Bekijk capaciteit",
      target_region: capacityRegion ?? undefined,
    };
  } else if (primaryIssue === "waiting_time_exceeded") {
    command_bar_summary = {
      primary_message: `${pluralize(issue_buckets.waiting_time_exceeded, "casus", "casussen")} overschrijdt normtijd`,
      why_it_matters: "Lange wachttijd verhoogt risico op uitval en escalatie",
      cta_label: "Bekijk wachttijd",
      tone: "warning",
    };

    recommended_action = {
      label: "Pak langst wachtende casussen eerst op",
      target_view: "casussen",
      target_filter: "waitingOverdue",
      reason: `Normtijd van ${slaDays} dagen wordt overschreden`,
      cta_label: "Bekijk wachttijd",
    };
  } else if (primaryIssue === "placements_pending" && issue_buckets.placements_pending > 0) {
    command_bar_summary = {
      primary_message: `${pluralize(issue_buckets.placements_pending, "plaatsing", "plaatsingen")} wacht op bevestiging`,
      why_it_matters: "Zonder bevestiging start intake niet",
      cta_label: "Bekijk plaatsingen",
      tone: "info",
    };

    recommended_action = {
      label: "Volg open plaatsingen op",
      target_view: "plaatsingen",
      target_filter: "placement",
      reason: "Snelle bevestiging voorkomt extra wachtdagen",
      cta_label: "Bekijk plaatsingen",
    };
  } else {
    command_bar_summary = {
      primary_message: "Doorstroom stabiel",
      why_it_matters: "Geen directe blokkades op dit moment",
      cta_label: "Bekijk plaatsingen",
      tone: "good",
    };

    recommended_action = {
      label: "Monitor actieve plaatsingen",
      target_view: "plaatsingen",
      target_filter: "placement",
      reason:
        issue_buckets.placements_pending > 0
          ? `${pluralize(issue_buckets.placements_pending, "plaatsing wacht", "plaatsingen wachten")} nog op bevestiging`
          : "Blijf signalen monitoren voor nieuwe knelpunten",
      cta_label: "Bekijk plaatsingen",
    };
  }

  let bottleneck_stage: RegiekamerBottleneckStage = "none";
  if (issue_buckets.afgewezen_door_aanbieder > 0 || issue_buckets.blocked_cases > 0 || issue_buckets.cases_without_match > 0) {
    bottleneck_stage = "matching";
  } else if (issue_buckets.wacht_op_aanbieder > 0) {
    bottleneck_stage = "aanbieder_review";
  } else if (issue_buckets.placements_pending > 0) {
    bottleneck_stage = "plaatsingen";
  } else if (flow_counts.klaar_voor_matching > 0) {
    bottleneck_stage = "casussen";
  }

  const avgWaitingDays =
    casesInScope.length === 0
      ? 0
      : Math.round(casesInScope.reduce((sum, c) => sum + c.waitingDays, 0) / casesInScope.length);

  const priority_cards: RegiekamerPriorityCard[] = [
    {
      key: "casussen_zonder_match",
      title: "Aanvragen zonder match",
      value: issue_buckets.cases_without_match,
      subtitle: "Vraagt handmatige opvolging",
      severity: issue_buckets.cases_without_match > 0 ? "critical" : "good",
      action: { target_view: "matching", target_filter: "noMatch", label: "Bekijk matching" },
    },
    {
      key: "klaar_voor_matching",
      title: "Matching & validatie",
      value: issue_buckets.klaar_voor_matching,
      subtitle: "Wachten op matching",
      severity: issue_buckets.klaar_voor_matching > 0 ? "info" : "good",
      action: { target_view: "matching", target_filter: "casussen", label: "Start matching" },
    },
    {
      key: "wacht_op_aanbieder",
      title: CARE_TERMS.workflow.aanbiederBeoordeling,
      value: issue_buckets.wacht_op_aanbieder,
      subtitle: "Verzoek verstuurd — wacht op reactie van de aanbieder",
      severity: issue_buckets.wacht_op_aanbieder > 0 ? "info" : "good",
      action: { target_view: "plaatsingen", target_filter: "aanbieder_wacht", label: "Bekijk aanbiederreacties" },
    },
    {
      key: "afgewezen_door_aanbieder",
      title: "Afgewezen door aanbieder",
      value: issue_buckets.afgewezen_door_aanbieder,
      subtitle: "Vereisen hermatching",
      severity: issue_buckets.afgewezen_door_aanbieder > 0 ? "critical" : "good",
      action: { target_view: "matching", target_filter: "afgewezen", label: "Herstart matching" },
    },
    {
      key: "wachttijd_overschreden",
      title: "Wachttijd overschreden",
      value: issue_buckets.waiting_time_exceeded,
      subtitle: `Overschrijden wachttijdnorm (${slaDays} dagen)`,
      severity: issue_buckets.waiting_time_exceeded > 0 ? "warning" : "good",
      action: { target_view: "casussen", target_filter: "waitingOverdue", label: "Bekijk wachttijd" },
    },
    {
      key: "plaatsingen_bezig",
      title: "Plaatsingen bezig",
      value: issue_buckets.placements_pending,
      subtitle: "Wachten op bevestiging",
      severity: issue_buckets.placements_pending > 0 ? "info" : "good",
      action: { target_view: "plaatsingen", target_filter: "placement", label: "Bekijk plaatsingen" },
    },
    {
      key: "gem_wachttijd",
      title: "Gem. wachttijd",
      value: avgWaitingDays,
      suffix: "d",
      subtitle: `Norm is ${slaDays} dagen`,
      severity: avgWaitingDays > slaDays ? "warning" : "good",
      action: { target_view: "casussen", target_filter: "delayed", label: "Bekijk wachttijd" },
    },
    {
      key: "capaciteitstekorten",
      title: "Capaciteitstekorten",
      value: issue_buckets.capacity_shortages,
      subtitle: capacityRegion ? `Druk in regio ${capacityRegion}` : "Geen regionale piek gedetecteerd",
      severity: issue_buckets.capacity_shortages > 0 ? "critical" : "good",
      action: {
        target_view: "matching",
        target_filter: "capacity",
        target_region: capacityRegion ?? undefined,
        label: "Bekijk capaciteit",
      },
    },
  ];

  const candidateSignals: RegiekamerSignalStrip[] = [
    {
      key: "waiting",
      tone: issue_buckets.waiting_time_exceeded > 0 ? "warning" : "info",
      text: `${pluralize(issue_buckets.waiting_time_exceeded, "casus wacht", "casussen wachten")} langer dan ${slaDays} dagen`,
      action: { target_view: "casussen", target_filter: "waitingOverdue" },
    },
    {
      key: "capacity",
      tone: issue_buckets.capacity_shortages > 0 ? "critical" : "info",
      text: capacityRegion
        ? `Capaciteit onder norm in regio ${capacityRegion}`
        : `${pluralize(issue_buckets.capacity_shortages, "casus", "casussen")} zonder beschikbare aanbieder`,
      action: {
        target_view: "matching",
        target_filter: "capacity",
        target_region: capacityRegion ?? undefined,
      },
    },
    {
      key: "placement",
      tone: issue_buckets.placements_pending > 0 ? "info" : "good",
      text: `${pluralize(issue_buckets.placements_pending, "plaatsing wacht", "plaatsingen wachten")} op bevestiging`,
      action: { target_view: "plaatsingen", target_filter: "placement" },
    },
    {
      key: "risk",
      tone: issue_buckets.high_risk_cases > 0 ? "critical" : "info",
      text: `${pluralize(issue_buckets.high_risk_cases, "hoog-risico casus vraagt", "hoog-risico casussen vragen")} directe regie`,
      action: { target_view: "signalen", target_filter: "highRisk" },
    },
  ];

  const primaryRelatedSignalKey: Record<string, string> = {
    afgewezen_door_aanbieder: "placement",
    blocked_cases: "capacity",
    cases_without_match: "capacity",
    capacity_shortages: "capacity",
    waiting_time_exceeded: "waiting",
    wacht_op_aanbieder: "placement",
    placements_pending: "placement",
  };

  const skipSignal = primaryRelatedSignalKey[primaryIssue];
  const signal_strips = candidateSignals
    .filter((signal) => signal.key !== skipSignal)
    .filter((signal) => {
      if (signal.key === "waiting") return issue_buckets.waiting_time_exceeded > 0;
      if (signal.key === "capacity") return issue_buckets.capacity_shortages > 0;
      if (signal.key === "placement") return issue_buckets.placements_pending > 0;
      if (signal.key === "risk") return issue_buckets.high_risk_cases > 0;
      return true;
    })
    .slice(0, 3);

  if (signal_strips.length === 0) {
    signal_strips.push({
      key: "monitor",
      tone: "info",
      text: "Geen extra blokkades. Blijf actieve casussen monitoren",
      action: { target_view: "plaatsingen", target_filter: "placement" },
    });
  }

  return {
    command_bar_summary,
    recommended_action,
    recommended_action_reason: recommended_action.reason,
    bottleneck_stage,
    priority_cards,
    signal_strips,
    flow_counts,
    issue_buckets,
    capacity_region: capacityRegion,
  };
}
