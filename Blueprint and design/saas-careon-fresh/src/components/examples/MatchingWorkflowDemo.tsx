/**
 * MatchingWorkflowDemo - Complete demonstration of map-enhanced matching
 * 
 * Shows the full workflow:
 * 1. AI recommendation
 * 2. Provider decision cards with explanations
 * 3. Map integration with synced interactions
 * 4. Risk signals and decision support
 */

import { useState } from "react";
import { MatchingPageWithMap } from "../care/MatchingPageWithMap";
import { mockCases } from "../../lib/casesData";

export function MatchingWorkflowDemo() {
  const [selectedCase] = useState(mockCases[0].id);
  const [matchConfirmed, setMatchConfirmed] = useState(false);

  const handleConfirmMatch = (providerId: string) => {
    console.log("Match confirmed:", providerId);
    setMatchConfirmed(true);
    
    // In real app, this would navigate to placement page
    setTimeout(() => {
      alert(`Match bevestigd! Volgende stap: Plaatsing voorbereiden`);
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
            ✓ Match bevestigd!
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Systeem bereidt plaatsing voor...
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
