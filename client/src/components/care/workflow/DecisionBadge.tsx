import { AlertTriangle, CheckCircle2, Clock3, Info, ShieldAlert } from "lucide-react";
import { Badge } from "../../ui/badge";
import type { WorkflowDecisionBadgeTone } from "../../../lib/workflowUi";

interface DecisionBadgeProps {
  label: string;
  tone: WorkflowDecisionBadgeTone;
}

function toneConfig(tone: WorkflowDecisionBadgeTone) {
  switch (tone) {
    case "critical":
      return { variant: "red" as const, icon: AlertTriangle };
    case "warning":
      return { variant: "yellow" as const, icon: ShieldAlert };
    case "good":
      return { variant: "blue" as const, icon: CheckCircle2 };
    case "info":
      return { variant: "secondary" as const, icon: Info };
    default:
      return { variant: "outline" as const, icon: Clock3 };
  }
}

export function DecisionBadge({ label, tone }: DecisionBadgeProps) {
  const config = toneConfig(tone);
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
      <Icon size={12} />
      {label}
    </Badge>
  );
}