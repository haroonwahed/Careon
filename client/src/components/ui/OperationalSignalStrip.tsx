/**
 * OperationalSignalStrip
 * 
 * Operational Contract Field: Derived from attention_band or bottleneck_state
 * 
 * Governance Rule: OperationalSignalStrip only allowed when:
 * - Real operational issue exists (not informational)
 * - Affects multiple items or system state
 * - Not allowed for empty states or soft issues
 * 
 * Rule: No business logic inside component
 * Rule: Severity derived from backend logic, not UI
 * 
 * Used on: Casussen, Beoordelingen, Matching, Plaatsingen (max 1 per page)
 */

import { ReactNode } from "react";

interface OperationalSignalStripProps {
  /** Severity determines visual treatment. From: attention_band */
  severity: "critical" | "warning" | "info";
  
  /** The operational issue. No vague language. */
  message: string;
  
  /** Optional context icon */
  icon?: ReactNode;
  
  /** Optional action. If present, must be actionable. */
  onAction?: () => void;
  actionLabel?: string;
}

export function OperationalSignalStrip({
  severity,
  message,
  icon,
  onAction,
  actionLabel
}: OperationalSignalStripProps) {
  const severityStyles = {
    critical: {
      bg: "bg-red-light/60",
      border: "border-red-border",
      textColor: "text-red-base"
    },
    warning: {
      bg: "bg-yellow-light/65",
      border: "border-yellow-border",
      textColor: "text-yellow-base"
    },
    info: {
      bg: "bg-blue-light/60",
      border: "border-blue-border",
      textColor: "text-blue-base"
    }
  };

  const style = severityStyles[severity];

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} px-4 py-3`}>
      <div className="flex items-center justify-between gap-3">
        {icon && (
          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-background/50 ${style.textColor}`}>
            {icon}
          </span>
        )}
        
        <p className="text-sm font-medium text-foreground flex-1">
          {message}
        </p>
        
        {onAction && actionLabel && (
          <button
            onClick={onAction}
            className="text-xs font-semibold text-foreground hover:text-primary transition-colors flex-shrink-0 whitespace-nowrap"
          >
            {actionLabel} →
          </button>
        )}
      </div>
    </div>
  );
}
