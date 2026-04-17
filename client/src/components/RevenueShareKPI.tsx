import { PieChart } from "lucide-react";
import { Language, t } from "../lib/i18n";

interface RevenueShareData {
  account: string;
  revenue: number;
  percentage: number;
  color: string;
}

interface RevenueShareKPIProps {
  data: RevenueShareData[];
  language: Language;
}

export function RevenueShareKPI({ data, language }: RevenueShareKPIProps) {
  const topAccount = data[0];
  
  if (!topAccount) return null;

  return (
    <div
      className="rounded-2xl border dark:border-[rgba(168,85,247,0.25)] border-border dark:bg-[#0E0E14] bg-card p-6 flex flex-col justify-between"
      style={{
        boxShadow:
          "0 0 0 1px rgba(168,85,247,0.25), 0 0 28px rgba(168,85,247,0.10)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-xl"
          style={{
            backgroundColor: "rgba(168, 85, 247, 0.12)",
          }}
        >
          <PieChart className="h-6 w-6 dark:text-primary text-primary" />
        </div>
      </div>

      <div>
        <p className="text-sm dark:text-[#9CA3AF] text-muted-foreground mb-1">
          {t(language, "kpi.revenueShare")}
        </p>
        <p className="text-3xl dark:text-[#E7E7F0] text-foreground tabular-nums mb-2">
          {data.length}
        </p>
        
        <div className="space-y-1.5">
          {data.slice(0, 3).map((item, idx) => (
            <div key={item.account} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs dark:text-[#9CA3AF] text-muted-foreground truncate">
                {item.account}
              </span>
              <span className="text-xs dark:text-[#E7E7F0] text-foreground ml-auto tabular-nums">
                {item.percentage.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
