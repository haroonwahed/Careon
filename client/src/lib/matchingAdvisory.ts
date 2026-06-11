/**
 * Operational matching advisory labels — no fabricated fit percentages on list surfaces.
 * Engine scores on case detail / matching workspace use qualitative bands + API copy only.
 */

import type { SpaCase } from "../hooks/useCases";

type AdvisoryTone = "good" | "info" | "warning" | "critical";

export type MatchingAdvisoryTier =
  | "strong_fit"
  | "review_needed"
  | "capacity_uncertain"
  | "manual_coordination"
  | "preliminary";

export const MATCHING_ADVISORY_LABELS: Record<MatchingAdvisoryTier, string> = {
  strong_fit: "Sterke aansluiting",
  review_needed: "Onderbouwing nodig",
  capacity_uncertain: "Capaciteit onzeker",
  manual_coordination: "Afstemming nodig",
  preliminary: "Voorlopige match",
};

export const MATCHING_ADVISORY_HINTS: Record<MatchingAdvisoryTier, string> = {
  strong_fit: "Arrangement sluit grotendeels aan — bevestig in casus.",
  review_needed: "Aanvullende onderbouwing nodig vóór doorstroom.",
  capacity_uncertain: "Capaciteit nog niet bevestigd.",
  manual_coordination: "Afstemming tussen coördinatie en aanbieder vereist.",
  preliminary: "Matchadvies nog in opbouw of onvolledig.",
};

const TIER_TONE: Record<MatchingAdvisoryTier, AdvisoryTone> = {
  strong_fit: "good",
  review_needed: "info",
  capacity_uncertain: "warning",
  manual_coordination: "warning",
  preliminary: "info",
};

/** Sort priority for queue scanability (higher = needs attention first). */
const TIER_ATTENTION_RANK: Record<MatchingAdvisoryTier, number> = {
  manual_coordination: 4,
  capacity_uncertain: 3,
  review_needed: 2,
  preliminary: 1,
  strong_fit: 0,
};

export type MatchingAdvisoryAssessment = {
  tier: MatchingAdvisoryTier;
  label: string;
  hint: string;
  tone: AdvisoryTone;
  attentionRank: number;
};

export function deriveListMatchingAdvisory(args: {
  boardColumn: string;
  providerCount: number;
  urgency: SpaCase["urgency"];
  summaryAvailable: boolean;
  isBlocked?: boolean;
}): MatchingAdvisoryAssessment | null {
  const { boardColumn, providerCount, urgency, summaryAvailable, isBlocked } = args;

  if (boardColumn !== "matching" && boardColumn !== "gemeente-validatie") {
    return null;
  }

  if (!summaryAvailable) {
    return pack("preliminary", "Samenvatting vereist voor matchadvies.");
  }

  if (isBlocked) {
    return pack("review_needed", "Casus geblokkeerd — eerst opheffen.");
  }

  if (boardColumn === "gemeente-validatie") {
    return providerCount > 0
      ? pack("review_needed", "Gemeentelijke validatie vereist.")
      : pack("preliminary", "Nog geen voorstel om te valideren.");
  }

  if (providerCount <= 0) {
    return pack("capacity_uncertain", "Geen aanbieder in regio voor advies.");
  }

  if (providerCount === 1) {
      return urgency === "critical"
      ? pack("manual_coordination", "Eén optie — spoed vraagt handmatige coördinatie.")
        : pack("capacity_uncertain", "Eén optie — capaciteit bevestigen.");
  }

  if (providerCount === 2) {
    return pack("review_needed", "Beperkte keuze — vergelijk in casus.");
  }

  return pack("strong_fit", "Meerdere opties — vergelijk vóór validatie.");
}

function pack(tier: MatchingAdvisoryTier, hintOverride?: string): MatchingAdvisoryAssessment {
  return {
    tier,
    label: MATCHING_ADVISORY_LABELS[tier],
    hint: hintOverride ?? MATCHING_ADVISORY_HINTS[tier],
    tone: TIER_TONE[tier],
    attentionRank: TIER_ATTENTION_RANK[tier],
  };
}

/** Map keten-engine `confidence_label` (hoog/middel/laag/onzeker) to operational advisory copy. */
export function advisoryFromEngineConfidenceLabel(label: string): MatchingAdvisoryAssessment {
  const key = (label || "").trim().toLowerCase();
  switch (key) {
    case "hoog":
      return pack("strong_fit");
    case "middel":
      return pack("review_needed");
    case "laag":
      return pack("capacity_uncertain");
    case "onzeker":
      return pack("manual_coordination");
    default:
      return pack("preliminary", "Vertrouwen op basis van beschikbare gegevens.");
  }
}

/** Qualitative band for persisted numeric engine scores — never shown as a list-row percentage. */
export function advisoryQualitativeFromNumericScore(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(score)) {
    return null;
  }
  const normalized = score > 1 ? score / 100 : score;
  if (normalized >= 0.75) {
    return MATCHING_ADVISORY_LABELS.strong_fit;
  }
  if (normalized >= 0.45) {
    return MATCHING_ADVISORY_LABELS.review_needed;
  }
  return MATCHING_ADVISORY_LABELS.manual_coordination;
}

export function formatCaseDetailMatchingUnderbouwing(args: {
  confidence_score?: number | null;
  confidence_reason?: string | null;
  has_matching_result: boolean;
}): { label: string; detail: string } {
  if (!args.has_matching_result) {
    return {
      label: "Nog geen matchadvies",
      detail: "Start matching of open de matchingwerkruimte voor advies.",
    };
  }

  const reason = args.confidence_reason?.trim();
  if (args.confidence_score == null) {
    return {
      label: MATCHING_ADVISORY_LABELS.review_needed,
      detail: reason ?? "Onderbouwing volgt uit de keten-engine.",
    };
  }

  const normalized = args.confidence_score > 1 ? args.confidence_score / 100 : args.confidence_score;
  const label =
    normalized >= 0.75
      ? MATCHING_ADVISORY_LABELS.strong_fit
      : normalized >= 0.45
        ? MATCHING_ADVISORY_LABELS.review_needed
        : MATCHING_ADVISORY_LABELS.manual_coordination;

  return {
    label,
    detail: reason ?? MATCHING_ADVISORY_HINTS[label === MATCHING_ADVISORY_LABELS.strong_fit ? "strong_fit" : label === MATCHING_ADVISORY_LABELS.review_needed ? "review_needed" : "manual_coordination"],
  };
}

export function matchingProposalStatusLabel(args: {
  has_matching_result: boolean;
  confidence_score?: number | null;
}): string {
  if (!args.has_matching_result) {
    return "Nog geen passend voorstel";
  }
  const { label } = formatCaseDetailMatchingUnderbouwing({
    has_matching_result: true,
    confidence_score: args.confidence_score,
    confidence_reason: null,
  });
  return label;
}

export function signalSeverityForAdvisoryLabel(label: string): "critical" | "warning" | "info" {
  const normalized = label.toLowerCase();
  if (normalized.includes("afstemming") || normalized.includes("handmatige") || normalized.includes("onzeker")) {
    return "warning";
  }
  if (normalized.includes("voorlopige") || normalized.includes("beoordeling") || normalized.includes("onderbouwing")) {
    return "info";
  }
  return "info";
}
