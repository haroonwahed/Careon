import { XCircle, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "../ui/utils";
import { quickFilterToneClasses } from "./careSemanticTones";

export type QuickFilter = "no-match" | "delayed" | "high-risk" | "ready-placement" | null;

interface CasussenFilterChipsProps {
  activeFilter: QuickFilter;
  onFilterChange: (filter: QuickFilter) => void;
  counts?: {
    noMatch: number;
    delayed: number;
    highRisk: number;
    readyPlacement: number;
  };
}

export function CasussenFilterChips({ 
  activeFilter, 
  onFilterChange,
  counts = {
    noMatch: 4,
    delayed: 6,
    highRisk: 3,
    readyPlacement: 2
  }
}: CasussenFilterChipsProps) {
  const filters = [
    {
      id: "no-match" as QuickFilter,
      label: "Zonder match",
      icon: XCircle,
      ...quickFilterToneClasses("no-match"),
      count: counts.noMatch
    },
    {
      id: "delayed" as QuickFilter,
      label: "Wacht > 3 dagen",
      icon: Clock,
      ...quickFilterToneClasses("delayed"),
      count: counts.delayed
    },
    {
      id: "high-risk" as QuickFilter,
      label: "Hoog risico",
      icon: AlertTriangle,
      ...quickFilterToneClasses("high-risk"),
      count: counts.highRisk
    },
    {
      id: "ready-placement" as QuickFilter,
      label: "Klaar voor plaatsing",
      icon: CheckCircle2,
      ...quickFilterToneClasses("ready-placement"),
      count: counts.readyPlacement
    }
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = activeFilter === filter.id;
        
        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(isActive ? null : filter.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200",
              isActive
                ? `${filter.activeBg} ${filter.activeBorder} ${filter.color} shadow-sm`
                : `${filter.bg} ${filter.border} ${filter.color}`,
            )}
          >
            <Icon size={16} />
            <span>{filter.label}</span>
            <span className={cn(
              "ml-1 rounded px-1.5 py-0.5 text-xs font-semibold",
              isActive ? "bg-background/40 text-foreground" : "bg-background/30 text-foreground/80",
            )}>
              {filter.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
