/**
 * PlacementPageWrapper - Wraps the already-designed PlacementPage
 * Shows list view → detail view workflow
 */

import { useState } from "react";
import { PlacementPage } from "./PlacementPage";
import { PlacementListPage } from "./PlacementListPage";
import { mockCases } from "../../lib/casesData";

export function PlacementPageWrapper() {
  const [selectedCase, setSelectedCase] = useState<string | null>(null);

  const handleCaseClick = (caseId: string) => {
    setSelectedCase(caseId);
  };

  const handleBack = () => {
    setSelectedCase(null);
  };

  const handleCancel = () => {
    console.log("Placement cancelled");
    handleBack();
  };

  const handleConfirm = () => {
    console.log("Placement confirmed for case:", selectedCase);
    // Show success, then go back
    setTimeout(() => {
      handleBack();
    }, 2000);
  };

  // If case is selected, show the full placement workflow
  if (selectedCase) {
    // Find a provider for this case (mock - in real app would come from matching)
    const providerId = "P-001"; // Mock provider ID
    
    return (
      <PlacementPage
        caseId={selectedCase}
        providerId={providerId}
        onBack={handleBack}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    );
  }

  // Otherwise show the list view
  return <PlacementListPage onCaseClick={handleCaseClick} />;
}
