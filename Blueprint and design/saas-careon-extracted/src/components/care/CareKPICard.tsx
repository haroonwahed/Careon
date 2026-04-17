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
    <div 
      className={`
        premium-card kpi-card p-6 
        ${style.border} ${style.glow}
        hover:scale-[1.02] transition-transform
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <div className={`text-3xl font-semibold ${style.value}`}>
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-muted/30 ${style.icon}`}>
          <Icon size={24} />
        </div>
      </div>
      
      {trend && (
        <div className="flex items-center gap-2 text-xs">
          <span 
            className={
              trend.direction === "up" 
                ? "text-[#EF4444]" 
                : "text-[#10B981]"
            }
          >
            {trend.direction === "up" ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
          <span className="text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
