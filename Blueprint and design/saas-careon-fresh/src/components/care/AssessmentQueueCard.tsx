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
    color: "bg-blue-500/20 text-blue-300 border-blue-500/30"
  },
  in_progress: {
    label: "Bezig",
    color: "bg-amber-500/20 text-amber-300 border-amber-500/30"
  },
  completed: {
    label: "Afgerond",
    color: "bg-green-500/20 text-green-300 border-green-500/30"
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
    <div className={`
      premium-card p-5 transition-all duration-200
      hover:border-primary/50 hover:shadow-lg
      ${hasErrors ? "border-red-500/30" : ""}
      ${hasWarnings && !hasErrors ? "border-amber-500/30" : ""}
    `}>
      <div className="flex items-start justify-between gap-4">
        {/* Left: Case Info */}
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${config.color}`}>
              {config.label}
            </span>
            {wachttijd > 3 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/20 border border-red-500/30">
                <Clock size={12} className="text-red-400" />
                <span className="text-xs font-semibold text-red-400">
                  {wachttijd}d
                </span>
              </div>
            )}
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold text-foreground mb-2">
            {caseTitle}
          </h3>

          {/* Meta Info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
            <div className="flex items-center gap-1.5">
              <MapPin size={14} />
              <span>{regio}</span>
            </div>
            <div className="text-xs">
              Case ID: {id}
            </div>
          </div>

          {/* Missing Info Indicators */}
          {missingInfo.length > 0 && (
            <div className="space-y-2">
              {missingInfo.slice(0, 2).map((info, idx) => (
                <div
                  key={idx}
                  className={`
                    flex items-start gap-2 px-3 py-2 rounded-lg border
                    ${info.severity === "error"
                      ? "bg-red-500/10 border-red-500/20"
                      : "bg-amber-500/10 border-amber-500/20"
                    }
                  `}
                >
                  <AlertTriangle
                    size={14}
                    className={`flex-shrink-0 mt-0.5 ${
                      info.severity === "error" ? "text-red-400" : "text-amber-400"
                    }`}
                  />
                  <span className={`text-xs ${
                    info.severity === "error" ? "text-red-300" : "text-amber-300"
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

        {/* Right: Action */}
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
            <p className="text-xs text-amber-400">
              Concept opgeslagen
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
