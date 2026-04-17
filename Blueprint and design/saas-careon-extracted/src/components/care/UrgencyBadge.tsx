import { UrgencyLevel } from "../../lib/casesData";
import { AlertTriangle, Clock, AlertCircle, Info } from "lucide-react";

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
      color: "text-[#EF4444]",
      bg: "bg-[rgba(239,68,68,0.1)]",
      border: "border-[rgba(239,68,68,0.3)]",
      icon: AlertCircle
    },
    high: {
      label: "Hoog",
      color: "text-[#F59E0B]",
      bg: "bg-[rgba(245,158,11,0.1)]",
      border: "border-[rgba(245,158,11,0.3)]",
      icon: AlertTriangle
    },
    medium: {
      label: "Gemiddeld",
      color: "text-[#3B82F6]",
      bg: "bg-[rgba(59,130,246,0.1)]",
      border: "border-[rgba(59,130,246,0.3)]",
      icon: Clock
    },
    low: {
      label: "Laag",
      color: "text-[#6B7280]",
      bg: "bg-[rgba(107,114,128,0.1)]",
      border: "border-[rgba(107,114,128,0.3)]",
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
    <div 
      className={`
        inline-flex items-center rounded-md border font-medium
        ${config.bg} ${config.border} ${config.color}
        ${sizeClasses[size]}
      `}
    >
      {showIcon && <Icon size={iconSizes[size]} />}
      <span>{config.label}</span>
    </div>
  );
}