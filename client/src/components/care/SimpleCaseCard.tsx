/**
 * SimpleCaseCard - Lightweight case card for list views
 */

import { 
  AlertTriangle, 
  Clock, 
  MapPin, 
  ChevronRight 
} from "lucide-react";
import { Button } from "../ui/button";

interface Case {
  id: string;
  clientName: string;
  clientAge?: number;
  age?: number;
  region?: string;
  municipality?: string;
  status: string;
  urgency: string;
  risk?: string;
  waitingDays: number;
  lastActivity?: string;
  caseType: string;
  signal: string;
  recommendedAction: string;
}

interface SimpleCaseCardProps {
  caseData: Case;
  onClick: () => void;
}

export function SimpleCaseCard({ caseData, onClick }: SimpleCaseCardProps) {
  const {
    id,
    clientName,
    clientAge,
    age,
    region,
    municipality,
    status,
    urgency,
    waitingDays,
    caseType,
    signal,
    recommendedAction
  } = caseData;

  // Urgency styling
  const getUrgencyConfig = (level: string) => {
    switch (level.toLowerCase()) {
      case "urgent":
      case "critical":
        return {
          borderColor: "border-l-destructive",
          badgeBg: "border border-destructive/30 bg-destructive/10",
          badgeText: "text-destructive",
          label: "Urgent"
        };
      case "high":
      case "warning":
        return {
          borderColor: "border-l-amber-400",
          badgeBg: "border border-amber-500/30 bg-amber-500/10",
          badgeText: "text-amber-300",
          label: "Hoog"
        };
      case "medium":
        return {
          borderColor: "border-l-cyan-400",
          badgeBg: "border border-cyan-500/30 bg-cyan-500/10",
          badgeText: "text-cyan-200",
          label: "Medium"
        };
      default:
        return {
          borderColor: "border-l-border-strong",
          badgeBg: "bg-gray-500/20",
          badgeText: "text-gray-600 dark:text-gray-400",
          label: "Laag"
        };
    }
  };

  const urgencyConfig = getUrgencyConfig(urgency);

  // Status styling
  const getStatusColor = (s: string): string => {
    const statusLower = s.toLowerCase();
    if (statusLower === "intake") return "border border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
    if (statusLower === "beoordeling" || statusLower === "assessment") return "border border-violet-500/30 bg-violet-500/10 text-violet-200";
    if (statusLower === "matching") return "border border-amber-500/30 bg-amber-500/10 text-amber-200";
    if (statusLower === "plaatsing" || statusLower === "placement") return "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    if (statusLower === "afgerond" || statusLower === "completed") return "bg-muted text-muted-foreground";
    if (statusLower === "blocked") return "border border-destructive/30 bg-destructive/10 text-destructive";
    return "bg-muted text-muted-foreground";
  };

  const getStatusLabel = (s: string): string => {
    const statusLower = s.toLowerCase();
    if (statusLower === "assessment" || statusLower === "beoordeling") return "Aanbieder beoordeling";
    if (statusLower === "placement") return "Plaatsing";
    if (statusLower === "completed") return "Afgerond";
    if (statusLower === "blocked") return "Geblokkeerd";
    if (statusLower === "intake") return "Casus";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <div
      className={`
        relative panel-surface border-l-4 ${urgencyConfig.borderColor}
        transition-all duration-200 hover:shadow-lg hover:bg-card/80 cursor-pointer
      `}
      onClick={onClick}
    >
      <div className="p-5">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-base font-semibold text-foreground">
                {id}
              </h3>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${urgencyConfig.badgeBg} ${urgencyConfig.badgeText}`}>
                {urgencyConfig.label}
              </span>
            </div>

            {/* Meta Info */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{clientName}</span>
              <span>•</span>
              <span>{clientAge || age} jaar</span>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>{region || municipality}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span className={waitingDays > 7 ? "text-destructive font-medium" : ""}>
                  {waitingDays} {waitingDays === 1 ? "dag" : "dagen"}
                </span>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)} whitespace-nowrap`}>
            {getStatusLabel(status)}
          </span>
        </div>

        {/* Case Type */}
        <div className="mb-3">
          <span className="px-2 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-200 text-xs font-medium">
            {caseType}
          </span>
        </div>

        {/* Signal */}
        {signal && (
          <div className="mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">{signal}</p>
          </div>
        )}

        {/* Action Row */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="gap-2 bg-primary hover:bg-primary-hover"
          >
            {recommendedAction}
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
