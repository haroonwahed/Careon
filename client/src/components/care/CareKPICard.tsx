import { LucideIcon } from "lucide-react";

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
      icon: "text-[#EF4444]",
      value: "text-[#EF4444]",
      border: "border-[rgba(239,68,68,0.3)]",
      glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]"
    },
    warning: {
      icon: "text-[#F59E0B]",
      value: "text-[#F59E0B]",
      border: "border-[rgba(245,158,11,0.3)]",
      glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]"
    },
    normal: {
      icon: "text-primary",
      value: "text-foreground",
      border: "border-border",
      glow: ""
    },
    positive: {
      icon: "text-[#10B981]",
      value: "text-[#10B981]",
      border: "border-[rgba(16,185,129,0.3)]",
      glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]"
    }
  };

  const style = urgencyStyles[urgency];

  return (
    <div className={`premium-card kpi-card p-5 ${style.border} ${style.glow}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
          <div className={`mt-2 text-3xl font-semibold tracking-tight ${style.value}`}>{value}</div>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-primary/10 ${style.icon}`}>
          <Icon size={18} />
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          <span className={trend.direction === "up" ? "text-[#EF4444]" : "text-[#10B981]"}>
            {trend.direction === "up" ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
          <span className="text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
