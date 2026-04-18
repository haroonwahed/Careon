/**
 * ImpactSummary
 * 
 * Standardized outcome-focused language for actions.
 * Appears alongside every action recommendation.
 * 
 * Used on: Every recommended action block
 */

interface ImpactSummaryProps {
  text: string;           // "Vergroot kans op match"
  type?: "positive" | "protective" | "accelerating";
  compact?: boolean;
}

export function ImpactSummary({ text, type = "positive", compact = false }: ImpactSummaryProps) {
  const typeStyles = {
    positive: {
      icon: "↗️",
      textColor: "text-green-base"
    },
    protective: {
      icon: "🛡️",
      textColor: "text-blue-base"
    },
    accelerating: {
      icon: "⚡",
      textColor: "text-yellow-base"
    }
  };

  const style = typeStyles[type];

  return (
    <div className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      <span className="text-lg">{style.icon}</span>
      <span className={`font-medium ${style.textColor} italic`}>
        {text}
      </span>
    </div>
  );
}
