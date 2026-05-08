import { CaseStatus } from "../../lib/casesData";
import { CaseTriageCard } from "./CaseTriageCard";

interface BoardCase {
  id: string;
  title: string;
  regio: string;
  careType: string;
  waitingDays: number;
  status: CaseStatus;
  urgency: "critical" | "high" | "medium" | "low";
  problems?: Array<{
    type: "no-match" | "missing-assessment" | "capacity" | "delay";
    label: string;
  }>;
  aiInsight?: string;
  recommendedAction: {
    label: string;
    type: "matching" | "assessment" | "escalate" | "placement";
  };
}

interface CasussenBoardViewProps {
  cases: BoardCase[];
  onViewCase: (id: string) => void;
  onTakeAction: (id: string, action: string) => void;
}

export function CasussenBoardView({ cases, onViewCase, onTakeAction }: CasussenBoardViewProps) {
  const columns: Array<{
    status: CaseStatus;
    label: string;
    tone: string;
  }> = [
    { status: "intake", label: "Intake", tone: "border-primary/35 bg-primary/10" },
    { status: "assessment", label: "Aanbieder beoordeling", tone: "border-blue-500/35 bg-blue-500/10" },
    { status: "matching", label: "Matching", tone: "border-amber-500/35 bg-amber-500/10" },
    { status: "placement", label: "Plaatsing", tone: "border-cyan-500/35 bg-cyan-500/10" },
    { status: "completed", label: "Afgerond", tone: "border-emerald-500/35 bg-emerald-500/10" }
  ];

  const getCasesForColumn = (status: CaseStatus) => {
    return cases.filter(c => c.status === status);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnCases = getCasesForColumn(column.status);
        
        return (
          <div 
            key={column.status}
            className="flex-shrink-0 w-[380px]"
          >
            {/* Column Header */}
            <div 
              className={`mb-4 rounded-lg border p-3 ${column.tone}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">
                  {column.label}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-background/40 text-sm font-medium text-foreground">
                  {columnCases.length}
                </span>
              </div>
            </div>

            {/* Column Cases */}
            <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {columnCases.length === 0 ? (
                <div className="panel-surface p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Geen casussen in deze fase
                  </p>
                </div>
              ) : (
                columnCases.map((caseItem) => (
                  <CaseTriageCard
                    key={caseItem.id}
                    {...caseItem}
                    onViewCase={onViewCase}
                    onTakeAction={onTakeAction}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
