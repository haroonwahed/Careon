import type { WorkflowCaseView } from "./workflowUi";
import type { SpaAssessment } from "../hooks/useAssessments";
import type { SpaProvider } from "../hooks/useProviders";
import type { SpaRegion } from "../hooks/useRegions";

/**
 * Counts the number of distinct action signals across cases, assessments,
 * providers and regions — mirrors the signal generation logic in SignalenPage
 * so that the sidebar badge matches the page count.
 */
export function countActionSignals(
  workflowCases: WorkflowCaseView[],
  assessments: SpaAssessment[],
  providers: SpaProvider[],
  regions: SpaRegion[],
): number {
  const ids = new Set<string>();
  const push = (id: string) => ids.add(id);

  workflowCases.forEach((wc) => {

    if (wc.phase !== "afgerond" && wc.daysInCurrentPhase >= 14) {
      push(`phase-time-critical-${wc.id}`);
    } else if (wc.phase !== "afgerond" && wc.daysInCurrentPhase >= 8) {
      push(`phase-time-warning-${wc.id}`);
    }

    if (wc.urgency === "critical" && wc.phase === "matching" && (wc.recommendedProvidersCount === 0 || wc.isBlocked)) {
      push(`urgent-no-match-${wc.id}`);
    }

    if (wc.phase === "matching" && wc.daysInCurrentPhase >= 4 && !wc.readyForPlacement) {
      push(`missing-placement-${wc.id}`);
    }
  });

  assessments
    .filter((a) => a.status !== "completed" || !a.matchingReady || a.missingInfo.length > 0)
    .forEach((a) => push(`incomplete-assessment-${a.id}`));

  const capacityPressureCount = providers.filter((p) => p.availableSpots <= 0 || p.waitingListLength >= 10).length;
  const matchingWithoutOptions = workflowCases.filter((c) => c.phase === "matching" && c.recommendedProvidersCount === 0).length;
  if (capacityPressureCount > 0 || matchingWithoutOptions > 0) {
    push("capacity-availability-issue");
  }

  regions
    .filter((r) => r.status !== "stabiel")
    .slice(0, 8)
    .forEach((r) => push(`region-health-${r.id}`));

  return Math.min(ids.size, 24);
}
