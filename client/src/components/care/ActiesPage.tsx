import { type MouseEvent, type ReactNode, useMemo, useState } from "react";
import { Calendar, ClipboardList, Clock, ShieldAlert } from "lucide-react";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { cn } from "../ui/utils";
import { tokens } from "../../design/tokens";
import { useTasks, type SpaTask } from "../../hooks/useTasks";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import {
  countOpenCareTasks,
  isOpenCareTask,
  normalizeTaskPriority,
  sortTasksByCaseId,
  sortTasksByDueDate,
  sortTasksByUrgency,
  type TaskPriorityKey,
} from "../../lib/actiesTaskSemantics";
import {
  CareAttentionBar,
  CareDominantStatus,
  CareFilterTabButton,
  CareFilterTabGroup,
  CareMetaChip,
  CareMetricBadge,
  CarePageScaffold,
  CarePrimaryList,
  CareSection,
  CareSectionBody,
  CareSectionHeader,
  CareSearchFiltersBar,
  CareWorkRow,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import { CareKPICard } from "./CareKPICard";

interface ActiesPageProps {
  onCaseClick: (caseId: string) => void;
  onNavigateToCasussen?: () => void;
}

type ListTab = "mine" | "waiting" | "all";
type SortMode = "urgency" | "due" | "case";
type DueBucketFilter = "all" | "overdue" | "today" | "week";

const PRIORITY_KEYS: TaskPriorityKey[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

const PRIORITY_UI: Record<
  TaskPriorityKey,
  { label: string; chipClass: string }
> = {
  URGENT: {
    label: "Kritiek",
    chipClass: "border-red-500/35 bg-red-500/10 text-red-200",
  },
  HIGH: {
    label: "Hoog",
    chipClass: "border-amber-500/35 bg-amber-500/10 text-amber-100",
  },
  MEDIUM: {
    label: "Gemiddeld",
    chipClass: "border-blue-500/35 bg-blue-500/10 text-blue-100",
  },
  LOW: {
    label: "Laag",
    chipClass: "border-slate-500/35 bg-slate-500/10 text-slate-200",
  },
};

function formatCasReference(linkedCaseId: string): string {
  if (!linkedCaseId) return "—";
  const y = new Date().getFullYear();
  const compact = linkedCaseId.replace(/-/g, "");
  const tail = (compact.slice(-6) || compact).toUpperCase();
  return `CAS-${y}-${tail}`;
}

function formatDeadlinePresent(task: SpaTask): string {
  if (task.actionStatus === "overdue") return "Te laat";
  if (task.actionStatus === "today") return "Vervalt vandaag";
  if (!task.dueDate) return "Geen vervaldatum";
  const d = new Date(`${task.dueDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return task.dueDate;
  return `Vervalt ${d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`;
}

function taskAssignedToMe(task: SpaTask, fullName: string | undefined): boolean {
  if (!fullName) return true;
  return task.assignedTo.trim().toLowerCase() === fullName.trim().toLowerCase();
}

function applyListTab(tasks: SpaTask[], tab: ListTab, meFullName: string | undefined): SpaTask[] {
  if (tab === "all") return tasks;
  const mine = tasks.filter((t) => taskAssignedToMe(t, meFullName));
  if (tab === "mine") return mine;
  return mine.filter((t) => t.actionStatus === "overdue" || t.actionStatus === "today");
}

function isDueInCalendarWeek(task: SpaTask): boolean {
  if (!task.dueDate || task.actionStatus === "overdue" || task.actionStatus === "today") {
    return false;
  }
  const due = new Date(`${task.dueDate}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (86400 * 1000));
  return diffDays >= 0 && diffDays <= 7;
}

function passesDueBucket(task: SpaTask, bucket: DueBucketFilter): boolean {
  if (bucket === "all") return true;
  if (bucket === "overdue") return task.actionStatus === "overdue";
  if (bucket === "today") return task.actionStatus === "today";
  return isDueInCalendarWeek(task);
}

function passesPrioritySet(task: SpaTask, selected: Set<TaskPriorityKey>): boolean {
  if (selected.size === 0 || selected.size === PRIORITY_KEYS.length) return true;
  return selected.has(normalizeTaskPriority(task.priority));
}

function priorityCounts(tasks: SpaTask[]): Record<TaskPriorityKey, number> {
  const base: Record<TaskPriorityKey, number> = {
    URGENT: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  for (const t of tasks) {
    base[normalizeTaskPriority(t.priority)] += 1;
  }
  return base;
}

function priorityLeading(task: SpaTask): ReactNode {
  const p = normalizeTaskPriority(task.priority);
  const ui = PRIORITY_UI[p];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        ui.chipClass,
      )}
    >
      {ui.label}
    </span>
  );
}

export function ActiesPage({ onCaseClick, onNavigateToCasussen }: ActiesPageProps) {
  const { me } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const [listTab, setListTab] = useState<ListTab>("all");
  const [sortMode, setSortMode] = useState<SortMode>("urgency");
  const [dueBucket, setDueBucket] = useState<DueBucketFilter>("all");
  const [prioritySelected, setPrioritySelected] = useState<Set<TaskPriorityKey>>(
    () => new Set(PRIORITY_KEYS),
  );

  const { tasks, loading, error, refetch } = useTasks({ q: searchQuery });

  const openTasks = useMemo(() => tasks.filter(isOpenCareTask), [tasks]);
  const openTaskTotal = countOpenCareTasks(tasks);

  const scopedTasks = useMemo(
    () => applyListTab(openTasks, listTab, me?.fullName),
    [openTasks, listTab, me?.fullName],
  );

  const filteredTasks = useMemo(() => {
    let list = scopedTasks.filter((t) => passesDueBucket(t, dueBucket));
    list = list.filter((t) => passesPrioritySet(t, prioritySelected));
    return list;
  }, [scopedTasks, dueBucket, prioritySelected]);

  const sortedTasks = useMemo(() => {
    if (sortMode === "due") return sortTasksByDueDate(filteredTasks);
    if (sortMode === "case") return sortTasksByCaseId(filteredTasks);
    return sortTasksByUrgency(filteredTasks);
  }, [filteredTasks, sortMode]);

  const counts = useMemo(() => {
    const urgent = openTasks.filter((t) => normalizeTaskPriority(t.priority) === "URGENT").length;
    const today = openTasks.filter((t) => t.actionStatus === "today").length;
    const waitingOthers = openTasks.filter((t) => {
      if (!me?.fullName) return Boolean(t.assignedTo);
      return Boolean(t.assignedTo) && !taskAssignedToMe(t, me.fullName);
    }).length;
    return { urgent, today, waitingOthers };
  }, [openTasks, me?.fullName]);

  const dominantAction = useMemo(() => {
    if (openTaskTotal === 0) {
      return null;
    }

    if (counts.urgent > 0) {
      return {
        tone: "critical" as const,
        icon: <ShieldAlert size={16} aria-hidden />,
        message: `${counts.urgent} kritieke actie${counts.urgent === 1 ? "" : "s"} staan nu open voor jou; pak de oudste eerst op om de blokkade niet te laten oplopen.`,
        action: (
          <Button
            type="button"
            variant="default"
            className="rounded-xl px-4 font-semibold"
            onClick={() => {
              setShowSecondaryFilters(true);
              setDueBucket("overdue");
            }}
          >
            Toon te laat
          </Button>
        ),
      };
    }

    if (counts.today > 0) {
      return {
        tone: "warning" as const,
        icon: <Clock size={16} aria-hidden />,
        message: `${counts.today} actie${counts.today === 1 ? "" : "s"} vervalt vandaag; werk deze eerst af voordat je verder filtert.`,
        action: (
          <Button
            type="button"
            variant="default"
            className="rounded-xl px-4 font-semibold"
            onClick={() => {
              setShowSecondaryFilters(true);
              setDueBucket("today");
            }}
          >
            Toon vandaag
          </Button>
        ),
      };
    }

    if (counts.waitingOthers > 0) {
      return {
        tone: "info" as const,
        icon: <ClipboardList size={16} aria-hidden />,
        message: `${counts.waitingOthers} actie${counts.waitingOthers === 1 ? "" : "s"} wachten op anderen; houd jouw eigen werkvoorraad vooraan.`,
        action: (
          <Button
            type="button"
            variant="outline"
            className="rounded-xl px-4 font-semibold"
            onClick={() => setListTab("waiting")}
          >
            Wacht op mij
          </Button>
        ),
      };
    }

    return {
      tone: "info" as const,
      icon: <ClipboardList size={16} aria-hidden />,
      message: `${openTaskTotal} open actie${openTaskTotal === 1 ? "" : "s"} staan klaar; pak ze in urgentie-volgorde op.`,
      action: onNavigateToCasussen ? (
        <Button
          type="button"
          variant="outline"
          className="rounded-xl px-4 font-semibold"
          onClick={onNavigateToCasussen}
        >
          Open casussen
        </Button>
      ) : undefined,
    };
  }, [counts.today, counts.urgent, counts.waitingOthers, openTaskTotal, onNavigateToCasussen]);

  const pc = useMemo(() => priorityCounts(openTasks), [openTasks]);

  const togglePriority = (key: TaskPriorityKey) => {
    setPrioritySelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearSidebarFilters = () => {
    setSearchQuery("");
    setDueBucket("all");
    setPrioritySelected(new Set(PRIORITY_KEYS));
  };

  const selectTriggerClass =
    "h-10 border-border bg-card text-foreground hover:bg-muted/35 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30";

  const brandAccent = tokens.colors.casussenAccent;
  const surfaceRaised = tokens.colors.casussenSurfaceRaised;

  const actiesTabRow = (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
      <CareFilterTabGroup
        aria-label="Actieweergave"
        className="min-w-0 flex-1 justify-start overflow-x-auto border-border/60 p-1 pb-1 shadow-sm"
        style={{ backgroundColor: surfaceRaised }}
      >
        <CareFilterTabButton selected={listTab === "mine"} accentSelected={listTab === "mine"} accentHex={brandAccent} onClick={() => setListTab("mine")}>
          Mijn acties
        </CareFilterTabButton>
        <CareFilterTabButton
          selected={listTab === "waiting"}
          accentSelected={listTab === "waiting"}
          accentHex={brandAccent}
          onClick={() => setListTab("waiting")}
        >
          Wacht op mij
        </CareFilterTabButton>
        <CareFilterTabButton selected={listTab === "all"} accentSelected={listTab === "all"} accentHex={brandAccent} onClick={() => setListTab("all")}>
          Alle acties
        </CareFilterTabButton>
      </CareFilterTabGroup>
    </div>
  );

  const actiesSortRightAction = (
    <div className="flex items-center gap-2">
      <span className="hidden text-[13px] text-muted-foreground sm:inline">Sorteren op</span>
      <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
        <SelectTrigger className={cn("h-10 min-w-[10.5rem]", selectTriggerClass)}>
          <SelectValue placeholder="Sorteren" />
        </SelectTrigger>
        <SelectContent className="border-border bg-card text-foreground">
          <SelectItem value="urgency" className="text-foreground focus:bg-muted">
            Urgentie
          </SelectItem>
          <SelectItem value="due" className="text-foreground focus:bg-muted">
            Vervaldatum
          </SelectItem>
          <SelectItem value="case" className="text-foreground focus:bg-muted">
            Casus ID
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const kpiStrip = (
    <div className="grid gap-3 px-1 sm:grid-cols-2 xl:grid-cols-4">
      <CareKPICard
        title="Totaal open"
        value={loading ? "—" : openTaskTotal}
        subtitle="Openstaande taken"
        icon={ClipboardList}
        urgency="normal"
      />
      <CareKPICard
        title="Kritiek"
        value={loading ? "—" : counts.urgent}
        subtitle="Vereist directe actie"
        icon={ShieldAlert}
        urgency="critical"
      />
      <CareKPICard
        title="Vandaag"
        value={loading ? "—" : counts.today}
        subtitle="Vervalt vandaag"
        icon={Calendar}
        urgency="warning"
      />
      <CareKPICard
        title="Wacht op anderen"
        value={loading ? "—" : counts.waitingOthers}
        subtitle="In afwachting"
        icon={Clock}
        urgency="normal"
      />
    </div>
  );

  return (
    <CarePageScaffold
      archetype="worklist"
      className="pb-8"
      title="Acties"
      subtitleInfoTestId="acties-page-info"
      subtitleAriaLabel="Uitleg Acties"
      subtitle="Open taken met eigenaar, verval en volgende stap, zodat je direct weet wat nu aandacht vraagt."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToCasussen ? (
            <Button type="button" variant="outline" className="rounded-xl px-4 font-semibold" onClick={onNavigateToCasussen}>
              Open casussen
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="rounded-xl px-4 font-semibold" onClick={() => refetch()}>
            Ververs
          </Button>
        </div>
      }
      dominantAction={
        dominantAction ? (
          <CareAttentionBar
            tone={dominantAction.tone}
            icon={dominantAction.icon}
            message={dominantAction.message}
            action={dominantAction.action}
          />
        ) : undefined
      }
      metric={
        <CareMetricBadge>
          {loading ? "Laden…" : `${sortedTasks.length} in deze weergave · ${openTaskTotal} totaal`}
        </CareMetricBadge>
      }
      kpiStrip={kpiStrip}
    >
      <CareSection testId="acties-uitvoerlijst" aria-labelledby="acties-werkvoorraad-heading">
        <CareSectionHeader
          title={
            <span id="acties-werkvoorraad-heading" className="flex flex-wrap items-baseline gap-3">
              <span>Werkvoorraad</span>
              <span className="text-base font-medium tabular-nums text-muted-foreground">
                {loading ? "…" : `${sortedTasks.length} acties`}
              </span>
            </span>
          }
          meta={
            <div className="w-full min-w-0 space-y-2">
              {actiesTabRow}
              <CareSearchFiltersBar
                className="px-0"
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Zoek acties of casus ID..."
                showSecondaryFilters={showSecondaryFilters}
                onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
                secondaryFiltersLabel="Filters"
                secondaryFilters={
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] leading-snug text-muted-foreground">
                        Prioriteit en verval gelden direct; zoeken via het veld hierboven.
                      </p>
                      <button
                        type="button"
                        className="shrink-0 text-[13px] font-semibold text-primary hover:text-primary/90"
                        onClick={clearSidebarFilters}
                      >
                        Wissen
                      </button>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Urgentie</p>
                      {PRIORITY_KEYS.map((key) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/30 px-2.5 py-2 text-[13px]"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={prioritySelected.has(key)}
                              onChange={() => togglePriority(key)}
                              className="size-4 rounded border-border accent-primary"
                            />
                            <span className="font-medium text-foreground">{PRIORITY_UI[key].label}</span>
                          </span>
                          <span className="tabular-nums text-muted-foreground">{pc[key]}</span>
                        </label>
                      ))}
                    </div>
                    <label className="block space-y-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">Type actie</span>
                      <select disabled className="h-9 w-full rounded-xl border border-border/50 bg-muted/20 px-3 text-sm text-muted-foreground">
                        <option>Alle typen</option>
                      </select>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">Fase</span>
                      <select disabled className="h-9 w-full rounded-xl border border-border/50 bg-muted/20 px-3 text-sm text-muted-foreground">
                        <option>Openstaande taak</option>
                      </select>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">Vervaldatum</span>
                      <select
                        value={dueBucket}
                        onChange={(e) => setDueBucket(e.target.value as DueBucketFilter)}
                        className="h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground"
                      >
                        <option value="all">Alle</option>
                        <option value="overdue">Te laat</option>
                        <option value="today">Vandaag</option>
                        <option value="week">Deze week</option>
                      </select>
                    </label>
                  </div>
                }
                rightAction={actiesSortRightAction}
              />
            </div>
          }
        />
        <CareSectionBody className="space-y-3">
          <div id="acties-werklijst" data-testid="acties-werklijst">
            {loading && <LoadingState title="Acties laden…" copy="Takenlijst wordt opgebouwd." />}
            {!loading && error && (
              <ErrorState
                title="Kon acties niet laden"
                copy={error}
                action={<Button variant="outline" size="sm" onClick={() => refetch()}>Opnieuw proberen</Button>}
                className="border-destructive/35 bg-destructive/5"
              />
            )}
            {!loading && !error && sortedTasks.length > 0 && (
              <CarePrimaryList>
                {sortedTasks.map((task) => {
                  const p = normalizeTaskPriority(task.priority);
                  const ui = PRIORITY_UI[p];
                  const casRef = formatCasReference(task.linkedCaseId);
                  return (
                    <CareWorkRow
                      key={task.id}
                      leading={priorityLeading(task)}
                      title={task.title}
                      context={
                        <>
                          <CareMetaChip>{casRef}</CareMetaChip>
                          <CareMetaChip>{task.caseTitle?.trim() ? task.caseTitle : "—"}</CareMetaChip>
                        </>
                      }
                      status={
                        <CareDominantStatus className={ui.chipClass}>{ui.label}</CareDominantStatus>
                      }
                      time={
                        <CareMetaChip>
                          <Clock size={12} aria-hidden />
                          {formatDeadlinePresent(task)}
                        </CareMetaChip>
                      }
                      contextInfo={
                        task.assignedTo ? (
                          <CareMetaChip title={task.assignedTo}>@ {task.assignedTo}</CareMetaChip>
                        ) : undefined
                      }
                      actionLabel={task.actionStatus === "overdue" ? "Open casus nu" : "Bekijk actie"}
                      actionVariant={
                        task.actionStatus === "overdue" || task.actionStatus === "today" ? "primary" : "ghost"
                      }
                      onOpen={() => onCaseClick(task.linkedCaseId)}
                      onAction={(event: MouseEvent<HTMLButtonElement>) => {
                        event.stopPropagation();
                        onCaseClick(task.linkedCaseId);
                      }}
                      accentTone={
                        task.actionStatus === "overdue"
                          ? "critical"
                          : task.actionStatus === "today"
                            ? "warning"
                            : "neutral"
                      }
                    />
                  );
                })}
              </CarePrimaryList>
            )}
            {!loading && !error && sortedTasks.length === 0 && (
              <EmptyState
                title="Geen openstaande acties"
                copy={
                  searchQuery.trim() || dueBucket !== "all" || prioritySelected.size < PRIORITY_KEYS.length
                    ? `Er zijn ${openTaskTotal} openstaande ${openTaskTotal === 1 ? "taak" : "taken"} in totaal. Pas tabblad, zoekopdracht of filters aan.`
                    : "Alle taken zijn voltooid. Er staat nu niets open dat jouw directe aandacht vraagt."
                }
                action={
                  onNavigateToCasussen ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-1 rounded-xl px-4 font-semibold"
                      onClick={onNavigateToCasussen}
                      data-testid="acties-empty-open-casussen"
                    >
                      Open casussen
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        </CareSectionBody>
      </CareSection>
    </CarePageScaffold>
  );
}
