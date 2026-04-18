import type { Casus } from "./phaseEngine";
import type { RegiekamerBottleneckStage, RegiekamerDecisionSummary } from "./regiekamerDecisionEngine";

export type PredictiveRiskBand = "critical" | "high" | "medium" | "low";

export interface RegiekamerForecastSignal {
  key:
    | "assessment_delay"
    | "match_failure"
    | "sla_breach"
    | "placement_stall"
    | "escalation"
    | "capacity_pressure";
  title: string;
  text: string;
  severity: "critical" | "warning" | "info";
  affected_case_ids: string[];
  target_stage: Exclude<RegiekamerBottleneckStage, "none">;
}

export interface RegiekamerCaseForecast {
  risk_score: number;
  risk_band: PredictiveRiskBand;
  top_reasons: string[];
  next_best_action: string;
  projected_impact: string;
}

export interface RegiekamerPredictiveSummary {
  forecast_signals: RegiekamerForecastSignal[];
  projected_bottleneck_stage: RegiekamerBottleneckStage;
  action_impact_summary: string;
  per_case_forecast: Record<string, RegiekamerCaseForecast>;
}

const SLA_DAYS = 7;

function bandFor(score: number): PredictiveRiskBand {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function scoreCase(caseItem: Casus): RegiekamerCaseForecast {
  let score = 0;
  const reasons: string[] = [];

  if (caseItem.urgency === "critical") {
    score += 35;
    reasons.push("Urgentie is kritiek");
  } else if (caseItem.urgency === "high") {
    score += 22;
    reasons.push("Urgentie is hoog");
  } else if (caseItem.urgency === "medium") {
    score += 10;
  }

  if (caseItem.waitingDays > 10) {
    score += 25;
    reasons.push(`Wachttijd is ${caseItem.waitingDays} dagen`);
  } else if (caseItem.waitingDays > SLA_DAYS) {
    score += 14;
    reasons.push(`Wachttijd overschrijdt norm (${SLA_DAYS} dagen)`);
  }

  if (caseItem.phase === "beoordeling" && !caseItem.assessment.isComplete) {
    score += 15;
    reasons.push("Beoordeling is nog niet compleet");
  }

  if ((caseItem.phase === "matching" || caseItem.phase === "geblokkeerd") && !caseItem.selectedProviderId) {
    score += 18;
    reasons.push("Nog geen passende aanbieder geselecteerd");
  }

  if (
    caseItem.phase === "plaatsing" &&
    (caseItem.placement.status === "proposed" || caseItem.placement.status === "pending")
  ) {
    score += 12;
    reasons.push("Plaatsing wacht op bevestiging");
  }

  if (caseItem.phase === "intake_provider" && caseItem.intake.providerResponseDays > 3) {
    score += 12;
    reasons.push("Aanbieder reageert traag op intake");
  }

  if (caseItem.complexity === "high") {
    score += 12;
    reasons.push("Complexiteit is hoog");
  }

  if (
    (caseItem.phase === "matching" || caseItem.phase === "geblokkeerd") &&
    caseItem.matchResults.length > 0 &&
    caseItem.matchResults.every((result) => result.availableSpots <= 0)
  ) {
    score += 10;
    reasons.push("Alle gevonden aanbieders hebben geen beschikbare plekken");
  }

  const clamped = Math.min(100, Math.max(0, score));
  const band = bandFor(clamped);

  let nextBestAction = "Monitor voortgang";
  let projectedImpact = "Houdt het dossier actueel";

  if (caseItem.phase === "beoordeling" && !caseItem.assessment.isComplete) {
    nextBestAction = "Rond beoordeling af";
    projectedImpact = "Ontgrendelt matching voor deze casus";
  } else if ((caseItem.phase === "matching" || caseItem.phase === "geblokkeerd") && !caseItem.selectedProviderId) {
    nextBestAction = "Heroverweeg matchingcriteria";
    projectedImpact = "Vergroot kans op plaatsing binnen 48 uur";
  } else if (caseItem.phase === "plaatsing" && caseItem.placement.status !== "confirmed") {
    nextBestAction = "Volg plaatsing direct op";
    projectedImpact = "Voorkomt extra wachtdagen in intake";
  } else if (caseItem.waitingDays > SLA_DAYS) {
    nextBestAction = "Pak deze casus vandaag op";
    projectedImpact = "Verlaagt kans op escalatie door wachttijd";
  }

  return {
    risk_score: clamped,
    risk_band: band,
    top_reasons: reasons.slice(0, 3),
    next_best_action: nextBestAction,
    projected_impact: projectedImpact,
  };
}

function findProjectedBottleneck(cases: Casus[], forecast: Record<string, RegiekamerCaseForecast>): RegiekamerBottleneckStage {
  const stageRisk = {
    casussen: 0,
    beoordelingen: 0,
    matching: 0,
    plaatsingen: 0,
  };

  for (const caseItem of cases) {
    const risk = forecast[caseItem.id];
    if (!risk) continue;
    const weighted = risk.risk_band === "critical" ? 3 : risk.risk_band === "high" ? 2 : risk.risk_band === "medium" ? 1 : 0;
    if (weighted === 0) continue;

    if (caseItem.phase === "intake_initial" || caseItem.phase === "intake_provider") stageRisk.casussen += weighted;
    else if (caseItem.phase === "beoordeling") stageRisk.beoordelingen += weighted;
    else if (caseItem.phase === "matching" || caseItem.phase === "geblokkeerd") stageRisk.matching += weighted;
    else if (caseItem.phase === "plaatsing") stageRisk.plaatsingen += weighted;
  }

  const ranked = Object.entries(stageRisk).sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] === 0) return "none";
  return ranked[0][0] as RegiekamerBottleneckStage;
}

