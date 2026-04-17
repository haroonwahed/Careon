/**
 * EXAMPLE: MatchingPage with AI Decision Intelligence Layer
 * 
 * Shows AI-powered match explanations and provider recommendations
 */

import { useState } from "react";
import { ArrowLeft, MapPin, Users, Star, Clock } from "lucide-react";
import { Button } from "../ui/button";
import { mockCases, mockProviders } from "../../lib/casesData";

// AI Components
import { 
  AanbevolenActie,
  Risicosignalen, 
  MatchExplanation,
  SystemInsight
} from "../ai";

interface MatchingPageWithAIProps {
  caseId: string;
  onBack: () => void;
  onConfirmMatch: (providerId: string) => void;
}

export function MatchingPageWithAI({ 
  caseId, 
  onBack, 
  onConfirmMatch 
}: MatchingPageWithAIProps) {
  const caseData = mockCases.find(c => c.id === caseId);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  if (!caseData) return null;

  // Get top 3 matches
  const topMatches = mockProviders
    .filter(p => p.region === caseData.region || p.region === "Amsterdam")
    .slice(0, 3);

  const bestMatch = topMatches[0];

  // AI Decision Logic
  const recommendation = {
    title: `Match met ${bestMatch.name}`,
    explanation: "Beste match op basis van specialisatie, capaciteit en reactietijd. Systeem heeft 94% match score berekend.",
    actionLabel: "Bevestig match",
    confidence: "high" as const,
    onAction: () => onConfirmMatch(bestMatch.id)
  };

  const riskSignals = [];
  
  if (topMatches.every(p => p.availableSpots === 0)) {
    riskSignals.push({
      severity: "critical" as const,
      message: "Geen providers met directe capaciteit in regio"
    });
  }

  if (caseData.urgency === "high" && bestMatch.responseTime > 6) {
    riskSignals.push({
      severity: "warning" as const,
      message: "Urgente casus met reactietijd boven 6 uur"
    });
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={20} />
        <span className="text-sm font-medium">Terug</span>
      </button>

      {/* Header */}
      <div className="premium-card p-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Matching · {caseData.clientName}
        </h1>
        <p className="text-sm text-muted-foreground break-words">
          {topMatches.length} potentiële matches gevonden in {caseData.region}
        </p>
      </div>

      {/* AI LAYER: Top Action */}
      <AanbevolenActie
        title={recommendation.title}
        explanation={recommendation.explanation}
        actionLabel={recommendation.actionLabel}
        confidence={recommendation.confidence}
        onAction={recommendation.onAction}
      />

      {/* Layout: Main + Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* MAIN: Provider Matches */}
        <div className="xl:col-span-8 space-y-4">
          
          {/* AI Insight: Match Status */}
          <SystemInsight
            type="info"
            message={`${topMatches.length} aanbieders gevonden met match score tussen 62-94%`}
          />

          {/* Provider Cards with AI Explanations */}
          {topMatches.map((provider, index) => {
            const score = index === 0 ? 94 : index === 1 ? 78 : 62;
            const isSelected = selectedProvider === provider.id;

            return (
              <div 
                key={provider.id}
                className={`premium-card p-5 cursor-pointer transition-all ${
                  isSelected ? "border-2 border-primary" : ""
                }`}
                onClick={() => setSelectedProvider(provider.id)}
              >
                {/* Provider Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      {provider.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{provider.type}</p>
                  </div>
                  
                  <div className="text-center">
                    <div className={`px-3 py-1 rounded-lg border-2 ${
                      score >= 90 
                        ? "bg-green-500/10 border-green-500/30" 
                        : "bg-amber-500/10 border-amber-500/30"
                    }`}>
                      <span className={`text-xl font-bold ${
                        score >= 90 ? "text-green-400" : "text-amber-400"
                      }`}>
                        {score}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Provider Metrics */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <MapPin size={12} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Regio</span>
                    </div>
                    <p className="text-sm font-semibold">{provider.region}</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Users size={12} className={provider.availableSpots > 0 ? "text-green-400" : "text-red-400"} />
                      <span className="text-xs text-muted-foreground">Capaciteit</span>
                    </div>
                    <p className={`text-sm font-semibold ${
                      provider.availableSpots > 0 ? "text-green-400" : "text-red-400"
                    }`}>
                      {provider.availableSpots}/{provider.capacity}
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Star size={12} className="text-green-400" />
                      <span className="text-xs text-muted-foreground">Rating</span>
                    </div>
                    <p className="text-sm font-semibold text-green-400">
                      {provider.rating.toFixed(1)}
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Clock size={12} className={provider.responseTime <= 6 ? "text-green-400" : "text-amber-400"} />
                      <span className="text-xs text-muted-foreground">Reactie</span>
                    </div>
                    <p className={`text-sm font-semibold ${
                      provider.responseTime <= 6 ? "text-green-400" : "text-amber-400"
                    }`}>
                      {provider.responseTime}u
                    </p>
                  </div>
                </div>

                {/* AI LAYER: Match Explanation */}
                <MatchExplanation
                  score={score}
                  strengths={
                    index === 0 
                      ? [
                          "Specialisatie match",
                          "3 plekken beschikbaar",
                          "Reactie binnen 4u"
                        ]
                      : index === 1
                      ? [
                          "Goede match",
                          "8 plekken vrij",
                          "Hogere rating (4.6)"
                        ]
                      : [
                          "Hoogste rating (4.8)",
                          "Perfecte specialisatie"
                        ]
                  }
                  tradeoffs={
                    index === 0 
                      ? []
                      : index === 1
                      ? ["Reactietijd 12u", "Minder ervaring"]
                      : ["Geen capaciteit", "Wachttijd 2-3w"]
                  }
                  confidence={index === 0 ? "high" : index === 1 ? "medium" : "low"}
                  compact
                />
              </div>
            );
          })}
        </div>

        {/* SIDEBAR: AI Insights */}
        <div className="xl:col-span-4 space-y-4">
          
          {/* AI LAYER: Risk Signals */}
          {riskSignals.length > 0 && (
            <Risicosignalen signals={riskSignals} compact />
          )}

          {/* Match Criteria */}
          <div className="premium-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Match criteria
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Specialisatie</span>
                <span className="text-green-400 font-semibold">100%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Regio</span>
                <span className="text-green-400 font-semibold">Match</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capaciteit</span>
                <span className="text-amber-400 font-semibold">Beperkt</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reactietijd</span>
                <span className="text-green-400 font-semibold">Goed</span>
              </div>
            </div>
          </div>

          {/* AI Suggestion */}
          {caseData.urgency === "high" && (
            <SystemInsight
              type="suggestion"
              message="Overweeg parallelle intake bij top 2 matches om wachttijd te minimaliseren"
            />
          )}
        </div>
      </div>
    </div>
  );
}
