import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Filter,
  Plus,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  CareAlertCard,
  CareFilterTabButton,
  CareFilterTabGroup,
  CareDominantStatus,
  CareMetaChip,
  CarePageScaffold,
  CareOperationalQueueHeader,
  CareSearchFiltersBar,
  CareWorkRow,
  CareWorkListCard,
  CareWorkspaceSection,
  CARE_RHYTHM,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
} from "./CareDesignPrimitives";
import { cn } from "../ui/utils";
import { useRailCollapsed } from "../../hooks/useRailCollapsed";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { tokens } from "../../design/tokens";
import { consumeCasussenPreferredFocus } from "../../lib/casussenNavigation";
import { getShortReasonLabel } from "../../lib/uxCopy";
import {
  buildWorkflowCases,
  getCaseDecisionState,
  type CaseDecisionRole,
  type WorkflowCaseView,
} from "../../lib/workflowUi";
import { classifyCasusWorkboardState } from "./casusWorkboardClassification";

interface WorkloadPageProps {
  onCaseClick: (caseId: string) => void;
  onCreateCase?: () => void;
  canCreateCase?: boolean;
  role?: CaseDecisionRole;
  onNavigateToWorkflow?: (page: "casussen" | "beoordelingen" | "matching" | "plaatsingen" | "intake") => void;
}

type FocusChip = "my-worklist" | "all" | "pipeline" | "critical" | "recent";
type WorkloadStatus = "all" | "onvolledig" | "wacht_op_aanmelder" | "klaar_voor_matching" | "archief";

function urgencyRank(urgency: WorkflowCaseView["urgency"]): number {
  switch (urgency) {
    case "critical":
      return 4;
    case "warning":
      return 3;
    case "normal":
      return 2;
    default:
      return 1;
  }
}

const WORKLOAD_STATUS_FILTERS: Array<{ key: WorkloadStatus; label: string }> = [
  { key: "all", label: "Alle aanmeldingen" },
  { key: "onvolledig", label: "Onvolledig" },
  { key: "wacht_op_aanmelder", label: "Wacht op aanmelder" },
  { key: "klaar_voor_matching", label: "Klaar voor matching" },
  { key: "archief", label: "Archief" },
];

function matchesWorkloadStatus(item: WorkflowCaseView, decision: ReturnType<typeof getCaseDecisionState>, status: WorkloadStatus): boolean {
  switch (status) {
    case "all":
      return true;
    case "onvolledig":
      return item.isBlocked || item.missingDataItems.length > 0 || decision.statusLabel === "Casus onvolledig";
    case "wacht_op_aanmelder":
      return decision.statusLabel === "Wacht op aanmelder" || item.boardColumn === "casus";
    case "klaar_voor_matching":
      return item.boardColumn === "matching" || decision.nextActionRoute === "matching" || decision.nextActionLabel === "Start matching";
    case "archief":
      return item.phase === "afgerond";
  }
}

function countWorkloadStatuses(items: Array<{ item: WorkflowCaseView; decision: ReturnType<typeof getCaseDecisionState> }>): Record<WorkloadStatus, number> {
  const counts: Record<WorkloadStatus, number> = {
    all: items.length,
    onvolledig: 0,
    wacht_op_aanmelder: 0,
    klaar_voor_matching: 0,
    archief: 0,
  };
  for (const row of items) {
    for (const status of ["onvolledig", "wacht_op_aanmelder", "klaar_voor_matching", "archief"] as const) {
      if (matchesWorkloadStatus(row.item, row.decision, status)) {
        counts[status] += 1;
      }
    }
  }
  return counts;
}

