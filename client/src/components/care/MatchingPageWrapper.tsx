/**
 * MatchingPageWrapper - Wraps the matching decision engine detail view
 * Shows list view → detail view workflow
 */

import { useEffect, useState } from "react";
import { MatchingPageWithMap } from "./MatchingDecisionEnginePage";
import { MatchingQueuePage } from "./MatchingQueuePage";
import { apiClient } from "../../lib/apiClient";

interface MatchingPageWrapperProps {
  onNavigateToCasussen?: () => void;
  onProviderReviewStarted?: (caseId: string) => void;
  initialCaseId?: string | null;
}

export function MatchingPageWrapper({ onNavigateToCasussen, onProviderReviewStarted, initialCaseId = null }: MatchingPageWrapperProps) {
  const [selectedCase, setSelectedCase] = useState<string | null>(initialCaseId);
  const [isSubmittingMatch, setIsSubmittingMatch] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCaseId) {
      setSelectedCase(initialCaseId);
    }
  }, [initialCaseId]);

  const handleCaseClick = (caseId: string) => {
    setSelectedCase(caseId);
  };

  const handleBack = () => {
    if (isSubmittingMatch) {
      return;
    }
    setSelectedCase(null);
    setSubmitError(null);
  };

  const handleConfirmMatch = async (providerId: string) => {
    if (!selectedCase || isSubmittingMatch) {
      return;
    }

    setIsSubmittingMatch(true);
    setSubmitError(null);

    const parsedProviderId = Number.parseInt(providerId, 10);

    try {
      await apiClient.post(`/care/api/cases/${selectedCase}/matching-action/`, {
        action: "assign",
        provider_id: Number.isNaN(parsedProviderId) ? providerId : parsedProviderId,
      });

      onProviderReviewStarted?.(selectedCase);
      setSelectedCase(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aanbiedersverzoek kon niet verstuurd worden.";
      setSubmitError(message);
    } finally {
      setIsSubmittingMatch(false);
    }
  };

  // If case is selected, show the full matching workflow
  if (selectedCase) {
    return (
      <MatchingPageWithMap
        caseId={selectedCase}
        onBack={handleBack}
        onConfirmMatch={handleConfirmMatch}
        isSubmittingMatch={isSubmittingMatch}
        submitError={submitError}
      />
    );
  }

  // Otherwise show the list view
  return <MatchingQueuePage onCaseClick={handleCaseClick} onNavigateToCasussen={onNavigateToCasussen} />;
}
