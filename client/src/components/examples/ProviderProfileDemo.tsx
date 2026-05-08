/**
 * ProviderProfileDemo - Complete provider profile demonstration
 * 
 * Shows provider profile in both contexts:
 * - From matching (with match score)
 * - From exploration
 */

import { useState } from "react";
import { ProviderProfilePage } from "../care/ProviderProfilePage";
import { mockProviders } from "../../lib/casesData";
import { Button } from "../ui/button";
import { CareAppFrame } from "../care/CareAppFrame";

export function ProviderProfileDemo() {
  const [context, setContext] = useState<"matching" | "exploration">("matching");
  const provider = mockProviders[0];

  const handleSelect = () => {
    console.log("Provider selected:", provider.id);
    alert("Provider geselecteerd! Navigeren naar plaatsing...");
  };

  const handleBack = () => {
    console.log("Navigate back");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Provider Profile */}
      <CareAppFrame>
        <div className="rounded-xl border border-border/70 bg-card/80 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              <p className="font-semibold uppercase tracking-[0.08em]">Demo</p>
              <p className="mt-1 text-foreground">
                Nu: <span className="font-semibold">{context}</span>
                {context === "matching" ? " · Score 94%" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={context === "matching" ? "default" : "outline"}
                onClick={() => setContext("matching")}
              >
                Matching
              </Button>
              <Button
                size="sm"
                variant={context === "exploration" ? "default" : "outline"}
                onClick={() => setContext("exploration")}
              >
                Verkennen
              </Button>
            </div>
          </div>
        </div>

        <ProviderProfilePage
          provider={provider}
          context={context}
          matchScore={context === "matching" ? 94 : undefined}
          caseId={context === "matching" ? "CASE-2024-001" : undefined}
          onSelectProvider={context === "matching" ? handleSelect : undefined}
          onBack={handleBack}
        />
      </CareAppFrame>
    </div>
  );
}
