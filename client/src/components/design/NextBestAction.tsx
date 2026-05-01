import type { ReactNode } from "react";
import { tokens } from "../../design/tokens";

/**
 * DO NOT DUPLICATE.
 * If you need this pattern, import this component.
 *
 * Density contract:
 * - Must remain the dominant execution element on Casus Detail
 * - Should not exceed around 156px visual height
 * - Casus Detail only
 */
interface NextBestActionProps {
  children: ReactNode;
  className?: string;
}

/** Contract: ONLY allowed in Casus Detail (execution). */
export function NextBestAction({ children, className }: NextBestActionProps) {
  return (
    <div
      data-testid="next-best-action"
      data-priority="primary"
      className={className}
      style={{
        rowGap: tokens.spacing.sectionGap,
        minHeight: tokens.density.nextBestActionMinHeight,
        maxHeight: tokens.density.nextBestActionMaxHeight,
      }}
    >
      {children}
    </div>
  );
}
