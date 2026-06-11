import { type ReactNode, useMemo, useState } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { useTasks, type SpaTask } from "../../hooks/useTasks";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import {
  isOpenCareTask,
  normalizeTaskPriority,
  sortTasksByUrgency,
  type TaskPriorityKey,
} from "../../lib/actiesTaskSemantics";
import { getShortReasonLabel } from "../../lib/uxCopy";
import {
  CareAlertCard,
  CareDominantStatus,
  CareMetaChip,
  CarePageScaffold,
  CareOperationalQueueHeader,
  CareSearchFiltersBar,
  CareWorkListCard,
  CareWorkspaceSection,
  CareWorkRow,
  CareQueueInlineAction,
  CarePrimaryList,
  CareSectionHeader,
  CareOperationalSelect,
  PrimaryActionButton,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";

interface ActiesPageProps {
  onCaseClick: (caseId: string) => void;
  onNavigateToCasussen?: () => void;
}

type ListTab = "mine" | "waiting" | "all";
type DueBucketFilter = "all" | "overdue" | "today" | "week";

const PRIORITY_KEYS: TaskPriorityKey[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

const PRIORITY_UI: Record<TaskPriorityKey, { label: string; chipClass: string }> = {
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

function formatRelativeActivity(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return "Onbekend";
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - created.getTime());
  const diffHours = diffMs / (60 * 60 * 1000);
  if (diffHours < 24) {
    return `${Math.max(1, Math.round(diffHours))} uur geleden`;
  }
  const diffDays = Math.max(1, Math.round(diffHours / 24));
  return `${diffDays} dag${diffDays === 1 ? "" : "en"} geleden`;
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

function taskStatusLabel(task: SpaTask): string {
  if (task.actionStatus === "overdue") return "Te laat";
  if (task.actionStatus === "today") return "Vandaag";
  if (task.actionStatus === "upcoming") return "Binnenkort";
  return "Afgerond";
}

function taskReasonLabel(task: SpaTask): string {
  const source = `${task.title} ${task.description}`.trim();
  const reason = getShortReasonLabel(source, 56);
  if (!reason || reason === "Geen toelichting") {
    return "Opvolging nodig";
  }
  return reason;
}

function taskNextActionLabel(task: SpaTask): string {
  const source = `${task.title} ${task.description}`.toLowerCase();
  if (/(casusgegevens|casus.*invull|aanvraag.*invull|casus.*compleet|aanvraag.*compleet|ontbreekt|vul.*aan|casus.*aanvull)/i.test(source)) {
    return "Maak casus compleet";
  }
  if (/opvragen|informatie vragen|info nodig|aanvullende informatie/i.test(source)) {
    return "Vraag gegevens op";
  }
  if (/start matching|matching/i.test(source)) {
    return "Start matching";
  }
  if (/verstuur|stuur.+aanbieder|naar aanbieder/i.test(source)) {
    return "Verstuur naar aanbieder";
  }
  if (/volg.+aanbieder|reactie op|aanbiederreactie/i.test(source)) {
    return "Volg aanbiederreactie op";
  }
  if (/bevestig.+plaatsing|plaatsing/i.test(source)) {
    return "Bevestig plaatsing";
  }
  if (/plan.+intake|intake/i.test(source)) {
    return "Plan intake";
  }
  if (task.actionStatus === "overdue" || task.actionStatus === "today") {
    return "Maak casus compleet";
  }
  return "Maak casus compleet";
}

export function ActiesPage({ onCaseClick, onNavigateToCasussen }: ActiesPageProps) {
  const { me } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const [listTab, setListTab] = useState<ListTab>("all");
  const [dueBucket, setDueBucket] = useState<DueBucketFilter>("all");
  const [prioritySelected, setPrioritySelected] = useState<Set<TaskPriorityKey>>(
    () => new Set(PRIORITY_KEYS),
  );

  const { tasks, loading, error, refetch } = useTasks({ q: searchQuery });

  const openTasks = useMemo(() => tasks.filter(isOpenCareTask), [tasks]);

  const scopedTasks = useMemo(
    () => applyListTab(openTasks, listTab, me?.fullName),
    [openTasks, listTab, me?.fullName],
  );

  const filteredTasks = useMemo(() => {
    let list = scopedTasks.filter((t) => passesDueBucket(t, dueBucket));
    list = list.filter((t) => passesPrioritySet(t, prioritySelected));
    return list;
  }, [scopedTasks, dueBucket, prioritySelected]);

  const sortedTasks = useMemo(() => sortTasksByUrgency(filteredTasks), [filteredTasks]);
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
    setListTab("all");
    setDueBucket("all");
    setPrioritySelected(new Set(PRIORITY_KEYS));
  };

  const selectTriggerClass =
    "h-10 border-border bg-card text-foreground hover:bg-muted/35 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30";

  const hasOpenActions = !loading && !error && openTasks.length > 0;
  const hasVisibleActions = !loading && !error && sortedTasks.length > 0;
  const emptyByDefault = !loading && !error && openTasks.length === 0;
  const emptyByFilters = !loading && !error && openTasks.length > 0 && sortedTasks.length === 0;
  const topTask = sortedTasks[0];

  return (
    <CarePageScaffold
      archetype="queue"
      className="pb-8"
      title="Acties"
      subtitle="Volg taken op die jouw beslissing of opvolging vragen."
      titleClassName="text-[32px] sm:text-[36px] lg:text-[38px]"
      dominantAction={
        hasVisibleActions && topTask ? (
          <CareAlertCard
            density="compact"
            testId="acties-dominant-action"
            tone="warning"
            icon={<AlertCircle size={18} aria-hidden />}
            metric={0}
            showMetric={false}
            title={`${sortedTasks.length} actie${sortedTasks.length === 1 ? " vraagt" : " vragen"} opvolging`}
            description={`${taskStatusLabel(topTask)} · ${taskReasonLabel(topTask)}. ${topTask.caseTitle?.trim() ? topTask.caseTitle : "Deze casus"} vraagt opvolging.`}
            primaryAction={(
              <PrimaryActionButton
                type="button"
                className="h-10 rounded-full px-5 text-[13px] font-semibold"
                onClick={() => onCaseClick(topTask.linkedCaseId)}
              >
                {taskNextActionLabel(topTask)}
                <ArrowRight size={16} aria-hidden className="ml-2" />
              </PrimaryActionButton>
            )}
          />
        ) : undefined
      }
    >
      {loading && <LoadingState title="Acties laden…" copy="Takenlijst wordt opgebouwd." />}
      {!loading && error && (
        <ErrorState
          title="Kon acties niet laden"
          copy={error}
          action={<Button variant="outline" onClick={() => refetch()}>Opnieuw proberen</Button>}
        />
      )}

      {!loading && !error && (
        <CareWorkspaceSection
          testId="acties-uitvoerlijst"
          aria-labelledby="acties-werkvoorraad-heading"
          bodyBleedX
          header={(
            <CareSectionHeader
              className="lg:flex-col lg:items-stretch"
              title={<span id="acties-werkvoorraad-heading">Werkvoorraad</span>}
              meta={(
                <CareSearchFiltersBar
                  variant="workspace"
                  className="px-0"
                  searchValue={searchQuery}
                  onSearchChange={setSearchQuery}
                  searchPlaceholder="Zoek taken of casus-ID..."
                  showSecondaryFilters={showSecondaryFilters}
                  onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
                  secondaryFiltersLabel="Filters"
                  secondaryFilters={(
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] leading-snug text-muted-foreground">
                          Gebruik de filters om te schakelen tussen eigen werk, opvolging en urgentie.
                        </p>
                        <CareQueueInlineAction type="button" onClick={clearSidebarFilters}>
                          Wissen
                        </CareQueueInlineAction>
                      </div>
                      <div className="grid items-end gap-2 md:grid-cols-2">
                        <label className="flex min-w-0 flex-col gap-1">
                          <span className="text-[11px] font-medium text-muted-foreground">Weergave</span>
                          <CareOperationalSelect
                            aria-label="Weergave"
                            value={listTab}
                            onChange={(event) => setListTab(event.target.value as ListTab)}
                            className={selectTriggerClass}
                          >
                            <option value="mine">Mijn acties</option>
                            <option value="waiting">Wacht op mij</option>
                            <option value="all">Alle acties</option>
                          </CareOperationalSelect>
                        </label>
                        <label className="flex min-w-0 flex-col gap-1">
                          <span className="text-[11px] font-medium text-muted-foreground">Vervalt</span>
                          <CareOperationalSelect
                            aria-label="Vervalt"
                            value={dueBucket}
                            onChange={(event) => setDueBucket(event.target.value as DueBucketFilter)}
                            className={selectTriggerClass}
                          >
                            <option value="all">Alle</option>
                            <option value="overdue">Te laat</option>
                            <option value="today">Vandaag</option>
                            <option value="week">Deze week</option>
                          </CareOperationalSelect>
                        </label>
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
                    </div>
                  )}
                />
              )}
            />
          )}
        >
          <CareWorkListCard
            header={
              <CareOperationalQueueHeader
                labels={["Urgentie", "Taak", "Casus", "Status", "Opvolging", "Volgende actie"]}
              />
            }
          >
            {emptyByDefault ? (
              <div className="p-4 md:p-5">
                <EmptyState
                  title="Geen openstaande acties"
                  copy="Er zijn geen taken die jouw beslissing of opvolging vragen."
                  action={
                    onNavigateToCasussen ? (
                      <CareQueueInlineAction
                        type="button"
                        onClick={onNavigateToCasussen}
                      >
                        Bekijk actieve casussen
                      </CareQueueInlineAction>
                    ) : undefined
                  }
                />
              </div>
            ) : emptyByFilters ? (
              <div className="p-4 md:p-5">
                <EmptyState
                  title="Geen acties in dit filter"
                  copy="Wis filters of kies een andere weergave."
                  action={<CareQueueInlineAction type="button" onClick={clearSidebarFilters}>Wis filters</CareQueueInlineAction>}
                />
              </div>
            ) : (
              <CarePrimaryList>
                {sortedTasks.map((task) => {
                  const priority = normalizeTaskPriority(task.priority);
                  const ui = PRIORITY_UI[priority];
                  const nextActionLabel = taskNextActionLabel(task);
                  const actionStatusTone =
                    task.actionStatus === "overdue"
                      ? "critical"
                      : task.actionStatus === "today"
                        ? "warning"
                        : "neutral";
                  return (
                    <CareWorkRow
                      key={task.id}
                      titleAriaLabel={task.title}
                      leading={priorityLeading(task)}
                      title={<span className="block truncate text-[18px] font-semibold tracking-tight text-foreground">{task.title}</span>}
                      context={(
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <CareMetaChip>{formatCasReference(task.linkedCaseId)}</CareMetaChip>
                          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                            {task.caseTitle?.trim() ? task.caseTitle : "Onbekende casus"}
                          </span>
                        </div>
                      )}
                      status={
                        <CareDominantStatus className={ui.chipClass}>{taskStatusLabel(task)}</CareDominantStatus>
                      }
                      owner={
                        <div className="min-w-0 truncate">
                          Taakopvolger: {task.assignedTo?.trim() ? task.assignedTo : "Onbekend"}
                        </div>
                      }
                      nextAction={
                        <div className="min-w-0 truncate">
                          Volgende actie: {nextActionLabel}
                        </div>
                      }
                      time={
                        <div className="min-w-0 truncate">
                          Laatste activiteit: {formatRelativeActivity(task.createdAt)}
                        </div>
                      }
                      contextInfo={
                        <div className="min-w-0 truncate text-muted-foreground/75">
                          Reden: {getShortReasonLabel(task.description || task.status || "Opvolging nodig", 56)}
                        </div>
                      }
                      actionLabel={nextActionLabel}
                      onOpen={() => onCaseClick(task.linkedCaseId)}
                      onAction={(event) => {
                        event.stopPropagation();
                        onCaseClick(task.linkedCaseId);
                      }}
                      accentTone={actionStatusTone}
                      actionVariant={task.actionStatus === "overdue" || task.actionStatus === "today" ? "primary" : "ghost"}
                    />
                  );
                })}
              </CarePrimaryList>
            )}
          </CareWorkListCard>
        </CareWorkspaceSection>
      )}
    </CarePageScaffold>
  );
}
