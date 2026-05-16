import type { Casus, CasusPhase } from "../../lib/phaseEngine";
import { UrgencyBadge } from "./UrgencyBadge";
import { RiskBadge } from "./RiskBadge";
import { Clock, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { CareMetaChip, CarePanel } from "./CareDesignPrimitives";
import { cn } from "../ui/utils";
import { phaseToneClass } from "./careSemanticTones";

interface CaseTableRowProps {
  case: Casus;
  onClick: () => void;
}

const PHASE_LABELS: Record<CasusPhase, string> = {
  intake_initial: "Casus",
  beoordeling: "Aanbieder beoordeling",
  matching: "Matching",
  plaatsing: "Plaatsing",
  intake_provider: "Intake",
  afgerond: "Afgerond",
  geblokkeerd: "Geblokkeerd",
};

export function CaseTableRow({ case: caseData, onClick }: CaseTableRowProps) {
  const getNextAction = () => {
    switch (caseData.phase) {
      case "intake_initial":
        return { label: "Naar matching", color: "text-primary" };
      case "beoordeling":
        return { label: "Acceptatie / afwijzing", color: "text-primary" };
      case "matching":
        return { label: "Match", color: "text-primary" };
      case "geblokkeerd":
        return { label: "Escaleer", color: "text-destructive" };
      case "plaatsing":
        return { label: "Bevestig", color: "text-emerald-300" };
      case "intake_provider":
        return { label: "Intake plannen", color: "text-cyan-300" };
      case "afgerond":
        return { label: "Afgesloten", color: "text-muted-foreground" };
      default:
        return { label: "Openstaand", color: "text-muted-foreground" };
    }
  };

  const nextAction = getNextAction();
  const phaseTone = phaseToneClass(caseData.phase);

  return (
    <CarePanel
      className="
        cursor-pointer p-4
        transition-all hover:border-border/80
        group
      "
      onClick={onClick}
    >
      <div className="grid grid-cols-12 gap-4 items-center">
        {/* Case ID & Client */}
        <div className="col-span-2">
          <div className="font-medium text-foreground group-hover:text-foreground transition-colors">
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
            <CareMetaChip className={cn("text-xs font-medium", phaseTone)}>
              {PHASE_LABELS[caseData.phase]}
            </CareMetaChip>
            <UrgencyBadge urgency={caseData.urgency} size="sm" />
          </div>
        </div>

        {/* Waiting Time & Risk */}
        <div className="col-span-2">
          <div className="flex items-center gap-1.5 text-sm mb-1.5">
            <Clock size={14} className="text-muted-foreground" />
            <span className={
              caseData.waitingDays > 10 
                ? "text-destructive font-medium"
                : caseData.waitingDays > 5
                  ? "text-amber-300 font-medium"
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
            {nextAction.label}
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
            className="group-hover:bg-muted/35 group-hover:text-foreground transition-all"
          >
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </CarePanel>
  );
}
