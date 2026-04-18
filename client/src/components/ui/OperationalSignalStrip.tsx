/**
 * OperationalSignalStrip
 * 
 * Standardized component for operational alerts and signals.
 * Used for local action banners on tactical pages.
 * 
 * Used on: Casussen, Beoordelingen, Matching, Plaatsingen
 */

import { ReactNode } from "react";

interface OperationalSignalStripProps {
  severity: "critical" | "warning" | "info";
  message: string;
  icon?: ReactNode;
  cta?: {
    label: string;
    onClick: () => void;
  };
}

export function OperationalSignalStrip({
  severity,
  message,
  icon,
  cta
}: OperationalSignalStripProps) {
  const severityStyles = {
    critical: {
      bg: "bg-red-light/60",
      border: "border-red-border",
      icon: "text-red-base"
    },
    warning: {
      bg: "bg-yellow-light/65",
      border: "border-yellow-border",
      icon: "text-yellow-base"
    },
    info: {
      bg: "bg-blue-light/60",
      border: "border-blue-border",
      icon: "text-blue-base"
    }
  };

  const style = severityStyles[severity];

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} px-4 py-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          {icon && (
            <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-background/50 ${style.icon}`}>
              {icon}
            </span>
          )}
          <p className="text-sm font-medium text-foreground">
            {message}
          </p>
        </div>
        
        {cta && (
          <button
            onClick={cta.onClick}
            className="text-xs font-semibold text-foreground hover:text-primary transition-colors whitespace-nowrap"
          >
            {cta.label} →
          </button>
        )}
      </div>
    </div>
  );
}
