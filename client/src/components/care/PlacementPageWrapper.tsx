/**
 * PlacementPageWrapper - Wraps the already-designed PlacementPage
 * Shows list view → detail view workflow
 */

import { useState } from "react";
import { PlacementPage } from "./PlacementPage";
import { PlacementTrackingPage } from "./PlacementTrackingPage";
import { useProviders } from "../../hooks/useProviders";

interface PlacementPageWrapperProps {
  onNavigateToMatching?: () => void;
}

export function PlacementPageWrapper({ onNavigateToMatching }: PlacementPageWrapperProps) {
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
  return <PlacementTrackingPage onCaseClick={handleCaseClick} onNavigateToMatching={onNavigateToMatching} />;
}
