import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
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
  CareDominantStatus,
  CareOperationalSelect,
  CareQueueInlineAction,
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
  CareWorklistFilterPanel,
  CareWorklistColumnHeader,
  CareWorklistBody,
  CareWorklistRow,
  CareWorklistRowAction,
  CareWorklistPagination,
  ROW_ACTION_CLASSES,
} from "./CareCommandPrimitives";

interface ActiesPageProps {
  onCaseClick: (caseId: string) => void;
  onNavigateToCasussen?: () => void;
}

type ListTab = "all" | "mine" | "waiting";
type DueBucketFilter = "all" | "overdue" | "today" | "week";

const PRIORITY_KEYS: TaskPriorityKey[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

const PRIORITY_UI: Record<TaskPriorityKey, { label: string; chipClass: string }> = {
  URGENT: { label: "Kritiek", chipClass: "border bg-care-urgent-bg text-care-urgent-text border-care-urgent-border" },
  HIGH: { label: "Hoog", chipClass: "border bg-care-warning-bg text-care-warning-text border-care-warning-border" },
  MEDIUM: { label: "Gemiddeld", chipClass: "border bg-care-info-bg text-care-info-text border-care-info-border" },
  LOW: { label: "Laag", chipClass: "border-slate-500/35 bg-muted/20 text-slate-200" },
};

const ACTIES_TABS: Array<{ id: ListTab; label: string }> = [
  { id: "all", label: "Alle acties" },
  { id: "mine", label: "Mijn acties" },
  { id: "waiting", label: "Wacht op mij" },
];

const ACTIES_COLS = "5rem minmax(12rem,2fr) minmax(9rem,1.3fr) minmax(7rem,1fr) minmax(9rem,1fr)";

function formatCasReference(linkedCaseId: string): string {
  if (!linkedCaseId) return "—";
  const y = new Date().getFullYear();
  const compact = linkedCaseId.replace(/-/g, "");
  const tail = (compact.slice(-6) || compact).toUpperCase();
  return `CAS-${y}-${tail}`;
}

function formatRelativeActivity(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "Onbekend";
  const diffHours = Math.max(0, Date.now() - created.getTime()) / (60 * 60 * 1000);
  if (diffHours < 24) return `${Math.max(1, Math.round(diffHours))} uur geleden`;
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
  if (!task.dueDate || task.actionStatus === "overdue" || task.actionStatus === "today") return false;
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
  const base: Record<TaskPriorityKey, number> = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const t of tasks) {
    base[normalizeTaskPriority(t.priority)] += 1;
  }
  return base;
}

function taskStatusLabel(task: SpaTask): string {
  if (task.actionStatus === "overdue") return "Te laat";
  if (task.actionStatus === "today") return "Vandaag";
  if (task.actionStatus === "upcoming") return "Binnenkort";
  return "Afgerond";
}

function taskNextActionLabel(task: SpaTask): string {
  const source = `${task.title} ${task.description}`.toLowerCase();
  if (/(casusgegevens|casus.*invull|aanvraag.*invull|casus.*compleet|aanvraag.*compleet|ontbreekt|vul.*aan|casus.*aanvull)/i.test(source)) return "Maak casus compleet";
  if (/opvragen|informatie vragen|info nodig|aanvullende informatie/i.test(source)) return "Vraag gegevens op";
  if (/start matching|matching/i.test(source)) return "Start matching";
  if (/verstuur|stuur.+aanbieder|naar aanbieder/i.test(source)) return "Verstuur naar aanbieder";
  if (/volg.+aanbieder|reactie op|aanbiederreactie/i.test(source)) return "Volg aanbiederreactie op";
  if (/bevestig.+plaatsing|plaatsing/i.test(source)) return "Bevestig plaatsing";
  if (/plan.+intake|intake/i.test(source)) return "Plan intake";
  return "Maak casus compleet";
}

