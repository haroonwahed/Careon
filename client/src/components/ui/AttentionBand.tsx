/**
 * AttentionBand
 * 
 * Standardized urgency/attention language across all pages.
 * Creates one operational vocabulary for severity levels.
 * 
 * Used on: Every item where attention/urgency needs to be indicated
 */

interface AttentionBandProps {
  level: "now" | "today" | "monitor" | "waiting";
  label?: string;  // Override default label
  compact?: boolean;
}

export function AttentionBand({ level, label, compact = false }: AttentionBandProps) {
  const levels = {
    now: {
      label: "Directe actie",
      shortLabel: "Nu",
      bg: "bg-red-light/50",
      text: "text-red-base",
      border: "border-red-border/50",
      icon: "🔴"
    },
    today: {
      label: "Vandaag oppakken",
      shortLabel: "Vandaag",
      bg: "bg-orange-light/50",
      text: "text-orange-base",
      border: "border-orange-border/50",
      icon: "🟠"
    },
    monitor: {
      label: "Monitoren",
      shortLabel: "Monitor",
      bg: "bg-yellow-light/50",
      text: "text-yellow-base",
      border: "border-yellow-border/50",
      icon: "🟡"
    },
    waiting: {
      label: "Wacht op externe partij",
      shortLabel: "Wacht",
      bg: "bg-blue-light/50",
      text: "text-blue-base",
      border: "border-blue-border/50",
      icon: "🔵"
    }
  };

  const style = levels[level];
  const displayLabel = label || (compact ? style.shortLabel : style.label);

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${style.bg} ${style.text} ${style.border}`}>
      <span className="text-sm">{style.icon}</span>
      {displayLabel}
    </span>
  );
}
