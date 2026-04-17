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
    high: "text-green-400",
    medium: "text-amber-400",
    low: "text-red-400"
  };

  return (
    <div className="premium-card p-4 bg-blue-500/5 border-2 border-blue-500/20">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-foreground">
            Waarom deze match?
          </h3>
        </div>
        
        {/* Score Badge */}
        <div className="text-center">
          <div 
            className="px-3 py-1 rounded-lg border-2"
            style={{
              background: score >= 90 
                ? "rgba(34, 197, 94, 0.1)" 
                : score >= 75 
                ? "rgba(251, 191, 36, 0.1)"
                : "rgba(239, 68, 68, 0.1)",
              borderColor: score >= 90 
                ? "rgba(34, 197, 94, 0.3)" 
                : score >= 75 
                ? "rgba(251, 191, 36, 0.3)"
                : "rgba(239, 68, 68, 0.3)"
            }}
          >
            <span className={`text-lg font-bold ${
              score >= 90 ? "text-green-400" : score >= 75 ? "text-amber-400" : "text-red-400"
            }`}>
              {score}%
            </span>
          </div>
        </div>
      </div>

      {/* Confidence Indicator */}
      <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-muted/20">
        <Target size={12} className={confidenceColor[confidence]} />
        <span className={`text-xs ${confidenceColor[confidence]}`}>
          {confidenceLabel[confidence]}
        </span>
      </div>

      {/* Strengths */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-green-400 mb-2">Sterke punten</p>
        <ul className="space-y-1.5">
          {strengths.map((strength, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <CheckCircle2 size={12} className="text-green-400 flex-shrink-0 mt-0.5" />
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
          <p className="text-xs font-semibold text-amber-400 mb-2">Aandachtspunten</p>
          <ul className="space-y-1.5">
            {tradeoffs.map((tradeoff, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <AlertCircle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
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
