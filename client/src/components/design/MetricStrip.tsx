import type { ReactNode } from "react";
import { tokens } from "../../design/tokens";

/**
 * DO NOT DUPLICATE.
 * If you need this pattern, import this component.
 *
 * Density contract:
 * - Must remain compact (around 48-56px visual height)
 * - Must not become KPI card-grid tiles
 * - Regiekamer only
 */
interface MetricStripProps {
  children: ReactNode;
  className?: string;
}

/** Contract: ONLY allowed in Regiekamer (system awareness). */
export function MetricStrip({ children, className }: MetricStripProps) {
  return (
    <div
      data-testid="metric-strip"
      data-density="compact"
      className={className}
      style={{
        backgroundColor: tokens.colors.surface,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.md,
        minHeight: tokens.density.metricStripHeight,
      }}
    >
      {children}
    </div>
  );
}
