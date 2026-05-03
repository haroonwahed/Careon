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
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-testid="care-app-frame"
      className={cn(
        "mx-auto flex w-full min-w-0 max-w-full flex-col gap-6 px-4 py-4 md:px-6 md:py-5",
        className,
      )}
      style={{ maxWidth: tokens.layout.pageMaxWidth }}
    >
      {children}
    </div>
  );
}
