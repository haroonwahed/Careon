// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  MATCHING_ADVISORY_LABELS,
  advisoryFromEngineConfidenceLabel,
  advisoryQualitativeFromNumericScore,
  deriveListMatchingAdvisory,
  formatCaseDetailMatchingUnderbouwing,
} from "./matchingAdvisory";

describe("matchingAdvisory", () => {
  it("deriveListMatchingAdvisory returns operational labels without percentages", () => {
    const advisory = deriveListMatchingAdvisory({
      boardColumn: "matching",
      providerCount: 3,
      urgency: "high",
      summaryAvailable: true,
      isBlocked: false,
    });
    expect(advisory?.label).toBe(MATCHING_ADVISORY_LABELS.strong_fit);
    expect(advisory?.label).not.toMatch(/%/);
    expect(advisory?.hint).toContain("vergelijk");
  });

  it("maps engine confidence_label to advisory tiers", () => {
    expect(advisoryFromEngineConfidenceLabel("hoog").label).toBe(MATCHING_ADVISORY_LABELS.strong_fit);
    expect(advisoryFromEngineConfidenceLabel("onzeker").label).toBe(MATCHING_ADVISORY_LABELS.manual_coordination);
  });

  it("converts numeric scores to qualitative bands only", () => {
    expect(advisoryQualitativeFromNumericScore(0.82)).toBe(MATCHING_ADVISORY_LABELS.strong_fit);
    expect(advisoryQualitativeFromNumericScore(55)).toBe(MATCHING_ADVISORY_LABELS.review_needed);
    expect(advisoryQualitativeFromNumericScore(null)).toBeNull();
  });

  it("formatCaseDetailMatchingUnderbouwing avoids percentage strings", () => {
    const formatted = formatCaseDetailMatchingUnderbouwing({
      has_matching_result: true,
      confidence_score: 0.91,
      confidence_reason: "Arrangement sluit grotendeels aan",
    });
    expect(formatted.label).not.toMatch(/%/);
    expect(formatted.detail).toBe("Arrangement sluit grotendeels aan");
  });
});
