import { FileText, CheckCircle2, AlertCircle, Info } from "lucide-react";

interface SummaryItem {
  text: string;
  type?: "success" | "warning" | "info" | "default";
}

interface SamenvattingProps {
  title?: string;
  items: SummaryItem[];
  compact?: boolean;
}

const itemConfig = {
  success: {
    icon: CheckCircle2,
    color: "text-green-base"
  },
  warning: {
    icon: AlertCircle,
    color: "text-yellow-base"
  },
  info: {
    icon: Info,
    color: "text-blue-base"
  },
  default: {
    icon: CheckCircle2,
    color: "text-muted-foreground"
  }
};

export function Samenvatting({ 
  title = "Samenvatting", 
  items, 
  compact = false 
}: SamenvattingProps) {
  return (
    <div className="premium-card p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          {title}
        </h3>
      </div>

      {/* Summary Items */}
      <ul className={`space-y-${compact ? "1.5" : "2.5"}`}>
        {items.map((item, idx) => {
          const config = itemConfig[item.type || "default"];
          const Icon = config.icon;

          return (
            <li key={idx} className="flex items-start gap-2.5">
              <Icon size={14} className={`${config.color} flex-shrink-0 mt-0.5`} />
              <span className="text-sm text-muted-foreground leading-relaxed break-words flex-1">
                {item.text}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
