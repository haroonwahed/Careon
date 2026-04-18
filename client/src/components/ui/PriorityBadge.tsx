/**
 * PriorityBadge
 * 
 * Operational Contract Field: priority_rank (and indirectly escalation_recommended)
 * 
 * Governance Rule: PriorityBadge only allowed when:
 * - Items are ranked or triaged
 * - Not allowed for flat lists or non-priority views
 * 
 * Rule: 5 fixed variants only. NO custom variants allowed.
 * Rule: Component has NO business logic for ranking (data from backend)
 * Rule: Maps ONLY to priority_rank field
 * 
 * Used on: Casussen, Regiekamer (max 1 badge per item)
 */

interface PriorityBadgeProps {
  /** One of 5 fixed variants. From: priority_rank or escalation_recommended */
  variant: "first" | "soon" | "monitor" | "waiting" | "escalate";
  
  /** If true, shows compact version (for tight layouts) */
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