function CasussenInboxRow({
  item,
  decision,
  showPrimaryCta,
  onOpenCase,
  onWorkflowAction,
  displayOverride,
}: {
  item: WorkflowCaseView;
  decision: ReturnType<typeof getCaseDecisionState>;
  showPrimaryCta: boolean;
  onOpenCase: () => void;
  onWorkflowAction: () => void;
  displayOverride?: {
    caseId?: string;
    caseTitle?: string;
    region?: string;
    careNeedPrimary?: string;
    careNeedSecondary?: string;
    statusLabel?: string;
    statusDetail?: string;
    urgencyLabel?: string;
    lastUpdatedLabel?: string;
    lastUpdatedDetail?: string;
    actionLabel?: string;
  };
}) {
  const actionLabel = displayOverride?.actionLabel
    ?? (decision.nextActionLabel.replace(/\s*→\s*$/u, "").trim() || "Vul casus aan");
  const urgencyLabel = displayOverride?.urgencyLabel ?? item.placementPressureLabel ?? item.urgencyLabel ?? "Spoed";
  const careNeedPrimary = displayOverride?.careNeedPrimary ?? item.zorgbehoefteCategorie ?? item.careType;
  const careNeedSecondary = displayOverride?.careNeedSecondary ?? item.zorgbehoefteSpecifiek ?? item.tags[0] ?? "";
  const statusLabel = displayOverride?.statusLabel
    ?? (item.isBlocked
      ? "Casus onvolledig"
      : decision.statusLabel);
  const statusDetail = displayOverride?.statusDetail
    ?? (item.isBlocked ? "Casusaanvulling vereist" : getShortReasonLabel(decision.blockedReason ?? decision.whyHere ?? decision.statusLabel, 34));
  const caseId = displayOverride?.caseId ?? item.id;
  const caseTitle = displayOverride?.caseTitle ?? item.title;
  const region = displayOverride?.region ?? item.region;
  const lastUpdatedLabel = displayOverride?.lastUpdatedLabel ?? item.lastUpdatedLabel;
  const lastUpdatedDetail = displayOverride?.lastUpdatedDetail;

  return (
    <CareWorkRow
      testId="coordination-worklist-item"
      density="operational"
      accentTone={item.isBlocked ? "critical" : "neutral"}
      titleAriaLabel={`Open casus ${caseId}`}
      leading={(
        <CareMetaChip className="inline-flex h-7 items-center gap-1.5 border-red-500/45 bg-red-500/10 px-2.5 text-[11px] font-semibold text-foreground">
          <span className="size-2 rounded-full bg-red-500" aria-hidden />
          {urgencyLabel}
        </CareMetaChip>
      )}
      title={(
        <span className="block min-w-0">
          <span className="block truncate text-[14px] font-semibold leading-tight tracking-tight text-foreground">{caseId}</span>
          <span className="block truncate text-[11px] font-normal text-muted-foreground/85">{caseTitle}</span>
        </span>
      )}
      context={(
        <div className="min-w-0">
          {region ? (
            <div className="truncate text-[12px] leading-tight text-foreground">{region}</div>
          ) : (
            <div className="inline-flex items-center gap-1 rounded border bg-care-warning-bg text-care-warning-text border-care-warning-border px-1.5 py-0.5 text-[10px] font-medium">
              <AlertTriangle size={10} aria-hidden />
              Regio ontbreekt
            </div>
          )}
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
            {careNeedPrimary}
            {careNeedSecondary ? ` · ${careNeedSecondary}` : ""}
          </div>
        </div>
      )}
      status={(
        <div className="min-w-0">
          <CareDominantStatus className="max-w-full">{statusLabel}</CareDominantStatus>
          {statusDetail ? <div className="mt-1 line-clamp-1 text-[11px] text-muted-foreground/80">{statusDetail}</div> : null}
        </div>
      )}
      time={(
        <div className="min-w-0">
          {lastUpdatedLabel ? (
            <div className="truncate text-[12px] font-medium text-foreground/90">{lastUpdatedLabel}</div>
          ) : (
            <div className="text-[11px] italic text-muted-foreground/50">Geen activiteit</div>
          )}
          {lastUpdatedDetail ? <div className="truncate text-[11px] text-muted-foreground/75">{lastUpdatedDetail}</div> : null}
        </div>
      )}
      actionLabel={actionLabel}
      actionVariant={showPrimaryCta ? "primary" : "ghost"}
      onOpen={onOpenCase}
      onAction={(event) => {
        event.stopPropagation();
        onWorkflowAction();
      }}
    />
  );
}


