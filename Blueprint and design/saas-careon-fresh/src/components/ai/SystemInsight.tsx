import { Info, AlertTriangle, CheckCircle2, XCircle, Lightbulb } from "lucide-react";

interface SystemInsightProps {
  message: string;
  type: "info" | "warning" | "success" | "blocked" | "suggestion";
  compact?: boolean;
}

const insightConfig = {
  info: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30"
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30"
  },
  success: {
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30"
  },
  blocked: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30"
  },
  suggestion: {
    icon: Lightbulb,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30"
  }
};

export function SystemInsight({ message, type, compact = false }: SystemInsightProps) {
  const config = insightConfig[type];
  const Icon = config.icon;

  return (
    <div 
      className={`flex items-start gap-2.5 ${compact ? "p-2.5" : "p-3"} rounded-lg border ${config.bg} ${config.border}`}
    >
      <Icon size={14} className={`${config.color} flex-shrink-0 mt-0.5`} />
      <p className={`text-xs ${config.color} leading-relaxed break-words flex-1`}>
        {message}
      </p>
    </div>
  );
}
