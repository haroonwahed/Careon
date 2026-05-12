import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  CareAttentionBar,
  CareFlowBoard,
  CareMetaChip,
  CarePageScaffold,
  CareSection,
  CareSectionBody,
  CareSectionHeader,
  CareSearchFiltersBar,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
  normalizeBoardColumnToPhaseId,
} from "./CareDesignPrimitives";
import { cn } from "../ui/utils";
import { RegieNotesPanel } from "./RegieNotesPanel";
import { RegieRailEdgeTab, RegieRailToggleButton } from "./RegieRailControls";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useRailCollapsed } from "../../hooks/useRailCollapsed";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { consumeCasussenPreferredFocus } from "../../lib/casussenNavigation";
import { CARE_PATHS } from "../../lib/routes";
import { getShortReasonLabel } from "../../lib/uxCopy";
import {
  buildWorkflowCases,
  getCaseDecisionState,
  type CaseDecisionRole,
  type CaseDecisionState,
  type WorkflowBoardColumn,
  type WorkflowCaseView,
} from "../../lib/workflowUi";
import { classifyCasusWorkboardState, type CasusWorkboardClassification } from "./casusWorkboardClassification";
import {
  deriveOperatieveWachtrijGroep,
  emptyQueueGroupTotals,
  operatieveGroepSortIndex,
  OPERATIEVE_WACHTLIJN_LABELS,
  OPERATIEVE_WACHTLIJN_VOLGORDE,
  type OperatieveWachtrijGroepKey,
} from "./casusOperatieveWachtrijGroep";
import { CareInfoPopover } from "./CareUnifiedPage";
import { tokens } from "../../design/tokens";
import {
  DECISION_UI_PHASE_IDS,
  DECISION_UI_PHASE_LABELS,
  mapApiPhaseToDecisionUiPhase,
  type DecisionUiPhaseId,
} from "../../lib/decisionPhaseUi";

/** Aligns with Regiekamer phase-board pill tones (`SystemAwarenessPage`). */
function phasePillClasses(tone: "blocked" | "waiting" | "ready" | "in_progress"): string {
  switch (tone) {
    case "blocked":
      return "border-red-500/35 bg-red-500/10 text-red-100";
    case "waiting":
      return "border-amber-500/35 bg-amber-500/10 text-amber-100";
    case "ready":
      return "border-sky-500/35 bg-sky-500/10 text-sky-100";
    case "in_progress":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-100";
    default:
      return "border-border bg-muted/30 text-foreground";
  }
}

interface WorkloadPageProps {
  onCaseClick: (caseId: string) => void;
  onCreateCase?: () => void;
  canCreateCase?: boolean;
  role?: CaseDecisionRole;
  onNavigateToWorkflow?: (page: "casussen" | "beoordelingen" | "matching" | "plaatsingen" | "intake") => void;
}

type FocusChip = "my-worklist" | "all" | "pipeline" | "critical" | "recent";
type FlowColumnFilter = "all" | "plaatsing" | "intake";

/** Compacte statusregel voor de paginabadge (contrast met vage “vragen actie”-formuleringen elders). */
function casussenWerkvoorraadMetric(filteredCount: number, attentionCount: number): string {
  if (filteredCount === 0) return "Geen aanvragen in deze weergave";
  if (attentionCount === 0) return `${filteredCount} aanvragen · geen open actie voor jou`;
  if (attentionCount === 1) return `${filteredCount} aanvragen · 1 wacht op jouw actie`;
  return `${filteredCount} aanvragen · ${attentionCount} wachten op jouw actie`;
}

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

/** Regiekamer-style priority chip tones for urgency column. */
function urgencyChipShellClass(urgency: WorkflowCaseView["urgency"]): string {
  switch (urgency) {
    case "critical":
      return "border-red-500/35 bg-red-500/10 text-red-100";
    case "warning":
      return "border-amber-500/35 bg-amber-500/10 text-amber-100";
    case "normal":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-100";
    default:
      return "border-border bg-muted/30 text-foreground";
  }
}

type StripBucketKey =
  | "casus"
  | "matching"
  | "aanbieder_beoordeling"
  | "plaatsing"
  | "intake";

const STRIP_DEF: Array<{
  key: StripBucketKey;
  label: string;
  ownerWaitLabel: string;
  countKeys: WorkflowBoardColumn[];
  filterPhase: DecisionUiPhaseId;
  statusTone: "blocked" | "waiting" | "ready" | "in_progress";
}> = [
  {
    key: "casus",
    label: "Casus",
    ownerWaitLabel: "Wacht op regieactie",
    countKeys: ["casus"],
    filterPhase: "casus_gestart",
    statusTone: "ready",
  },
  {
    key: "matching",
    label: "Matching",
    ownerWaitLabel: "Wacht op matchvoorstel",
    countKeys: ["matching"],
    filterPhase: "klaar_voor_matching",
    statusTone: "in_progress",
  },
  {
    key: "aanbieder_beoordeling",
    label: "Beoordeling",
    ownerWaitLabel: "Wacht op aanbiederreactie",
    countKeys: ["aanbieder-beoordeling"],
    filterPhase: "in_beoordeling",
    statusTone: "waiting",
  },
  {
    key: "plaatsing",
    label: "Plaatsing",
    ownerWaitLabel: "Wacht op plaatsing",
    countKeys: ["plaatsing"],
    filterPhase: "plaatsing_intake",
    statusTone: "waiting",
  },
  {
    key: "intake",
    label: "Intake",
    ownerWaitLabel: "Wacht op intake-start",
    countKeys: ["intake"],
    filterPhase: "plaatsing_intake",
    statusTone: "in_progress",
  },
];

