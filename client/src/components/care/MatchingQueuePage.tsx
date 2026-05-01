import { useMemo, useState } from "react";
import { Building2, Clock3, Shuffle } from "lucide-react";
import { Button } from "../ui/button";
import { CareEmptyState } from "./CareSurface";
import {
  CanonicalPhaseBadge,
  CareAttentionBar,
  CareContextHint,
  CareDominantStatus,
  CareMetricBadge,
  CareMetaChip,
  CarePageTemplate,
  CarePrimaryList,
  CareSearchFiltersBar,
  CareUnifiedHeader,
  CareWorkRow,
  normalizeBoardColumnToPhaseId,
} from "./CareUnifiedPage";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCases } from "../../lib/workflowUi";

interface MatchingQueuePageProps {
  onCaseClick: (caseId: string) => void;
  onNavigateToCasussen?: () => void;
}

export function MatchingQueuePage({ onCaseClick, onNavigateToCasussen }: MatchingQueuePageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);

  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const queueCases = useMemo(() => {
    const _sentinel = "9999-12-31";
    return buildWorkflowCases(cases, providers)
      .filter((item) => item.readyForMatching)
      .filter((item) => selectedRegion === "all" || item.region === selectedRegion)
      .sort((a, b) => {
        const aBucket = a.waitlistBucket ?? 1;
        const bBucket = b.waitlistBucket ?? 1;
        if (aBucket !== bBucket) return aBucket - bBucket;
        if (aBucket === 0) {
          const aDate = a.urgencyGrantedDate ?? _sentinel;
          const bDate = b.urgencyGrantedDate ?? _sentinel;
          return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
        }
        const aStart = a.intakeStartDate ?? _sentinel;
        const bStart = b.intakeStartDate ?? _sentinel;
        return aStart < bStart ? -1 : aStart > bStart ? 1 : 0;
      });
  }, [cases, providers, selectedRegion]);

  const regions = useMemo(() => ["all", ...Array.from(new Set(queueCases.map((item) => item.region)))], [queueCases]);
  const urgentCount = queueCases.filter((item) => item.urgency === "critical" || item.urgency === "warning").length;
  const blockedCount = queueCases.filter((item) => item.isBlocked).length;

  return (
    <CarePageTemplate
      className="pb-8"
      header={
        <CareUnifiedHeader
          title="Matching"
          subtitle="Vergelijk fit, capaciteit en blokkades voordat je doorzet naar validatie."
          metric={
            <CareMetricBadge>
              {queueCases.length} casussen klaar voor matching
            </CareMetricBadge>
          }
        />
      }
      attention={
        <CareAttentionBar
          visible={blockedCount > 0}
          tone="warning"
          message={`${blockedCount} casus${blockedCount === 1 ? "" : "sen"} geblokkeerd — los dit eerst op voordat matching betrouwbaar is.`}
        />
      }
      filters={
        <CareSearchFiltersBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Zoek casus, client of regio..."
        showSecondaryFilters={showSecondaryFilters}
        onToggleSecondaryFilters={() => setShowSecondaryFilters((v) => !v)}
        secondaryFilters={
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedRegion}
              onChange={(event) => setSelectedRegion(event.target.value)}
              className="h-9 min-w-[160px] rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground"
            >
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region === "all" ? "Alle regio's" : region}
                </option>
              ))}
            </select>
            <CareMetaChip>
              <Clock3 size={12} />
              Urgent: {urgentCount}
            </CareMetaChip>
            <CareMetaChip>
              <Building2 size={12} />
              Blokkades: {blockedCount}
            </CareMetaChip>
          </div>
        }
        />
      }
    >
      {loading && <CareEmptyState title="Matching laden…" copy="De wachtrij wordt opgebouwd." />}
      {!loading && error && (
        <CareEmptyState title="Laden mislukt" copy={error} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
      )}

      {!loading && !error && queueCases.length === 0 && (
        <CareEmptyState
          title="Geen casussen in matching"
          copy="Zodra samenvatting en voorbereiding klaar zijn, verschijnen casussen hier automatisch."
          action={<Button onClick={() => onNavigateToCasussen?.()}>Terug naar werkvoorraad</Button>}
        />
      )}

      {!loading && !error && queueCases.length > 0 && (
        <CarePrimaryList>
          {queueCases.map((item) => (
            <CareWorkRow
              key={item.id}
              leading={<CanonicalPhaseBadge phaseId={normalizeBoardColumnToPhaseId(item.boardColumn)} />}
              title={item.clientLabel}
              context={`${item.id} · ${item.region}`}
              status={
                <CareDominantStatus
                  className={
                    item.matchConfidenceScore != null && item.matchConfidenceScore < 40
                      ? "border-destructive/35 bg-destructive/10 text-destructive"
                      : item.matchConfidenceScore != null && item.matchConfidenceScore < 65
                        ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                        : undefined
                  }
                >
                  {item.matchConfidenceLabel ?? item.phaseLabel}
                </CareDominantStatus>
              }
              time={
                <CareMetaChip>
                  <Clock3 size={12} />
                  {item.daysInCurrentPhase}d
                </CareMetaChip>
              }
              contextInfo={
                <CareMetaChip>
                  {item.recommendedProvidersCount} aanbieders
                </CareMetaChip>
              }
              actionLabel={item.primaryActionEnabled ? "Start matching" : "Controleer matchadvies"}
              actionVariant={item.primaryActionEnabled ? "primary" : "ghost"}
              onOpen={() => onCaseClick(item.id)}
              onAction={(event) => {
                event.stopPropagation();
                onCaseClick(item.id);
              }}
              accentTone={item.isBlocked ? "critical" : item.urgency === "critical" ? "warning" : "neutral"}
            />
          ))}
        </CarePrimaryList>
      )}

      <CareContextHint
        icon={<Shuffle className="text-primary" size={18} />}
        title="Werk vanuit samenvatting"
        copy="Matching is alleen zinvol als de casus inhoudelijk compleet is."
      />
    </CarePageTemplate>
  );
}
