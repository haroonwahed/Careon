import type { ReactNode } from "react";
import { tokens } from "../../design/tokens";

/**
 * DO NOT DUPLICATE.
 * If you need this pattern, import this component.
 *
 * Density contract:
 * - Must remain compact (no step-card layouts)
 * - Prefer connected timeline/segment visualization
 * - Casus Detail only
 */
interface ProcessTimelineProps {
  children: ReactNode;
  className?: string;
}

/** Contract: ONLY allowed in Casus Detail (execution canonical flow). */
export function ProcessTimeline({ children, className }: ProcessTimelineProps) {
  return (
    <div
      data-testid="case-process-timeline"
      data-density="compact"
      className={className}
      style={{
        borderRadius: tokens.radius.md,
        border: `1px solid ${tokens.colors.border}`,
        minHeight: tokens.density.processTimelineHeight,
      }}
    >
      {children}
    </div>
  );
}
