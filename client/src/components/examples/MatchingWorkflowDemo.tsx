/**
 * MatchingWorkflowDemo - Complete demonstration of map-enhanced matching
 *
 * Shows the full workflow:
 * 1. AI recommendation
 * 2. Provider decision cards with explanations
 * 3. Map integration with synced interactions
 * 4. Risk signals and decision support
 *
 * Case id: prefers the first live case in matching from the API; otherwise a static
 * mock case in matching phase (not the first mock row, which is often blocked).
 */

import { useMemo, useState } from "react";
import { MatchingPageWithMap } from "../care/MatchingPageWithMap";
import { useCases } from "../../hooks/useCases";
import { mockCases } from "../../lib/casesData";

const FALLBACK_DEMO_CASE_ID =
  mockCases.find((c) => c.status === "matching")?.id ?? mockCases[0].id;

export function MatchingWorkflowDemo() {
  const { cases, loading } = useCases({ q: "" });
  const selectedCase = useMemo(() => {
    if (loading) {
      return FALLBACK_DEMO_CASE_ID;
    }
    const liveMatching = cases.find((c) => c.status === "matching");
    if (liveMatching) return liveMatching.id;
    if (cases.some((c) => c.id === FALLBACK_DEMO_CASE_ID)) {
      return FALLBACK_DEMO_CASE_ID;
    }
    return cases[0]?.id ?? FALLBACK_DEMO_CASE_ID;
  }, [cases, loading]);
  const [matchConfirmed, setMatchConfirmed] = useState(false);

  const handleConfirmMatch = (providerId: string) => {
    console.log("Match confirmed:", providerId);
    setMatchConfirmed(true);
    
    // In real app, this would navigate to placement page
    setTimeout(() => {
      alert(`Bevestigd. Start plaatsing.`);
    }, 500);
  };

  const handleBack = () => {
    console.log("Navigate back to case detail");
  };

  return (
    <div className="min-h-screen bg-background">
      {matchConfirmed && (
        <div className="fixed top-4 right-4 z-50 premium-card p-4 bg-green-500/10 border-2 border-green-500/30 max-w-sm">
          <p className="text-sm font-semibold text-green-400">
            ✓ Bevestigd
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Start plaatsing.
          </p>
        </div>
      )}

      <MatchingPageWithMap
        caseId={selectedCase}
        onBack={handleBack}
        onConfirmMatch={handleConfirmMatch}
      />
    </div>
  );
}
