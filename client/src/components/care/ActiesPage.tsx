import { useState } from "react";
import { Search, SlidersHorizontal, ChevronRight, Clock, AlertTriangle, CheckCircle2, Phone, Mail, FileText, UserPlus, GitMerge, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { useTasks, ActionStatus, SpaTask } from "../../hooks/useTasks";

type ActionType = "call" | "email" | "assessment" | "matching" | "placement" | "escalation";

interface ActiesPageProps {
  onCaseClick: (caseId: string) => void;
}

export function ActiesPage({ onCaseClick }: ActiesPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ActionStatus | "all">("all");

  const { tasks, loading, error, refetch } = useTasks({ q: searchQuery });

  const filteredActions = tasks
    .filter((action) => {
      if (selectedStatus !== "all" && action.actionStatus !== selectedStatus) return false;
      if (searchQuery && !action.title.toLowerCase().includes(searchQuery.toLowerCase()) && !action.linkedCaseId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .filter((action) => action.actionStatus !== "completed");

  const groupedActions = {
    overdue: filteredActions.filter((action) => action.actionStatus === "overdue"),
    today: filteredActions.filter((action) => action.actionStatus === "today"),
    upcoming: filteredActions.filter((action) => action.actionStatus === "upcoming")
  };

  const getActionIcon = (title: string) => {
    const normalized = title.toLowerCase();
    if (normalized.includes("bel") || normalized.includes("call")) return <Phone size={18} className="text-blue-400" />;
    if (normalized.includes("mail") || normalized.includes("e-mail")) return <Mail size={18} className="text-green-400" />;
    if (normalized.includes("beoord")) return <FileText size={18} className="text-purple-400" />;
    if (normalized.includes("match")) return <GitMerge size={18} className="text-amber-400" />;
    if (normalized.includes("plaats")) return <UserPlus size={18} className="text-green-400" />;
    return <AlertTriangle size={18} className="text-red-400" />;
  };

  const renderActionGroup = (title: string, actions: SpaTask[], color: string) => {
    if (actions.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${color}`}>{actions.length}</span>
        </div>
        {actions.map((action) => (
          <div key={action.id} role="button" tabIndex={0} onClick={() => onCaseClick(action.linkedCaseId)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCaseClick(action.linkedCaseId); } }} className="w-full premium-card p-4 hover:bg-muted/20 transition-all text-left group border-l-4 border-l-primary cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">{getActionIcon(action.title)}</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.description}</p>
                <div className="flex items-center gap-4 text-xs mt-3">
                  <span className="text-primary hover:underline font-medium cursor-pointer" onClick={(event) => { event.stopPropagation(); onCaseClick(action.linkedCaseId); }}>{action.linkedCaseId}</span>
                  <span className="text-muted-foreground">{action.caseTitle}</span>
                  <div className="flex items-center gap-1 text-muted-foreground"><Clock size={12} />{action.dueDate}</div>
                  {action.assignedTo && <span className="text-muted-foreground">@ {action.assignedTo}</span>}
                </div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">Acties</h1>
        <p className="text-muted-foreground">Taken en actiepunten · {groupedActions.overdue.length} te laat · {groupedActions.today.length} vandaag · {groupedActions.upcoming.length} binnenkort</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <button onClick={() => setSelectedStatus(selectedStatus === "overdue" ? "all" : "overdue")} className={`premium-card p-4 text-left ${selectedStatus === "overdue" ? "border-2 border-red-500" : ""}`}>
          <p className="text-2xl font-bold text-foreground mb-1">{groupedActions.overdue.length}</p>
          <p className="text-sm text-muted-foreground">Te laat</p>
        </button>
        <button onClick={() => setSelectedStatus(selectedStatus === "today" ? "all" : "today")} className={`premium-card p-4 text-left ${selectedStatus === "today" ? "border-2 border-amber-500" : ""}`}>
          <p className="text-2xl font-bold text-foreground mb-1">{groupedActions.today.length}</p>
          <p className="text-sm text-muted-foreground">Vandaag</p>
        </button>
        <button onClick={() => setSelectedStatus(selectedStatus === "upcoming" ? "all" : "upcoming")} className={`premium-card p-4 text-left ${selectedStatus === "upcoming" ? "border-2 border-blue-500" : ""}`}>
          <p className="text-2xl font-bold text-foreground mb-1">{groupedActions.upcoming.length}</p>
          <p className="text-sm text-muted-foreground">Binnenkort</p>
        </button>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Zoek acties of casus ID..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-muted-foreground/20 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors" />
        </div>


        <Button variant="outline" className="border-2 border-muted-foreground/20">
          <SlidersHorizontal size={18} />
          Meer filters
        </Button>
      </div>

      <div className="space-y-8">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" />
            <span>Acties laden…</span>
          </div>
        )}
        {error && (
          <div className="premium-card p-6 text-center text-destructive space-y-2">
            <p>Kon acties niet laden: {error}</p>
            <Button variant="outline" size="sm" onClick={refetch}>Opnieuw proberen</Button>
          </div>
        )}
        {!loading && !error && renderActionGroup("Te laat", groupedActions.overdue, "bg-red-500/10 text-red-400")}
        {!loading && !error && renderActionGroup("Vandaag", groupedActions.today, "bg-amber-500/10 text-amber-400")}
        {!loading && !error && renderActionGroup("Binnenkort", groupedActions.upcoming, "bg-blue-500/10 text-blue-400")}
        {!loading && !error && filteredActions.length === 0 && (
          <div className="premium-card p-12 text-center">
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-semibold text-foreground">Geen openstaande acties</h3>
              <p className="text-muted-foreground">Alle taken zijn voltooid.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
