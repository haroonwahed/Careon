import { useState, type MouseEvent } from "react";
import { Clock, AlertTriangle, Phone, Mail, FileText, UserPlus, GitMerge, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { useTasks, ActionStatus, SpaTask } from "../../hooks/useTasks";
import { countOpenCareTasks, isOpenCareTask } from "../../lib/actiesTaskSemantics";
import { CareEmptyState } from "./CareSurface";
import {
  CareDominantStatus,
  CareMetaChip,
  CarePageTemplate,
  CarePrimaryList,
  CareSearchFiltersBar,
  CareUnifiedHeader,
  CareWorkRow,
} from "./CareUnifiedPage";

interface ActiesPageProps {
  onCaseClick: (caseId: string) => void;
}

export function ActiesPage({ onCaseClick }: ActiesPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ActionStatus | "all">("all");
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);

  const { tasks, loading, error, refetch } = useTasks({ q: searchQuery });

  const openTasks = tasks.filter(isOpenCareTask);
  const openTaskTotal = countOpenCareTasks(tasks);
  const filteredActions = openTasks
    .filter((action) => {
      if (selectedStatus !== "all" && action.actionStatus !== selectedStatus) return false;
      if (searchQuery && !action.title.toLowerCase().includes(searchQuery.toLowerCase()) && !action.linkedCaseId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

  const quickFilterBtn = (selected: boolean, tone: "overdue" | "today" | "upcoming") =>
    cn(
      "rounded-xl border border-border/70 bg-card/75 p-4 text-left transition-colors hover:bg-card/90",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      selected && tone === "overdue" && "border-destructive/80 bg-destructive/5",
      selected && tone === "today" && "border-amber-500/70 bg-amber-500/5",
      selected && tone === "upcoming" && "border-blue-500/60 bg-blue-500/5",
    );

  const groupedActions = {
    overdue: filteredActions.filter((action) => action.actionStatus === "overdue"),
    today: filteredActions.filter((action) => action.actionStatus === "today"),
    upcoming: filteredActions.filter((action) => action.actionStatus === "upcoming")
  };

  const getActionIcon = (title: string) => {
    const normalized = title.toLowerCase();
    if (normalized.includes("bel") || normalized.includes("call")) return <Phone className="size-4 shrink-0 text-blue-400" aria-hidden />;
    if (normalized.includes("mail") || normalized.includes("e-mail")) return <Mail className="size-4 shrink-0 text-green-400" aria-hidden />;
    if (normalized.includes("beoord")) return <FileText className="size-4 shrink-0 text-purple-400" aria-hidden />;
    if (normalized.includes("match")) return <GitMerge className="size-4 shrink-0 text-amber-400" aria-hidden />;
    if (normalized.includes("plaats")) return <UserPlus className="size-4 shrink-0 text-emerald-400" aria-hidden />;
    return <AlertTriangle className="size-4 shrink-0 text-red-400" aria-hidden />;
  };

  const renderActionGroup = (sectionTitle: string, actions: SpaTask[], countToneClass: string) => {
    if (actions.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[15px] font-semibold text-foreground">{sectionTitle}</h2>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${countToneClass}`}>{actions.length}</span>
        </div>
        <CarePrimaryList>
          {actions.map((action) => (
            <CareWorkRow
              key={action.id}
              leading={getActionIcon(action.title)}
              title={action.title}
              context={action.description || "—"}
              status={
                <CareDominantStatus
                  className={
                    action.actionStatus === "overdue"
                      ? "border-destructive/35 bg-destructive/10 text-destructive"
                      : action.actionStatus === "today"
                        ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                        : "border-blue-500/35 bg-blue-500/10 text-blue-100"
                  }
                >
                  {action.actionStatus === "overdue" ? "Te laat" : action.actionStatus === "today" ? "Vandaag" : "Binnenkort"}
                </CareDominantStatus>
              }
              time={
                <CareMetaChip>
                  <Clock size={12} aria-hidden />
                  {action.dueDate}
                </CareMetaChip>
              }
              contextInfo={
                <>
                  <CareMetaChip>{action.linkedCaseId}</CareMetaChip>
                  {action.caseTitle ? <CareMetaChip>{action.caseTitle}</CareMetaChip> : null}
                  {action.assignedTo ? <CareMetaChip>@ {action.assignedTo}</CareMetaChip> : null}
                </>
              }
              actionLabel="Open casus →"
              onOpen={() => onCaseClick(action.linkedCaseId)}
              onAction={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                onCaseClick(action.linkedCaseId);
              }}
              accentTone={action.actionStatus === "overdue" ? "critical" : action.actionStatus === "today" ? "warning" : "neutral"}
            />
          ))}
        </CarePrimaryList>
      </div>
    );
  };

  return (
    <CarePageTemplate
      className="pb-8"
      header={
        <CareUnifiedHeader
          title="Acties"
          subtitle={`Taken en actiepunten · ${groupedActions.overdue.length} te laat · ${groupedActions.today.length} vandaag · ${groupedActions.upcoming.length} binnenkort`}
        />
      }
      filters={
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 px-1">
            <button
              type="button"
              onClick={() => setSelectedStatus(selectedStatus === "overdue" ? "all" : "overdue")}
              className={quickFilterBtn(selectedStatus === "overdue", "overdue")}
            >
              <p className="text-2xl font-bold text-foreground mb-1">{groupedActions.overdue.length}</p>
              <p className="text-sm text-muted-foreground">Te laat</p>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus(selectedStatus === "today" ? "all" : "today")}
              className={quickFilterBtn(selectedStatus === "today", "today")}
            >
              <p className="text-2xl font-bold text-foreground mb-1">{groupedActions.today.length}</p>
              <p className="text-sm text-muted-foreground">Vandaag</p>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus(selectedStatus === "upcoming" ? "all" : "upcoming")}
              className={quickFilterBtn(selectedStatus === "upcoming", "upcoming")}
            >
              <p className="text-2xl font-bold text-foreground mb-1">{groupedActions.upcoming.length}</p>
              <p className="text-sm text-muted-foreground">Binnenkort</p>
            </button>
          </div>
          <CareSearchFiltersBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Zoek acties of casus ID..."
            showSecondaryFilters={showSecondaryFilters}
            onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
            secondaryFilters={<p className="text-sm text-muted-foreground">Geen aanvullende filters beschikbaar.</p>}
          />
        </div>
      }
    >
      <div className="space-y-8">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" />
            <span>Acties laden…</span>
          </div>
        )}
        {error && (
          <CareEmptyState
            title="Kon acties niet laden"
            copy={error}
            action={<Button variant="outline" size="sm" onClick={refetch}>Opnieuw proberen</Button>}
            className="border-destructive/35 bg-destructive/5"
          />
        )}
        {!loading && !error && renderActionGroup("Te laat", groupedActions.overdue, "bg-red-500/10 text-red-400")}
        {!loading && !error && renderActionGroup("Vandaag", groupedActions.today, "bg-amber-500/10 text-amber-400")}
        {!loading && !error && renderActionGroup("Binnenkort", groupedActions.upcoming, "bg-blue-500/10 text-blue-400")}
        {!loading && !error && filteredActions.length === 0 && (
          <CareEmptyState
            title="Geen openstaande acties"
            copy={
              searchQuery.trim() || selectedStatus !== "all"
                ? `Er zijn ${openTaskTotal} openstaande ${openTaskTotal === 1 ? "taak" : "taken"} in totaal. Pas de zoekopdracht of snelfilter aan om resultaten te zien.`
                : "Alle taken zijn voltooid."
            }
          />
        )}
      </div>
    </CarePageTemplate>
  );
}
