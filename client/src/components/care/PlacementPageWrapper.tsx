/**
 * PlacementPageWrapper - Wraps the already-designed PlacementPage
 * Shows list view → detail view workflow
 */

import { useState } from "react";
import { PlacementPage } from "./PlacementPage";
import { PlacementListPage } from "./PlacementListPage";
import { useProviders } from "../../hooks/useProviders";

export function PlacementPageWrapper() {
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const { providers } = useProviders({ q: "" });

  const handleCaseClick = (caseId: string) => {
    setSelectedCase(caseId);
  };

  const handleBack = () => {
    setSelectedCase(null);
  };

  const handleCancel = () => {
    handleBack();
  };

  const handleConfirm = () => {
    // Show success, then go back
    setTimeout(() => {
      handleBack();
    }, 2000);
  };

  // If case is selected, show the full placement workflow
  if (selectedCase) {
    const providerId = providers[0]?.id ?? "";
    
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
