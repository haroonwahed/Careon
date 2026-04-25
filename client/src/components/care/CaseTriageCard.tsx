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
  glow?: string;
}> = {
  critical: {
    bg: "bg-red-light",
    border: "border-red-border",
    text: "text-red-base",
    label: "Urgent",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.08)]"
  },
  warning: {
    bg: "bg-yellow-light",
    border: "border-yellow-border",
    text: "text-yellow-base",
    label: "Aandacht",
    glow: "shadow-[0_0_15px_rgba(245,158,11,0.06)]"
  },
  normal: {
    bg: "bg-blue-light",
    border: "border-blue-border",
    text: "text-blue-base",
    label: "Normaal"
  },
  stable: {
    bg: "bg-green-light",
    border: "border-green-border",
    text: "text-green-base",
    label: "Stabiel"
  }
};

const statusConfig: Record<CaseStatus, { label: string; color: string }> = {
  intake: { label: "Casus", color: "careon-badge-purple" },
  beoordeling: { label: "Aanbieder Beoordeling", color: "careon-badge-blue" },
  matching: { label: "Matching", color: "careon-badge-yellow" },
  plaatsing: { label: "Plaatsing", color: "bg-green-light text-green-base border border-green-border" },
  afgerond: { label: "Afgerond", color: "bg-slate-500/20 text-slate-300 border border-slate-500/30" }
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
  
  const isUrgent = urgency === "critical" || urgency === "warning";

  return (
    <div 
      className={`
        relative group
        rounded-xl border-2 transition-all duration-200
        ${config.border} ${config.bg}
        ${isUrgent ? config.glow : ""}
        ${isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}
        hover:border-opacity-60 hover:shadow-lg
      `}
    >
      {/* Selection Checkbox */}
      {onSelect && (
        <div className="absolute top-4 left-4 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(e.target.checked)}
            className="w-4 h-4 rounded border-2 border-muted-foreground/30 bg-background/50 
                     checked:bg-primary checked:border-primary cursor-pointer"
          />
        </div>
      )}

      <div className={`p-5 ${onSelect ? "pl-12" : ""}`}>
        {/* HEADER: Urgency + Title */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`
                px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wide
                ${config.bg} ${config.text} border ${config.border}
              `}>
                {config.label}
              </span>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium ${statusStyle.color}`}>
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
            ${wachttijd > 5 ? "bg-red-light border border-red-border" : "bg-muted/50"}
          `}>
            <Clock size={14} className={wachttijd > 5 ? "text-red-base" : "text-muted-foreground"} />
            <span className={`text-sm font-semibold ${wachttijd > 5 ? "text-red-base" : "text-muted-foreground"}`}>
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
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border careon-alert-error"
                >
                  <Icon size={12} className="text-red-base flex-shrink-0" />
                  <span className="text-xs font-medium text-red-base">{problem.label}</span>
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
          <div className="absolute inset-0 rounded-xl border-2 border-red-border animate-pulse" />
        </div>
      )}
    </div>
  );
}