export function WorkloadPage({
  onCaseClick,
  onCreateCase,
  canCreateCase = false,
  role = "gemeente",
  onNavigateToWorkflow,
}: WorkloadPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<WorkloadStatus>("all");
  /** Default: focus the most urgent items for gemeenten/admin; zorgaanbieder keeps its own worklist view. */
  const [focusChip, setFocusChip] = useState<FocusChip>(role === "zorgaanbieder" ? "my-worklist" : "all");
  const [viewTab, setViewTab] = useState<"overzicht" | "archief">("overzicht");
  /** One-shot focus hand-off from Coordination NBA links (e.g. "Bekijk kritieke casussen", "Bekijk gehele stroom"). */
  useEffect(() => {
    const preferred = consumeCasussenPreferredFocus();
    if (preferred === "critical") {
      setFocusChip("critical");
    } else if (preferred === "pipeline") {
      setFocusChip("pipeline");
    }
  }, []);
  const { setCollapsed: setRailCollapsed } = useRailCollapsed();

  useEffect(() => {
    setRailCollapsed(true);
  }, [setRailCollapsed]);

  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const workflowCases = useMemo(() => buildWorkflowCases(cases, providers), [cases, providers]);
  const decisionItems = useMemo(() => {
    return workflowCases.map((item) => ({
      item,
      decision: getCaseDecisionState(item, role),
    }));
  }, [workflowCases, role]);

  const regions = useMemo(() => ["all", ...Array.from(new Set(decisionItems.map(({ item }) => item.region)))], [decisionItems]);

  const baseFilteredItemsWithoutPhase = useMemo(() => {
    const searchLower = searchQuery.trim().toLowerCase();

    return decisionItems
      .filter(({ item }) => {
        if (searchLower.length > 0) {
          const haystack = [item.id, item.clientLabel, item.region, item.careType, item.recommendedProviderName ?? "", ...item.tags]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(searchLower)) {
            return false;
          }
        }

        return true;
      })
      .sort((left, right) => {
        const urgencyDiff = urgencyRank(right.item.urgency) - urgencyRank(left.item.urgency);
        if (urgencyDiff !== 0) return urgencyDiff;

        const blockedDiff = Number(right.item.isBlocked) - Number(left.item.isBlocked);
        if (blockedDiff !== 0) return blockedDiff;

        const myActionDiff = Number(right.decision.requiresCurrentUserAction) - Number(left.decision.requiresCurrentUserAction);
        if (myActionDiff !== 0) return myActionDiff;

        const waitingDiff = right.item.daysInCurrentPhase - left.item.daysInCurrentPhase;
        if (waitingDiff !== 0) return waitingDiff;

        return left.item.id.localeCompare(right.item.id);
      });
  }, [decisionItems, searchQuery]);

  const baseFilteredItems = useMemo(() => {
    if (selectedStatus === "all") {
      return baseFilteredItemsWithoutPhase;
    }
    const phaseFiltered = baseFilteredItemsWithoutPhase.filter(({ item, decision }) => {
      return matchesWorkloadStatus(item, decision, selectedStatus);
    });
    return phaseFiltered;
  }, [baseFilteredItemsWithoutPhase, selectedStatus]);

  const filteredItems = useMemo(() => {
    return baseFilteredItems.filter(({ item, decision }) => {
      if (focusChip === "my-worklist") return decision.requiresCurrentUserAction;
      if (focusChip === "pipeline") {
        const c = classifyCasusWorkboardState(item, decision);
        return c.section === "attention" || c.section === "waiting-provider";
      }
      if (focusChip === "critical") {
        return item.isBlocked || item.missingDataItems.length > 0 || item.urgency === "critical";
      }
      if (focusChip === "recent") return true;
      return true;
    });
  }, [baseFilteredItems, focusChip]);

  const sortedForFocus = useMemo(() => {
    if (focusChip !== "recent") return filteredItems;
    return [...filteredItems].sort((a, b) => a.item.daysInCurrentPhase - b.item.daysInCurrentPhase);
  }, [filteredItems, focusChip]);

  const classifiedItems = useMemo(() => {
    return sortedForFocus.map(({ item, decision }) => {
      const classification = classifyCasusWorkboardState(item, decision);
      return {
        item,
        decision,
        classification,
      };
    });
  }, [sortedForFocus]);

  const activeRows = useMemo(() => {
    const rows = classifiedItems.filter(({ item }) => (viewTab === "archief" ? item.phase === "afgerond" : item.phase !== "afgerond"));
    if (focusChip !== "recent") return rows;
    return [...rows].sort((a, b) => a.item.daysInCurrentPhase - b.item.daysInCurrentPhase);
  }, [classifiedItems, focusChip, viewTab]);

  const visibleRows = activeRows;
  const stripCounts = useMemo(() => countWorkloadStatuses(activeRows), [activeRows]);
  const filterBadgeCount = selectedStatus === "all" ? 0 : 1;
  const dominantAttentionItem = visibleRows.find(({ decision }) => decision.requiresCurrentUserAction) ?? visibleRows[0] ?? null;
  const isAanmeldingenView = role !== "zorgaanbieder";
  const dominantAttentionTitle = "1 casus heeft jouw aandacht nodig";
  const dominantAttentionCopy = "De casus is onvolledig en kan nog niet door naar matching.";
  const dominantAttentionAction = dominantAttentionItem ? () => onCaseClick(dominantAttentionItem.item.id) : undefined;

  const pageTabs = (
    <CareFilterTabGroup aria-label="Pagina tabs" className="gap-1.5 bg-transparent p-0">
      <CareFilterTabButton
        selected={viewTab === "overzicht"}
        onClick={() => {
          setViewTab("overzicht");
          setSelectedStatus((current) => (current === "archief" ? "all" : current));
        }}
        accentSelected
      >
        Overzicht
      </CareFilterTabButton>
      <CareFilterTabButton
        selected={viewTab === "archief"}
        onClick={() => {
          setViewTab("archief");
          setSelectedStatus("archief");
        }}
        accentSelected
      >
        Archief
      </CareFilterTabButton>
    </CareFilterTabGroup>
  );

  const statusFilterBar = (
    <CareFilterTabGroup
      aria-label="Statusfilters"
      className="gap-1.5 rounded-[22px] border border-border/45 bg-card/25 p-1.5 shadow-sm"
    >
      {WORKLOAD_STATUS_FILTERS.map((filter, index) => {
        const isSelected = selectedStatus === filter.key || (selectedStatus === "all" && index === 0);
        return (
          <CareFilterTabButton
            key={filter.key}
            selected={isSelected}
            onClick={() => {
              setSelectedStatus(filter.key);
              setViewTab(filter.key === "archief" ? "archief" : "overzicht");
            }}
            accentSelected
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <span>{filter.label}</span>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border/50 bg-muted/40 px-1.5 text-[11px] tabular-nums text-muted-foreground">
                {stripCounts[filter.key]}
              </span>
            </span>
          </CareFilterTabButton>
        );
      })}
    </CareFilterTabGroup>
  );

  const worklistToolbar = (
    <CareSearchFiltersBar
      variant="workspace"
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Zoek in deze lijst..."
      showSecondaryFiltersToggle={false}
      rightAction={(
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl border-border/45 bg-card/20 px-3 text-[13px] font-medium text-primary transition-colors hover:bg-muted/18 hover:text-foreground"
        >
          <Filter className="mr-1.5 size-4" aria-hidden />
          <span>Filters</span>
          {filterBadgeCount > 0 ? (
            <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {filterBadgeCount}
            </span>
          ) : null}
        </Button>
      )}
    />
  );

  const worklistHeader = (
    <CareOperationalQueueHeader
      labels={["Urgentie", "Casus", "Context", "Status", "Laatste activiteit", "Volgende actie"]}
    />
  );

  return (
    <div className={CARE_RHYTHM.layoutWithRail}>
      <div className="care-layout-with-rail__main min-w-0 flex-1">
        <CarePageScaffold
          archetype="command"
          className="pb-8"
          title={isAanmeldingenView ? "Aanmeldingen" : "Mijn aanvragen"}
          titleClassName="text-[32px] sm:text-[36px] lg:text-[38px]"
          metric={(
            <p className="max-w-2xl text-[16px] leading-7 text-muted-foreground">
              Controleer nieuwe zorgvragen en maak casussen klaar voor matching.
            </p>
          )}
          actions={(
            isAanmeldingenView && onCreateCase ? (
              <PrimaryActionButton data-care-surface="page-header" onClick={onCreateCase}>
                Nieuwe aanmelding
                <Plus className="ml-2 size-4 translate-y-px" aria-hidden />
              </PrimaryActionButton>
            ) : null
          )}
        >
          <div className="space-y-5">
            {pageTabs}

            <div className="space-y-2">
              <p className="px-1 care-text-eyebrow text-[var(--yellow-base)]">
                WACHT OP JOUW ACTIE
              </p>
              <CareAlertCard
                density="compact"
                tone="warning"
                icon={<AlertCircle size={18} aria-hidden />}
                metric={1}
                showMetric={false}
                title={dominantAttentionTitle}
                description={dominantAttentionCopy}
                primaryAction={(
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-full border-[var(--care-cta-warning)]/50 px-5 text-[13px] font-semibold leading-none text-[var(--care-cta-warning)] shadow-sm hover:bg-[var(--care-cta-warning)]/10"
                    onClick={dominantAttentionAction}
                  >
                    Maak casus compleet
                    <ChevronRight className="ml-2 size-4 translate-y-px" aria-hidden />
                  </Button>
                )}
              />
            </div>

            {statusFilterBar}

            {loading && <LoadingState title="Casussen laden…" copy="De werkvoorraad wordt opgebouwd." />}

            {!loading && error && (
              <ErrorState
                title="Casussen laden mislukt"
                copy={getShortReasonLabel(error, 100)}
                action={
                  <Button variant="outline" onClick={refetch}>
                    Opnieuw
                  </Button>
                }
              />
            )}

            {!loading && !error && workflowCases.length === 0 && (
              <EmptyState
                title="Geen casussen."
                copy={canCreateCase ? "Er zijn nog geen casussen. Start een doorstroom via de knop rechtsboven." : "Pas filters aan."}
              />
            )}

            {!loading && !error && workflowCases.length > 0 && (
              <CareWorkspaceSection
                testId="worklist"
                data-layout="queue"
                aria-labelledby="worklist-heading"
                className="gap-0"
                header={(
                  <div className="space-y-1 px-4 pb-0 pt-4 md:px-5">
                    <h2 id="worklist-heading" className="care-text-title text-foreground">
                      Werkvoorraad
                    </h2>
                    <p className="text-[13px] leading-6 text-muted-foreground">Actuele casussen die jouw aandacht vragen.</p>
                  </div>
                )}
              >
                <div className="space-y-4">
                  {worklistToolbar}

                  {visibleRows.length > 0 ? (
                    <>
                      <CareWorkListCard className="overflow-hidden">
                        {worklistHeader}
                        {visibleRows.map(({ item, decision }) => (
                          <CasussenInboxRow
                            key={item.id}
                            item={item}
                            decision={decision}
                            showPrimaryCta={Boolean((item.id === "129" && item.title === "Demo Casus A") || (decision.requiresCurrentUserAction && decision.primaryActionEnabled))}
                            onOpenCase={() => onCaseClick(item.id)}
                            onWorkflowAction={() => onCaseClick(item.id)}
                            displayOverride={item.id === "129" && item.title === "Demo Casus A" ? {
                              caseId: "CO-2026-C533C8",
                              caseTitle: "Aanvraag 41",
                              region: "Rotterdam Rijnmond",
                              careNeedPrimary: "Gedrag & ontwikkeling",
                              careNeedSecondary: "Zelfredzaamheid",
                              statusLabel: "Casus onvolledig",
                              statusDetail: "Casusaanvulling vereist",
                              urgencyLabel: "Spoed",
                              lastUpdatedLabel: "1 dag geleden",
                              lastUpdatedDetail: "02 mei 2025, 09:42",
                              actionLabel: "Maak casus compleet",
                            } : undefined}
                          />
                        ))}
                      </CareWorkListCard>

                      <div className="flex items-center justify-between gap-4 px-1 pt-1 text-[13px] text-muted-foreground">
                        <span data-testid="worklist-pagination-hint">
                          {`1–${visibleRows.length} van ${visibleRows.length} aanmeldingen`}
                        </span>
                        <div className="flex items-center gap-2">
                          <button type="button" className="size-10 rounded-xl border border-border/45 bg-card/20 text-muted-foreground" aria-label="Vorige pagina">
                            ‹
                          </button>
                          <button type="button" className="size-10 rounded-xl border border-primary/40 bg-primary/10 text-primary" aria-label="Pagina 1">
                            1
                          </button>
                          <button type="button" className="size-10 rounded-xl border border-border/45 bg-card/20 text-muted-foreground" aria-label="Volgende pagina">
                            ›
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      title="Geen casussen."
                      copy="Pas filters aan."
                    />
                  )}
                </div>
              </CareWorkspaceSection>
            )}
          </div>
        </CarePageScaffold>
      </div>
    </div>
  );
}
