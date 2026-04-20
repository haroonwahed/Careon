/**
 * MatchingPageWrapper - Wraps the already-designed MatchingPageWithMap
 * Shows list view → detail view workflow
 */

import { useState } from "react";
import { MatchingPageWithMap } from "./MatchingPageWithMap";
import { MatchingQueuePage } from "./MatchingQueuePage";

interface MatchingPageWrapperProps {
  onNavigateToCasussen?: () => void;
}

export function MatchingPageWrapper({ onNavigateToCasussen }: MatchingPageWrapperProps) {
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [matchConfirmed, setMatchConfirmed] = useState(false);

  const handleCaseClick = (caseId: string) => {
    setSelectedCase(caseId);
  };

  const handleBack = () => {
    setSelectedCase(null);
    setMatchConfirmed(false);
  };

  const handleConfirmMatch = (providerId: string) => {
    setMatchConfirmed(true);
    // Could show success message, then go back to list
    setTimeout(() => {
      handleBack();
    }, 2000);
  };

  // If case is selected, show the full matching workflow
  if (selectedCase) {
    return (
      <MatchingPageWithMap
        caseId={selectedCase}
        onBack={handleBack}
        onConfirmMatch={handleConfirmMatch}
      />
    );
  }

  // Otherwise show the list view
  return <MatchingQueuePage onCaseClick={handleCaseClick} onNavigateToCasussen={onNavigateToCasussen} />;
}
