import { Info, AlertTriangle, CheckCircle2, XCircle, Lightbulb } from "lucide-react";

interface SystemInsightProps {
  message: string;
  type: "info" | "warning" | "success" | "blocked" | "suggestion";
  compact?: boolean;
}

const insightConfig = {
  info: {
    icon: Info,
    color: "text-blue-base",
    alertClass: "careon-alert-info"
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-base",
    alertClass: "careon-alert-warning"
  },
  success: {
    icon: CheckCircle2,
    color: "text-green-base",
    alertClass: "careon-alert-success"
  },
  blocked: {
    icon: XCircle,
    color: "text-red-base",
    alertClass: "careon-alert-error"
  },
  suggestion: {
    icon: Lightbulb,
    color: "text-primary",
    alertClass: "careon-alert-primary"
  }
};

export function SystemInsight({ message, type, compact = false }: SystemInsightProps) {
  const config = insightConfig[type];
  const Icon = config.icon;

  return (
    <div 
      className={`flex items-start gap-2.5 ${compact ? "p-2.5" : "p-3"} rounded-lg border ${config.alertClass}`}
    >
      <Icon size={14} className={`${config.color} flex-shrink-0 mt-0.5`} />
      <p className={`text-xs ${config.color} leading-relaxed break-words flex-1`}>
        {message}
      </p>
    </div>
  );
}
