import { RiskLevel } from "../../lib/casesData";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";

interface RiskBadgeProps {
  risk?: RiskLevel;
  level?: RiskLevel;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function RiskBadge({ risk, level, showIcon = true, size = "md" }: RiskBadgeProps) {
  // Accept both 'risk' and 'level' props for backwards compatibility
  const riskLevel = risk || level;
  
  if (!riskLevel) {
    return null;
  }

  const configs = {
    high: {
      label: "Hoog risico",
      color: "text-[#DC2626]",
      bg: "bg-[rgba(220,38,38,0.1)]",
      border: "border-[rgba(220,38,38,0.3)]",
      icon: ShieldAlert
    },
    medium: {
      label: "Gemiddeld risico",
      color: "text-[#F59E0B]",
      bg: "bg-[rgba(245,158,11,0.1)]",
      border: "border-[rgba(245,158,11,0.3)]",
      icon: Shield
    },
    low: {
      label: "Laag risico",
      color: "text-[#10B981]",
      bg: "bg-[rgba(16,185,129,0.1)]",
      border: "border-[rgba(16,185,129,0.3)]",
      icon: ShieldCheck
    },
    none: {
      label: "Geen risico",
      color: "text-muted-foreground",
      bg: "bg-muted/30",
      border: "border-border",
      icon: ShieldCheck
    }
  };

  const config = configs[riskLevel];
  
  if (!config) {
    return null;
  }
  
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-sm gap-1.5"
  };

  const iconSizes = {
    sm: 12,
    md: 14
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