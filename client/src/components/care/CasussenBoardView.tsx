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
    color: string;
  }> = [
    { status: "intake", label: "Intake", color: "rgba(139, 92, 246, 0.2)" },
    { status: "assessment", label: "Aanbieder beoordeling", color: "rgba(59, 130, 246, 0.2)" },
    { status: "matching", label: "Matching", color: "rgba(245, 158, 11, 0.2)" },
    { status: "placement", label: "Plaatsing", color: "rgba(34, 211, 238, 0.2)" },
    { status: "completed", label: "Afgerond", color: "rgba(16, 185, 129, 0.2)" }
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
              className="mb-4 p-3 rounded-lg border"
              style={{
                backgroundColor: column.color,
                borderColor: column.color
              }}
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
