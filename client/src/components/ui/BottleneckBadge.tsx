/**
 * BottleneckBadge
 * 
 * Operational Contract Field: bottleneck_state
 * 
 * Governance Rule: BottleneckBadge only allowed when:
 * - Item actually blocks critical flow (matching/placement/assessment)
 * - NOT allowed for general warnings or soft issues
 * 
 * Rule: 3 fixed variants only (matching, placement, assessment)
 * Rule: Component has NO logic for determining bottlenecks (from backend)
 * Rule: Maps ONLY to bottleneck_state field
 * 
 * Used on: Beoordelingen, Matching (only when item blocks flow)
 */

interface BottleneckBadgeProps {
  /** One of 3 fixed variants. From: bottleneck_state */
  variant: "matching" | "placement" | "assessment";
}

export function BottleneckBadge({ variant }: BottleneckBadgeProps) {
  const variants = {
    matching: {
      label: "Blokkeert matching",
      bg: "bg-red-light/40",
      text: "text-red-base",
      border: "border-red-border/40"
    },
    placement: {
      label: "Blokkeert plaatsing",
      bg: "bg-orange-light/40",
      text: "text-orange-base",
      border: "border-orange-border/40"
    },
    assessment: {
      label: "Vertraagt beoordeling",
      bg: "bg-yellow-light/40",
      text: "text-yellow-base",
      border: "border-yellow-border/40"
    }
  };

  const style = variants[variant];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${style.bg} ${style.text} ${style.border}`}>
      🔒
      <span>{style.label}</span>
    </span>
  );
}
