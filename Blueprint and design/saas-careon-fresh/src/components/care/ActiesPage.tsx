import { useState } from "react";
import { 
  Search, 
  SlidersHorizontal,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Mail,
  FileText,
  UserPlus,
  GitMerge,
  X
} from "lucide-react";
import { Button } from "../ui/button";

type ActionStatus = "overdue" | "today" | "upcoming" | "completed";
type ActionType = "call" | "email" | "assessment" | "matching" | "placement" | "escalation";

interface Action {
  id: string;
  type: ActionType;
  status: ActionStatus;
  title: string;
  description: string;
  linkedCaseId: string;
  caseTitle: string;
  dueDate: string;
  assignedTo?: string;
  priority: "high" | "medium" | "low";
}

const mockActions: Action[] = [
  {
    id: "A-001",
    type: "call",
    status: "overdue",
    title: "Bel beoordelaar",
    description: "Beoordeling loopt 5 dagen vertraging. Neem contact op met Dr. P. Bakker.",
    linkedCaseId: "C-001",
    caseTitle: "Jeugd 14 – Complex gedrag",
    dueDate: "12 apr 2026",
    assignedTo: "Jane Doe",
    priority: "high"
  },
  {
    id: "A-002",
    type: "escalation",
    status: "overdue",
    title: "Escaleer capaciteitstekort",
    description: "Geen beschikbare aanbieders in regio. Escaleer naar capaciteitsmanager.",
    linkedCaseId: "C-004",
    caseTitle: "Jeugd 9 – ADHD + emotionele problematiek",
    dueDate: "13 apr 2026",
    assignedTo: "Jane Doe",
    priority: "high"
  },
  {
    id: "A-003",
    type: "matching",
    status: "today",
    title: "Start matching",
    description: "Beoordeling is afgerond. Klaar om matching te starten.",
    linkedCaseId: "C-002",
    caseTitle: "Jeugd 11 – Licht verstandelijke beperking",
    dueDate: "17 apr 2026",
    assignedTo: "Jane Doe",
    priority: "high"
  },
  {
    id: "A-004",
    type: "placement",
    status: "today",
    title: "Bevestig plaatsing",
    description: "Aanbieder heeft match geaccepteerd. Plan intake gesprek.",
    linkedCaseId: "C-003",
    caseTitle: "Jeugd 16 – Autisme spectrum",
    dueDate: "17 apr 2026",
    assignedTo: "Jane Doe",
    priority: "medium"
  },
  {
    id: "A-005",
    type: "email",
    status: "today",
    title: "Verstuur update naar ouders",
    description: "Informeer ouders over voortgang matching proces.",
    linkedCaseId: "C-002",
    caseTitle: "Jeugd 11 – Licht verstandelijke beperking",
    dueDate: "17 apr 2026",
    assignedTo: "Jane Doe",
    priority: "medium"
  },
  {
    id: "A-006",
    type: "assessment",
    status: "upcoming",
    title: "Voltooi psychiatrische beoordeling",
    description: "Psychiatrische diagnose vereist voor klinische behandeling.",
    linkedCaseId: "C-005",
    caseTitle: "Jeugd 13 – Trauma & angststoornis",
    dueDate: "19 apr 2026",
    assignedTo: "Dr. M. van der Berg",
    priority: "high"
  },
  {
    id: "A-007",
    type: "matching",
    status: "upcoming",
    title: "Heroverweeg zorgvraag",
    description: "Meerdere aanbieders hebben match afgewezen. Mogelijk onrealistische verwachtingen.",
    linkedCaseId: "C-004",
    caseTitle: "Jeugd 9 – ADHD + emotionele problematiek",
    dueDate: "20 apr 2026",
    assignedTo: "Jane Doe",
    priority: "medium"
  }
];

