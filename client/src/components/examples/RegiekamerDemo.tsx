/**
 * RegiekamerDemo - Control Center Demonstration
 * 
 * Shows the redesigned Regiekamer as an operational control tower
 */

import { useState } from "react";
import { SystemAwarenessPage } from "../care/SystemAwarenessPage";
import { CareAppFrame } from "../care/CareAppFrame";

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
      <CareAppFrame>
        {selectedCase && (
          <div className="rounded-xl border border-border/70 bg-card/80 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Navigatie
                </p>
                <p className="truncate text-sm font-semibold text-primary">
                  Casus: {selectedCase}
                </p>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Sluiten
              </button>
            </div>
          </div>
        )}
        <SystemAwarenessPage onCaseClick={handleCaseClick} />
      </CareAppFrame>
    </div>
  );
}
