/**
 * MatchingPageWrapper - Wraps the already-designed MatchingPageWithMap
 * Shows list view → detail view workflow
 */

import { useEffect, useState } from "react";
import { MatchingPageWithMap } from "./MatchingPageWithMap";
import { MatchingQueuePage } from "./MatchingQueuePage";

function readOpenCaseFromSearch(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = new URLSearchParams(window.location.search).get("openCase");
  const trimmed = raw?.trim() ?? "";
  // Numeric CareCase.pk in production; E2E stubs may use slug ids (e.g. e2e-matching-1).
  if (!trimmed || !/^[A-Za-z0-9_-]{1,128}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

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
  const [selectedCase, setSelectedCase] = useState<string | null>(() => readOpenCaseFromSearch());
  const [matchConfirmed, setMatchConfirmed] = useState(false);

  /** Keep URL in sync with list vs case workspace so the address bar matches what you see (and `/matching` means queue). */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    const next = new URL(url.href);
    if (selectedCase) {
      next.searchParams.set("openCase", selectedCase);
    } else {
      next.searchParams.delete("openCase");
    }
    const serialized = `${next.pathname}${next.search}${next.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (serialized !== current) {
      window.history.replaceState(window.history.state, "", serialized);
    }
  }, [selectedCase]);

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
