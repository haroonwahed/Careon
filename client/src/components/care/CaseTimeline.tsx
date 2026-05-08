import { 
  FileText, 
  ClipboardCheck, 
  GitMerge, 
  CheckCircle2,
  Clock
} from "lucide-react";
import { tokens } from "../../design/tokens";
import { CarePanel } from "./CareDesignPrimitives";

interface TimelineEvent {
  id: string;
  type: "created" | "assessed" | "matched" | "placed" | "intake";
  title: string;
  description: string;
  timestamp: string;
  user?: string;
}

interface CaseTimelineProps {
  events: TimelineEvent[];
}

const eventConfig = {
  created: {
    icon: FileText,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30"
  },
  assessed: {
    icon: ClipboardCheck,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30"
  },
  matched: {
    icon: GitMerge,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30"
  },
  placed: {
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30"
  },
  intake: {
    icon: Clock,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30"
  }
};

export function CaseTimeline({ events }: CaseTimelineProps) {
  return (
    <CarePanel className="p-4">
      <h3 className="text-base font-semibold text-foreground mb-4">
        Case historie
      </h3>

      <div className="space-y-3">
        {events.map((event, idx) => {
          const config = eventConfig[event.type];
          const Icon = config.icon;
          const isLast = idx === events.length - 1;

          return (
            <div key={event.id} className="relative">
              <div className="flex gap-4">
                {/* Icon */}
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2
                  ${config.bg} ${config.border}
                `}>
                  <Icon size={18} className={config.color} />
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <p className="text-sm font-semibold text-foreground">
                      {event.title}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {event.timestamp}
                    </span>
                  </div>
                  
                  <p className="text-xs text-muted-foreground leading-relaxed mb-1">
                    {event.description}
                  </p>
                  
                  {event.user && (
                    <p className="text-xs text-muted-foreground">
                      Door: <span className="text-foreground">{event.user}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Connecting Line */}
              {!isLast && (
                <div
                  className="absolute left-5 w-0.5 h-full bg-muted-foreground/20"
                  style={{ top: tokens.layout.timelineConnectorTop, transform: 'translateX(-1px)' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </CarePanel>
  );
}
