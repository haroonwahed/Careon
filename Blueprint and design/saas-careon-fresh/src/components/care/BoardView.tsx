import { CaseData, CaseStatus } from "./CasussenPage";
import { 
  Inbox, 
  ClipboardList, 
  GitMerge, 
  CheckCircle2, 
  FileCheck,
  AlertTriangle,
  Clock
} from "lucide-react";

interface BoardViewProps {
  cases: CaseData[];
}

export function BoardView({ cases }: BoardViewProps) {
  const columns: { status: CaseStatus; label: string; icon: any; color: string }[] = [
    { status: "intake", label: "Intake", icon: Inbox, color: "blue" },
    { status: "beoordeling", label: "Beoordeling", icon: ClipboardList, color: "purple" },
    { status: "matching", label: "Matching", icon: GitMerge, color: "orange" },
    { status: "plaatsing", label: "Plaatsing", icon: CheckCircle2, color: "green" },
    { status: "afgerond", label: "Afgerond", icon: FileCheck, color: "gray" }
  ];

  const getCasesByStatus = (status: CaseStatus) => {
    return cases.filter(c => c.status === status);
  };

  const getColumnColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: "bg-blue-500/10 border-blue-500/20",
      purple: "bg-purple-500/10 border-purple-500/20",
      orange: "bg-orange-500/10 border-orange-500/20",
      green: "bg-green-500/10 border-green-500/20",
      gray: "bg-muted border-border"
    };
    return colors[color] || colors.gray;
  };

  const getHeaderColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: "text-blue-600 dark:text-blue-400",
      purple: "text-purple-600 dark:text-purple-400",
      orange: "text-orange-600 dark:text-orange-400",
      green: "text-green-600 dark:text-green-400",
      gray: "text-muted-foreground"
    };
    return colors[color] || colors.gray;
  };

  return (
    <div className="space-y-4">
      {/* Board Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Workflow Overzicht
        </h2>
        <p className="text-sm text-muted-foreground">
          {cases.length} totaal casussen
        </p>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-5 gap-4 overflow-x-auto pb-4">
        {columns.map(column => {
          const columnCases = getCasesByStatus(column.status);
          const Icon = column.icon;
          const urgentCount = columnCases.filter(c => c.urgency === "urgent").length;
          const warningCount = columnCases.filter(c => c.urgency === "warning").length;

          return (
            <div key={column.status} className="min-w-[280px]">
              {/* Column Header */}
              <div className={`p-4 rounded-lg border mb-3 ${getColumnColor(column.color)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${getHeaderColor(column.color)}`} />
                    <h3 className={`font-semibold ${getHeaderColor(column.color)}`}>
                      {column.label}
                    </h3>
                  </div>
                  <span className="text-sm font-bold text-muted-foreground">
                    {columnCases.length}
                  </span>
                </div>
                
                {/* Urgency Indicators */}
                {(urgentCount > 0 || warningCount > 0) && (
                  <div className="flex items-center gap-2 text-xs">
                    {urgentCount > 0 && (
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-3 h-3" />
                        {urgentCount} urgent
                      </span>
                    )}
                    {warningCount > 0 && (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Clock className="w-3 h-3" />
                        {warningCount}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Column Cards */}
              <div className="space-y-3">
                {columnCases.length === 0 ? (
                  <div className="p-6 rounded-lg border border-dashed border-border bg-muted/20 text-center">
                    <p className="text-sm text-muted-foreground">
                      Geen casussen
                    </p>
                  </div>
                ) : (
                  columnCases.map(caseData => (
                    <BoardCard key={caseData.id} caseData={caseData} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface BoardCardProps {
  caseData: CaseData;
}

function BoardCard({ caseData }: BoardCardProps) {
  const { title, regio, wachttijd, urgency, issues } = caseData;

  const getUrgencyIndicator = () => {
    switch (urgency) {
      case "urgent":
        return "border-l-4 border-l-red-500 bg-red-500/5";
      case "warning":
        return "border-l-4 border-l-amber-500 bg-amber-500/5";
      case "positive":
        return "border-l-4 border-l-green-500 bg-green-500/5";
      default:
        return "border-l-4 border-l-border";
    }
  };

  return (
    <div
      className={`
        premium-card p-4 cursor-pointer
        transition-all duration-200 hover:shadow-md
        ${getUrgencyIndicator()}
      `}
      onClick={() => console.log("Open case:", caseData.id)}
    >
      {/* Title */}
      <h4 className="font-medium text-sm text-foreground mb-2 line-clamp-2">
        {title}
      </h4>

      {/* Meta */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{regio}</span>
          <span className={`font-medium ${wachttijd > 7 ? "text-red-500" : "text-muted-foreground"}`}>
            {wachttijd}d
          </span>
        </div>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="space-y-1">
          {issues.slice(0, 2).map((issue, idx) => (
            <div
              key={idx}
              className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
            >
              {issue}
            </div>
          ))}
          {issues.length > 2 && (
            <p className="text-xs text-muted-foreground">
              +{issues.length - 2} meer
            </p>
          )}
        </div>
      )}

      {/* Urgency Badge */}
      {urgency === "urgent" && (
        <div className="mt-2 pt-2 border-t border-border">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3 h-3" />
            Urgent
          </span>
        </div>
      )}
    </div>
  );
}
