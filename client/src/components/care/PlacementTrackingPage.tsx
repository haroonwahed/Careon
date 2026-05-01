import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import { CareEmptyState } from "./CareSurface";
import {
  CareAttentionBar,
  CareContextHint,
  CareDominantStatus,
  CareFilterTabButton,
  CareFilterTabGroup,
  CareMetricBadge,
  CareMetaChip,
  CarePageTemplate,
  CarePrimaryList,
  CareSearchFiltersBar,
  CareUnifiedHeader,
  CareWorkRow,
} from "./CareUnifiedPage";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases } from "../../lib/workflowUi";

interface PlacementTrackingPageProps {
  onCaseClick: (caseId: string) => void;
  onNavigateToMatching?: () => void;
}

type PlacementTab = "te-bevestigen" | "lopend" | "afgerond";

export function PlacementTrackingPage({ onCaseClick, onNavigateToMatching }: PlacementTrackingPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<PlacementTab>("te-bevestigen");
  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const placementCases = useMemo(() => {
    return buildWorkflowCases(cases, providers).filter((item) => item.phase === "plaatsing" || item.phase === "afgerond");
  }, [cases, providers]);

  const tabCounts = {
    "te-bevestigen": placementCases.filter((item) => item.phase === "plaatsing" && item.daysInCurrentPhase <= 2).length,
    lopend: placementCases.filter((item) => item.phase === "plaatsing" && item.daysInCurrentPhase > 2).length,
    afgerond: placementCases.filter((item) => item.phase === "afgerond").length,
  };

  const visibleCases = placementCases.filter((item) => {
    if (activeTab === "te-bevestigen") return item.phase === "plaatsing" && item.daysInCurrentPhase <= 2;
    if (activeTab === "lopend") return item.phase === "plaatsing" && item.daysInCurrentPhase > 2;
    return item.phase === "afgerond";
  });

  const intakeStallCount = useMemo(
    () => placementCases.filter((item) => item.phase === "plaatsing" && item.daysInCurrentPhase >= 5).length,
    [placementCases],
  );

  const emptyCopy = {
    "te-bevestigen": "Bevestig plaatsing en plan intake zodra de aanbieder heeft geaccepteerd.",
    lopend: "Volg lopende plaatsingen tot intake is gepland en gestart.",
    afgerond: "Afgeronde trajecten blijven hier terugvindbaar voor audit en nazorg.",
  } as const;

  const tabLabel: Record<PlacementTab, string> = {
    "te-bevestigen": "Te bevestigen",
    lopend: "Lopend",
    afgerond: "Afgerond",
  };

  return (
    <CarePageTemplate
      className="pb-8"
      header={
        <CareUnifiedHeader
          title="Plaatsingen"
          subtitle="Van bevestiging tot intake — één lijn door de keten."
          metric={
            <CareMetricBadge>
              {placementCases.length} plaatsingen in flow
            </CareMetricBadge>
          }
        />
      }
      filters={
        <CareSearchFiltersBar
          tabs={
            <CareFilterTabGroup aria-label="Plaatsing-status">
              {(["te-bevestigen", "lopend", "afgerond"] as PlacementTab[]).map((tab) => (
                <CareFilterTabButton key={tab} selected={activeTab === tab} onClick={() => setActiveTab(tab)}>
                  {tabLabel[tab]} · {tabCounts[tab]}
                </CareFilterTabButton>
              ))}
            </CareFilterTabGroup>
          }
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Zoek casus, provider of regio..."
        />
      }
    >
      <CareAttentionBar
        visible={intakeStallCount > 0}
        tone="warning"
        message={`${intakeStallCount} plaatsing${intakeStallCount === 1 ? "" : "en"} staat${intakeStallCount === 1 ? "" : "en"} ≥5 dagen in plaatsing zonder duidelijke intake — plan intake of escaleer via Regiekamer.`}
      />

      {loading && <CareEmptyState title="Plaatsingen laden…" copy="De lijst wordt opgebouwd." />}
      {!loading && error && (
        <CareEmptyState title="Laden mislukt" copy={error} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
      )}

      {!loading && !error && visibleCases.length === 0 && (
        <CareEmptyState
          title="Geen plaatsingen in dit overzicht"
          copy={emptyCopy[activeTab]}
          action={<Button onClick={() => onNavigateToMatching?.()}>Naar matching</Button>}
        />
      )}

      {!loading && !error && visibleCases.length > 0 && (
        <CarePrimaryList>
          {visibleCases.map((item) => (
            <CareWorkRow
              key={item.id}
              title={item.clientLabel}
              context={`${item.id} · ${item.recommendedProviderName ?? "Nog niet gekozen"}`}
              status={<CareDominantStatus>{tabLabel[activeTab]}</CareDominantStatus>}
              time={
                <CareMetaChip>
                  {item.daysInCurrentPhase}d in fase
                </CareMetaChip>
              }
              contextInfo={
                <CareMetaChip>{item.intakeDateLabel ?? "Intake volgt"}</CareMetaChip>
              }
              actionLabel="Bekijk intake"
              onOpen={() => onCaseClick(item.id)}
              onAction={(event) => {
                event.stopPropagation();
                onCaseClick(item.id);
              }}
            />
          ))}
        </CarePrimaryList>
      )}

      <CareContextHint
        icon={<CheckCircle2 className="text-primary" size={20} />}
        title="Volgt uit matching"
        copy="Plaatsing en intake horen bij elkaar; gebruik de casus voor de volgende beslissing."
      />
    </CarePageTemplate>
  );
}
