import type { Casus, CasusPhase } from "../../lib/phaseEngine";
import { UrgencyBadge } from "./UrgencyBadge";
import { RiskBadge } from "./RiskBadge";
import { Clock, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";

interface CaseTableRowProps {
  case: Casus;
  onClick: () => void;
}

const PHASE_LABELS: Record<CasusPhase, string> = {
  intake_initial: "Intake",
  beoordeling: "Beoordeling",
  matching: "Matching",
  plaatsing: "Plaatsing",
  intake_provider: "Intake aanbieder",
  afgerond: "Afgerond",
  geblokkeerd: "Geblokkeerd",
};

const PHASE_COLORS: Record<CasusPhase, { text: string; bg: string; border: string }> = {
  intake_initial: { text: "text-[#8B5CF6]", bg: "bg-primary/10", border: "border-primary/30" },
  beoordeling: { text: "text-[#3B82F6]", bg: "bg-[rgba(59,130,246,0.1)]", border: "border-[rgba(59,130,246,0.3)]" },
  matching: { text: "text-[#F59E0B]", bg: "bg-[rgba(245,158,11,0.1)]", border: "border-[rgba(245,158,11,0.3)]" },
  plaatsing: { text: "text-[#22D3EE]", bg: "bg-[rgba(34,211,238,0.1)]", border: "border-[rgba(34,211,238,0.3)]" },
  intake_provider: { text: "text-[#10B981]", bg: "bg-[rgba(16,185,129,0.1)]", border: "border-[rgba(16,185,129,0.3)]" },
  afgerond: { text: "text-[#6B7280]", bg: "bg-[rgba(107,114,128,0.1)]", border: "border-[rgba(107,114,128,0.3)]" },
  geblokkeerd: { text: "text-[#EF4444]", bg: "bg-[rgba(239,68,68,0.1)]", border: "border-[rgba(239,68,68,0.3)]" },
};

export function CaseTableRow({ case: caseData, onClick }: CaseTableRowProps) {
  const getNextAction = () => {
    switch (caseData.phase) {
      case "intake_initial":
        return { label: "Start beoordeling", color: "text-primary" };
      case "beoordeling":
        return { label: "Beoordeel", color: "text-primary" };
      case "matching":
        return { label: "Match", color: "text-primary" };
      case "geblokkeerd":
        return { label: "Escaleer", color: "text-[#EF4444]" };
      case "plaatsing":
        return { label: "Bevestig", color: "text-green-500" };
      case "intake_provider":
        return { label: "Intake plannen", color: "text-[#22D3EE]" };
      case "afgerond":
        return { label: "Afgesloten", color: "text-muted-foreground" };
      default:
        return { label: "Open", color: "text-muted-foreground" };
    }
  };

  const nextAction = getNextAction();
  const phaseColors = PHASE_COLORS[caseData.phase];

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
          <div className="text-sm font-medium">{caseData.careType}</div>
        </div>

        {/* Phase & Urgency */}
        <div className="col-span-2">
          <div className="flex flex-col gap-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${phaseColors.text} ${phaseColors.bg} ${phaseColors.border}`}>
              {PHASE_LABELS[caseData.phase]}
            </span>
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
          <RiskBadge risk={caseData.complexity} size="sm" />
        </div>

        {/* Next Action (NEW - was "Signal") */}
        <div className="col-span-3">
          <div className="text-xs text-muted-foreground mb-1">Volgende actie</div>
          <div className={`text-sm font-semibold ${nextAction.color}`}>
            👉 {nextAction.label}
          </div>
          <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {caseData.assignedTo}
          </div>
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