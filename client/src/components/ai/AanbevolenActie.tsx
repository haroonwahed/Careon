import { Sparkles, ChevronRight, Info } from "lucide-react";
import { Button } from "../ui/button";

interface AanbevolenActieProps {
  title: string;
  explanation: string;
  confidence?: "high" | "medium" | "low";
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  variant?: "default" | "urgent";
}

export function AanbevolenActie({
  title,
  explanation,
  confidence = "high",
  actionLabel,
  onAction,
  disabled = false,
  variant = "default"
}: AanbevolenActieProps) {
  const isUrgent = variant === "urgent";
  
  return (
    <div 
      className={`premium-card p-5 border-2 ${
        isUrgent 
          ? "border-purple-500/50 bg-purple-500/5" 
          : "border-primary/40 bg-primary/5"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">
              Aanbevolen actie
            </span>
            {confidence === "medium" && (
              <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded bg-muted/30">
                <Info size={10} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Gemiddeld vertrouwen</span>
              </div>
            )}
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-foreground mb-2 break-words">
            {title}
          </h3>

          {/* Explanation */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 break-words">
            {explanation}
          </p>

          {/* Action Button */}
          <Button
            onClick={onAction}
            disabled={disabled}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {actionLabel}
            <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
