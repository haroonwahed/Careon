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
      {/* Demo Controls */}
      <div className="fixed top-4 right-4 z-50 premium-card p-4 bg-card/95 backdrop-blur space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase">
          Demo
        </p>
        
        <div className="space-y-2">
          <Button
            size="sm"
            variant={context === "matching" ? "default" : "outline"}
            onClick={() => setContext("matching")}
            className="w-full"
          >
            Matching
          </Button>
          <Button
            size="sm"
            variant={context === "exploration" ? "default" : "outline"}
            onClick={() => setContext("exploration")}
            className="w-full"
          >
            Verkennen
          </Button>
        </div>

        <div className="text-xs text-muted-foreground pt-2 border-t border-border">
          <p>Nu: <span className="font-semibold text-foreground">{context}</span></p>
          {context === "matching" && (
            <p className="mt-1">Score: <span className="font-semibold text-green-400">94%</span></p>
          )}
        </div>
      </div>

      {/* Provider Profile */}
      <ProviderProfilePage
        provider={provider}
        context={context}
        matchScore={context === "matching" ? 94 : undefined}
        caseId={context === "matching" ? "CASE-2024-001" : undefined}
        onSelectProvider={context === "matching" ? handleSelect : undefined}
        onBack={handleBack}
      />
    </div>
  );
}
