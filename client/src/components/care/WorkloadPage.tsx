import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import {
  CareDominantStatus,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import {
  CareCommandShell,
  CareMetricStrip,
  CareMetricCard,
  CareWorklist,
  CareWorklistTabs,
  CareWorklistToolbar,
  CareWorklistColumnHeader,
  CareWorklistBody,
  CareWorklistRow,
  CareWorklistRowAction,
  CareWorklistPagination,
  ROW_ACTION_CLASSES,
} from "./CareCommandPrimitives";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
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

type WorkloadStatus = "all" | "onvolledig" | "wacht_op_aanmelder" | "klaar_voor_matching" | "archief";

function urgencyRank(urgency: WorkflowCaseView["urgency"]): number {
  switch (urgency) {
    case "critical": return 4;
    case "warning": return 3;
    case "normal": return 2;
    default: return 1;
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
    case "all": return true;
    case "onvolledig": return item.isBlocked || item.missingDataItems.length > 0 || decision.statusLabel === "Casus onvolledig";
    case "wacht_op_aanmelder": return decision.statusLabel === "Wacht op aanmelder" || item.boardColumn === "casus";
    case "klaar_voor_matching": return item.boardColumn === "matching" || decision.nextActionRoute === "matching" || decision.nextActionLabel === "Start matching";
    case "archief": return item.phase === "afgerond";
  }
}

function countWorkloadStatuses(items: Array<{ item: WorkflowCaseView; decision: ReturnType<typeof getCaseDecisionState> }>): Record<WorkloadStatus, number> {
  const counts: Record<WorkloadStatus, number> = { all: items.length, onvolledig: 0, wacht_op_aanmelder: 0, klaar_voor_matching: 0, archief: 0 };
  for (const row of items) {
    for (const status of ["onvolledig", "wacht_op_aanmelder", "klaar_voor_matching", "archief"] as const) {
      if (matchesWorkloadStatus(row.item, row.decision, status)) {
        counts[status] += 1;
      }
    }
  }
  return counts;
}

const WORKLOAD_COLS = "minmax(13rem,2fr) minmax(10rem,1.4fr) minmax(8rem,1fr) minmax(8rem,1fr) minmax(9rem,1fr)";

export function WorkloadPage({
  onCaseClick,
  onCreateCase,
  canCreateCase = false,
  role = "gemeente",
  onNavigateToWorkflow: _onNavigateToWorkflow,
}: WorkloadPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<WorkloadStatus>("all");
  const [focusChip] = useState<"all">("all");

  useEffect(() => {
    const preferred = consumeCasussenPreferredFocus();
    if (preferred === "critical" || preferred === "pipeline") {
      // For now, focused view is handled via the metric strip KPI cards
    }
  }, []);

  const { cases, loading, error, refetch } = useCases({ q: searchQuery });
  const { providers } = useProviders({ q: "" });

  const workflowCases = useMemo(() => buildWorkflowCases(cases, providers), [cases, providers]);
  const decisionItems = useMemo(() => {
    return workflowCases.map((item) => ({ item, decision: getCaseDecisionState(item, role) }));
  }, [workflowCases, role]);

  const baseFilteredItems = useMemo(() => {
    const searchLower = searchQuery.trim().toLowerCase();

    const base = decisionItems
      .filter(({ item }) => {
        if (searchLower.length > 0) {
          const haystack = [item.id, item.clientLabel, item.region, item.careType, item.recommendedProviderName ?? "", ...item.tags]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(searchLower)) return false;
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

    if (selectedStatus === "all") return base;
    return base.filter(({ item, decision }) => matchesWorkloadStatus(item, decision, selectedStatus));
  }, [decisionItems, searchQuery, selectedStatus]);

  const activeRows = useMemo(() => {
    const isArchiveTab = selectedStatus === "archief";
    return baseFilteredItems.filter(({ item }) => (isArchiveTab ? item.phase === "afgerond" : item.phase !== "afgerond"));
  }, [baseFilteredItems, selectedStatus]);

  const allCountsSource = useMemo(() => {
    const searchLower = searchQuery.trim().toLowerCase();
    return decisionItems.filter(({ item }) => {
      if (searchLower.length === 0) return true;
      const haystack = [item.id, item.clientLabel, item.region, item.careType, ...item.tags].join(" ").toLowerCase();
      return haystack.includes(searchLower);
    });
  }, [decisionItems, searchQuery]);

  const stripCounts = useMemo(() => countWorkloadStatuses(allCountsSource), [allCountsSource]);

  const isAanmeldingenView = role !== "zorgaanbieder";
  const PROVIDER_TAB_LABELS: Partial<Record<WorkloadStatus, string>> = {
    wacht_op_aanmelder: "Wacht op reactie",
    klaar_voor_matching: "Doorgestuurd",
  };
  const tabs = WORKLOAD_STATUS_FILTERS.map((f) => ({
    id: f.key,
    label: isAanmeldingenView ? f.label : (PROVIDER_TAB_LABELS[f.key] ?? f.label),
    count: stripCounts[f.key],
  }));

  return (
    <CareCommandShell
      title={isAanmeldingenView ? "Aanmeldingen" : "Mijn aanvragen"}
      subtitle={isAanmeldingenView
        ? "Controleer nieuwe zorgvragen en maak casussen klaar voor matching."
        : "Volg uw ingediende aanvragen en de status per gemeente."}
      actions={isAanmeldingenView && onCreateCase ? (
        <Button
          type="button"
          className="h-9 min-h-9 rounded-[10px] px-4 text-[13px] font-medium shadow-sm"
          onClick={onCreateCase}
        >
          Nieuwe aanmelding
          <Plus className="ml-2 size-4 translate-y-px" aria-hidden />
        </Button>
      ) : undefined}
    >
      <CareMetricStrip>
        <CareMetricCard
          value={stripCounts.onvolledig}
          label="Onvolledig"
          tone="urgent"
          isActive={selectedStatus === "onvolledig"}
          onClick={() => setSelectedStatus(selectedStatus === "onvolledig" ? "all" : "onvolledig")}
        />
        <CareMetricCard
          value={stripCounts.wacht_op_aanmelder}
          label={isAanmeldingenView ? "Wacht op aanmelder" : "Wacht op reactie"}
          tone="warning"
          isActive={selectedStatus === "wacht_op_aanmelder"}
          onClick={() => setSelectedStatus(selectedStatus === "wacht_op_aanmelder" ? "all" : "wacht_op_aanmelder")}
        />
        <CareMetricCard
          value={stripCounts.klaar_voor_matching}
          label={isAanmeldingenView ? "Klaar voor matching" : "Doorgestuurd"}
          tone="neutral"
          isActive={selectedStatus === "klaar_voor_matching"}
          onClick={() => setSelectedStatus(selectedStatus === "klaar_voor_matching" ? "all" : "klaar_voor_matching")}
        />
      </CareMetricStrip>

      {loading && <LoadingState title="Casussen laden…" copy="De werkvoorraad wordt opgebouwd." />}

      {!loading && error && (
        <ErrorState
          title="Casussen laden mislukt"
          copy={getShortReasonLabel(error, 100)}
          action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>}
        />
      )}

      {!loading && !error && workflowCases.length === 0 && (
        <EmptyState
          title="Geen casussen."
          copy={canCreateCase ? "Er zijn nog geen casussen. Start een doorstroom via de knop rechtsboven." : "Pas filters aan."}
        />
      )}

      {!loading && !error && workflowCases.length > 0 && (
        <CareWorklist>
          <CareWorklistTabs
            tabs={tabs}
            activeId={selectedStatus}
            onChange={(id) => setSelectedStatus(id as WorkloadStatus)}
          />

          <CareWorklistToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Zoek in aanmeldingen..."
          />

          <div className="overflow-x-auto">
            <CareWorklistColumnHeader
              columns={["Casus", "Context", "Status", "Laatste activiteit", "Volgende actie"]}
              cols={WORKLOAD_COLS}
              minWidth="840px"
            />
            <CareWorklistBody>
              {activeRows.length === 0 ? (
                <div className="px-6 py-8 text-center text-[13px] text-muted-foreground">
                  Geen casussen in dit filter.
                </div>
              ) : activeRows.map(({ item, decision }) => {
                const actionLabel = decision.nextActionLabel.replace(/\s*→\s*$/u, "").trim() || "Vul casus aan";
                const careNeedPrimary = item.zorgbehoefteCategorie ?? item.careType;
                const careNeedSecondary = item.zorgbehoefteSpecifiek ?? item.tags[0] ?? "";
                const statusLabel = item.isBlocked ? "Casus onvolledig" : decision.statusLabel;
                const statusDetail = item.isBlocked
                  ? "Casusaanvulling vereist"
                  : getShortReasonLabel(decision.blockedReason ?? decision.whyHere ?? decision.statusLabel, 34);

                const displayId = item.id;
                const displayTitle = item.title;
                const displayRegion = item.region;
                const displayCareNeed = careNeedPrimary;
                const displaySecondary = careNeedSecondary;
                const displayStatus = statusLabel;
                const displayStatusDetail = statusDetail;
                const displayAction = actionLabel;
                const displayActivity = item.lastUpdatedLabel;

                const accentTone = item.isBlocked ? "urgent" as const : "neutral" as const;

                return (
                  <CareWorklistRow
                    key={item.id}
                    testId="coordination-worklist-item"
                    cols={WORKLOAD_COLS}
                    minWidth="840px"
                    accentTone={accentTone}
                    onRowClick={() => onCaseClick(item.id)}
                  >
                    {/* Casus */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0",
                          item.urgency === "critical" || item.isBlocked
                            ? "border border-care-urgent-border/60 bg-care-urgent-bg text-care-urgent-text"
                            : "border border-border/60 bg-muted/30 text-muted-foreground",
                        )}>
                          <span className={cn(
                            "mr-1 size-1.5 rounded-full",
                            item.urgency === "critical" || item.isBlocked ? "bg-care-urgent-solid" : "bg-muted-foreground/40",
                          )} aria-hidden />
                          {item.placementPressureLabel ?? item.urgencyLabel ?? "Normaal"}
                        </span>
                      </div>
                      <span className="mt-1 block truncate text-[13px] font-medium leading-tight text-foreground">{displayId}</span>
                      <span className="block truncate text-[11px] text-muted-foreground/85">{displayTitle}</span>
                    </div>

                    {/* Context */}
                    <div className="min-w-0">
                      {displayRegion ? (
                        <div className="truncate text-[12px] leading-tight text-foreground">{displayRegion}</div>
                      ) : (
                        <div className="inline-flex items-center gap-1 rounded border bg-care-warning-bg text-care-warning-text border-care-warning-border px-1.5 py-0.5 text-[10px] font-medium">
                          <AlertTriangle size={10} aria-hidden />
                          Regio ontbreekt
                        </div>
                      )}
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                        {displayCareNeed}{displaySecondary ? ` · ${displaySecondary}` : ""}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="min-w-0">
                      <CareDominantStatus className="max-w-full">{displayStatus}</CareDominantStatus>
                      {displayStatusDetail ? (
                        <div className="mt-1 line-clamp-1 text-[11px] text-muted-foreground/80">{displayStatusDetail}</div>
                      ) : null}
                    </div>

                    {/* Laatste activiteit */}
                    <div className="min-w-0">
                      {displayActivity ? (
                        <div className="truncate text-[12px] font-medium text-foreground/90">{displayActivity}</div>
                      ) : (
                        <div className="text-[11px] italic text-muted-foreground/50">Geen activiteit</div>
                      )}
                    </div>

                    {/* Volgende actie */}
                    <CareWorklistRowAction>
                      <button
                        type="button"
                        className={item.isBlocked ? ROW_ACTION_CLASSES.blocking : ROW_ACTION_CLASSES.default}
                        onClick={(e) => { e.stopPropagation(); onCaseClick(item.id); }}
                      >
                        {displayAction}
                        <ChevronRight size={12} className="shrink-0 opacity-60" aria-hidden />
                      </button>
                    </CareWorklistRowAction>
                  </CareWorklistRow>
                );
              })}
            </CareWorklistBody>
          </div>

          <div className="flex items-center justify-between border-t border-border/35 px-6 py-3">
            <span className="text-[12px] text-muted-foreground" data-testid="worklist-pagination-hint">
              {`1–${activeRows.length} van ${activeRows.length} aanmeldingen`}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" disabled aria-label="Vorige pagina" className="flex size-7 items-center justify-center rounded-[10px] border border-border/60 text-muted-foreground disabled:opacity-40">‹</button>
              <button type="button" className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-[10px] bg-foreground px-1.5 text-[12px] font-medium text-background">1</button>
              <button type="button" disabled aria-label="Volgende pagina" className="flex size-7 items-center justify-center rounded-[10px] border border-border/60 text-muted-foreground disabled:opacity-40">›</button>
            </div>
          </div>
        </CareWorklist>
      )}
    </CareCommandShell>
  );
}
