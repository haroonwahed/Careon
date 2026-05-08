import { RiskLevel } from "../../lib/casesData";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "../ui/utils";

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
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/30",
      icon: ShieldAlert
    },
    medium: {
      label: "Gemiddeld risico",
      color: "text-amber-300",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      icon: Shield
    },
    low: {
      label: "Laag risico",
      color: "text-emerald-300",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
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
    <div className={cn("inline-flex items-center rounded-md border font-medium", config.bg, config.border, config.color, sizeClasses[size])}>
      {showIcon && <Icon size={iconSizes[size]} />}
      <span>{config.label}</span>
    </div>
  );
}