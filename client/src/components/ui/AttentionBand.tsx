/**
 * AttentionBand
 * 
 * Operational Contract Field: attention_band
 * 
 * Governance Rule: App-wide urgency vocabulary (ONE language).
 * - 4 fixed levels only. NO custom variants allowed.
 * - Maps to backend attention_band enum
 * 
 * Rule: No business logic for determining attention level (from backend)
 * Rule: Maps ONLY to attention_band field
 * Rule: Used consistently across all pages
 * 
 * Used on: Casussen, Matching, all operational pages
 */

interface AttentionBandProps {
  /** One of 4 fixed levels. From: attention_band */
  level: "now" | "today" | "monitor" | "waiting";
}

export function AttentionBand({ level }: AttentionBandProps) {
  const levels = {
    now: {
      label: "Directe actie",
      bg: "bg-red-light/50",
      text: "text-red-base",
      border: "border-red-border/50",
      icon: "🔴"
    },
    today: {
      label: "Vandaag oppakken",
      bg: "bg-orange-light/50",
      text: "text-orange-base",
      border: "border-orange-border/50",
      icon: "🟠"
    },
    monitor: {
      label: "Monitoren",
      bg: "bg-yellow-light/50",
      text: "text-yellow-base",
      border: "border-yellow-border/50",
      icon: "🟡"
    },
    waiting: {
      label: "Wacht op externe partij",
      bg: "bg-blue-light/50",
      text: "text-blue-base",
      border: "border-blue-border/50",
      icon: "🔵"
    }
  };

  const style = levels[level];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${style.bg} ${style.text} ${style.border}`}>
      <span className="text-sm">{style.icon}</span>
      {style.label}
    </span>
  );
}
