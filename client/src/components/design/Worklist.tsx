import type { ReactNode } from "react";
import { tokens } from "../../design/tokens";

/**
 * DO NOT DUPLICATE.
 * If you need this pattern, import this component.
 *
 * Density contract:
 * - Rows must remain compact
 * - Prefer row separators over heavy card shells
 * - Casussen only
 */
interface WorklistProps {
  children: ReactNode;
  className?: string;
}

/** Contract: ONLY allowed in Casussen (workload / triage). */
export function Worklist({ children, className }: WorklistProps) {
  return (
    <div
      data-testid="worklist"
      data-density="compact"
      className={className}
      style={{ gap: tokens.spacing.rowGap }}
    >
      {children}
    </div>
  );
}
