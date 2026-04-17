import { CheckCircle2, Circle, AlertTriangle, XCircle } from "lucide-react";

type ValidationStatus = "complete" | "incomplete" | "warning" | "error";

interface ValidationItem {
  id: string;
  label: string;
  status: ValidationStatus;
  description?: string;
}

interface PlacementValidationChecklistProps {
  items: ValidationItem[];
}

const statusConfig: Record<ValidationStatus, {
  icon: any;
  color: string;
  bg: string;
  border: string;
}> = {
  complete: {
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30"
  },
  incomplete: {
    icon: Circle,
    color: "text-muted-foreground",
    bg: "bg-muted/20",
    border: "border-muted-foreground/30"
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30"
  },
  error: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30"
  }
};

export function PlacementValidationChecklist({ items }: PlacementValidationChecklistProps) {
  const allComplete = items.every(item => item.status === "complete");
  const hasErrors = items.some(item => item.status === "error");
  const hasWarnings = items.some(item => item.status === "warning");

  return (
    <div className="premium-card p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground mb-1">
          Validatie checklist
        </h3>
        <p className="text-sm text-muted-foreground">
          {allComplete && "Alle vereisten voldaan"}
          {hasErrors && "Er zijn blokkerende problemen"}
          {!allComplete && !hasErrors && hasWarnings && "Let op waarschuwingen"}
          {!allComplete && !hasErrors && !hasWarnings && "Controleer alle items"}
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const config = statusConfig[item.status];
          const Icon = config.icon;

          return (
            <div
              key={item.id}
              className={`
                p-4 rounded-lg border-2 transition-all
                ${config.bg} ${config.border}
              `}
            >
              <div className="flex items-start gap-3">
                <Icon size={20} className={`${config.color} flex-shrink-0 mt-0.5`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    item.status === "complete" ? "text-foreground" : config.color
                  }`}>
                    {item.label}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Status Summary */}
      <div className="mt-5 pt-4 border-t border-muted-foreground/20">
        {allComplete && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 size={16} className="text-green-400" />
            <span className="font-medium text-green-400">
              Klaar voor plaatsing
            </span>
          </div>
        )}
        {hasErrors && (
          <div className="flex items-center gap-2 text-sm">
            <XCircle size={16} className="text-red-400" />
            <span className="font-medium text-red-400">
              Los eerst blokkerende problemen op
            </span>
          </div>
        )}
        {!allComplete && !hasErrors && hasWarnings && (
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle size={16} className="text-amber-400" />
            <span className="font-medium text-amber-400">
              Controleer waarschuwingen voordat je doorgaat
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
