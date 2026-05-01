import { useState, type MouseEvent } from "react";
import { Clock, AlertTriangle, Phone, Mail, FileText, UserPlus, GitMerge, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { useTasks, ActionStatus, SpaTask } from "../../hooks/useTasks";
import { countOpenCareTasks, isOpenCareTask } from "../../lib/actiesTaskSemantics";
import { CareEmptyState } from "./CareSurface";
import {
  CareDominantStatus,
  CareFilterTabButton,
  CareFilterTabGroup,
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
  const statusCounts = {
    overdue: openTasks.filter((t) => t.actionStatus === "overdue").length,
    today: openTasks.filter((t) => t.actionStatus === "today").length,
    upcoming: openTasks.filter((t) => t.actionStatus === "upcoming").length,
  };
  const filteredActions = openTasks
    .filter((action) => {
      if (selectedStatus !== "all" && action.actionStatus !== selectedStatus) return false;
      if (searchQuery && !action.title.toLowerCase().includes(searchQuery.toLowerCase()) && !action.linkedCaseId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

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
              actionLabel={action.actionStatus === "overdue" ? "Open casus nu" : "Open casus"}
              actionVariant={action.actionStatus === "overdue" || action.actionStatus === "today" ? "primary" : "ghost"}
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

  const toggleStatusFilter = (key: ActionStatus | "all") => {
    if (key === "all") {
      setSelectedStatus("all");
      return;
    }
    setSelectedStatus((current) => (current === key ? "all" : key));
  };

  return (
    <CarePageTemplate
      className="pb-8"
      header={
        <CareUnifiedHeader
          title="Acties"
          subtitle={`Taken en actiepunten · ${loading ? "…" : `${statusCounts.overdue} te laat · ${statusCounts.today} vandaag · ${statusCounts.upcoming} binnenkort`}`}
        />
      }
      filters={
        <CareSearchFiltersBar
          tabs={
            <CareFilterTabGroup aria-label="Status acties">
              <CareFilterTabButton selected={selectedStatus === "all"} onClick={() => toggleStatusFilter("all")}>
                Alles
              </CareFilterTabButton>
              <CareFilterTabButton
                selected={selectedStatus === "overdue"}
                onClick={() => toggleStatusFilter("overdue")}
              >
                Te laat ({loading ? "—" : statusCounts.overdue})
              </CareFilterTabButton>
              <CareFilterTabButton selected={selectedStatus === "today"} onClick={() => toggleStatusFilter("today")}>
                Vandaag ({loading ? "—" : statusCounts.today})
              </CareFilterTabButton>
              <CareFilterTabButton
                selected={selectedStatus === "upcoming"}
                onClick={() => toggleStatusFilter("upcoming")}
              >
                Binnenkort ({loading ? "—" : statusCounts.upcoming})
              </CareFilterTabButton>
            </CareFilterTabGroup>
          }
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Zoek acties of casus ID..."
          showSecondaryFilters={showSecondaryFilters}
          onToggleSecondaryFilters={() => setShowSecondaryFilters((current) => !current)}
          secondaryFilters={<p className="text-sm text-muted-foreground">Geen aanvullende filters beschikbaar.</p>}
        />
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
