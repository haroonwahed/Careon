/**
 * ImpactSummary
 * 
 * Operational Contract Field: impact_summary
 * 
 * Governance Rule: MANDATORY. No action without impact.
 * - Every RecommendedActionBlock must include ImpactSummary
 * - Impact must answer: "What will this action change?"
 * 
 * Rule: No business logic (text from backend)
 * Rule: Maps ONLY to impact_summary field
 * Rule: Type inferred from text pattern or explicitly set
 * 
 * Used on: All pages with recommended actions
 */

interface ImpactSummaryProps {
  /** The impact text. From: impact_summary */
  text: string;
  
  /** Visual treatment to indicate impact type */
  type?: "positive" | "protective" | "accelerating";
}

export function ImpactSummary({ text, type = "positive" }: ImpactSummaryProps) {
  const typeStyles = {
    positive: {
      icon: "↗️",
      textColor: "text-green-base",
      description: "Increases likelihood or improves"
    },
    protective: {
      icon: "🛡️",
      textColor: "text-blue-base",
      description: "Prevents or avoids issue"
    },
    accelerating: {
      icon: "⚡",
      textColor: "text-yellow-base",
      description: "Speeds up or unblocks"
    }
  };

  const style = typeStyles[type];

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-lg flex-shrink-0">{style.icon}</span>
      <span className={`font-medium ${style.textColor} italic`}>
        {text}
      </span>
    </div>
  );
}