export function ActiesPage({ onCaseClick, onNavigateToCasussen }: ActiesPageProps) {
  const { me } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [listTab, setListTab] = useState<ListTab>("all");
  const [dueBucket, setDueBucket] = useState<DueBucketFilter>("all");
  const [prioritySelected, setPrioritySelected] = useState<Set<TaskPriorityKey>>(() => new Set(PRIORITY_KEYS));

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

  const clearFilters = () => {
    setSearchQuery("");
    setListTab("all");
    setDueBucket("all");
    setPrioritySelected(new Set(PRIORITY_KEYS));
  };

  const filtersActive = listTab !== "all" || dueBucket !== "all" || prioritySelected.size < PRIORITY_KEYS.length;
  const tabs = ACTIES_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    count: applyListTab(openTasks, t.id, me?.fullName).length,
  }));

  return (
    <CareCommandShell
      title="Acties"
    >
      <CareMetricStrip>
        <CareMetricCard
          value={pc.URGENT}
          label="Kritiek"
          tone="urgent"
          isActive={prioritySelected.size === 1 && prioritySelected.has("URGENT")}
          onClick={() => {
            if (prioritySelected.size === 1 && prioritySelected.has("URGENT")) {
              setPrioritySelected(new Set(PRIORITY_KEYS));
            } else {
              setPrioritySelected(new Set(["URGENT"]));
            }
          }}
        />
        <CareMetricCard
          value={pc.HIGH}
          label="Hoog"
          tone="warning"
          isActive={prioritySelected.size === 1 && prioritySelected.has("HIGH")}
          onClick={() => {
            if (prioritySelected.size === 1 && prioritySelected.has("HIGH")) {
              setPrioritySelected(new Set(PRIORITY_KEYS));
            } else {
              setPrioritySelected(new Set(["HIGH"]));
            }
          }}
        />
        <CareMetricCard
          value={openTasks.length}
          label="Alle open acties"
          tone="neutral"
          isActive={listTab === "all" && !filtersActive}
          onClick={clearFilters}
        />
      </CareMetricStrip>

      {loading && <LoadingState title="Acties laden…" copy="Takenlijst wordt opgebouwd." />}
      {!loading && error && (
        <ErrorState
          title="Kon acties niet laden"
          copy={error}
          action={<Button variant="outline" onClick={() => refetch()}>Opnieuw proberen</Button>}
        />
      )}

      {!loading && !error && (
        <CareWorklist testId="acties-uitvoerlijst">
          <CareWorklistTabs
            tabs={tabs}
            activeId={listTab}
            onChange={(id) => setListTab(id as ListTab)}
          />

          <CareWorklistToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Zoek taken of casus-ID..."
            filtersActive={filtersActive}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters((v) => !v)}
          />

          <CareWorklistFilterPanel open={showFilters}>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] text-muted-foreground">Gebruik de filters om te schakelen tussen eigen werk, opvolging en urgentie.</p>
                <CareQueueInlineAction type="button" onClick={clearFilters}>Wissen</CareQueueInlineAction>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
                  Vervalt
                  <CareOperationalSelect
                    aria-label="Vervalt"
                    value={dueBucket}
                    onChange={(e) => setDueBucket(e.target.value as DueBucketFilter)}
                  >
                    <option value="all">Alle</option>
                    <option value="overdue">Te laat</option>
                    <option value="today">Vandaag</option>
                    <option value="week">Deze week</option>
                  </CareOperationalSelect>
                </label>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Urgentie</p>
                {PRIORITY_KEYS.map((key) => (
                  <label key={key} className="flex cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-border/40 bg-background/30 px-2.5 py-2 text-[13px]">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={prioritySelected.has(key)} onChange={() => togglePriority(key)} className="size-4 rounded border-border accent-primary" />
                      <span className="font-medium text-foreground">{PRIORITY_UI[key].label}</span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">{pc[key]}</span>
                  </label>
                ))}
              </div>
            </div>
          </CareWorklistFilterPanel>

          <div className="overflow-x-auto">
            <CareWorklistColumnHeader
              columns={["Urgentie", "Taak", "Casus", "Status", "Actie"]}
              cols={ACTIES_COLS}
              minWidth="800px"
            />
            <CareWorklistBody>
              {openTasks.length === 0 ? (
                <EmptyState
                  title="Geen openstaande acties"
                  copy="Er zijn geen taken die jouw beslissing of opvolging vragen."
                  action={onNavigateToCasussen ? (
                    <CareQueueInlineAction type="button" onClick={onNavigateToCasussen}>Bekijk actieve casussen</CareQueueInlineAction>
                  ) : undefined}
                />
              ) : sortedTasks.length === 0 ? (
                <EmptyState
                  title="Geen acties in dit filter"
                  copy="Wis filters of kies een andere weergave."
                  action={<CareQueueInlineAction type="button" onClick={clearFilters}>Wis filters</CareQueueInlineAction>}
                />
              ) : sortedTasks.map((task) => {
                const priority = normalizeTaskPriority(task.priority);
                const ui = PRIORITY_UI[priority];
                const nextActionLabel = taskNextActionLabel(task);
                const accentTone = task.actionStatus === "overdue" ? "urgent" as const : task.actionStatus === "today" ? "warning" as const : "neutral" as const;
                const actionClass = task.actionStatus === "overdue" || task.actionStatus === "today" ? ROW_ACTION_CLASSES.primary : ROW_ACTION_CLASSES.default;

                return (
                  <CareWorklistRow
                    key={task.id}
                    cols={ACTIES_COLS}
                    minWidth="800px"
                    accentTone={accentTone}
                    onRowClick={() => onCaseClick(task.linkedCaseId)}
                  >
                    {/* Urgentie */}
                    <div className="flex items-start">
                      <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium", ui.chipClass)}>
                        {ui.label}
                      </span>
                    </div>

                    {/* Taak */}
                    <div className="min-w-0">
                      <span className="block truncate text-[13px] font-medium leading-tight text-foreground">{task.title}</span>
                      {task.description && (
                        <span className="block line-clamp-1 text-[11px] text-muted-foreground/80">
                          {getShortReasonLabel(task.description, 56)}
                        </span>
                      )}
                      <span className="block text-[11px] text-muted-foreground/60">{formatRelativeActivity(task.createdAt)}</span>
                    </div>

                    {/* Casus */}
                    <div className="min-w-0">
                      <span className="block truncate font-mono text-[12px] font-medium text-foreground">{formatCasReference(task.linkedCaseId)}</span>
                      {task.caseTitle?.trim() && (
                        <span className="block truncate text-[11px] text-muted-foreground/80">{task.caseTitle}</span>
                      )}
                      {task.assignedTo?.trim() && (
                        <span className="block truncate text-[11px] text-muted-foreground/60">{task.assignedTo}</span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex items-start">
                      <CareDominantStatus className={ui.chipClass}>{taskStatusLabel(task)}</CareDominantStatus>
                    </div>

                    {/* Actie */}
                    <CareWorklistRowAction>
                      <button
                        type="button"
                        className={actionClass}
                        onClick={(e) => { e.stopPropagation(); onCaseClick(task.linkedCaseId); }}
                      >
                        {nextActionLabel}
                        <ChevronRight size={12} className="shrink-0 opacity-60" aria-hidden />
                      </button>
                    </CareWorklistRowAction>
                  </CareWorklistRow>
                );
              })}
            </CareWorklistBody>
          </div>

          <CareWorklistPagination count={sortedTasks.length} singular="actie" plural="acties" />
        </CareWorklist>
      )}
    </CareCommandShell>
  );
}
