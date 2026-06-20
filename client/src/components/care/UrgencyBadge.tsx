/**
 * @deprecated Use `CareBadge` from CareDesignPrimitives or `PriorityBadge` for operational priority.
 * This component is retained for backwards compatibility only.
 */
import type { UrgencyLevel } from "../../lib/careTypes";
import { AlertCircle, AlertTriangle, Clock, Info } from "lucide-react";
import { cn } from "../ui/utils";

interface UrgencyBadgeProps {
  urgency?: UrgencyLevel;
  level?: UrgencyLevel;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

const URGENCY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  critical: {
    bg: "var(--care-badge-red-bg)",
    text: "var(--care-badge-red-text)",
    border: "var(--care-badge-red-bg)",
  },
  high: {
    bg: "var(--care-badge-amber-bg)",
    text: "var(--care-badge-amber-text)",
    border: "var(--care-badge-amber-bg)",
  },
  medium: {
    bg: "var(--care-badge-muted-bg)",
    text: "var(--care-badge-muted-text)",
    border: "var(--border)",
  },
  low: {
    bg: "var(--care-badge-muted-bg)",
    text: "var(--care-badge-muted-text)",
    border: "var(--border)",
  },
};

const URGENCY_CONFIG: Record<string, { label: string; Icon: typeof AlertCircle }> = {
  critical: { label: "Kritiek", Icon: AlertCircle },
  high:     { label: "Hoog",    Icon: AlertTriangle },
  medium:   { label: "Gemiddeld", Icon: Clock },
  low:      { label: "Laag",    Icon: Info },
};

const SIZE_CLASS = {
  sm: "px-2 py-0.5 text-xs gap-1",
  md: "px-2.5 py-1 text-sm gap-1.5",
  lg: "px-3 py-1.5 text-base gap-2",
};

const ICON_SIZE = { sm: 12, md: 14, lg: 16 };

export function UrgencyBadge({ urgency, level, showIcon = true, size = "md" }: UrgencyBadgeProps) {
  const urgencyLevel = urgency || level;
  if (!urgencyLevel) return null;
  const config = URGENCY_CONFIG[urgencyLevel];
  const style = URGENCY_STYLE[urgencyLevel];
  if (!config || !style) return null;
  const { Icon } = config;

  return (
    <div
      className={cn("inline-flex items-center rounded-md border font-medium", SIZE_CLASS[size])}
      style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}
    >
      {showIcon && <Icon size={ICON_SIZE[size]} aria-hidden />}
      <span>{config.label}</span>
    </div>
  );
}
