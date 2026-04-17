import { Circle, CheckCircle2, Clock, Calendar } from "lucide-react";

type IntakeStatus = "not-started" | "planned" | "in-progress" | "completed";

interface IntakeStatusTrackerProps {
  currentStatus: IntakeStatus;
  onStatusChange?: (status: IntakeStatus) => void;
  plannedDate?: string;
  completedDate?: string;
}

const statusConfig: Record<IntakeStatus, {
  label: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
}> = {
  "not-started": {
    label: "Nog niet gestart",
    icon: Circle,
    color: "text-muted-foreground",
    bg: "bg-muted/20",
    border: "border-muted-foreground/30"
  },
  "planned": {
    label: "Intake gepland",
    icon: Calendar,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30"
  },
  "in-progress": {
    label: "Intake gestart",
    icon: Clock,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30"
  },
  "completed": {
    label: "Intake afgerond",
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30"
  }
};

export function IntakeStatusTracker({ 
  currentStatus, 
  onStatusChange,
  plannedDate,
  completedDate 
}: IntakeStatusTrackerProps) {
  const config = statusConfig[currentStatus];
  const Icon = config.icon;

  const statuses: IntakeStatus[] = ["not-started", "planned", "in-progress", "completed"];
  const currentIndex = statuses.indexOf(currentStatus);

  return (
    <div className="premium-card p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">
        Intake status
      </h3>

      {/* Current Status Display */}
      <div 
        className={`p-4 rounded-lg border-2 mb-5 ${config.bg} ${config.border}`}
      >
        <div className="flex items-center gap-3 mb-2">
          <Icon size={20} className={config.color} />
          <span className={`text-base font-semibold ${config.color}`}>
            {config.label}
          </span>
        </div>
        
        {plannedDate && currentStatus === "planned" && (
          <p className="text-sm text-muted-foreground ml-8">
            Gepland voor: <strong className="text-foreground">{plannedDate}</strong>
          </p>
        )}
        
        {completedDate && currentStatus === "completed" && (
          <p className="text-sm text-muted-foreground ml-8">
            Afgerond op: <strong className="text-foreground">{completedDate}</strong>
          </p>
        )}
      </div>

      {/* Status Progress Visualization */}
      <div className="space-y-3 mb-5">
        {statuses.map((status, idx) => {
          const statusConf = statusConfig[status];
          const StatusIcon = statusConf.icon;
          const isPast = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = idx > currentIndex;

          return (
            <div key={status} className="relative">
              <div className="flex items-center gap-3">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all
                  ${isCurrent ? `${statusConf.bg} ${statusConf.border}` : ""}
                  ${isPast ? "bg-green-500/20 border-green-500/40" : ""}
                  ${isFuture ? "bg-muted/20 border-muted-foreground/30" : ""}
                `}>
                  {isPast && <CheckCircle2 size={16} className="text-green-400" />}
                  {isCurrent && <StatusIcon size={16} className={statusConf.color} />}
                  {isFuture && <Circle size={16} className="text-muted-foreground" />}
                </div>
                
                <span className={`text-sm font-medium ${
                  isCurrent ? statusConf.color : 
                  isPast ? "text-green-400" : 
                  "text-muted-foreground"
                }`}>
                  {statusConf.label}
                </span>
              </div>
              
              {/* Connecting Line */}
              {idx < statuses.length - 1 && (
                <div className={`
                  w-0.5 h-6 ml-4 mt-1 transition-all
                  ${isPast ? "bg-green-500/40" : "bg-muted-foreground/30"}
                `} />
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Status Update Buttons */}
      {onStatusChange && currentStatus !== "completed" && (
        <div className="pt-4 border-t border-muted-foreground/20">
          <p className="text-xs text-muted-foreground mb-3">Update status</p>
          <div className="space-y-2">
            {currentStatus === "not-started" && (
              <button
                onClick={() => onStatusChange("planned")}
                className="w-full px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm font-medium hover:bg-blue-500/20 transition-colors"
              >
                Markeer als gepland
              </button>
            )}
            {currentStatus === "planned" && (
              <button
                onClick={() => onStatusChange("in-progress")}
                className="w-full px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 transition-colors"
              >
                Start intake
              </button>
            )}
            {currentStatus === "in-progress" && (
              <button
                onClick={() => onStatusChange("completed")}
                className="w-full px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-sm font-medium hover:bg-green-500/20 transition-colors"
              >
                Markeer als afgerond
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
