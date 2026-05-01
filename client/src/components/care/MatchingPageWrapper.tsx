/**
 * MatchingPageWrapper - Wraps the already-designed MatchingPageWithMap
 * Shows list view → detail view workflow
 */

import { useState } from "react";
import { MatchingPageWithMap } from "./MatchingPageWithMap";
import { MatchingQueuePage } from "./MatchingQueuePage";

interface MatchingPageWrapperProps {
  onNavigateToCasussen?: () => void;
  onNavigateToBeoordelingen?: () => void;
  /** After waitlist proposal is saved, open case detail (e.g. `/care/cases/<id>/`). */
  onNavigateToCaseDetail?: (caseId: string) => void;
}

export function MatchingPageWrapper({
  onNavigateToCasussen,
  onNavigateToBeoordelingen,
  onNavigateToCaseDetail,
}: MatchingPageWrapperProps) {
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [matchConfirmed, setMatchConfirmed] = useState(false);

  const handleCaseClick = (caseId: string) => {
    setSelectedCase(caseId);
  };

  const handleBack = () => {
    setSelectedCase(null);
    setMatchConfirmed(false);
  };

  const handleConfirmMatch = (_providerId: string) => {
    setMatchConfirmed(true);
    // Case is sent to provider for beoordeling — navigate to beoordelingen page after short feedback delay
    setTimeout(() => {
      if (onNavigateToBeoordelingen) {
        onNavigateToBeoordelingen();
      } else {
        handleBack();
      }
    }, 1500);
  };

  // If case is selected, show the full matching workflow
  if (selectedCase) {
    return (
      <MatchingPageWithMap
        caseId={selectedCase}
        onBack={handleBack}
        onConfirmMatch={handleConfirmMatch}
        onNavigateToCase={onNavigateToCaseDetail}
      />
    );
  }

  // Otherwise show the list view
  return <MatchingQueuePage onCaseClick={handleCaseClick} onNavigateToCasussen={onNavigateToCasussen} />;
}