export function ActiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ActionStatus | "all">("all");
  const [selectedType, setSelectedType] = useState<ActionType | "all">("all");

  const filteredActions = mockActions
    .filter(action => {
      if (selectedStatus !== "all" && action.status !== selectedStatus) return false;
      if (selectedType !== "all" && action.type !== selectedType) return false;
      if (searchQuery && !action.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !action.linkedCaseId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .filter(a => a.status !== "completed"); // Only show active actions

  const groupedActions = {
    overdue: filteredActions.filter(a => a.status === "overdue"),
    today: filteredActions.filter(a => a.status === "today"),
    upcoming: filteredActions.filter(a => a.status === "upcoming")
  };

  const getActionIcon = (type: ActionType) => {
    switch (type) {
      case "call":
        return <Phone size={18} className="text-blue-400" />;
      case "email":
        return <Mail size={18} className="text-green-400" />;
      case "assessment":
        return <FileText size={18} className="text-purple-400" />;
      case "matching":
        return <GitMerge size={18} className="text-amber-400" />;
      case "placement":
        return <UserPlus size={18} className="text-green-400" />;
      case "escalation":
        return <AlertTriangle size={18} className="text-red-400" />;
    }
  };

  const getActionTypeLabel = (type: ActionType) => {
    const labels: Record<ActionType, string> = {
      call: "Bellen",
      email: "E-mail",
      assessment: "Beoordeling",
      matching: "Matching",
      placement: "Plaatsing",
      escalation: "Escalatie"
    };
    return labels[type];
  };

  const handleActionClick = (action: Action) => {
    console.log("Execute action:", action.id, "for case:", action.linkedCaseId);
    // This should open the Casus Control Center with the appropriate context
  };

  const renderActionGroup = (title: string, actions: Action[], color: string) => {
    if (actions.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${color}`}>
            {actions.length}
          </span>
        </div>

        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action)}
            className="w-full premium-card p-4 hover:bg-muted/20 transition-all text-left group border-l-4 border-l-primary"
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="flex-shrink-0 mt-1">
                {getActionIcon(action.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                      {action.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-4 text-xs mt-3">
                  <button className="text-primary hover:underline font-medium">
                    {action.linkedCaseId}
                  </button>
                  <span className="text-muted-foreground">
                    {action.caseTitle}
                  </span>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock size={12} />
                    {action.dueDate}
                  </div>
                  {action.assignedTo && (
                    <span className="text-muted-foreground">
                      @ {action.assignedTo}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    action.priority === "high" 
                      ? "bg-red-500/10 text-red-400"
                      : action.priority === "medium"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-blue-500/10 text-blue-400"
                  }`}>
                    {action.priority === "high" ? "Hoog" : action.priority === "medium" ? "Gemiddeld" : "Laag"}
                  </span>
                </div>
              </div>

              {/* Action Arrow */}
              <ChevronRight 
                size={18} 
                className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" 
              />
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Acties
        </h1>
        <p className="text-muted-foreground">
          Taken en actiepunten · {groupedActions.overdue.length} te laat · {groupedActions.today.length} vandaag · {groupedActions.upcoming.length} binnenkort
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setSelectedStatus(selectedStatus === "overdue" ? "all" : "overdue")}
          className={`premium-card p-4 text-left transition-all hover:scale-[1.02] ${
            selectedStatus === "overdue" ? "border-2 border-red-500 shadow-lg shadow-red-500/20" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">{groupedActions.overdue.length}</p>
          <p className="text-sm text-muted-foreground">Te laat</p>
        </button>

        <button
          onClick={() => setSelectedStatus(selectedStatus === "today" ? "all" : "today")}
          className={`premium-card p-4 text-left transition-all hover:scale-[1.02] ${
            selectedStatus === "today" ? "border-2 border-amber-500 shadow-lg shadow-amber-500/20" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock size={18} className="text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">{groupedActions.today.length}</p>
          <p className="text-sm text-muted-foreground">Vandaag</p>
        </button>

        <button
          onClick={() => setSelectedStatus(selectedStatus === "upcoming" ? "all" : "upcoming")}
          className={`premium-card p-4 text-left transition-all hover:scale-[1.02] ${
            selectedStatus === "upcoming" ? "border-2 border-blue-500 shadow-lg shadow-blue-500/20" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <CheckCircle2 size={18} className="text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">{groupedActions.upcoming.length}</p>
          <p className="text-sm text-muted-foreground">Binnenkort</p>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Zoek acties of casus ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-muted-foreground/20 
                     bg-background text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as ActionType | "all")}
          className="px-4 py-2 rounded-lg bg-card border border-border text-foreground text-sm"
        >
          <option value="all">Alle types</option>
          <option value="call">Bellen</option>
          <option value="email">E-mail</option>
          <option value="assessment">Beoordeling</option>
          <option value="matching">Matching</option>
          <option value="placement">Plaatsing</option>
          <option value="escalation">Escalatie</option>
        </select>

        <Button variant="outline" className="border-2 border-muted-foreground/20">
          <SlidersHorizontal size={18} />
          Meer filters
        </Button>
      </div>

      {/* Actions List - Grouped */}
      <div className="space-y-8">
        {renderActionGroup(
          "Te laat 🔴",
          groupedActions.overdue,
          "bg-red-500/10 text-red-400"
        )}

        {renderActionGroup(
          "Vandaag 📋",
          groupedActions.today,
          "bg-amber-500/10 text-amber-400"
        )}

        {renderActionGroup(
          "Binnenkort 📅",
          groupedActions.upcoming,
          "bg-blue-500/10 text-blue-400"
        )}

        {filteredActions.length === 0 && (
          <div className="premium-card p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div 
                className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)",
                  border: "2px solid rgba(34, 197, 94, 0.3)"
                }}
              >
                <CheckCircle2 size={40} className="text-green-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground">
                  Geen openstaande acties 🎯
                </h3>
                <p className="text-muted-foreground">
                  Alle taken zijn voltooid. Goed bezig!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
