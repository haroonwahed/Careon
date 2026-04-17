import { SystemSignal } from "../../lib/casesData";
import { AlertCircle, Clock, Shield, TrendingDown } from "lucide-react";

interface SignalCardProps {
  signal: SystemSignal;
}

export function SignalCard({ signal }: SignalCardProps) {
  const typeIcons = {
    capacity: TrendingDown,
    delay: Clock,
    risk: Shield,
    quality: AlertCircle
  };

  const severityStyles = {
    critical: {
      bg: "bg-[rgba(239,68,68,0.1)]",
      border: "border-[rgba(239,68,68,0.3)]",
      text: "text-[#EF4444]",
      icon: "text-[#EF4444]"
    },
    warning: {
      bg: "bg-[rgba(245,158,11,0.1)]",
      border: "border-[rgba(245,158,11,0.3)]",
      text: "text-[#F59E0B]",
      icon: "text-[#F59E0B]"
    },
    info: {
      bg: "bg-primary/10",
      border: "border-primary/30",
      text: "text-primary",
      icon: "text-primary"
    }
  };

  const Icon = typeIcons[signal.type];
  const style = severityStyles[signal.severity];

  return (
    <div 
      className={`
        p-4 rounded-xl border
        ${style.bg} ${style.border}
        transition-all hover:scale-[1.02]
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-card/50 ${style.icon}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-medium text-sm mb-1 ${style.text}`}>
            {signal.title}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {signal.description}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className={style.text}>
              {signal.affectedCases} casussen
            </span>
            {signal.region && (
              <span className="text-muted-foreground">
                · {signal.region}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
