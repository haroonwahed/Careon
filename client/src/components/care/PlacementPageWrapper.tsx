/**
 * PlacementPageWrapper - Wraps the already-designed PlacementPage
 * Shows list view → detail view workflow
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PlacementPage } from "./PlacementPage";
import { PlacementTrackingPage } from "./PlacementTrackingPage";
import { useCasePlacement } from "../../hooks/useCasePlacement";

interface PlacementPageWrapperProps {
  onNavigateToMatching?: () => void;
  initialCaseId?: string | null;
}

export function PlacementPageWrapper({ onNavigateToMatching, initialCaseId = null }: PlacementPageWrapperProps) {
  const [selectedCase, setSelectedCase] = useState<string | null>(initialCaseId);
  const { placement, loading: placementLoading } = useCasePlacement(selectedCase);

  useEffect(() => {
    if (initialCaseId) {
      setSelectedCase(initialCaseId);
    }
  }, [initialCaseId]);

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
    if (placementLoading) {
      return (
        <div className="flex items-center justify-center min-h-[300px] text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span>Plaatsing laden...</span>
        </div>
      );
    }

    const providerId = placement?.resolvedProviderId ?? "";

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
  return <PlacementTrackingPage onCaseClick={handleCaseClick} onNavigateToMatching={onNavigateToMatching} />;
}
