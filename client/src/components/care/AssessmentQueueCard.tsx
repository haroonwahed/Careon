import { Clock, MapPin, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";

interface MissingInfo {
  field: string;
  severity: "error" | "warning";
}

interface AssessmentQueueCardProps {
  id: string;
  caseTitle: string;
  regio: string;
  wachttijd: number;
  status: "open" | "in_progress" | "completed";
  missingInfo?: MissingInfo[];
  onStart: () => void;
}

const statusConfig = {
  open: {
    label: "Te doen",
    color: "border border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
  },
  in_progress: {
    label: "Bezig",
    color: "border border-amber-500/30 bg-amber-500/10 text-amber-200"
  },
  completed: {
    label: "Afgerond",
    color: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
  }
};

export function AssessmentQueueCard({
  id,
  caseTitle,
  regio,
  wachttijd,
  status,
  missingInfo = [],
  onStart
}: AssessmentQueueCardProps) {
  const config = statusConfig[status];
  const hasErrors = missingInfo.some(info => info.severity === "error");
  const hasWarnings = missingInfo.some(info => info.severity === "warning");

  return (
    <article className={`
      panel-surface queue-row transition-colors
      ${hasErrors ? "border-destructive/40" : ""}
      ${hasWarnings && !hasErrors ? "border-amber-500/40" : ""}
    `}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className={`ds-badge ${config.color}`}>
              {config.label}
            </span>
            {wachttijd > 3 && (
              <div className="flex items-center gap-1.5 ds-badge badge-critical">
                <Clock size={12} className="text-destructive" />
                <span className="text-xs font-semibold text-destructive">
                  {wachttijd}d
                </span>
              </div>
            )}
          </div>

          <h3 className="queue-title text-base font-semibold text-foreground mb-2">
            {caseTitle}
          </h3>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
            <div className="flex items-center gap-1.5">
              <MapPin size={14} />
              <span>{regio}</span>
            </div>
            <div className="text-xs">
              Casus-ID: {id}
            </div>
          </div>

          {missingInfo.length > 0 && (
            <div className="space-y-2">
              {missingInfo.slice(0, 2).map((info, idx) => (
                <div
                  key={idx}
                  className={`
                    flex items-start gap-2 px-3 py-2 rounded-lg border
                    ${info.severity === "error"
                      ? "border-destructive/30 bg-destructive/10"
                      : "border-amber-500/30 bg-amber-500/10"
                    }
                  `}
                >
                  <AlertTriangle
                    size={14}
                    className={`flex-shrink-0 mt-0.5 ${
                      info.severity === "error" ? "text-destructive" : "text-amber-300"
                    }`}
                  />
                  <span className={`text-xs ${
                    info.severity === "error" ? "text-destructive" : "text-amber-300"
                  }`}>
                    {info.field}
                  </span>
                </div>
              ))}
              {missingInfo.length > 2 && (
                <p className="text-xs text-muted-foreground ml-5">
                  +{missingInfo.length - 2} meer
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-3">
          <Button
            onClick={onStart}
            className="bg-primary hover:bg-primary/90 text-white font-semibold"
          >
            {status === "in_progress" ? "Verder gaan" : "Start beoordeling"}
            <ArrowRight size={16} className="ml-2" />
          </Button>
          
          {status === "open" && (
            <p className="text-xs text-muted-foreground">
              Nog niet gestart
            </p>
          )}
          {status === "in_progress" && (
            <p className="text-xs text-amber-300">
              Concept opgeslagen
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
