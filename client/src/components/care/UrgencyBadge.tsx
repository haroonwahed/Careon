import { UrgencyLevel } from "../../lib/casesData";
import { AlertTriangle, Clock, AlertCircle, Info } from "lucide-react";
import { urgencyLevelChipClasses } from "./careSemanticTones";
import { cn } from "../ui/utils";

interface UrgencyBadgeProps {
  urgency?: UrgencyLevel;
  level?: UrgencyLevel;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export function UrgencyBadge({ urgency, level, showIcon = true, size = "md" }: UrgencyBadgeProps) {
  // Accept both 'urgency' and 'level' props for backwards compatibility
  const urgencyLevel = urgency || level;
  
  if (!urgencyLevel) {
    return null;
  }

  const configs = {
    critical: {
      label: "Kritiek",
      icon: AlertCircle
    },
    high: {
      label: "Hoog",
      icon: AlertTriangle
    },
    medium: {
      label: "Gemiddeld",
      icon: Clock
    },
    low: {
      label: "Laag",
      icon: Info
    }
  };

  const config = configs[urgencyLevel];
  
  if (!config) {
    return null;
  }
  
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-sm gap-1.5",
    lg: "px-3 py-1.5 text-base gap-2"
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  };

  return (
    <div className={cn("inline-flex items-center rounded-md border font-medium", urgencyLevelChipClasses(urgencyLevel), sizeClasses[size])}>
      {showIcon && <Icon size={iconSizes[size]} />}
      <span>{config.label}</span>
    </div>
  );
}