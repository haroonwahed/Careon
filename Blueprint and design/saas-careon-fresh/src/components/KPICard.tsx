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
        colorClass = "dark:text-[#2AF07A] text-emerald-600";
        arrow = "▲";
      } else {
        colorClass = "dark:text-[#FF5C8A] text-red-600";
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
      className="kpi-card relative rounded-2xl p-6 group transition-all duration-200 dark:bg-gradient-to-br dark:from-[#12121C] dark:to-[#16162A] bg-gradient-to-br from-white to-[#fafafa] border dark:border-primary/20 border-primary/15"
      style={{
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08), 0 0 0 0.5px rgba(139, 92, 246, 0.08)"
      }}
    >
      <div className="flex items-start justify-between mb-5">
        <span className="text-[15px] font-medium dark:text-muted-foreground text-muted-foreground tracking-normal">
          {label}
        </span>
        <div 
          className="w-9 h-9 rounded-xl dark:bg-primary/15 bg-primary/10 flex items-center justify-center transition-all duration-200"
        >
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
            <p className="text-xs dark:text-muted-foreground text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}