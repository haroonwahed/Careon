/**
 * RegiekamerDemo - Control Center Demonstration
 * 
 * Shows the redesigned Regiekamer as an operational control tower
 */

import { useState } from "react";
import { RegiekamerControlCenter } from "../care/RegiekamerControlCenter";

export function RegiekamerDemo() {
  const [selectedCase, setSelectedCase] = useState<string | null>(null);

  const handleCaseClick = (caseId: string) => {
    console.log("Navigate to case:", caseId);
    setSelectedCase(caseId);
    
    // In real app, navigate to case detail page
    // router.push(`/cases/${caseId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {selectedCase && (
        <div className="fixed top-4 right-4 z-50 premium-card p-4 bg-card/95 backdrop-blur max-w-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
            Would navigate to:
          </p>
          <p className="text-sm font-bold text-primary">
            Case Detail: {selectedCase}
          </p>
          <button
            onClick={() => setSelectedCase(null)}
            className="text-xs text-muted-foreground hover:text-foreground mt-2"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="max-w-[1920px] mx-auto p-6">
        <RegiekamerControlCenter onCaseClick={handleCaseClick} />
      </div>
    </div>
  );
}