function ownerWaitLabelForRole(stepKey: StripBucketKey, role: CaseDecisionRole): string {
  if (role === "zorgaanbieder") {
    switch (stepKey) {
      case "casus":
        return "Wacht op regie-invoer";
      case "matching":
        return "Wacht op matchvoorstel";
      case "aanbieder_beoordeling":
        return "Wacht op jouw beoordeling";
      case "plaatsing":
        return "Wacht op plaatsingsactie";
      case "intake":
        return "Wacht op intake-uitvoering";
      default:
        return "Wacht op doorstroming";
    }
  }

  switch (stepKey) {
    case "casus":
      return "Wacht op regieactie";
    case "matching":
      return "Wacht op matchvoorstel";
    case "aanbieder_beoordeling":
      return "Wacht op aanbiederreactie";
    case "plaatsing":
      return "Wacht op plaatsing";
    case "intake":
      return "Wacht op intake-start";
    default:
      return "Wacht op doorstroming";
  }
}

function countWorkflowStrip(items: WorkflowCaseView[]): Record<StripBucketKey, number> {
  const acc: Record<StripBucketKey, number> = {
    casus: 0,
    matching: 0,
    aanbieder_beoordeling: 0,
    plaatsing: 0,
    intake: 0,
  };
  for (const row of STRIP_DEF) {
    let n = 0;
    for (const col of row.countKeys) {
      n += items.filter((it) => it.boardColumn === col).length;
    }
    acc[row.key] = n;
  }
  return acc;
}

function buildOperationalHeadline(item: WorkflowCaseView, decision: CaseDecisionState, phaseHumanLabel: string): string {
  if (item.missingDataItems.length > 0) {
    return item.missingDataItems.join(" · ");
  }
  const blocked = decision.blockedReason?.trim();
  if (blocked) return blocked;
  const why = decision.whyHere?.trim();
  if (why) return why;
  return phaseHumanLabel;
}

function buildOperationalSubline(decision: CaseDecisionState, queueGroup: OperatieveWachtrijGroepKey): string {
  switch (queueGroup) {
    case "wacht-op-aanbieder":
      return "Wacht op reactie van de zorgaanbieder.";
    case "wacht-op-aanmelder":
      if (decision.responsibleParty === "Systeem") return "Wacht op systeem (bijv. samenvatting).";
      return "Wacht op actie van aanmelder of regie.";
    case "financiele-validatie":
      return "Gemeente moet validatie afronden voordat de keten doorloopt.";
    case "klaar-voor-matching":
      return decision.primaryActionEnabled
        ? "Je kunt matching starten of het matchadvies controleren."
        : "Er ontbreekt nog een voorwaarde om matching zeker te starten.";
    case "plaatsing-intake":
      return "Plaatsing of intake vraagt coördinatie tussen regie en aanbieder.";
    default:
      if (decision.requiresCurrentUserAction) return "Jouw beurt voor de volgende stap.";
      return "Geen urgente regie-actie; volg op de achtergrond.";
  }
}

function buildOperationalMetaLine(item: WorkflowCaseView, decision: CaseDecisionState, phaseHumanLabel: string): string {
  const owner =
    decision.responsibleParty === "Gemeente" ? "Regie" : decision.responsibleParty === "Zorgaanbieder" ? "Aanbieder" : "Systeem";
  return `${item.lastUpdatedLabel} · ${owner} · ${phaseHumanLabel}`;
}

function queueGroupAccentClass(queueGroup: OperatieveWachtrijGroepKey): string {
  switch (queueGroup) {
    case "wacht-op-aanmelder":
    case "financiele-validatie":
      return "border-l-[3px] border-l-destructive/70";
    case "klaar-voor-matching":
      return "border-l-[3px] border-l-sky-500/60";
    case "wacht-op-aanbieder":
      return "border-l-[3px] border-l-amber-500/65";
    case "plaatsing-intake":
      return "border-l-[3px] border-l-emerald-600/55";
    default:
      return "border-l-[3px] border-l-border/70";
  }
}