export function buildRegiekamerPredictiveSummary(
  cases: Casus[],
  decisionSummary?: RegiekamerDecisionSummary
): RegiekamerPredictiveSummary {
  const activeCases = cases.filter((c) => c.phase !== "afgerond");

  const perCaseForecast = activeCases.reduce<Record<string, RegiekamerCaseForecast>>((acc, caseItem) => {
    acc[caseItem.id] = scoreCase(caseItem);
    return acc;
  }, {});

  const assessmentDelayIds = activeCases
    .filter((c) => c.phase === "beoordeling" && (!c.assessment.isComplete || c.waitingDays > 4))
    .map((c) => c.id);

  const matchFailureIds = activeCases
    .filter((c) => (c.phase === "matching" || c.phase === "geblokkeerd") && !c.selectedProviderId)
    .map((c) => c.id);

  const slaBreachIds = activeCases.filter((c) => c.waitingDays > SLA_DAYS).map((c) => c.id);

  const placementStallIds = activeCases
    .filter((c) => c.phase === "plaatsing" && (c.placement.status === "pending" || c.placement.status === "proposed"))
    .map((c) => c.id);

  const escalationIds = activeCases
    .filter((c) => c.urgency === "critical" || c.complexity === "high")
    .map((c) => c.id);

  const capacityPressureIds = activeCases
    .filter((c) => {
      if (c.phase !== "matching" && c.phase !== "geblokkeerd") return false;
      if (c.matchResults.length === 0) return true;
      return c.matchResults.every((r) => r.availableSpots <= 0);
    })
    .map((c) => c.id);

  const signals: RegiekamerForecastSignal[] = [];

  if (assessmentDelayIds.length > 0) {
    signals.push({
      key: "assessment_delay",
      title: "Voorspeld: beoordelingsachterstand",
      text: `${assessmentDelayIds.length} casussen dreigen te blijven hangen in beoordeling`,
      severity: assessmentDelayIds.length > 3 ? "critical" : "warning",
      affected_case_ids: assessmentDelayIds,
      target_stage: "beoordelingen",
    });
  }

  if (matchFailureIds.length > 0) {
    signals.push({
      key: "match_failure",
      title: "Voorspeld: matching loopt vast",
      text: `${matchFailureIds.length} casussen hebben verhoogde kans op match-failure`,
      severity: matchFailureIds.length > 2 ? "critical" : "warning",
      affected_case_ids: matchFailureIds,
      target_stage: "matching",
    });
  }

  if (slaBreachIds.length > 0) {
    signals.push({
      key: "sla_breach",
      title: "Voorspeld: SLA-overschrijding",
      text: `${slaBreachIds.length} casussen overschrijden of naderen de wachttijdnorm`,
      severity: slaBreachIds.length > 3 ? "critical" : "warning",
      affected_case_ids: slaBreachIds,
      target_stage: "casussen",
    });
  }

  if (placementStallIds.length > 0) {
    signals.push({
      key: "placement_stall",
      title: "Voorspeld: plaatsingen vertragen",
      text: `${placementStallIds.length} plaatsingen vragen actieve opvolging`,
      severity: "info",
      affected_case_ids: placementStallIds,
      target_stage: "plaatsingen",
    });
  }

  if (escalationIds.length > 0) {
    signals.push({
      key: "escalation",
      title: "Voorspeld: escalatie-risico",
      text: `${escalationIds.length} casussen hebben hoog escalatierisico`,
      severity: escalationIds.length > 2 ? "critical" : "warning",
      affected_case_ids: escalationIds,
      target_stage: "casussen",
    });
  }

  if (capacityPressureIds.length > 0) {
    signals.push({
      key: "capacity_pressure",
      title: "Voorspeld: capaciteitsdruk",
      text: `${capacityPressureIds.length} casussen hebben beperkte kans op directe plaatsing`,
      severity: capacityPressureIds.length > 2 ? "critical" : "warning",
      affected_case_ids: capacityPressureIds,
      target_stage: "matching",
    });
  }

  const topRiskCase = activeCases
    .map((c) => ({ caseItem: c, forecast: perCaseForecast[c.id] }))
    .sort((a, b) => b.forecast.risk_score - a.forecast.risk_score)[0];

  const actionImpactSummary = topRiskCase
    ? `${topRiskCase.caseItem.id}: ${topRiskCase.forecast.next_best_action} · ${topRiskCase.forecast.projected_impact}`
    : "Geen acute voorspelde knelpunten";

  const projectedBottleneckStage = findProjectedBottleneck(activeCases, perCaseForecast);

  return {
    forecast_signals: signals
      .sort((a, b) => b.affected_case_ids.length - a.affected_case_ids.length)
      .slice(0, 4),
    projected_bottleneck_stage: projectedBottleneckStage,
    action_impact_summary:
      decisionSummary && decisionSummary.recommended_action_reason
        ? `${actionImpactSummary}. Verwacht effect: ${decisionSummary.recommended_action_reason}`
        : actionImpactSummary,
    per_case_forecast: perCaseForecast,
  };
}
