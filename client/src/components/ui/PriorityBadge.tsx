/**
 * PriorityBadge
 * 
 * Standardized priority/urgency badge across operational pages.
 * Creates consistent urgency vocabulary app-wide.
 * 
 * Used on: Every casus card and actionable item
 */

interface PriorityBadgeProps {
  variant: "first" | "soon" | "monitor" | "waiting" | "escalate";
  compact?: boolean;
}

export function PriorityBadge({ variant, compact = false }: PriorityBadgeProps) {
  const variants = {
    first: {
      label: "Hoogste prioriteit",
      shortLabel: "Prioriteit",
      bg: "bg-red-light/50",
      text: "text-red-base",
      border: "border-red-border/50"
    },
    soon: {
      label: "Eerst oppakken",
      shortLabel: "Eerst",
      bg: "bg-orange-light/50",
      text: "text-orange-base",
      border: "border-orange-border/50"
    },
    monitor: {
      label: "Monitoren",
      shortLabel: "Monitor",
      bg: "bg-yellow-light/50",
      text: "text-yellow-base",
      border: "border-yellow-border/50"
    },
    waiting: {
      label: "Wacht op externe partij",
      shortLabel: "Wachten",
      bg: "bg-blue-light/50",
      text: "text-blue-base",
      border: "border-blue-border/50"
    },
    escalate: {
      label: "Escalatie aanbevolen",
      shortLabel: "Escalatie",
      bg: "bg-red-light/40",
      text: "text-red-base",
      border: "border-red-border/40"
    }
  };

  const style = variants[variant];
  const label = compact ? style.shortLabel : style.label;

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-semibold ${style.bg} ${style.text} ${style.border}`}>
      {label}
    </span>
  );
}
