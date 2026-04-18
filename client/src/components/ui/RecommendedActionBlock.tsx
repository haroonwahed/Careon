/**
 * RecommendedActionBlock
 * 
 * Operational Contract Field: recommended_action
 * 
 * Mandatory structure (from governance):
 * 1. Action (verb + target) — "Rond beoordeling af"
 * 2. Why Now (blocker/reason) — "Zonder dit kan matching niet starten"
 * 3. Impact (outcome) — comes from impact_summary component
 * 
 * Rule: Every action must have impact (enforced by ImpactSummary requirement)
 * Rule: No business logic inside component (data comes from backend)
 * Rule: Maps only to recommended_action field
 * 
 * Used on: All operational pages where action is available
 */

import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

interface RecommendedActionBlockProps {
  /** Verb + target. From: recommended_action.label */
  label: string;
  
  /** The blocker or reason now. From: recommended_action.reason */
  reason: string;
  
  /** Optional icon (component decides, not business logic) */
  icon?: ReactNode;
  
  /** Handler for the action. No logic inside. */
  onAction?: () => void;
  
  /** Severity determines visual treatment. From: attention_band */
  severity?: "critical" | "warning" | "info" | "neutral";
}

export function RecommendedActionBlock({
  label,
  reason,
  icon,
  onAction,
  severity = "info"
}: RecommendedActionBlockProps) {
  const severityStyles = {
    critical: "border-red-border/60 bg-red-light/40",
    warning: "border-yellow-border/60 bg-yellow-light/40",
    info: "border-blue-border/60 bg-blue-light/40",
    neutral: "border-border/60 bg-card/60"
  };

  return (
    <button
      onClick={onAction}
      disabled={!onAction}
      className={`premium-card rounded-lg border p-4 space-y-2 text-left transition-all ${
        onAction
          ? "hover:shadow-sm hover:-translate-y-0.5 cursor-pointer"
          : "cursor-default"
      } ${severityStyles[severity]}`}
    >
      {/* Header: Action + Icon */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          {icon && <span className="flex-shrink-0 text-lg">{icon}</span>}
          <p className="font-semibold text-foreground text-sm leading-tight">
            {label}
          </p>
        </div>
        {onAction && (
          <ArrowRight
            size={16}
            className="text-muted-foreground/50 flex-shrink-0 mt-0.5"
          />
        )}
      </div>

      {/* Reason */}
      <p className="text-xs text-muted-foreground leading-tight">
        {reason}
      </p>
    </button>
  );
}
