import { TrendingUp, CheckCircle2, AlertCircle, Target } from "lucide-react";

interface MatchExplanationProps {
  score: number;
  strengths: string[];
  tradeoffs?: string[];
  confidence?: "high" | "medium" | "low";
  compact?: boolean;
}

export function MatchExplanation({ 
  score, 
  strengths, 
  tradeoffs = [], 
  confidence = "high",
  compact = false 
}: MatchExplanationProps) {
  const confidenceLabel = {
    high: "Hoog vertrouwen",
    medium: "Gemiddeld vertrouwen",
    low: "Laag vertrouwen"
  };

  const confidenceColor = {
    high: "text-green-base",
    medium: "text-yellow-base",
    low: "text-red-base"
  };

  const scoreTone = score >= 90 ? "success" : score >= 75 ? "warning" : "error";
  const scoreClass = scoreTone === "success"
    ? "careon-alert-success"
    : scoreTone === "warning"
    ? "careon-alert-warning"
    : "careon-alert-error";

  return (
    <div className="premium-card p-4 border careon-alert-info">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-base" />
          <h3 className="text-sm font-semibold text-foreground">
            Waarom deze match?
          </h3>
        </div>
        
        {/* Score Badge */}
        <div className="text-center">
          <div className={`px-3 py-1 rounded-lg border ${scoreClass}`}>
            <span className={`text-lg font-bold ${
              score >= 90 ? "text-green-base" : score >= 75 ? "text-yellow-base" : "text-red-base"
            }`}>
              {score}%
            </span>
          </div>
        </div>
      </div>

      {/* Confidence Indicator */}
      <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-bg-surface/70 border border-border-default">
        <Target size={12} className={confidenceColor[confidence]} />
        <span className={`text-xs ${confidenceColor[confidence]}`}>
          {confidenceLabel[confidence]}
        </span>
      </div>

      {/* Strengths */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-green-base mb-2">Sterke punten</p>
        <ul className="space-y-1.5">
          {strengths.map((strength, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <CheckCircle2 size={12} className="text-green-base flex-shrink-0 mt-0.5" />
              <span className="text-xs text-muted-foreground leading-relaxed break-words">
                {strength}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Trade-offs */}
      {tradeoffs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-yellow-base mb-2">Aandachtspunten</p>
          <ul className="space-y-1.5">
            {tradeoffs.map((tradeoff, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <AlertCircle size={12} className="text-yellow-base flex-shrink-0 mt-0.5" />
                <span className="text-xs text-muted-foreground leading-relaxed break-words">
                  {tradeoff}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
