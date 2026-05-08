import { 
  Clock, 
  MapPin, 
  AlertTriangle, 
  ArrowRight,
  Info,
  TrendingUp,
  Users
} from "lucide-react";
import { Button } from "../ui/button";
import { tokens } from "../../design/tokens";
import { cn } from "../ui/utils";
import { urgencyToneClasses, workflowStatusChipClasses } from "./careSemanticTones";

type UrgencyLevel = "critical" | "warning" | "normal" | "stable";
type CaseStatus = "intake" | "beoordeling" | "matching" | "plaatsing" | "afgerond";

interface Problem {
  type: "no-match" | "missing-assessment" | "capacity" | "delayed";
  label: string;
}

interface CaseTriageCardProps {
  id: string;
  title: string;
  regio: string;
  zorgtype: string;
  wachttijd: number; // in days
  status: CaseStatus;
  urgency: UrgencyLevel;
  problems?: Problem[];
  systemInsight?: string;
  recommendedAction: string;
  onViewDetails: () => void;
  onTakeAction: () => void;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}

const urgencyConfig: Record<UrgencyLevel, { 
  bg: string; 
  border: string; 
  text: string; 
  label: string;
}> = {
  critical: {
    bg: "bg-destructive/10",
    border: "border-destructive/40",
    text: "text-destructive",
    label: "Urgent",
  },
  warning: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    text: "text-amber-300",
    label: "Aandacht",
  },
  normal: {
    bg: "bg-muted/30",
    border: "border-border/70",
    text: "text-muted-foreground",
    label: "Normaal"
  },
  stable: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    text: "text-emerald-300",
    label: "Stabiel"
  }
};

const statusConfig: Record<
  CaseStatus,
  { label: string; tone: "intake" | "assessment" | "matching" | "placement" | "completed" }
> = {
  intake: { label: "Casus", tone: "intake" },
  beoordeling: { label: "Aanbieder beoordeling", tone: "assessment" },
  matching: { label: "Matching", tone: "matching" },
  plaatsing: { label: "Plaatsing", tone: "placement" },
  afgerond: { label: "Afgerond", tone: "completed" },
};

const problemIcons: Record<Problem["type"], any> = {
  "no-match": AlertTriangle,
  "missing-assessment": Info,
  "capacity": Users,
  "delayed": Clock
};

export function CaseTriageCard({
  id,
  title,
  regio,
  zorgtype,
  wachttijd,
  status,
  urgency,
  problems = [],
  systemInsight,
  recommendedAction,
  onViewDetails,
  onTakeAction,
  isSelected = false,
  onSelect
}: CaseTriageCardProps) {
  const config = urgencyConfig[urgency];
  const statusStyle = statusConfig[status];
  const urgencyTone = urgencyToneClasses(urgency === "critical" ? "urgent" : urgency === "warning" ? "warning" : urgency === "stable" ? "positive" : "normal");
  
  const isUrgent = urgency === "critical" || urgency === "warning";

  return (
    <div 
      className={`
        relative group
        rounded-xl border-2 transition-all duration-200
        ${config.border} ${config.bg}
        ${isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}
        hover:border-opacity-60 hover:shadow-lg
      `}
    >
      {/* Selection Checkbox */}
      {onSelect && (
        <div className="absolute left-4 z-10" style={{ top: tokens.layout.edgeZero }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(e.target.checked)}
            className="w-4 h-4 rounded border-2 border-muted-foreground/30 bg-background/50 
                     checked:bg-primary checked:border-primary cursor-pointer"
          />
        </div>
      )}

      <div className={`p-4 ${onSelect ? "pl-12" : ""}`}>
        {/* HEADER: Urgency + Title */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("px-2.5 py-0.5 rounded-md border text-xs font-semibold uppercase tracking-wide", urgencyTone.chip)}>
                {config.label}
              </span>
              <span className={cn("px-2.5 py-0.5 rounded-md border text-xs font-medium", workflowStatusChipClasses(statusStyle.tone))}>
                {statusStyle.label}
              </span>
            </div>
            <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
              {title}
            </h3>
          </div>
          
          {/* Wait Time Indicator */}
          <div className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg
            ${wachttijd > 5 ? "border border-destructive/40 bg-destructive/10" : "bg-muted/50"}
          `}>
            <Clock size={14} className={wachttijd > 5 ? "text-destructive" : "text-muted-foreground"} />
            <span className={`text-sm font-semibold ${wachttijd > 5 ? "text-destructive" : "text-muted-foreground"}`}>
              {wachttijd}d
            </span>
          </div>
        </div>

        {/* BODY: Key Info */}
        <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin size={14} />
            <span>{regio}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp size={14} />
            <span>{zorgtype}</span>
          </div>
        </div>

        {/* PROBLEMS: compact pills */}
        {problems.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {problems.map((problem, idx) => {
              const Icon = problemIcons[problem.type];
              return (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/15 px-2.5 py-1"
                >
                  <Icon size={12} className="text-destructive flex-shrink-0" />
                  <span className="text-xs font-medium text-destructive">{problem.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* SYSTEM INSIGHT: single muted line */}
        {systemInsight && (
          <div className="mb-3 flex items-start gap-1.5">
            <Info size={12} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{systemInsight}</p>
          </div>
        )}

        {/* CTA BUTTONS */}
        <div className="flex gap-2 mt-4">
          <Button
            onClick={onTakeAction}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold"
          >
            {recommendedAction}
            <ArrowRight size={16} className="ml-2" />
          </Button>
          <Button
            onClick={onViewDetails}
            variant="outline"
            className="border-muted-foreground/30 hover:border-primary/50 hover:text-primary"
          >
            Bekijk casus
          </Button>
        </div>
      </div>

      {/* Urgent Pulse Animation */}
      {urgency === "critical" && (
        <div className="absolute inset-0 rounded-xl pointer-events-none">
          <div className="absolute inset-0 rounded-xl border-2 border-destructive/50 animate-pulse" />
        </div>
      )}
    </div>
  );
}
