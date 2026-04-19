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
import { Button } from "../ui/button";

type CaseStatus = "intake" | "beoordeling" | "matching" | "plaatsing" | "afgerond";
type UrgencyLevel = "urgent" | "warning" | "positive" | "normal";

interface CaseData {
  id: string;
  title: string;
  regio: string;
  zorgtype: string;
  wachttijd: number;
  status: CaseStatus;
  urgency: UrgencyLevel;
  issues: string[];
  systemInsight: string;
  recommendedAction: string;
  lastUpdated: string;
}

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
          borderColor: "border-l-red-base",
          bgColor: "bg-red-light/60",
          badgeBg: "careon-badge-red",
          badgeText: "text-red-base",
          label: "Urgent",
          icon: AlertTriangle,
          iconColor: "text-red-base"
        };
      case "warning":
        return {
          borderColor: "border-l-yellow-base",
          bgColor: "bg-yellow-light/60",
          badgeBg: "careon-badge-yellow",
          badgeText: "text-yellow-base",
          label: "Aandacht",
          icon: Clock,
          iconColor: "text-yellow-base"
        };
      case "positive":
        return {
          borderColor: "border-l-green-base",
          bgColor: "bg-green-light/60",
          badgeBg: "bg-green-light border border-green-border",
          badgeText: "text-green-base",
          label: "Op koers",
          icon: CheckCircle2,
          iconColor: "text-green-base"
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
      intake: "careon-badge-blue",
      beoordeling: "careon-badge-purple",
      matching: "careon-badge-yellow",
      plaatsing: "bg-green-light text-green-base border border-green-border",
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
                  <span className={wachttijd > 7 ? "text-red-base font-medium" : ""}>
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
            <AlertTriangle className="w-4 h-4 text-red-base flex-shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-2">
              {issues.map((issue, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded text-xs font-medium border careon-alert-error"
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
              className="gap-2 bg-primary hover:bg-primary-hover"
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
