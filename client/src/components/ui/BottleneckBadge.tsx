/**
 * BottleneckBadge
 * 
 * Signals that an item is blocking critical flow stages.
 * Used locally on pages to highlight what is preventing progress.
 * 
 * Used on: Casussen, Beoordelingen, Matching, Plaatsingen
 */

interface BottleneckBadgeProps {
  variant: "matching" | "placement" | "assessment";
  compact?: boolean;
}

export function BottleneckBadge({ variant, compact = false }: BottleneckBadgeProps) {
  const variants = {
    matching: {
      label: "Blokkeert matching",
      shortLabel: "Blokkeert matching",
      icon: "🔒",
      bg: "bg-red-light/40",
      text: "text-red-base",
      border: "border-red-border/40"
    },
    placement: {
      label: "Blokkeert plaatsing",
      shortLabel: "Blokkeert plaatsing",
      icon: "🛑",
      bg: "bg-orange-light/40",
      text: "text-orange-base",
      border: "border-orange-border/40"
    },
    assessment: {
      label: "Vertraagt beoordeling",
      shortLabel: "Vertraagt beoordeling",
      icon: "⏳",
      bg: "bg-yellow-light/40",
      text: "text-yellow-base",
      border: "border-yellow-border/40"
    }
  };

  const style = variants[variant];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${style.bg} ${style.text} ${style.border}`}>
      <span>{style.icon}</span>
      {style.label}
    </span>
  );
}
