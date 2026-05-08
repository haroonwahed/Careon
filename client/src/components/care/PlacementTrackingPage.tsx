import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  CareAttentionBar,
  CareContextHint,
  CareDominantStatus,
  CareFilterTabButton,
  CareFilterTabGroup,
  CareMetricBadge,
  CareInfoPopover,
  CareMetaChip,
  CarePageScaffold,
  CarePrimaryList,
  CareSearchFiltersBar,
  CareWorkRow,
  EmptyState,
  ErrorState,
  FlowPhaseBadge,
  LoadingState,
  PrimaryActionButton,
  normalizeBoardColumnToPhaseId,
} from "./CareDesignPrimitives";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import {
  buildWorkflowCases,
  placementTrackingRowAction,
  placementTrackingRowStatusLabel,
  placementTrackingSubstepAmbiguous,
  placementTrackingTabBucket,
} from "../../lib/workflowUi";

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
    "te-bevestigen": placementCases.filter((item) => placementTrackingTabBucket(item) === "te-bevestigen").length,
    lopend: placementCases.filter((item) => placementTrackingTabBucket(item) === "lopend").length,
    afgerond: placementCases.filter((item) => placementTrackingTabBucket(item) === "afgerond").length,
  };

  const visibleCases = placementCases.filter((item) => placementTrackingTabBucket(item) === activeTab);

  const intakeStallCount = useMemo(
    () => placementCases.filter((item) => item.phase === "plaatsing" && item.daysInCurrentPhase >= 5).length,
    [placementCases],
  );

  const ambiguousPlacementCount = useMemo(
    () => placementCases.filter((item) => placementTrackingSubstepAmbiguous(item)).length,
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
    <CarePageScaffold
      archetype="worklist"
      className="pb-8"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Plaatsingen
          <CareInfoPopover ariaLabel="Uitleg plaatsingen" testId="plaatsingen-page-info">
            <p className="text-muted-foreground">Van bevestiging tot intake — één lijn door de keten.</p>
          </CareInfoPopover>
        </span>
      }
      metric={
        <CareMetricBadge>
          {placementCases.length} plaatsingen in flow
        </CareMetricBadge>
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
        visible={ambiguousPlacementCount > 0}
        tone="info"
        message={
          ambiguousPlacementCount === 1
            ? "1 casus heeft geen duidelijk placement-signaal (workflow/arrangement/placement-record) — open het dossier voor de exacte tussenstap."
            : `${ambiguousPlacementCount} casussen hebben geen duidelijk placement-signaal (workflow/arrangement/placement-record) — open het dossier voor de exacte tussenstap.`
        }
      />
      <CareAttentionBar
        visible={intakeStallCount > 0}
        tone="warning"
        message={`${intakeStallCount} plaatsing${intakeStallCount === 1 ? "" : "en"} staat${intakeStallCount === 1 ? "" : "en"} ≥5 dagen in plaatsing zonder duidelijke intake — plan intake of escaleer via Regiekamer.`}
      />

      {loading && <LoadingState title="Plaatsingen laden…" copy="De lijst wordt opgebouwd." />}
      {!loading && error && (
        <ErrorState title="Laden mislukt" copy={error} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
      )}

      {!loading && !error && visibleCases.length === 0 && (
        <EmptyState
          title="Geen plaatsingen in dit overzicht"
          copy={emptyCopy[activeTab]}
          action={<PrimaryActionButton onClick={() => onNavigateToMatching?.()}>Naar matching</PrimaryActionButton>}
        />
      )}

      {!loading && !error && visibleCases.length > 0 && (
        <CarePrimaryList>
          {visibleCases.map((item) => {
            const { actionLabel, actionVariant } = placementTrackingRowAction(item);
            const ambiguous = placementTrackingSubstepAmbiguous(item);
            return (
            <CareWorkRow
              key={item.id}
              leading={<FlowPhaseBadge phaseId={normalizeBoardColumnToPhaseId(item.boardColumn)} />}
              title={item.clientLabel}
              context={`${item.id} · ${item.recommendedProviderName ?? "Nog niet gekozen"}`}
              status={<CareDominantStatus>{placementTrackingRowStatusLabel(item)}</CareDominantStatus>}
              time={
                <CareMetaChip>
                  {item.daysInCurrentPhase}d in fase
                </CareMetaChip>
              }
              contextInfo={
                <>
                  <CareMetaChip>{item.intakeDateLabel ?? "Intake volgt"}</CareMetaChip>
                  {ambiguous ? (
                    <CareMetaChip title="Geen workflow/arrangement/placement-record in API — controleer in dossier">
                      Status via dossier
                    </CareMetaChip>
                  ) : null}
                </>
              }
              actionLabel={actionLabel}
              actionVariant={actionVariant}
              onOpen={() => onCaseClick(item.id)}
              onAction={(event) => {
                event.stopPropagation();
                onCaseClick(item.id);
              }}
            />
            );
          })}
        </CarePrimaryList>
      )}

      <CareContextHint
        icon={<CheckCircle2 className="text-primary" size={20} />}
        title="Volgt uit matching"
        copy="Plaatsing & intake horen bij elkaar; gebruik de casus voor de volgende beslissing."
      />
    </CarePageScaffold>
  );
}
