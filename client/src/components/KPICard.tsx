import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Language, t } from "../lib/i18n";

interface KPICardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  delta?: {
    value: number;
    prevValue: string;
  };
  language?: Language;
}

export function KPICard({ label, value, subtitle, icon: Icon, delta, language = "en" }: KPICardProps) {
  const getDeltaDisplay = () => {
    if (!delta) return null;
    
    const isPositive = delta.value > 0;
    const isNeutral = Math.abs(delta.value) < 0.5;
    
    let colorClass = "";
    let arrow = "▬";
    
    if (!isNeutral) {
      if (isPositive) {
        colorClass = "text-green-base text-emerald-600";
        arrow = "▲";
      } else {
        colorClass = "text-red-base text-red-600";
        arrow = "▼";
      }
    } else {
      colorClass = "dark:text-muted-foreground text-neutral-500";
    }
    
    const displayValue = isNeutral ? "0%" : `${isPositive ? "+" : ""}${delta.value.toFixed(1)}%`;
    
    return (
      <div className={`inline-flex items-center gap-1.5 ${colorClass}`}>
        <span className="text-[10px]">{arrow}</span>
        <span className="text-xs font-medium">
          {displayValue}
        </span>
      </div>
    );
  };

  return (
    <div 
      className="kpi-card relative rounded-xl border border-border/70 bg-card/55 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="text-[15px] font-medium dark:text-muted-foreground tracking-normal">
          {label}
        </span>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-primary/10 transition-all duration-200">
          <Icon className="h-4 w-4 dark:text-primary text-primary" />
        </div>
      </div>
      
      <div className="space-y-3">
        <div 
          className="dark:text-white text-foreground tracking-tight"
          style={{
            fontSize: "2rem",
            fontWeight: "700",
            lineHeight: "1",
            letterSpacing: "-0.02em"
          }}
        >
          {value}
        </div>
        
        <div className="flex flex-col gap-2">
          {delta && (
            <div>
              {getDeltaDisplay()}
            </div>
          )}
          {subtitle && (
            <p className="text-xs dark:text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
