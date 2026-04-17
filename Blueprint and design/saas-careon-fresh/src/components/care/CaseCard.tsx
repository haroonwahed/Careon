import { 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Tag,
  ChevronRight,
  CheckCircle2,
  Info,
  Sparkles
} from "lucide-react";
import { CaseData, CaseStatus, UrgencyLevel } from "./CasussenPage";
import { Button } from "../ui/button";

interface CaseCardProps {
  caseData: CaseData;
  isSelected?: boolean;
  onSelect?: () => void;
  onViewCase: () => void;
  onAction: () => void;
}

export function CaseCard({ caseData, isSelected, onSelect, onViewCase, onAction }: CaseCardProps) {
  const {
    title,
    regio,
    zorgtype,
    wachttijd,
    status,
    urgency,
    issues,
    systemInsight,
    recommendedAction,
    lastUpdated
  } = caseData;

  // Urgency styling
  const getUrgencyConfig = (level: UrgencyLevel) => {
    switch (level) {
      case "urgent":
        return {
          borderColor: "border-l-red-500",
          bgColor: "bg-red-500/5",
          badgeBg: "bg-red-500/20",
          badgeText: "text-red-600 dark:text-red-400",
          label: "Urgent",
          icon: AlertTriangle,
          iconColor: "text-red-500"
        };
      case "warning":
        return {
          borderColor: "border-l-amber-500",
          bgColor: "bg-amber-500/5",
          badgeBg: "bg-amber-500/20",
          badgeText: "text-amber-600 dark:text-amber-400",
          label: "Aandacht",
          icon: Clock,
          iconColor: "text-amber-500"
        };
      case "positive":
        return {
          borderColor: "border-l-green-500",
          bgColor: "bg-green-500/5",
          badgeBg: "bg-green-500/20",
          badgeText: "text-green-600 dark:text-green-400",
          label: "Op koers",
          icon: CheckCircle2,
          iconColor: "text-green-500"
        };
      default:
        return {
          borderColor: "border-l-border",
          bgColor: "bg-transparent",
          badgeBg: "bg-muted",
          badgeText: "text-muted-foreground",
          label: "Normaal",
          icon: Info,
          iconColor: "text-muted-foreground"
        };
    }
  };

  const urgencyConfig = getUrgencyConfig(urgency);
  const UrgencyIcon = urgencyConfig.icon;

  // Status styling
  const getStatusLabel = (s: CaseStatus): string => {
    const labels: Record<CaseStatus, string> = {
      intake: "Intake",
      beoordeling: "Beoordeling",
      matching: "Matching",
      plaatsing: "Plaatsing",
      afgerond: "Afgerond"
    };
    return labels[s];
  };

  const getStatusColor = (s: CaseStatus): string => {
    const colors: Record<CaseStatus, string> = {
      intake: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
      beoordeling: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
      matching: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
      plaatsing: "bg-green-500/20 text-green-600 dark:text-green-400",
      afgerond: "bg-muted text-muted-foreground"
    };
    return colors[s];
  };

  return (
    <div
      className={`
        relative premium-card border-l-4 ${urgencyConfig.borderColor} ${urgencyConfig.bgColor}
        transition-all duration-200 hover:shadow-lg
        ${isSelected ? "ring-2 ring-primary/40" : ""}
      `}
    >
      <div className="p-5">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1">
            {/* Checkbox */}
            {onSelect && (
              <div className="pt-1">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={onSelect}
                  className="w-4 h-4 rounded border-2 border-border text-primary focus:ring-2 focus:ring-primary/40 cursor-pointer"
                />
              </div>
            )}

            {/* Urgency Icon */}
            <div className="pt-0.5">
              <UrgencyIcon className={`w-5 h-5 ${urgencyConfig.iconColor}`} />
            </div>

            {/* Title and Meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 mb-2">
                <h3 className="text-base font-semibold text-foreground leading-tight">
                  {title}
                </h3>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${urgencyConfig.badgeBg} ${urgencyConfig.badgeText} whitespace-nowrap`}>
                  {urgencyConfig.label}
                </span>
              </div>

              {/* Meta Info */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{regio}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{zorgtype}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span className={wachttijd > 7 ? "text-red-500 font-medium" : ""}>
                    {wachttijd} {wachttijd === 1 ? "dag" : "dagen"}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)} whitespace-nowrap`}>
              {getStatusLabel(status)}
            </span>
          </div>
        </div>

        {/* Issues Section */}
        {issues.length > 0 && (
          <div className="mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-2">
              {issues.map((issue, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                >
                  {issue}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* System Insight */}
        {systemInsight && (
          <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-primary mb-1">Systeem inzicht</p>
                <p className="text-sm text-foreground">{systemInsight}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Row */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <Button
              onClick={onAction}
              className="gap-2"
              style={{
                background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)"
              }}
            >
              {recommendedAction}
              <ChevronRight size={16} />
            </Button>
            <Button
              variant="outline"
              onClick={onViewCase}
              className="gap-2"
            >
              Bekijk casus
            </Button>
          </div>

          <span className="text-xs text-muted-foreground">
            {lastUpdated}
          </span>
        </div>
      </div>
    </div>
  );
}
