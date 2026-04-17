import { AlertTriangle, AlertCircle, Info, AlertOctagon } from "lucide-react";

interface RiskSignal {
  severity: "critical" | "warning" | "info";
  message: string;
}

interface RisicosignalenProps {
  signals: RiskSignal[];
  compact?: boolean;
}

const severityConfig = {
  critical: {
    icon: AlertOctagon,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30"
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30"
  },
  info: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30"
  }
};

export function Risicosignalen({ signals, compact = false }: RisicosignalenProps) {
  if (signals.length === 0) return null;

  const hasCritical = signals.some(s => s.severity === "critical");

  return (
    <div 
      className={`premium-card p-4 border-2 ${
        hasCritical ? "border-red-500/40" : "border-amber-500/30"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className={hasCritical ? "text-red-400" : "text-amber-400"} />
        <h3 className="text-sm font-semibold text-foreground">
          Risicosignalen
        </h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {signals.length} {signals.length === 1 ? "signaal" : "signalen"}
        </span>
      </div>

      {/* Signals List */}
      <div className={`space-y-${compact ? "1.5" : "2"}`}>
        {signals.map((signal, idx) => {
          const config = severityConfig[signal.severity];
          const Icon = config.icon;

          return (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border ${config.bg} ${config.border}`}
            >
              <div className="flex items-start gap-2">
                <Icon size={14} className={`${config.color} flex-shrink-0 mt-0.5`} />
                <p className={`text-xs ${config.color} leading-relaxed break-words flex-1`}>
                  {signal.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
