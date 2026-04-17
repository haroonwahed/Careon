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
          borderColor: "border-l-red-500",
          badgeBg: "bg-red-500/20",
          badgeText: "text-red-600 dark:text-red-400",
          label: "Urgent"
        };
      case "high":
      case "warning":
        return {
          borderColor: "border-l-amber-500",
          badgeBg: "bg-amber-500/20",
          badgeText: "text-amber-600 dark:text-amber-400",
          label: "Hoog"
        };
      case "medium":
        return {
          borderColor: "border-l-blue-500",
          badgeBg: "bg-blue-500/20",
          badgeText: "text-blue-600 dark:text-blue-400",
          label: "Medium"
        };
      default:
        return {
          borderColor: "border-l-gray-500",
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
    if (statusLower === "intake") return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
    if (statusLower === "beoordeling" || statusLower === "assessment") return "bg-purple-500/20 text-purple-600 dark:text-purple-400";
    if (statusLower === "matching") return "bg-orange-500/20 text-orange-600 dark:text-orange-400";
    if (statusLower === "plaatsing" || statusLower === "placement") return "bg-green-500/20 text-green-600 dark:text-green-400";
    if (statusLower === "afgerond" || statusLower === "completed") return "bg-muted text-muted-foreground";
    if (statusLower === "blocked") return "bg-red-500/20 text-red-600 dark:text-red-400";
    return "bg-muted text-muted-foreground";
  };

  const getStatusLabel = (s: string): string => {
    const statusLower = s.toLowerCase();
    if (statusLower === "assessment") return "Beoordeling";
    if (statusLower === "placement") return "Plaatsing";
    if (statusLower === "completed") return "Afgerond";
    if (statusLower === "blocked") return "Geblokkeerd";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <div
      className={`
        relative premium-card border-l-4 ${urgencyConfig.borderColor}
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
                <span className={waitingDays > 7 ? "text-red-500 font-medium" : ""}>
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
          <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-500 text-xs font-medium">
            {caseType}
          </span>
        </div>

        {/* Signal */}
        {signal && (
          <div className="mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
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
            style={{
              background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)"
            }}
            className="gap-2"
          >
            {recommendedAction}
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