function CasussenOperatieveWachtrijItem({
  item,
  decision,
  queueGroup,
  classification,
  phaseHumanLabel,
  headline,
  subline,
  metaLine,
  showPrimaryCta,
  onOpenCase,
  onWorkflowAction,
}: {
  item: WorkflowCaseView;
  decision: CaseDecisionState;
  queueGroup: OperatieveWachtrijGroepKey;
  classification: CasusWorkboardClassification;
  phaseHumanLabel: string;
  headline: string;
  subline: string;
  metaLine: string;
  showPrimaryCta: boolean;
  onOpenCase: () => void;
  onWorkflowAction: () => void;
}) {
  const actionVariant = showPrimaryCta ? "primary" : "ghost";

  return (
    <div
      data-care-work-row
      data-queue-group={queueGroup}
      className={cn(
        "group relative rounded-xl border border-border/55 bg-card/25 px-4 py-4 shadow-sm transition-colors hover:bg-card/40 sm:px-5",
        queueGroupAccentClass(queueGroup),
      )}
    >
      <button
        type="button"
        onClick={onOpenCase}
        aria-label={`Open aanvraag ${item.clientLabel}`}
        className="w-full min-w-0 space-y-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="break-all font-mono text-[13px] font-semibold leading-snug text-foreground">{item.id}</span>
          <CareMetaChip className={cn("h-7 shrink-0 px-2.5 text-[12px] font-semibold", urgencyChipShellClass(item.urgency))}>
            {item.urgencyLabel}
          </CareMetaChip>
        </div>
        <p className="text-[15px] font-semibold leading-snug text-foreground break-words">{item.clientLabel}</p>
        <p className="text-[14px] font-medium leading-snug text-foreground break-words">{headline}</p>
        <p className="text-[13px] leading-relaxed text-muted-foreground break-words">{subline}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-[12px] leading-snug text-muted-foreground">
          <Clock3 size={12} className="shrink-0 opacity-70" aria-hidden />
          <span className="break-words">{metaLine}</span>
        </p>
      </button>
      <div className="mt-3 min-w-0">
        <Button
          variant={showPrimaryCta ? "default" : "secondary"}
          size="sm"
          type="button"
          data-care-work-row-cta={actionVariant}
          className="h-11 min-h-11 w-full rounded-xl px-3 text-[13px] font-semibold leading-snug"
          onClick={onWorkflowAction}
        >
          <span className="text-center break-words whitespace-normal">{decision.nextActionLabel} →</span>
        </Button>
      </div>
      {import.meta.env.DEV && (
        <details className="absolute right-2 top-2">
          <summary
            aria-label="Open debug classificatie"
            className="inline-block cursor-pointer list-none rounded-full px-1 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-muted/40 group-hover:opacity-100 focus-visible:opacity-100"
          >
            i
          </summary>
          <div className="mt-1 space-y-1 text-left text-[11px] text-muted-foreground md:absolute md:right-4 md:z-10 md:max-w-[280px] md:rounded-md md:border md:border-border/60 md:bg-background/95 md:p-2">
            <p>Bucket: {classification.debug.assignedBucket}</p>
            <p>Regel: {classification.debug.winningRule}</p>
            <p>isBlocked: {String(classification.debug.signals.isBlocked)}</p>
            <p>primaryActionEnabled: {String(classification.debug.signals.primaryActionEnabled)}</p>
            <p>missingDataItems: {classification.debug.signals.missingDataItems.join(", ") || "geen"}</p>
            <p>requiresCurrentUserAction: {String(classification.debug.signals.requiresCurrentUserAction)}</p>
            <p>responsibleParty: {classification.debug.signals.responsibleParty}</p>
            <p>boardColumn: {classification.debug.signals.boardColumn}</p>
            <p>providerStatusLabel: {classification.debug.signals.providerStatusLabel ?? "geen"}</p>
            <p>nextActionRoute: {classification.debug.nextActionRoute}</p>
            <p>Wachtrij (UI): {queueGroup}</p>
          </div>
        </details>
      )}
    </div>
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
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedUrgency, setSelectedUrgency] = useState("all");
  const [selectedPhase, setSelectedPhase] = useState<"all" | DecisionUiPhaseId>("all");
  const [selectedFlowColumn, setSelectedFlowColumn] = useState<FlowColumnFilter>("all");
  const [selectedOwner, setSelectedOwner] = useState<"all" | "Gemeente" | "Zorgaanbieder" | "Systeem">("all");
  /** Default “Alle casussen”: volledige werklijst; gebruikers kunnen naar Mijn werkvoorraad voor focus. */
  const [focusChip, setFocusChip] = useState<FocusChip>("all");
  /** One-shot focus hand-off from Regiekamer NBA links (e.g. "Bekijk kritieke casussen", "Bekijk gehele stroom"). */
  useEffect(() => {
    const preferred = consumeCasussenPreferredFocus();
    if (preferred === "critical") {
      setFocusChip("critical");
    } else if (preferred === "pipeline") {
      setFocusChip("pipeline");
    }
  }, []);
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const { collapsed: railCollapsed, toggle: toggleRail, setCollapsed: setRailCollapsed } = useRailCollapsed();
  const [collapsedQueueGroups, setCollapsedQueueGroups] = useState<Partial<Record<OperatieveWachtrijGroepKey, boolean>>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

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
      .filter(({ item, decision }) => {
        if (searchLower.length > 0) {
          const haystack = [item.id, item.clientLabel, item.region, item.careType, item.recommendedProviderName ?? "", ...item.tags]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(searchLower)) {
            return false;
          }
        }

        if (selectedRegion !== "all" && item.region !== selectedRegion) {
          return false;
        }

        const normalizedUrgency = selectedUrgency === "stable" ? "normal" : selectedUrgency;
        if (normalizedUrgency !== "all" && item.urgency !== normalizedUrgency) {
          return false;
        }

        if (selectedOwner !== "all" && decision.responsibleParty !== selectedOwner) {
          return false;
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
  }, [decisionItems, searchQuery, selectedRegion, selectedUrgency, selectedOwner]);

  const baseFilteredItems = useMemo(() => {
    if (selectedPhase === "all") {
      if (selectedFlowColumn === "all") {
        return baseFilteredItemsWithoutPhase;
      }
      return baseFilteredItemsWithoutPhase.filter(({ item }) => item.boardColumn === selectedFlowColumn);
    }
    const phaseFiltered = baseFilteredItemsWithoutPhase.filter(({ item }) => {
      const itemDecision = mapApiPhaseToDecisionUiPhase(normalizeBoardColumnToPhaseId(item.boardColumn));
      return itemDecision === selectedPhase;
    });
    if (selectedFlowColumn === "all") {
      return phaseFiltered;
    }
    return phaseFiltered.filter(({ item }) => item.boardColumn === selectedFlowColumn);
  }, [baseFilteredItemsWithoutPhase, selectedPhase, selectedFlowColumn]);

  const tabCounts = useMemo(() => {
    let myWorklist = 0;
    let pipeline = 0;
    let critical = 0;
    for (const { item, decision } of baseFilteredItemsWithoutPhase) {
      if (decision.requiresCurrentUserAction) myWorklist++;
      const c = classifyCasusWorkboardState(item, decision);
      if (c.section === "attention" || c.section === "waiting-provider") pipeline++;
      if (item.isBlocked || item.missingDataItems.length > 0 || item.urgency === "critical") critical++;
    }
    return {
      all: baseFilteredItemsWithoutPhase.length,
      myWorklist,
      pipeline,
      critical,
      recent: baseFilteredItemsWithoutPhase.length,
    };
  }, [baseFilteredItemsWithoutPhase]);

  const stripCounts = useMemo(
    () => countWorkflowStrip(baseFilteredItemsWithoutPhase.map((r) => r.item)),
    [baseFilteredItemsWithoutPhase],
  );

  const dominantStripKey = useMemo((): StripBucketKey | null => {
    let best: StripBucketKey | null = null;
    let bestN = -1;
    for (const row of STRIP_DEF) {
      const n = stripCounts[row.key];
      if (n > bestN) {
        bestN = n;
        best = row.key;
      }
    }
    return bestN > 0 ? best : null;
  }, [stripCounts]);

  const { me } = useCurrentUser();
  const gemeenteDisplayName = me?.organization?.name?.trim() || "Gemeente";

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
        queueGroup: deriveOperatieveWachtrijGroep(item, decision, classification),
      };
    });
  }, [sortedForFocus]);

  const attentionCount = classifiedItems.filter(({ classification }) => classification.section === "attention").length;

  const avgDaysInPhase = useMemo(() => {
    if (classifiedItems.length === 0) return 0;
    const sum = classifiedItems.reduce((acc, { item }) => acc + item.daysInCurrentPhase, 0);
    return Math.max(1, Math.round(sum / classifiedItems.length));
  }, [classifiedItems]);

  const riskSignalCount = useMemo(
    () => classifiedItems.filter(({ item }) => item.urgency === "critical" || item.isBlocked).length,
    [classifiedItems],
  );

  const queueGroupTotals = useMemo(() => {
    const acc = emptyQueueGroupTotals();
    for (const row of classifiedItems) {
      acc[row.queueGroup] += 1;
    }
    return acc;
  }, [classifiedItems]);

  const displayRows = useMemo(() => {
    const rows = [...classifiedItems];
    if (focusChip === "recent") {
      return rows;
    }
    rows.sort((a, b) => {
      const g = operatieveGroepSortIndex(a.queueGroup) - operatieveGroepSortIndex(b.queueGroup);
      if (g !== 0) return g;
      const u = urgencyRank(b.item.urgency) - urgencyRank(a.item.urgency);
      if (u !== 0) return u;
      return a.item.id.localeCompare(b.item.id);
    });
    return rows;
  }, [classifiedItems, focusChip]);

  const totalRows = displayRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return displayRows.slice(start, start + pageSize);
  }, [displayRows, safePage, pageSize]);

  const groupedPageSections = useMemo(() => {
    const buckets: Partial<Record<OperatieveWachtrijGroepKey, typeof pageRows>> = {};
    for (const row of pageRows) {
      const k = row.queueGroup;
      if (!buckets[k]) buckets[k] = [];
      buckets[k]!.push(row);
    }
    return OPERATIEVE_WACHTLIJN_VOLGORDE.filter((key) => (buckets[key]?.length ?? 0) > 0).map((key) => ({
      key,
      items: buckets[key]!,
    }));
  }, [pageRows]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, focusChip, selectedRegion, selectedUrgency, selectedPhase, selectedFlowColumn, selectedOwner]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const handleNavigate = (nav: "casussen" | "beoordelingen" | "matching" | "plaatsingen" | "intake") => {
    onNavigateToWorkflow?.(nav);
  };

  const focusCriticalCases = () => {
    // Avoid stale phase scoping so critical focus behaves predictably.
    setSelectedPhase("all");
    setFocusChip("critical");
    const werkvoorraadHeading = document.getElementById("casussen-werkvoorraad-heading");
    if (werkvoorraadHeading && typeof werkvoorraadHeading.scrollIntoView === "function") {
      werkvoorraadHeading.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const toggleQueueGroup = (group: OperatieveWachtrijGroepKey) => {
    setCollapsedQueueGroups((current) => ({ ...current, [group]: !current[group] }));
  };

  const isQueueGroupCollapsed = (group: OperatieveWachtrijGroepKey) => collapsedQueueGroups[group] === true;

  const phaseOptions: Array<{ value: DecisionUiPhaseId; label: string }> = DECISION_UI_PHASE_IDS.map((id) => ({
    value: id,
    label: DECISION_UI_PHASE_LABELS[id],
  }));

  const phasePillLabel = (item: WorkflowCaseView): string => {
    const id = mapApiPhaseToDecisionUiPhase(normalizeBoardColumnToPhaseId(item.boardColumn));
    return DECISION_UI_PHASE_LABELS[id];
  };

  /**
   * Snelt naar tabblad Kritiek of terug naar Alles — knop verdwijnt niet meer zonder uitleg:
   * op tab Kritiek tonen we "Toon alle casussen" i.p.v. de knop te verbergen.
   */
  const primaryShortcut = useMemo((): { label: string; onClick: () => void } | null => {
    if (workflowCases.length === 0) {
      return null;
    }
    if (focusChip === "critical") {
      return {
        label: "Toon alle aanvragen",
        onClick: () => setFocusChip("all"),
      };
    }
    if (attentionCount > 0) {
      return {
        label: "Bekijk kritieke aanvragen",
        onClick: focusCriticalCases,
      };
    }
    if (focusChip === "my-worklist") {
      return null;
    }
    return {
      label: "Bekijk mijn werkvoorraad",
      onClick: () => setFocusChip("my-worklist"),
    };
  }, [workflowCases.length, focusChip, attentionCount]);

  const workloadAttentionMessage =
    workflowCases.length === 0
      ? canCreateCase
        ? "Er zijn nog geen lopende aanvragen; start een doorstroom of pas filters aan."
        : "Er zijn nog geen lopende aanvragen; pas filters aan."
      : attentionCount > 0
        ? `${attentionCount} aanvraag${attentionCount === 1 ? "" : "en"} wachten op vervolgactie in de keten; blokkades en wachttijd bepalen de eigenaar.`
        : "De werkvoorraad is rustig; gebruik filters om de volgende aanvraag en stap te vinden.";

  const workloadAttentionAction =
    primaryShortcut !== null ? (
      <PrimaryActionButton
        type="button"
        className="h-9 min-h-9 px-4 text-[13px] shadow-md"
        onClick={primaryShortcut.onClick}
      >
        {primaryShortcut.label}
      </PrimaryActionButton>
    ) : null;

  const headerActions = (
    <div className="flex flex-col items-start gap-1 md:pt-3 md:items-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canCreateCase && onCreateCase ? (
          <PrimaryActionButton type="button" className="h-10 min-h-10 px-4 text-[13px]" onClick={onCreateCase}>
          Nieuwe aanvraag
          </PrimaryActionButton>
        ) : null}
        <RegieRailToggleButton
          collapsed={railCollapsed}
          onToggle={toggleRail}
          testId="casussen-rail-toggle"
        />
      </div>
    </div>
  );

  const stripStepIsActive = (step: (typeof STRIP_DEF)[number]) => {
    if (selectedPhase !== "all") {
      if (selectedFlowColumn !== "all") {
        return (step.key === "plaatsing" || step.key === "intake") && step.key === selectedFlowColumn;
      }
      if (step.key === "matching") {
        return selectedPhase === "klaar_voor_matching";
      }
      return step.filterPhase === selectedPhase;
    }
    return dominantStripKey === step.key;
  };

  const doorstroomStrip = (
    <CareSection testId="casussen-workflow-strip" aria-label="Doorstroom per fase">
      <CareSectionHeader
        title="Doorstroom"
        description={
          <>
            <p>Toont waar aanvragen in de keten staan, op basis van je huidige filters.</p>
            <p>Klik een fase om de werkvoorraad op die fase te filteren.</p>
          </>
        }
        descriptionAriaLabel="Uitleg doorstroom"
        descriptionTestId="casussen-doorstroom-uitleg"
        action={
          <Button type="button" variant="ghost" className="gap-1 px-2 text-sm font-semibold text-primary hover:bg-primary/10 hover:text-primary" asChild>
            <a href={CARE_PATHS.REGIEKAMER} data-testid="casussen-doorstroom-naar-regiekamer">
              Naar coördinatie
              <ChevronRight size={14} aria-hidden />
            </a>
          </Button>
        }
      />
      <CareSectionBody className="mt-4 space-y-0">
        <CareFlowBoard testId="casussen-flow-board" variant="pipeline">
          {STRIP_DEF.map((step) => {
            const active = stripStepIsActive(step);
            const count = stripCounts[step.key];
            // Operational lane: phase-first, count-second. The waiting label IS the
            // bottleneck signal when count > 0; "Geen instroom" stays as the only
            // generic status pill (drops the low-value "Doorstroom actief").
            const roleAwareWait = ownerWaitLabelForRole(step.key, role).toLowerCase();
            const waitingLabel = count > 0
              ? `${count} ${roleAwareWait}`
              : null;
            return (
              <button
                key={step.key}
                type="button"
                data-testid={`casussen-phase-column-${step.key}`}
                onClick={() => {
                  setSelectedPhase(step.filterPhase);
                  setSelectedFlowColumn(step.key === "plaatsing" || step.key === "intake" ? step.key : "all");
                  setFocusChip("all");
                }}
                className={cn(
                  "group flex h-full w-full flex-col gap-1.5 rounded-xl border border-border/60 bg-bg-subtle px-3 py-2.5 text-left transition",
                  "hover:border-primary/35 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                  active && "border-primary/35 ring-2 ring-primary/30",
                )}
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium leading-tight text-foreground">{step.label}</span>
                  <span className="shrink-0 text-[18px] font-semibold leading-none tabular-nums text-foreground">{count}</span>
                </div>
                {waitingLabel ? (
                  <p className="truncate text-[11px] leading-snug text-muted-foreground">{waitingLabel}</p>
                ) : (
                  <span
                    className={cn(
                      "inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      phasePillClasses(step.statusTone),
                    )}
                  >
                    Geen instroom
                  </span>
                )}
              </button>
            );
          })}
        </CareFlowBoard>
      </CareSectionBody>
    </CareSection>
  );

  return (
    <div className="flex w-full flex-col gap-8 xl:flex-row xl:items-start xl:gap-8">
      <div className="min-w-0 flex-1">
    <CarePageScaffold
      archetype="worklist"
      className="pb-8"
      title="Aanvragen"
      subtitleInfoTestId="casussen-page-info"
      subtitleAriaLabel="Uitleg aanvragen"
      subtitle={
        <div className="space-y-2">
          <p className="font-semibold text-foreground">Hoe deze lijst werkt</p>
          <p>
            Tabbladen en zoekveld bepalen welke aanvragen je ziet. Sidebar Acties (taken) staat los van het tabblad Mijn werkvoorraad op
            deze pagina.
          </p>
          <p>Doorstroom toont aanvragen per fase (na je filters). De werklijst toont de eerstvolgende passende actie per aanvraag.</p>
          <p className="text-muted-foreground">
            Tijdelijke werkvoorraad — na plaatsing en validatie gaat het traject naar externe systemen (uitstroom).
          </p>
        </div>
      }
      metric={
        <span title="Telling voor je huidige tabblad en filters — geen knop, alleen status." className="inline-flex shrink-0">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold"
            style={{
              backgroundColor: tokens.colors.casussenMetricBg,
              borderColor: tokens.colors.casussenMetricBorder,
              color: tokens.colors.casussenMetricText,
            }}
          >
            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tokens.colors.casussenMetricDot }} />
            {casussenWerkvoorraadMetric(filteredItems.length, attentionCount)}
          </span>
        </span>
      }
      actions={headerActions}
      kpiStrip={
        <div className="space-y-3">
          <CareAttentionBar
            tone={workflowCases.length === 0 ? "warning" : attentionCount > 0 ? "critical" : "info"}
            message={workloadAttentionMessage}
            action={workloadAttentionAction}
          />
          {doorstroomStrip}
        </div>
      }
    >
      <CareSection testId="casussen-uitvoerlijst" aria-labelledby="casussen-werkvoorraad-heading">
        <CareSectionHeader
          className="lg:flex-col lg:items-stretch"
          title={
            <span id="casussen-werkvoorraad-heading">Werkvoorraad</span>
          }
          meta={
            <div className="w-full min-w-0 space-y-2">
              <span className="inline-flex w-fit items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[12px] font-semibold text-cyan-200">
                {filteredItems.length} aanvragen
              </span>
              <CareSearchFiltersBar
                className="px-0"
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Zoek aanvragen, regio's, aanbieders…"
                showSecondaryFilters={showSecondaryFilters}
                onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
                secondaryFiltersLabel="Filters"
                secondaryFilters={
                  <div className="grid items-end gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Werkvoorraad-weergave
                      <select
                        aria-label="Werkvoorraad-weergave"
                        value={focusChip}
                        onChange={(event) => setFocusChip(event.target.value as FocusChip)}
                        className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                      >
                        <option value="my-worklist">Mijn werkvoorraad ({tabCounts.myWorklist})</option>
                        <option value="all">Alle aanvragen ({tabCounts.all})</option>
                        <option value="pipeline">Wacht op actie ({tabCounts.pipeline})</option>
                        <option value="critical">Kritiek ({tabCounts.critical})</option>
                        <option value="recent">Recent bijgewerkt ({tabCounts.recent})</option>
                      </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Stap
                      <select
                        aria-label="Stap in de keten"
                        value={selectedPhase}
                        onChange={(event) => {
                          setSelectedPhase(event.target.value as "all" | DecisionUiPhaseId);
                          setSelectedFlowColumn("all");
                        }}
                        className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                      >
                        <option value="all">Alle fases</option>
                        {phaseOptions.map((phase) => (
                          <option key={phase.value} value={phase.value}>
                            {phase.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Urgentie
                      <select
                        aria-label="Urgentie"
                        value={selectedUrgency}
                        onChange={(event) => setSelectedUrgency(event.target.value)}
                        className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                      >
                        <option value="all">Alle urgentie</option>
                        <option value="critical">Kritiek</option>
                        <option value="warning">Hoog</option>
                        <option value="normal">Normaal / laag</option>
                      </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Regio
                      <select
                        aria-label="Regio"
                        value={selectedRegion}
                        onChange={(event) => setSelectedRegion(event.target.value)}
                        className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                      >
                        {regions.map((region) => (
                          <option key={region} value={region}>
                            {region === "all" ? "Alle regio's" : region}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                      Verantwoordelijke
                      <select
                        aria-label="Verantwoordelijke"
                        value={selectedOwner}
                        onChange={(event) => setSelectedOwner(event.target.value as "all" | "Gemeente" | "Zorgaanbieder" | "Systeem")}
                        className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                      >
                        <option value="all">Alle verantwoordelijken</option>
                        <option value="Gemeente">Aanmelder / gemeente</option>
                        <option value="Zorgaanbieder">Zorgaanbieder</option>
                        <option value="Systeem">Systeem</option>
                      </select>
                    </label>
                  </div>
                }
              />
            </div>
          }
        />
        <CareSectionBody className="space-y-3">
          {focusChip === "critical" && workflowCases.length > 0 ? (
            <div data-testid="worklist-blocked-filter-hint">
              <CareAttentionBar
                tone="critical"
                message={
                  <>
                    Weergave: kritiek / geblokkeerd. Gebruik <span className="font-medium text-foreground">Toon alle aanvragen</span> rechtsboven om
                    terug te gaan naar de volledige lijst.
                  </>
                }
              />
            </div>
          ) : null}
          {loading && <LoadingState title="Aanvragen laden…" copy="De werkvoorraad wordt opgebouwd." />}

          {!loading && error && (
            <ErrorState title="Aanvragen laden mislukt" copy={getShortReasonLabel(error, 100)} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
          )}

          {!loading && !error && workflowCases.length === 0 && (
            <EmptyState
              title="Geen aanvragen."
              copy={canCreateCase ? "Er zijn nog geen aanvragen. Start een doorstroom via de knop rechtsboven." : "Pas filters aan."}
            />
          )}

          {!loading && !error && workflowCases.length > 0 && filteredItems.length === 0 && (
            <EmptyState
              title={focusChip === "my-worklist" ? "Geen open acties." : "Geen aanvragen."}
              copy={focusChip === "my-worklist" ? "Alles ligt bij andere partijen." : "Pas filters aan."}
            />
          )}

          {!loading && !error && filteredItems.length > 0 && (
            <div data-testid="worklist" data-density="compact" data-layout="queue" className="space-y-5">
              {groupedPageSections.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Geen aanvragen op deze pagina.</p>
              ) : (
                groupedPageSections.map(({ key: groupKey, items }) => {
                  const totalInGroup = queueGroupTotals[groupKey];
                  const isCollapsed = isQueueGroupCollapsed(groupKey);
                  return (
                    <section key={groupKey} className="space-y-2.5">
                      <button
                        type="button"
                        onClick={() => toggleQueueGroup(groupKey)}
                        className="flex w-full items-start justify-between gap-2 rounded-lg px-0.5 py-0.5 text-left"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <h2 className="text-[15px] font-semibold leading-snug text-foreground">
                            {OPERATIEVE_WACHTLIJN_LABELS[groupKey]}{" "}
                            <span className="font-semibold tabular-nums text-muted-foreground">({totalInGroup})</span>
                          </h2>
                        </div>
                        {isCollapsed ? <ChevronDown size={16} className="mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronUp size={16} className="mt-0.5 shrink-0 text-muted-foreground" />}
                      </button>

                      {!isCollapsed && (
                        <div className="space-y-3">
                          {items.map(({ item, decision, classification, queueGroup }) => {
                            const phaseHuman = phasePillLabel(item);
                            const headline = buildOperationalHeadline(item, decision, phaseHuman);
                            const subline = buildOperationalSubline(decision, queueGroup);
                            const metaLine = buildOperationalMetaLine(item, decision, phaseHuman);
                            const showPrimaryCta = Boolean(decision.requiresCurrentUserAction && decision.primaryActionEnabled);
                            return (
                              <CasussenOperatieveWachtrijItem
                                key={item.id}
                                item={item}
                                decision={decision}
                                queueGroup={queueGroup}
                                classification={classification}
                                phaseHumanLabel={phaseHuman}
                                headline={headline}
                                subline={subline}
                                metaLine={metaLine}
                                showPrimaryCta={showPrimaryCta}
                                onOpenCase={() => onCaseClick(item.id)}
                                onWorkflowAction={() => handleNavigate(decision.nextActionRoute)}
                              />
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })
              )}

              <p className="text-[12px] leading-snug text-muted-foreground" data-testid="worklist-pagination-hint">
                Paginering loopt plat over alle wachtrijen (volgorde: wachtrij → urgentie → aanvraag). Tellingen bij elke kop
                zijn voor je huidige filters, niet alleen voor deze pagina.
              </p>

              <div className="flex flex-col gap-3 border-t border-border/50 pt-3 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p className="tabular-nums">
                  {totalRows === 0 ? "0" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalRows)}`} van {totalRows}{" "}
                  aanvragen
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Vorige pagina"
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <span className="tabular-nums text-foreground">
                    Pagina {safePage} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Volgende pagina"
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
                <label className="flex items-center gap-2">
                  <span className="text-[12px]">Rijen per pagina</span>
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                    className="h-9 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground"
                  >
                    {[5, 10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}
        </CareSectionBody>
      </CareSection>
    </CarePageScaffold>
      </div>

      {!railCollapsed && (
        <aside
          data-testid="casussen-right-rail"
          className="hidden w-[300px] shrink-0 space-y-4 pt-1 xl:block xl:sticky xl:top-4 xl:z-10 xl:overflow-y-auto xl:self-start"
          style={{ maxHeight: tokens.layout.regiekamerRailMaxHeight }}
        >
          <CasussenInsightsPanels
            gemeenteDisplayName={gemeenteDisplayName}
            filteredTotal={filteredItems.length}
            attentionCount={attentionCount}
            criticalCount={tabCounts.critical}
            avgDaysInPhase={avgDaysInPhase}
            riskSignalCount={riskSignalCount}
            onCriticalClick={focusCriticalCases}
          />
        </aside>
      )}

      {railCollapsed && (
        <RegieRailEdgeTab
          onExpand={() => setRailCollapsed(false)}
          testId="casussen-rail-edge-tab"
        />
      )}
    </div>
  );
}

function CasussenInsightsPanels({
  gemeenteDisplayName,
  filteredTotal,
  attentionCount,
  criticalCount,
  avgDaysInPhase,
  riskSignalCount,
  onCriticalClick,
}: {
  gemeenteDisplayName: string;
  filteredTotal: number;
  attentionCount: number;
  criticalCount: number;
  avgDaysInPhase: number;
  riskSignalCount: number;
  onCriticalClick: () => void;
}) {
  return (
    <>
      <section className="rounded-xl border border-border/50 bg-card/40 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/40">
            <Building2 size={18} className="text-primary" aria-hidden />
          </div>
          <div className="min-w-0 space-y-3">
            <p className="text-sm font-semibold leading-tight text-foreground">{gemeenteDisplayName}</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Zichtbaar in lijst</dt>
                <dd className="tabular-nums font-semibold text-foreground">{filteredTotal}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Wacht op jouw actie</dt>
                <dd className="tabular-nums font-semibold text-foreground">{attentionCount}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Gem. dagen in fase</dt>
                <dd className="tabular-nums font-semibold text-foreground">{avgDaysInPhase > 0 ? avgDaysInPhase : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Risico-/spoedsignalen</dt>
                <dd className={cn("tabular-nums font-semibold", riskSignalCount > 0 ? "text-red-400" : "text-foreground")}>
                  {riskSignalCount}
                </dd>
              </div>
            </dl>
            <a
              href={CARE_PATHS.REGIEKAMER}
              className="inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
              data-testid="casussen-rail-naar-regiekamer"
            >
              Bekijk regie-overzicht
            </a>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/50 bg-card/40 p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Snelle focus</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Fasefilters en doorlooptellingen staan in <span className="font-medium text-foreground">Doorstroom</span> boven de werklijst — zo blijft deze
          kolom licht en contextueel.
        </p>
        <button
          type="button"
          data-testid="casussen-quick-critical"
          onClick={onCriticalClick}
          className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2.5 text-left text-sm transition hover:border-primary/35 hover:bg-muted/25"
        >
          <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
            <AlertCircle size={16} className="shrink-0 text-red-400" aria-hidden />
            Kritieke aanvragen
          </span>
          <span className="tabular-nums font-semibold text-foreground">{criticalCount}</span>
        </button>
      </section>

      <RegieNotesPanel testId="casussen-notes-panel" />
    </>
  );
}
