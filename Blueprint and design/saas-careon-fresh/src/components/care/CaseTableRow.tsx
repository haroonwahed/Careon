import { Case } from "../../lib/casesData";
import { UrgencyBadge } from "./UrgencyBadge";
import { CaseStatusBadge } from "./CaseStatusBadge";
import { RiskBadge } from "./RiskBadge";
import { AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";

interface CaseTableRowProps {
  case: Case;
  onClick: () => void;
}

export function CaseTableRow({ case: caseData, onClick }: CaseTableRowProps) {
  // Determine next action based on status
  const getNextAction = () => {
    switch (caseData.status) {
      case "intake":
        return { label: "Start beoordeling", color: "text-primary" };
      case "assessment":
        return { label: "Beoordeel", color: "text-primary" };
      case "matching":
        return { label: "Match", color: "text-primary" };
      case "blocked":
        return { label: "Escaleer", color: "text-[#EF4444]" };
      case "placement":
        return { label: "Bevestig", color: "text-green-500" };
      default:
        return { label: "Open", color: "text-muted-foreground" };
    }
  };

  const nextAction = getNextAction();

  return (
    <div 
      className="
        premium-card p-4 cursor-pointer
        hover:border-primary/40 transition-all
        group
      "
      onClick={onClick}
    >
      <div className="grid grid-cols-12 gap-4 items-center">
        {/* Case ID & Client */}
        <div className="col-span-2">
          <div className="font-medium text-foreground group-hover:text-primary transition-colors">
            {caseData.id}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {caseData.clientName} · {caseData.clientAge}j
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {caseData.region}
          </div>
        </div>

        {/* Type */}
        <div className="col-span-2">
          <div className="text-xs text-muted-foreground mb-0.5">Type</div>
          <div className="text-sm font-medium">{caseData.caseType}</div>
        </div>

        {/* Status & Urgency */}
        <div className="col-span-2">
          <div className="flex flex-col gap-1.5">
            <CaseStatusBadge status={caseData.status} size="sm" />
            <UrgencyBadge urgency={caseData.urgency} size="sm" />
          </div>
        </div>

        {/* Waiting Time & Risk */}
        <div className="col-span-2">
          <div className="flex items-center gap-1.5 text-sm mb-1.5">
            <Clock size={14} className="text-muted-foreground" />
            <span className={
              caseData.waitingDays > 10 
                ? "text-[#EF4444] font-medium" 
                : caseData.waitingDays > 5
                  ? "text-[#F59E0B] font-medium"
                  : "text-muted-foreground"
            }>
              {caseData.waitingDays} dagen
            </span>
          </div>
          <RiskBadge risk={caseData.risk} size="sm" />
        </div>

        {/* Next Action (NEW - was "Signal") */}
        <div className="col-span-3">
          <div className="text-xs text-muted-foreground mb-1">Volgende actie</div>
          <div className={`text-sm font-semibold ${nextAction.color}`}>
            👉 {nextAction.label}
          </div>
          {caseData.signal && (
            <div className="flex items-start gap-1 mt-1">
              <AlertTriangle 
                size={12} 
                className={
                  caseData.urgency === "critical" 
                    ? "text-[#EF4444] mt-0.5" 
                    : caseData.urgency === "high"
                      ? "text-[#F59E0B] mt-0.5"
                      : "text-muted-foreground mt-0.5"
                }
              />
              <span className="text-xs text-muted-foreground line-clamp-1">
                {caseData.signal}
              </span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="col-span-1 flex justify-end">
          <Button 
            size="sm" 
            variant="ghost"
            className="group-hover:bg-primary group-hover:text-white transition-all"
          >
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}