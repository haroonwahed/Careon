/**
 * PlacementPageWrapper - Wraps the already-designed PlacementPage
 * Shows list view → detail view workflow
 */

import { useState } from "react";
import { PlacementPage } from "./PlacementPage";
import { PlacementTrackingPage } from "./PlacementTrackingPage";
import { useProviders } from "../../hooks/useProviders";
import { useCases } from "../../hooks/useCases";

interface PlacementPageWrapperProps {
  onNavigateToMatching?: () => void;
  onNavigateToAanbiederreacties?: () => void;
}

export function PlacementPageWrapper({ onNavigateToMatching, onNavigateToAanbiederreacties }: PlacementPageWrapperProps) {
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const { providers } = useProviders({ q: "" });
  const { cases } = useCases({ q: "" });

  const handleCaseClick = (caseId: string) => {
    setSelectedCase(caseId);
  };

  const handleBack = () => {
    setSelectedCase(null);
  };

  const handleCancel = () => {
    handleBack();
  };

  // If case is selected, show the full placement workflow
  if (selectedCase) {
    const selectedCaseData = cases.find((c) => c.id === selectedCase);
    const arrangementProviderName = selectedCaseData?.arrangementProvider?.trim() ?? "";
    const providerId = arrangementProviderName
      ? (providers.find((p) => p.name === arrangementProviderName)?.id ?? "")
      : "";
    
    return (
      <PlacementPage
        caseId={selectedCase}
        providerId={providerId}
        onBack={handleBack}
        onCancel={handleCancel}
      />
    );
  }

  // Otherwise show the list view
  return (
    <PlacementTrackingPage
      onCaseClick={handleCaseClick}
      onNavigateToMatching={onNavigateToMatching}
      onNavigateToAanbiederreacties={onNavigateToAanbiederreacties}
    />
  );
}
