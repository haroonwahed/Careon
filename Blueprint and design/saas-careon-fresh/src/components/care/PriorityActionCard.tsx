import { PriorityAction } from "../../lib/casesData";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";

interface PriorityActionCardProps {
  action: PriorityAction;
  onTakeAction: () => void;
}

export function PriorityActionCard({ action, onTakeAction }: PriorityActionCardProps) {
  const priorityStyles = {
    urgent: {
      bg: "bg-[rgba(239,68,68,0.1)]",
      border: "border-[rgba(239,68,68,0.3)]",
      text: "text-[#EF4444]",
      dot: "bg-[#EF4444]"
    },
    high: {
      bg: "bg-[rgba(245,158,11,0.1)]",
      border: "border-[rgba(245,158,11,0.3)]",
      text: "text-[#F59E0B]",
      dot: "bg-[#F59E0B]"
    },
    medium: {
      bg: "bg-primary/10",
      border: "border-primary/30",
      text: "text-primary",
      dot: "bg-primary"
    }
  };

  const style = priorityStyles[action.priority];

  return (
    <div 
      className={`
        p-4 rounded-xl border
        ${style.bg} ${style.border}
        transition-all hover:scale-[1.01]
        group cursor-pointer
      `}
      onClick={onTakeAction}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 flex-1">
          <div className={`w-2 h-2 rounded-full mt-1.5 ${style.dot}`} />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm mb-0.5">
              {action.action}
            </div>
            <div className="text-xs text-muted-foreground">
              {action.clientName} · {action.caseId}
            </div>
          </div>
        </div>
        <AlertCircle size={16} className={style.text} />
      </div>
      
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${style.text}`}>
          {action.deadline}
        </span>
        <Button 
          size="sm" 
          variant="ghost"
          className={`
            opacity-0 group-hover:opacity-100 transition-opacity
            hover:bg-primary hover:text-white
          `}
          onClick={(e) => {
            e.stopPropagation();
            onTakeAction();
          }}
        >
          <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}
