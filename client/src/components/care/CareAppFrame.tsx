import type { ReactNode } from "react";
import { cn } from "../ui/utils";
import { tokens } from "../../design/tokens";

/**
 * Canonical SPA content frame.
 *
 * All authenticated Care surfaces should render inside this frame so the app
 * keeps one width, one gutter, and one vertical rhythm.
 */
export function CareAppFrame({
  children,
  className,
  /** When set, overrides the default `tokens.layout.pageMaxWidth` (e.g. Regiekamer + right rail). */
  layoutMaxWidth,
}: {
  children: ReactNode;
  className?: string;
  layoutMaxWidth?: string;
}) {
  return (
    <div
      data-testid="care-app-frame"
      className={cn(
        "mx-auto flex w-full min-w-0 max-w-full flex-col gap-4 px-4 py-3 md:px-5 md:py-4",
        className,
      )}
      style={{ maxWidth: layoutMaxWidth ?? tokens.layout.pageMaxWidth }}
    >
      {children}
    </div>
  );
}
