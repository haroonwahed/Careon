import { 
  Clock, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
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
    bg: "bg-red-500/15",
    border: "border-red-500/40",
    text: "text-red-400",
    label: "Urgent",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]"
  },
  warning: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/40",
    text: "text-amber-400",
    label: "Aandacht",
    glow: "shadow-[0_0_15px_rgba(245,158,11,0.1)]"
  },
  normal: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    label: "Normaal"
  },
  stable: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-400",
    label: "Stabiel"
  }
};

const statusConfig: Record<CaseStatus, { label: string; color: string }> = {
  intake: { label: "Intake", color: "bg-purple-500/20 text-purple-300 border border-purple-500/30" },
  beoordeling: { label: "Beoordeling", color: "bg-blue-500/20 text-blue-300 border border-blue-500/30" },
  matching: { label: "Matching", color: "bg-amber-500/20 text-amber-300 border border-amber-500/30" },
  plaatsing: { label: "Plaatsing", color: "bg-green-500/20 text-green-300 border border-green-500/30" },
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
      style={{
        background: isUrgent 
          ? `linear-gradient(135deg, ${urgency === "critical" ? "rgba(239, 68, 68, 0.08)" : "rgba(245, 158, 11, 0.08)"} 0%, rgba(0, 0, 0, 0.02) 100%)`
          : undefined
      }}
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
            ${wachttijd > 5 ? "bg-red-500/20 border border-red-500/30" : "bg-muted/50"}
          `}>
            <Clock size={14} className={wachttijd > 5 ? "text-red-400" : "text-muted-foreground"} />
            <span className={`text-sm font-semibold ${wachttijd > 5 ? "text-red-400" : "text-muted-foreground"}`}>
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

        {/* PROBLEMS: Problem Indicators */}
        {problems.length > 0 && (
          <div className="mb-4 space-y-2">
            {problems.map((problem, idx) => {
              const Icon = problemIcons[problem.type];
              return (
                <div 
                  key={idx}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20"
                >
                  <Icon size={14} className="text-red-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-red-300">{problem.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* SYSTEM INSIGHT */}
        {systemInsight && (
          <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex gap-2">
              <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300 leading-relaxed">{systemInsight}</p>
            </div>
          </div>
        )}

        {/* RECOMMENDED ACTION */}
        <div className="mb-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-purple-400" />
            <span className="text-xs font-semibold text-purple-300 uppercase tracking-wide">
              Aanbevolen actie
            </span>
          </div>
          <p className="text-sm font-medium text-purple-200">{recommendedAction}</p>
        </div>

        {/* CTA BUTTONS */}
        <div className="flex gap-3">
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
          <div className="absolute inset-0 rounded-xl border-2 border-red-500/30 animate-pulse" />
        </div>
      )}
    </div>
  );
}
