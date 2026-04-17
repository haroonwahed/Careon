import { XCircle, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

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
      color: "text-[#EF4444]",
      bg: "bg-[rgba(239,68,68,0.1)]",
      border: "border-[rgba(239,68,68,0.3)]",
      activeBg: "bg-[rgba(239,68,68,0.15)]",
      activeBorder: "border-[rgba(239,68,68,0.5)]",
      count: counts.noMatch
    },
    {
      id: "delayed" as QuickFilter,
      label: "Wacht > 3 dagen",
      icon: Clock,
      color: "text-[#F59E0B]",
      bg: "bg-[rgba(245,158,11,0.1)]",
      border: "border-[rgba(245,158,11,0.3)]",
      activeBg: "bg-[rgba(245,158,11,0.15)]",
      activeBorder: "border-[rgba(245,158,11,0.5)]",
      count: counts.delayed
    },
    {
      id: "high-risk" as QuickFilter,
      label: "Hoog risico",
      icon: AlertTriangle,
      color: "text-[#F59E0B]",
      bg: "bg-[rgba(245,158,11,0.1)]",
      border: "border-[rgba(245,158,11,0.3)]",
      activeBg: "bg-[rgba(245,158,11,0.15)]",
      activeBorder: "border-[rgba(245,158,11,0.5)]",
      count: counts.highRisk
    },
    {
      id: "ready-placement" as QuickFilter,
      label: "Klaar voor plaatsing",
      icon: CheckCircle2,
      color: "text-[#10B981]",
      bg: "bg-[rgba(16,185,129,0.1)]",
      border: "border-[rgba(16,185,129,0.3)]",
      activeBg: "bg-[rgba(16,185,129,0.15)]",
      activeBorder: "border-[rgba(16,185,129,0.5)]",
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
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-lg border font-medium text-sm
              transition-all duration-200
              ${isActive 
                ? `${filter.activeBg} ${filter.activeBorder} ${filter.color} shadow-sm` 
                : `${filter.bg} ${filter.border} ${filter.color} hover:${filter.activeBg}`
              }
            `}
          >
            <Icon size={16} />
            <span>{filter.label}</span>
            <span className={`
              ml-1 px-1.5 py-0.5 rounded text-xs font-semibold
              ${isActive 
                ? 'bg-background/40 text-foreground' 
                : 'bg-background/30 text-foreground/80'
              }
            `}>
              {filter.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
