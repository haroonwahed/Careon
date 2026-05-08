import { ChevronLeft, PanelRightOpen } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";

interface RegieRailToggleButtonProps {
  collapsed: boolean;
  onToggle: () => void;
  testId?: string;
}

export function RegieRailToggleButton({ collapsed, onToggle, testId }: RegieRailToggleButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-testid={testId}
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Regie-rail openen" : "Regie-rail inklappen"}
      className="h-9 gap-2 rounded-xl px-3 text-[13px] font-semibold"
    >
      <PanelRightOpen size={14} aria-hidden />
      {collapsed ? "Open rail" : "Sluit rail"}
    </Button>
  );
}

interface RegieRailEdgeTabProps {
  onExpand: () => void;
  testId?: string;
}

export function RegieRailEdgeTab({ onExpand, testId }: RegieRailEdgeTabProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onExpand}
      aria-label="Regie-rail openen"
      className={cn(
        "fixed right-0 top-1/2 z-20 -translate-y-1/2 rounded-l-xl border border-border/70 bg-card px-2.5 py-3 text-muted-foreground shadow-md",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <ChevronLeft size={16} aria-hidden />
    </button>
  );
}

