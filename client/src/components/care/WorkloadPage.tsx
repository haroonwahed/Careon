import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  FileText,
  FolderOpen,
  Home,
  LayoutGrid,
  SlidersHorizontal,
  SquarePen,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  CareAttentionBar,
  CareDominantStatus,
  CareFilterTabButton,
  CareFilterTabGroup,
  CareFlowBoard,
  CareFlowStepCard,
  CareMetaChip,
  CarePageScaffold,
  CarePrimaryList,
  CareSection,
  CareSectionBody,
  CareSectionHeader,
  CareSearchFiltersBar,
  CareWorkListCard,
  CareWorkRow,
  EmptyState,
  ErrorState,
  FlowPhaseBadge,
  LoadingState,
  PrimaryActionButton,
  normalizeBoardColumnToPhaseId,
} from "./CareDesignPrimitives";
import { cn } from "../ui/utils";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { getShortReasonLabel } from "../../lib/uxCopy";
import {
  buildWorkflowCases,
  getCaseDecisionState,
  type CaseDecisionRole,
  type CaseDecisionState,
  type WorkflowBoardColumn,
  type WorkflowCaseView,
} from "../../lib/workflowUi";
import { classifyCasusWorkboardState, type CasusWorkboardSection } from "./casusWorkboardClassification";
import { CareInfoPopover } from "./CareUnifiedPage";
import { tokens } from "../../design/tokens";
import {
  canonicalPhaseSubStatusLabel,
  DECISION_UI_PHASE_IDS,
  DECISION_UI_PHASE_LABELS,
  decisionUiPhaseBadgeShellClass,
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
type SectionKey = CasusWorkboardSection;

/** Compacte statusregel voor de paginabadge (contrast met vage “vragen actie”-formuleringen elders). */
function casussenWerkvoorraadMetric(filteredCount: number, attentionCount: number): string {
  if (filteredCount === 0) return "Geen casussen in deze weergave";
  if (attentionCount === 0) return `${filteredCount} casussen · geen open actie voor jou`;
  if (attentionCount === 1) return `${filteredCount} casussen · 1 wacht op jouw actie`;
  return `${filteredCount} casussen · ${attentionCount} wachten op jouw actie`;
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

function clientInitials(clientLabel: string): string {
  const parts = clientLabel.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
  }
  return clientLabel.slice(0, 2).toUpperCase();
}

function urgencyDotClass(urgency: WorkflowCaseView["urgency"]): string {
  switch (urgency) {
    case "critical":
      return "bg-red-500";
    case "warning":
      return "bg-amber-500";
    case "normal":
      return "bg-emerald-500";
    default:
      return "bg-muted-foreground/60";
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

function casussenBlokkadeChipClass(item: WorkflowCaseView): string {
  if (item.isBlocked || item.missingDataItems.length > 0) {
    return "border-red-500/35 bg-red-500/10 text-red-100";
  }
  if (item.urgency === "critical") {
    return "border-red-500/35 bg-red-500/10 text-red-100";
  }
  if (item.urgency === "warning") {
    return "border-amber-500/35 bg-amber-500/10 text-amber-100";
  }
  return "border-border bg-muted/30 text-foreground";
}

type StripBucketKey = "casus" | "matching" | "aanbieder" | "plaatsing" | "intake";

const STRIP_DEF: Array<{
  key: StripBucketKey;
  label: string;
  sub: string;
  countKeys: WorkflowBoardColumn[];
  filterPhase: DecisionUiPhaseId;
  statusTone: "blocked" | "waiting" | "ready" | "in_progress";
  statusPillLabel: string;
  Icon: LucideIcon;
}> = [
  {
    key: "casus",
    label: "Casus",
    sub: "Nieuw / intake",
    countKeys: ["casus", "samenvatting"],
    filterPhase: "casus_gestart",
    statusTone: "ready",
    statusPillLabel: "Open",
    Icon: FolderOpen,
  },
  {
    key: "matching",
    label: "Matching",
    sub: "Bezig / validatie",
    countKeys: ["matching", "gemeente-validatie"],
    filterPhase: "klaar_voor_matching",
    statusTone: "in_progress",
    statusPillLabel: "Lopend",
    Icon: Users,
  },
  {
    key: "aanbieder",
    label: "Aanbieder",
    sub: "Wacht op reactie",
    countKeys: ["aanbieder-beoordeling"],
    filterPhase: "in_beoordeling",
    statusTone: "waiting",
    statusPillLabel: "Wacht",
    Icon: UserCheck,
  },
  {
    key: "plaatsing",
    label: "Plaatsing",
    sub: "In afwachting",
    countKeys: ["plaatsing"],
    filterPhase: "plaatsing_intake",
    statusTone: "waiting",
    statusPillLabel: "Wacht",
    Icon: Home,
  },
  {
    key: "intake",
    label: "Intake",
    sub: "Gepland",
    countKeys: ["intake"],
    filterPhase: "plaatsing_intake",
    statusTone: "in_progress",
    statusPillLabel: "Lopend",
    Icon: FileText,
  },
];

function countWorkflowStrip(items: WorkflowCaseView[]): Record<StripBucketKey, number> {
  const acc: Record<StripBucketKey, number> = {
    casus: 0,
    matching: 0,
    aanbieder: 0,
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

/** Zelfde grid als `RegiekamerWorkItemCard` (`SystemAwarenessPage`). */
function CasussenWerkvoorraadRow({
  item,
  decision,
  phaseLabel,
  problemLabel,
  actionLabel,
  showPrimaryCta,
  onOpenCase,
  onWorkflowAction,
}: {
  item: WorkflowCaseView;
  decision: CaseDecisionState;
  phaseLabel: string;
  problemLabel: string;
  actionLabel: string;
  showPrimaryCta: boolean;
  onOpenCase: () => void;
  onWorkflowAction: () => void;
}) {
  const blokkadeLine = `${phaseLabel} — ${problemLabel}`;
  const actionVariant = showPrimaryCta ? "primary" : "ghost";

  return (
    <div
      data-care-work-row
      className={cn(
        "group grid cursor-pointer gap-y-3 gap-x-4 px-4 py-3.5 transition-colors md:grid-cols-[88px_128px_minmax(220px,260px)_104px_112px_minmax(220px,1fr)] md:gap-x-5 md:items-center md:px-5",
        "hover:bg-background/35",
      )}
      role="button"
      tabIndex={0}
      onClick={onOpenCase}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenCase();
        }
      }}
      aria-label={`Open casus ${item.clientLabel}`}
    >
      <div className="flex items-center gap-2 md:flex-col md:items-start md:gap-2.5">
        <CareMetaChip className={cn("h-8 px-3 text-[13px] font-semibold", urgencyChipShellClass(item.urgency))}>
          {item.urgencyLabel}
        </CareMetaChip>
      </div>

      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold leading-tight text-foreground">{item.clientLabel}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
          <span className="font-mono text-[11px] text-muted-foreground/80">{item.id}</span>
        </div>
      </div>

      <div className="min-w-0 space-y-1.5">
        <CareMetaChip
          className={cn(
            "w-fit max-w-full whitespace-normal border text-left text-[12px] font-semibold leading-snug text-foreground",
            casussenBlokkadeChipClass(item),
          )}
        >
          <span className="line-clamp-2">{blokkadeLine}</span>
        </CareMetaChip>
      </div>

      <div className="min-w-0">
        <p className="text-[14px] font-medium leading-tight text-foreground/95">{decision.responsibleParty}</p>
      </div>

      <div className="md:justify-self-start">
        <CareMetaChip className="h-8">
          <Clock3 size={12} />
          {item.lastUpdatedLabel}
        </CareMetaChip>
      </div>

      <div className="min-w-0 md:justify-self-start">
        <Button
          variant={showPrimaryCta ? "default" : "secondary"}
          size="sm"
          type="button"
          data-care-work-row-cta={actionVariant}
          className="h-11 min-h-11 w-full justify-center rounded-xl px-3 text-[13px] font-semibold leading-tight"
          onClick={(event) => {
            event.stopPropagation();
            onWorkflowAction();
          }}
        >
          <span className="whitespace-nowrap text-center">{actionLabel}</span>
        </Button>
      </div>
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
  const [selectedOwner, setSelectedOwner] = useState<"all" | "Gemeente" | "Zorgaanbieder" | "Systeem">("all");
  /** Default “Alle casussen”: volledige werklijst; gebruikers kunnen naar Mijn werkvoorraad voor focus. */
  const [focusChip, setFocusChip] = useState<FocusChip>("all");
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionKey, boolean>>({
    attention: false,
    "waiting-provider": false,
    stable: false,
  });
  const [visibleBySection, setVisibleBySection] = useState<Record<SectionKey, number>>({
    attention: 8,
    "waiting-provider": 8,
    stable: 8,
  });
  const [listLayout, setListLayout] = useState<"table" | "cards">("table");
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

  const baseFilteredItems = useMemo(() => {
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

        if (selectedUrgency !== "all" && item.urgency !== selectedUrgency) {
          return false;
        }

        if (selectedPhase !== "all") {
          const itemDecision = mapApiPhaseToDecisionUiPhase(normalizeBoardColumnToPhaseId(item.boardColumn));
          const matchesPhase = itemDecision === selectedPhase;
          if (!matchesPhase) {
            return false;
          }
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
  }, [decisionItems, searchQuery, selectedRegion, selectedUrgency, selectedPhase, selectedOwner]);

  const tabCounts = useMemo(() => {
    let myWorklist = 0;
    let pipeline = 0;
    let critical = 0;
    for (const { item, decision } of baseFilteredItems) {
      if (decision.requiresCurrentUserAction) myWorklist++;
      const c = classifyCasusWorkboardState(item, decision);
      if (c.section === "attention" || c.section === "waiting-provider") pipeline++;
      if (item.isBlocked || item.missingDataItems.length > 0 || item.urgency === "critical") critical++;
    }
    return {
      all: baseFilteredItems.length,
      myWorklist,
      pipeline,
      critical,
      recent: baseFilteredItems.length,
    };
  }, [baseFilteredItems]);

  const stripCounts = useMemo(() => countWorkflowStrip(baseFilteredItems.map((r) => r.item)), [baseFilteredItems]);

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
    return sortedForFocus.map(({ item, decision }) => ({
      item,
      decision,
      classification: classifyCasusWorkboardState(item, decision),
    }));
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

  const sectionedItems = useMemo(
    () => ({
      attention: classifiedItems.filter(({ classification }) => classification.section === "attention"),
      "waiting-provider": classifiedItems.filter(({ classification }) => classification.section === "waiting-provider"),
      stable: classifiedItems.filter(({ classification }) => classification.section === "stable"),
    }),
    [classifiedItems],
  );

  const displayRows = useMemo(() => {
    const rows = [...classifiedItems];
    if (focusChip === "recent") {
      return rows;
    }
    const sectionOrder: Record<SectionKey, number> = { attention: 0, "waiting-provider": 1, stable: 2 };
    rows.sort((a, b) => {
      const s = sectionOrder[a.classification.section] - sectionOrder[b.classification.section];
      if (s !== 0) return s;
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

  useEffect(() => {
    setPage(1);
  }, [searchQuery, focusChip, selectedRegion, selectedUrgency, selectedPhase, selectedOwner]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const handleNavigate = (nav: "casussen" | "beoordelingen" | "matching" | "plaatsingen" | "intake") => {
    onNavigateToWorkflow?.(nav);
  };

  const toggleSection = (section: SectionKey) => {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const sectionHeaders: Record<SectionKey, string> = {
    attention: "⚠ Vraagt actie",
    "waiting-provider": "⏳ Aanbieder beoordeling",
    stable: "✓ Stabiel",
  };

  const sectionEmptyLabel: Record<SectionKey, string> = {
    attention: "Geen casussen in deze categorie",
    "waiting-provider": "Geen casussen in deze categorie",
    stable: "Geen casussen in deze categorie",
  };

  const compactProblemLabel = (
    item: (typeof classifiedItems)[number]["item"],
    decision: (typeof classifiedItems)[number]["decision"],
  ): string => {
    const problem = getShortReasonLabel(decision.blockedReason ?? item.missingDataItems[0] ?? decision.whyHere).toLowerCase();
    if (item.isBlocked || item.missingDataItems.length > 0) {
      return problem.includes("samenvatting") ? "Casusgegevens onvolledig" : "Blokkade";
    }
    if (problem.includes("urgentie")) return "Blokkade";
    if (problem.includes("samenvatting")) return "Casusgegevens onvolledig";
    if (problem.includes("beoordeling") || problem.includes("aanbieder")) return "Aanbieder beoordeling";
    return decision.requiresCurrentUserAction ? "Actie vereist" : "Geen actie nodig";
  };

  const compactActionLabel = (decision: (typeof classifiedItems)[number]["decision"]): string => {
    const action = decision.nextActionLabel.toLowerCase();
    if (action.includes("urgentie")) return "Vul urgentie aan";
    if (action.includes("wacht op samenvatting")) return "Bekijk status";
    if (action.includes("genereer") || action.includes("samenvatting") || action.includes("casus")) return "Vul casus aan";
    if (action.includes("controleer") && action.includes("match")) return "Start matching";
    if (action.includes("start matching")) return "Start matching";
    if ((action.includes("bekijk") && action.includes("reactie")) || action.includes("aanbiederreactie")) return "Bekijk status";
    if (action.includes("status") && !action.includes("beoordeling uitvoeren")) return "Bekijk status";
    if (action.includes("intake") && action.includes("bekijk")) return "Bekijk intake";
    if (action.includes("open")) return "Open casus";
    return decision.nextActionLabel;
  };

  const compactDaysLabel = (lastUpdatedLabel: string): string => {
    const match = lastUpdatedLabel.match(/(\d+)/);
    if (match) return `${match[1]}d`;
    if (lastUpdatedLabel.toLowerCase().includes("vandaag")) return "0d";
    return lastUpdatedLabel;
  };

  const phaseOptions: Array<{ value: DecisionUiPhaseId; label: string }> = DECISION_UI_PHASE_IDS.map((id) => ({
    value: id,
    label: DECISION_UI_PHASE_LABELS[id],
  }));

  const phasePillClass = (item: WorkflowCaseView): string => {
    const id = mapApiPhaseToDecisionUiPhase(normalizeBoardColumnToPhaseId(item.boardColumn));
    return decisionUiPhaseBadgeShellClass(id);
  };

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
        label: "Toon alle casussen",
        onClick: () => setFocusChip("all"),
      };
    }
    if (attentionCount > 0) {
      return {
        label: "Bekijk kritieke casussen",
        onClick: () => setFocusChip("critical"),
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

  const brandAccent = tokens.colors.casussenAccent;
  const surfaceRaised = tokens.colors.casussenSurfaceRaised;

  const headerActions =
    primaryShortcut !== null || (canCreateCase && onCreateCase) ? (
      <div className="flex flex-col items-start gap-1 md:items-end">
        <div className="flex flex-wrap items-center justify-end gap-2">
        {primaryShortcut ? (
          <PrimaryActionButton
            type="button"
            className="h-11 min-h-11 px-5 text-[14px] shadow-md"
            onClick={primaryShortcut.onClick}
          >
            {primaryShortcut.label}
          </PrimaryActionButton>
        ) : null}
          {canCreateCase && onCreateCase ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 min-h-10 rounded-xl border-border/50 bg-card/40 px-4 text-[13px] font-semibold text-foreground hover:bg-card/60"
              onClick={onCreateCase}
            >
              Nieuwe casus
            </Button>
          ) : null}
        </div>
      </div>
    ) : undefined;

  /** Tabs + weergave — zelfde verticale ritme als Regiekamer (filters via `CareSearchFiltersBar`). */
  const workloadTabRow = (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
      <CareFilterTabGroup
        aria-label="Werkvoorraad-weergave"
        className="min-w-0 flex-1 justify-start overflow-x-auto border-white/[0.08] p-1 pb-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
        style={{ backgroundColor: surfaceRaised }}
      >
        {(
          [
            { key: "my-worklist" as const, label: `Mijn werkvoorraad (${tabCounts.myWorklist})` },
            { key: "all" as const, label: `Alle casussen (${tabCounts.all})` },
            { key: "pipeline" as const, label: `Wacht op actie (${tabCounts.pipeline})` },
            { key: "critical" as const, label: `Kritiek (${tabCounts.critical})` },
            { key: "recent" as const, label: `Recent bijgewerkt (${tabCounts.recent})` },
          ] as const
        ).map((tab) => (
          <CareFilterTabButton
            key={tab.key}
            selected={focusChip === tab.key}
            accentSelected={focusChip === tab.key}
            accentHex={brandAccent}
            onClick={() => setFocusChip(tab.key)}
          >
            {tab.label}
          </CareFilterTabButton>
        ))}
      </CareFilterTabGroup>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-white/[0.1] bg-card/30 px-3 text-[13px] font-medium text-foreground hover:bg-card/50"
            >
              <SlidersHorizontal size={14} className="mr-1.5 opacity-80" aria-hidden />
              Weergave
              <ChevronDown size={14} className="ml-1 opacity-70" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            <DropdownMenuItem
              className="gap-2 text-[13px]"
              onClick={() => {
                setListLayout("table");
              }}
            >
              <LayoutGrid size={14} aria-hidden />
              Tabel (standaard)
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-[13px]"
              onClick={() => {
                setListLayout("cards");
              }}
            >
              Kaarten (compact)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const stripStepIsActive = (step: (typeof STRIP_DEF)[number]) => {
    if (selectedPhase !== "all") {
      if (step.key === "matching") {
        return selectedPhase === "klaar_voor_matching";
      }
      return step.filterPhase === selectedPhase;
    }
    return dominantStripKey === step.key;
  };

  const ketenStrip = (
    <CareSection testId="casussen-workflow-strip" aria-label="Aantallen per ketenstap">
      <CareSectionHeader
        title="De ketenstrip"
        description={
          <>
            <p>Tellingen gelden voor je huidige filters en tabblad.</p>
            <p>Klik een stap om te filteren op die beslisfase (ketenlabel).</p>
          </>
        }
        descriptionAriaLabel="Uitleg ketenstrip"
        descriptionTestId="casussen-ketenstrip-uitleg"
        action={
          <Button type="button" variant="ghost" className="gap-1 px-2 text-sm font-semibold text-primary hover:bg-primary/10 hover:text-primary" asChild>
            <a href="/regiekamer" data-testid="casussen-ketenstrip-naar-regiekamer">
              Naar Regiekamer
              <ChevronRight size={14} aria-hidden />
            </a>
          </Button>
        }
      />
      <CareSectionBody className="mt-4 space-y-0">
        <CareFlowBoard testId="casussen-flow-board" variant="pipeline">
          {STRIP_DEF.map((step) => {
            const Icon = step.Icon;
            const active = stripStepIsActive(step);
            return (
              <CareFlowStepCard
                key={step.key}
                testId={`casussen-phase-column-${step.key}`}
                active={active}
                onClick={() => {
                  setSelectedPhase(step.filterPhase);
                  setFocusChip("all");
                }}
                icon={<Icon size={18} className="text-current" aria-hidden />}
                metric={stripCounts[step.key]}
                title={step.label}
                subStatusLines={[
                  <span
                    key={`${step.key}-pill`}
                    className={cn(
                      "inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold",
                      phasePillClasses(step.statusTone),
                    )}
                  >
                    {step.statusPillLabel}
                  </span>,
                ]}
              />
            );
          })}
        </CareFlowBoard>
      </CareSectionBody>
    </CareSection>
  );

  return (
    <div className="flex w-full flex-col gap-8 xl:flex-row xl:items-start xl:gap-10">
      <div className="min-w-0 flex-1">
    <CarePageScaffold
      archetype="worklist"
      className="pb-8"
      title="Casussen"
      subtitleInfoTestId="casussen-page-info"
      subtitleAriaLabel="Uitleg Casussen"
      subtitle={
        <div className="space-y-2">
          <p className="font-semibold text-foreground">Hoe deze lijst werkt</p>
          <p>
            Tabbladen en zoekveld bepalen welke dossiers je ziet. Sidebar Acties (taken) staat los van het tabblad Mijn werkvoorraad op
            deze pagina.
          </p>
          <p>De ketenstrip telt dossiers per stap (na je filters). De werklijst toont de volgende best passende actie per casus.</p>
          <p className="text-muted-foreground">
            Overzicht van je werkvoorraad per dossier — ketenstrip en filters bepalen wat je hier ziet.
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
      kpiStrip={ketenStrip}
    >
      <CareSection testId="casussen-uitvoerlijst" aria-labelledby="casussen-werkvoorraad-heading">
        <CareSectionHeader
          title={
            <span id="casussen-werkvoorraad-heading" className="flex flex-wrap items-baseline gap-3">
              <span>Werkvoorraad</span>
              <span className="text-base font-medium tabular-nums text-muted-foreground">{filteredItems.length} casussen</span>
            </span>
          }
          meta={
            <div className="w-full min-w-0 space-y-2">
              {workloadTabRow}
              <CareSearchFiltersBar
                className="px-0"
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Zoek casussen, cliënten, aanbieders…"
                showSecondaryFilters={showSecondaryFilters}
                onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
                secondaryFiltersLabel="Filters"
                secondaryFilters={
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs text-muted-foreground">
                      Stap
                      <select
                        aria-label="Stap in de keten"
                        value={selectedPhase}
                        onChange={(event) => setSelectedPhase(event.target.value as "all" | DecisionUiPhaseId)}
                        className="mt-1 h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                      >
                        <option value="all">Alle fases</option>
                        {phaseOptions.map((phase) => (
                          <option key={phase.value} value={phase.value}>
                            {phase.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Urgentie
                      <select
                        aria-label="Urgentie"
                        value={selectedUrgency}
                        onChange={(event) => setSelectedUrgency(event.target.value)}
                        className="mt-1 h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                      >
                        <option value="all">Alle urgentie</option>
                        <option value="critical">Kritiek</option>
                        <option value="warning">Hoog</option>
                        <option value="normal">Normaal</option>
                        <option value="stable">Laag</option>
                      </select>
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Regio
                      <select
                        aria-label="Regio"
                        value={selectedRegion}
                        onChange={(event) => setSelectedRegion(event.target.value)}
                        className="mt-1 h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                      >
                        {regions.map((region) => (
                          <option key={region} value={region}>
                            {region === "all" ? "Alle regio's" : region}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Verantwoordelijke
                      <select
                        aria-label="Verantwoordelijke"
                        value={selectedOwner}
                        onChange={(event) => setSelectedOwner(event.target.value as "all" | "Gemeente" | "Zorgaanbieder" | "Systeem")}
                        className="mt-1 h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                      >
                        <option value="all">Alle verantwoordelijken</option>
                        <option value="Gemeente">Gemeente</option>
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
                    Weergave: kritiek / geblokkeerd. Gebruik <span className="font-medium text-foreground">Toon alle casussen</span> rechtsboven om
                    terug te gaan naar de volledige lijst.
                  </>
                }
              />
            </div>
          ) : null}
          {loading && <LoadingState title="Casussen laden…" copy="De werkvoorraad wordt opgebouwd." />}

          {!loading && error && (
            <ErrorState title="Casussen laden mislukt" copy={getShortReasonLabel(error, 100)} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
          )}

          {!loading && !error && workflowCases.length === 0 && (
            <EmptyState
              title="Geen casussen."
              copy={canCreateCase ? "Er zijn nog geen dossiers. Start een nieuwe casus via de knop rechtsboven." : "Pas filters aan."}
            />
          )}

          {!loading && !error && workflowCases.length > 0 && filteredItems.length === 0 && (
            <EmptyState
              title={focusChip === "my-worklist" ? "Geen open acties." : "Geen casussen."}
              copy={focusChip === "my-worklist" ? "Alles ligt bij andere partijen." : "Pas filters aan."}
            />
          )}

          {!loading && !error && filteredItems.length > 0 && listLayout === "table" && (
            <div data-testid="worklist" data-density="compact" className="space-y-3">
              <CareWorkListCard
                header={(
                  <div
                    data-testid="casussen-werkvoorraad-column-headers"
                    className="hidden gap-y-3 gap-x-4 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid md:grid-cols-[88px_128px_minmax(220px,260px)_104px_112px_minmax(220px,1fr)] md:gap-x-5 md:px-5"
                  >
                    <span>Prioriteit</span>
                    <span>Casus</span>
                    <span>Blokkade / aandacht</span>
                    <span>Eigenaar</span>
                    <span>Wachttijd</span>
                    <span>Volgende actie</span>
                  </div>
                )}
              >
                <div className="divide-y divide-border/45">
                  {pageRows.map(({ item, decision }) => (
                    <CasussenWerkvoorraadRow
                      key={item.id}
                      item={item}
                      decision={decision}
                      phaseLabel={phasePillLabel(item)}
                      problemLabel={compactProblemLabel(item, decision)}
                      actionLabel={compactActionLabel(decision)}
                      showPrimaryCta={Boolean(decision.requiresCurrentUserAction && decision.primaryActionEnabled)}
                      onOpenCase={() => onCaseClick(item.id)}
                      onWorkflowAction={() => handleNavigate(decision.nextActionRoute)}
                    />
                  ))}
                </div>
              </CareWorkListCard>

              <div className="flex flex-col gap-3 border-t border-border/50 pt-3 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p className="tabular-nums">
                  {totalRows === 0 ? "0" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalRows)}`} van {totalRows}{" "}
                  casussen
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

          {!loading && !error && filteredItems.length > 0 && listLayout === "cards" && (
            <div data-testid="worklist" data-density="compact" data-layout="cards" className="space-y-3.5">
              {(Object.keys(sectionedItems) as SectionKey[]).map((sectionKey) => {
                const items = sectionedItems[sectionKey];
                const isCollapsed = collapsedSections[sectionKey];
                const visibleItems = items.slice(0, visibleBySection[sectionKey]);
                return (
                  <section key={sectionKey} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleSection(sectionKey)}
                      className="flex w-full items-center justify-between rounded-lg px-1 py-0.5 text-left"
                    >
                      <h2 className="text-[15px] font-semibold">
                        {sectionHeaders[sectionKey]} ({items.length})
                      </h2>
                      {isCollapsed ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronUp size={16} className="text-muted-foreground" />}
                    </button>

                    {!isCollapsed && (
                      <>
                        {items.length === 0 ? <p className="text-[13px] text-muted-foreground">{sectionEmptyLabel[sectionKey]}</p> : null}
                        {items.length > 0 ? (
                          <CarePrimaryList>
                            {visibleItems.map(({ item, decision }) => {
                              const classification = classifyCasusWorkboardState(item, decision);
                              const showPrimaryCta = decision.requiresCurrentUserAction && decision.primaryActionEnabled;
                              const apiPhase = normalizeBoardColumnToPhaseId(item.boardColumn);
                              const subPhase = canonicalPhaseSubStatusLabel(apiPhase);
                              return (
                                <div key={item.id} className="group relative">
                                  <CareWorkRow
                                    leading={(
                                      <span className="flex max-w-full flex-col items-stretch gap-1">
                                        <FlowPhaseBadge phaseId={apiPhase} />
                                        {subPhase ? <CareMetaChip title="Deelstatus (geen aparte ketenfase)">{subPhase}</CareMetaChip> : null}
                                      </span>
                                    )}
                                    title={item.clientLabel}
                                    context={(
                                      <>
                                        <CareMetaChip>{item.clientAge} jaar</CareMetaChip>
                                        <CareMetaChip>{item.region}</CareMetaChip>
                                        <CareMetaChip title={item.careType}>
                                          <span className="truncate" style={{ maxWidth: tokens.layout.chipMeasure }}>
                                            {item.careType}
                                          </span>
                                        </CareMetaChip>
                                      </>
                                    )}
                                    status={(
                                      <CareDominantStatus
                                        className={
                                          item.isBlocked || item.missingDataItems.length > 0
                                            ? "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-200"
                                            : sectionKey === "attention"
                                              ? "border-destructive/35 bg-destructive/10 text-destructive"
                                              : sectionKey === "waiting-provider"
                                                ? "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                                                : "border-border/70 bg-muted/20 text-muted-foreground"
                                        }
                                      >
                                        {compactProblemLabel(item, decision)}
                                      </CareDominantStatus>
                                    )}
                                    time={(
                                      <CareMetaChip>
                                        <Clock3 size={12} />
                                        {compactDaysLabel(item.lastUpdatedLabel)}
                                      </CareMetaChip>
                                    )}
                                    contextInfo={
                                      item.recommendedProviderName ? (
                                        <CareMetaChip title={item.recommendedProviderName}>
                                          <Building2 size={12} />
                                          <span className="truncate" style={{ maxWidth: tokens.layout.chipMeasureWide }}>
                                            {item.recommendedProviderName}
                                          </span>
                                        </CareMetaChip>
                                      ) : undefined
                                    }
                                    actionLabel={compactActionLabel(decision)}
                                    actionVariant={showPrimaryCta ? "primary" : "ghost"}
                                    onOpen={() => onCaseClick(item.id)}
                                    onAction={(event) => {
                                      event.stopPropagation();
                                      handleNavigate(decision.nextActionRoute);
                                    }}
                                    accentTone={sectionKey === "attention" ? "critical" : sectionKey === "waiting-provider" ? "warning" : "neutral"}
                                  />
                                  {import.meta.env.DEV && (
                                    <details className="absolute right-2 top-1">
                                      <summary
                                        aria-label="Open debug classificatie"
                                        className="inline-block cursor-pointer list-none rounded-full px-1 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-muted/40 group-hover:opacity-100 focus-visible:opacity-100"
                                      >
                                        i
                                      </summary>
                                      <div className="mt-1 space-y-1 text-left text-[11px] text-muted-foreground md:absolute md:right-6 md:z-10 md:rounded-md md:border md:border-border/60 md:bg-background/95 md:p-2">
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
                                      </div>
                                    </details>
                                  )}
                                </div>
                              );
                            })}
                          </CarePrimaryList>
                        ) : null}
                        {items.length > visibleItems.length ? (
                          <Button variant="outline" onClick={() => setVisibleBySection((current) => ({ ...current, [sectionKey]: current[sectionKey] + 8 }))}>
                            Toon meer
                          </Button>
                        ) : null}
                      </>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </CareSectionBody>
      </CareSection>
    </CarePageScaffold>
      </div>

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
          stripCounts={stripCounts}
          onCriticalClick={() => setFocusChip("critical")}
          onStripBucketClick={(key) => {
            const step = STRIP_DEF.find((row) => row.key === key);
            if (step) {
              setSelectedPhase(step.filterPhase);
              setFocusChip("all");
            }
          }}
        />
      </aside>
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
  stripCounts,
  onCriticalClick,
  onStripBucketClick,
}: {
  gemeenteDisplayName: string;
  filteredTotal: number;
  attentionCount: number;
  criticalCount: number;
  avgDaysInPhase: number;
  riskSignalCount: number;
  stripCounts: Record<StripBucketKey, number>;
  onCriticalClick: () => void;
  onStripBucketClick: (key: StripBucketKey) => void;
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
              href="/regiekamer"
              className="inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
              data-testid="casussen-rail-naar-regiekamer"
            >
              Bekijk regie-overzicht
            </a>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/50 bg-card/40 p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Snel naar</p>
        <ul className="mt-3 space-y-2">
          <li>
            <button
              type="button"
              data-testid="casussen-quick-critical"
              onClick={onCriticalClick}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2.5 text-left text-sm transition hover:border-primary/35 hover:bg-muted/25"
            >
              <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                <AlertCircle size={16} className="shrink-0 text-red-400" aria-hidden />
                Kritieke casussen
              </span>
              <span className="tabular-nums font-semibold text-foreground">{criticalCount}</span>
            </button>
          </li>
          {STRIP_DEF.map((col) => {
            const QuickIcon = col.Icon;
            return (
            <li key={col.key}>
              <button
                type="button"
                data-testid={`casussen-quick-phase-${col.key}`}
                onClick={() => onStripBucketClick(col.key)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2.5 text-left text-sm transition hover:border-primary/35 hover:bg-muted/25"
              >
                <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                  <span className="shrink-0 opacity-90" aria-hidden>
                    <QuickIcon size={16} className="text-muted-foreground" />
                  </span>
                  <span className="truncate">{col.label}</span>
                </span>
                <span className="tabular-nums font-semibold text-foreground">{stripCounts[col.key]}</span>
              </button>
            </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-border/50 bg-card/40 p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Regie-notitie</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Leg een regieafspraak of aandachtspunt vast voor je team.
        </p>
        <Button variant="outline" className="mt-4 w-full gap-2 rounded-xl border-primary/40 text-primary" type="button">
          <SquarePen size={16} aria-hidden />
          Nieuwe notitie
        </Button>
      </section>
    </>
  );
}
