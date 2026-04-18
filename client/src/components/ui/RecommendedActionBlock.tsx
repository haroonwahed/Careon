/**
 * RecommendedActionBlock
 * 
 * Standardized component for displaying recommended actions across operational pages.
 * Structure: Action → Why Now → Impact
 * 
 * Used on: Regiekamer, Casussen, Beoordelingen, Matching, Plaatsingen
 */

import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

interface RecommendedActionBlockProps {
  action: string;           // Verb + target: "Rond beoordeling af"
  whyNow: string;          // The blocker: "Zonder dit kan matching niet starten"
  impact: string;          // Outcome: "Ontgrendelt vervolgstap"
  icon?: ReactNode;        // Optional icon
  onClick?: () => void;    // Optional action handler
  variant?: "primary" | "secondary" | "warning" | "critical";
}

export function RecommendedActionBlock({
  action,
  whyNow,
  impact,
  icon,
  onClick,
  variant = "primary"
}: RecommendedActionBlockProps) {
  const variantStyles = {
    primary: "border-blue-border/60 bg-blue-light/40",
    secondary: "border-border/60 bg-card/60",
    warning: "border-yellow-border/60 bg-yellow-light/40",
    critical: "border-red-border/60 bg-red-light/40"
  };

  return (
    <div className={`premium-card rounded-lg border p-4 space-y-2 ${variantStyles[variant]}`}>
      <button
        onClick={onClick}
        className="w-full text-left group"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              {icon && <span className="text-lg">{icon}</span>}
              <p className="font-semibold text-foreground text-sm">
                {action}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {whyNow}
            </p>
          </div>
          <ArrowRight size={16} className="text-muted-foreground/50 group-hover:text-primary/70 transition-colors flex-shrink-0 mt-0.5" />
        </div>
      </button>
      
      <div className="pt-2 border-t border-border/30">
        <p className="text-xs font-medium text-foreground italic">
          → {impact}
        </p>
      </div>
    </div>
  );
}
