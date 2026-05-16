import { LucideIcon } from "lucide-react";
import { cn } from "../ui/utils";
import { CarePanel } from "./CareDesignPrimitives";

interface CareKPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    direction: "up" | "down";
    label: string;
  };
  urgency?: "critical" | "warning" | "normal" | "positive";
}

export function CareKPICard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  urgency = "normal"
}: CareKPICardProps) {
  const urgencyStyles = {
    critical: {
      icon: "text-destructive",
      value: "text-destructive",
      border: "border-destructive/35",
    },
    warning: {
      icon: "text-amber-300",
      value: "text-amber-200",
      border: "border-amber-500/35",
    },
    normal: {
      icon: "text-muted-foreground",
      value: "text-foreground",
      border: "border-border",
    },
    positive: {
      icon: "text-emerald-300",
      value: "text-emerald-200",
      border: "border-emerald-500/35",
    }
  };

  const style = urgencyStyles[urgency];

  return (
    <CarePanel className={cn("kpi-card care-hover-card p-4", style.border)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
          <div className="mt-2 border-t border-border/45 pt-2">
            <div className={`text-3xl font-semibold tracking-tight ${style.value}`}>{value}</div>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/35 ${style.icon}`}>
          <Icon size={18} />
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          <span className={trend.direction === "up" ? "text-destructive" : "text-emerald-300"}>
            {trend.direction === "up" ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
          <span className="text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </CarePanel>
  );
}
