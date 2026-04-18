import { useState } from "react";
import { 
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Star,
  MapPin,
  Users,
  Clock,
  TrendingUp,
  Shield,
  Sparkles,
  AlertCircle,
  Info,
  Lightbulb,
  Search,
  SlidersHorizontal,
  AlertOctagon,
  Target,
  Zap,
  Loader2
} from "lucide-react";
import { Button } from "../ui/button";
import { Provider } from "../../lib/casesData";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { toLegacyCase, toLegacyProvider } from "../../lib/careLegacyAdapters";

interface MatchingPageEnhancedProps {
  caseId: string;
  onBack: () => void;
  onConfirmMatch: (providerId: string) => void;
}

export function MatchingPageEnhanced({ caseId, onBack, onConfirmMatch }: MatchingPageEnhancedProps) {
  const { cases, loading: casesLoading, error: casesError } = useCases({ q: "" });
  const { providers, loading: providersLoading, error: providersError } = useProviders({ q: "" });
  const legacyCases = cases.map(toLegacyCase);
  const legacyProviders = providers.map(toLegacyProvider);

  const caseData = legacyCases.find(c => c.id === caseId);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  if (casesLoading || providersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-muted-foreground gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span>Matching laden...</span>
      </div>
    );
  }

  if (casesError || providersError) {
    return (
      <div className="premium-card p-6 text-center text-destructive">
        Kon matchinggegevens niet laden: {casesError ?? providersError}
      </div>
    );
  }

  if (!caseData) {
    return null;
  }

  // Get top 3 provider matches
  const topMatches = legacyProviders
    .filter(p => p.region === caseData.region || p.region === "Amsterdam")
    .slice(0, 3);

  // Enhanced match scoring with explanations
  const getMatchData = (provider: Provider, index: number) => {
    const baseScore = index === 0 ? 94 : index === 1 ? 78 : 62;
    
    return {
      score: baseScore,
      confidence: index === 0 ? 95 : index === 1 ? 82 : 68,
      matchType: index === 0 ? "best" : index === 1 ? "alternative" : "risky",
      reasons: index === 0 ? [
        { text: "Specialisatie match", positive: true },
        { text: "3 plekken beschikbaar", positive: true },
        { text: "Reactie binnen 4u", positive: true }
      ] : index === 1 ? [
        { text: "Goede match", positive: true },
        { text: "8 plekken vrij", positive: true },
        { text: "Reactie 12u", positive: false }
      ] : [
        { text: "Hoogste rating (4.8)", positive: true },
        { text: "Perfecte specialisatie", positive: true },
        { text: "Geen capaciteit", positive: false }
      ]
    };
  };

  const bestMatch = topMatches[0];
  const bestMatchData = getMatchData(bestMatch, 0);

  // System intelligence insights
  const riskSignals = [
    ...(topMatches.every(p => p.availableSpots === 0) 
      ? [{ severity: "high" as const, message: "Geen providers met directe capaciteit in regio" }] 
      : []),
    ...(caseData.urgency === "high" && topMatches[0]?.responseTime > 8
      ? [{ severity: "medium" as const, message: "Urgente casus met langere reactietijd" }]
      : [])
  ];

  const suggestions = [
    ...(topMatches.length < 3 
      ? [{ text: "Vergroot zoekradius naar aangrenzende regio's", action: "expand-region" }] 
      : []),
    ...(bestMatchData.score < 80 
      ? [{ text: "Overweeg alternatief zorgtype voor betere matches", action: "change-type" }] 
      : [])
  ];

  const insights = [
    `Top match heeft ${bestMatchData.confidence}% voorspelde succeskans`,
    `${topMatches.filter(p => p.availableSpots > 0).length} van ${topMatches.length} providers hebben directe capaciteit`,
    `Gemiddelde acceptatieratio in regio: 82%`
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={20} />
        <span className="text-sm font-medium">Terug naar case</span>
      </button>

      {/* DECISION HEADER - Top recommendation */}
      <div 
        className="premium-card p-6"
        style={{
          background: "linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(0, 0, 0, 0.02) 100%)",
          border: "2px solid rgba(34, 197, 94, 0.3)"
        }}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <Target size={24} className="text-green-400" />
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Aanbevolen plaatsing
                </h2>
                <p className="text-sm text-muted-foreground">
                  Beste match voor {caseData.clientName}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-background/50 border border-green-500/30 mb-4">
              <div className="flex items-start gap-3">
                <Zap size={20} className="text-green-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <p className="text-lg font-semibold text-green-300 mb-2">
                    {bestMatch.name}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {bestMatch.name} biedt de beste match met een score van <strong className="text-green-400">{bestMatchData.score}%</strong>. 
                    Specialisatie in {bestMatch.specializations[0].toLowerCase()}, 
                    directe capaciteit beschikbaar, en snelle reactietijd van {bestMatch.responseTime} uur.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-muted-foreground">Match score:</span>
                <span className="font-semibold text-green-400">{bestMatchData.score}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-muted-foreground">Confidence:</span>
                <span className="font-semibold text-green-400">{bestMatchData.confidence}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-muted-foreground">Beschikbaar:</span>
                <span className="font-semibold text-foreground">{bestMatch.availableSpots} plekken</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => onConfirmMatch(bestMatch.id)}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold whitespace-nowrap"
            >
              <CheckCircle2 size={16} className="mr-2" />
              Plaats direct
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Verwachte reactie: {bestMatch.responseTime}u
            </p>
          </div>
        </div>
      </div>

      {/* Main Layout: 3 Panels */}
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT PANEL: Case Context */}
        <div className="col-span-3">
          <div className="premium-card p-4 sticky top-24">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Casus context
            </h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Case ID</p>
                <p className="font-medium text-foreground">{caseData.id}</p>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Cliënt</p>
                <p className="font-medium text-foreground">{caseData.clientName}</p>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Leeftijd</p>
                <p className="font-medium text-foreground">{caseData.clientAge} jaar</p>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Regio</p>
                <div className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-muted-foreground" />
                  <p className="font-medium text-foreground">{caseData.region}</p>
                </div>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Zorgtype</p>
                <p className="font-medium text-foreground">{caseData.caseType}</p>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Urgentie</p>
                <span className={`
                  inline-block px-2 py-1 rounded-md text-xs font-semibold
                  ${caseData.urgency === "high" ? "bg-red-500/20 text-red-300 border border-red-500/30" : ""}
                  ${caseData.urgency === "medium" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : ""}
                  ${caseData.urgency === "low" ? "bg-green-500/20 text-green-300 border border-green-500/30" : ""}
                `}>
                  {caseData.urgency === "high" ? "Hoog" : caseData.urgency === "medium" ? "Gemiddeld" : "Laag"}
                </span>
              </div>

              <div className="pt-3 border-t border-muted-foreground/20">
                <p className="text-muted-foreground text-xs mb-2">Status</p>
                <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-primary/20 text-primary border border-primary/30">
                  Klaar voor matching
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER PANEL: Match Results */}
        <div className="col-span-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-foreground">
              Provider matches
            </h2>
            <span className="text-sm text-muted-foreground">
              {topMatches.length} gevonden
            </span>
          </div>

          {topMatches.map((provider, index) => {
            const matchData = getMatchData(provider, index);
            return (
              <EnhancedProviderMatchCard
                key={provider.id}
                provider={provider}
                matchData={matchData}
                isSelected={selectedProvider === provider.id}
                onSelect={() => setSelectedProvider(provider.id)}
                onConfirm={() => onConfirmMatch(provider.id)}
              />
            );
          })}

          {/* Alternative Actions */}
          <div className="premium-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Alternatieve acties
            </h3>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1">
                <Search size={16} className="mr-2" />
                Zoek handmatig
              </Button>
              <Button variant="outline" className="flex-1">
                <SlidersHorizontal size={16} className="mr-2" />
                Pas filters aan
              </Button>
              <Button variant="outline" className="flex-1">
                <AlertOctagon size={16} className="mr-2" />
                Escaleren
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: System Intelligence */}
        <div className="col-span-3">
          <div className="sticky top-24 space-y-4">
            {/* Risk Signals */}
            {riskSignals.length > 0 && (
              <div className="premium-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-400" />
                  Risicosignalen
                </h3>
                <div className="space-y-2">
                  {riskSignals.map((signal, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        signal.severity === "high"
                          ? "bg-red-500/10 border-red-500/30"
                          : "bg-amber-500/10 border-amber-500/30"
                      }`}
                    >
                      <p className={`text-xs ${
                        signal.severity === "high" ? "text-red-300" : "text-amber-300"
                      }`}>
                        {signal.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="premium-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Lightbulb size={16} className="text-purple-400" />
                  Suggesties
                </h3>
                <div className="space-y-2">
                  {suggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border bg-purple-500/10 border-purple-500/30"
                    >
                      <p className="text-xs text-purple-300 mb-2">
                        {suggestion.text}
                      </p>
                      <button className="text-xs text-purple-400 underline hover:text-purple-300">
                        Toepassen
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matching Insights */}
            <div className="premium-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-blue-400" />
                Matching insights
              </h3>
              <div className="space-y-2">
                {insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/5"
                  >
                    <Info size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300 leading-relaxed">
                      {insight}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Confidence Indicator */}
            <div className="premium-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Systeemvertrouwen
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">Match kwaliteit</span>
                    <span className="text-xs font-semibold text-green-400">{bestMatchData.score}%</span>
                  </div>
                  <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${bestMatchData.score}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">Voorspelde succes</span>
                    <span className="text-xs font-semibold text-green-400">{bestMatchData.confidence}%</span>
                  </div>
                  <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${bestMatchData.confidence}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Action Bar (when provider selected) */}
      {selectedProvider && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm z-50 ml-[240px]">
          <div className="max-w-[1400px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {topMatches.find(p => p.id === selectedProvider)?.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Geselecteerd voor plaatsing
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline"
                  onClick={() => setSelectedProvider(null)}
                >
                  Annuleer
                </Button>
                <Button 
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => onConfirmMatch(selectedProvider)}
                >
                  <CheckCircle2 size={16} className="mr-2" />
                  Bevestig plaatsing
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Enhanced Provider Match Card
interface MatchData {
  score: number;
  confidence: number;
  matchType: "best" | "alternative" | "risky";
  reasons: Array<{ text: string; positive: boolean }>;
  tradeOffs: { pros: string[]; cons: string[] } | null;
}

function EnhancedProviderMatchCard({
  provider,
  matchData,
  isSelected,
  onSelect,
  onConfirm
}: {
  provider: Provider;
  matchData: MatchData;
  isSelected: boolean;
  onSelect: () => void;
  onConfirm: () => void;
}) {
  const getBorderColor = () => {
    if (matchData.matchType === "best") return "border-green-500/40";
    if (matchData.matchType === "alternative") return "border-primary/40";
    return "border-amber-500/40";
  };

  const getBadgeStyle = () => {
    if (matchData.matchType === "best") 
      return "bg-green-500/20 text-green-300 border-green-500/40";
    if (matchData.matchType === "alternative") 
      return "bg-primary/20 text-primary border-primary/40";
    return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  };

  const getMatchLabel = () => {
    if (matchData.matchType === "best") return "🟢 Beste match";
    if (matchData.matchType === "alternative") return "🟡 Alternatief";
    return "🔴 Met risico";
  };

  const getGlow = () => {
    if (matchData.matchType === "best") 
      return "shadow-[0_0_20px_rgba(34,197,94,0.15)]";
    return "";
  };

  return (
    <div 
      className={`
        premium-card p-5 border-2 transition-all cursor-pointer
        ${isSelected ? "border-primary ring-2 ring-primary/20" : getBorderColor()}
        ${getGlow()}
        hover:border-opacity-60 hover:shadow-lg
      `}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-foreground">
              {provider.name}
            </h3>
            <span className={`px-3 py-1 rounded-md text-xs font-semibold border ${getBadgeStyle()}`}>
              {getMatchLabel()}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{provider.type}</p>
        </div>
        
        {/* Match Score */}
        <div className="text-right">
          <div className="flex items-baseline gap-1 mb-1">
            <span className={`text-3xl font-bold ${
              matchData.matchType === "best" ? "text-green-400" :
              matchData.matchType === "alternative" ? "text-primary" :
              "text-amber-400"
            }`}>
              {matchData.score}
            </span>
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">Match score</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <MetricItem
          icon={MapPin}
          label="Regio"
          value={provider.region}
        />
        <MetricItem
          icon={Users}
          label="Capaciteit"
          value={`${provider.availableSpots}/${provider.capacity}`}
          status={provider.availableSpots > 0 ? "positive" : "negative"}
        />
        <MetricItem
          icon={Star}
          label="Rating"
          value={provider.rating.toFixed(1)}
          status="positive"
        />
        <MetricItem
          icon={Clock}
          label="Reactie"
          value={`${provider.responseTime}u`}
          status={provider.responseTime <= 6 ? "positive" : "warning"}
        />
      </div>

      {/* Specializations */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">Specialisaties</p>
        <div className="flex flex-wrap gap-2">
          {provider.specializations.map((spec, idx) => (
            <span 
              key={idx}
              className="px-2.5 py-1 bg-muted/50 text-xs rounded-md font-medium"
            >
              {spec}
            </span>
          ))}
        </div>
      </div>

      {/* Match Explanation */}
      <div className="mb-4 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-blue-400" />
          Waarom deze match?
        </h4>
        <ul className="space-y-2">
          {matchData.reasons.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              {reason.positive ? (
                <CheckCircle2 size={14} className="mt-0.5 text-green-400 flex-shrink-0" />
              ) : (
                <AlertCircle size={14} className="mt-0.5 text-amber-400 flex-shrink-0" />
              )}
              <span className="text-xs text-muted-foreground leading-relaxed">
                {reason.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Trade-offs (for non-best matches) */}
      {matchData.tradeOffs && (
        <div className="mb-4 p-4 rounded-lg bg-muted/30 border border-muted-foreground/20">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Shield size={14} className="text-muted-foreground" />
            Overwegingen
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-green-400 mb-2">+ Voordelen</p>
              <ul className="space-y-1">
                {matchData.tradeOffs.pros.map((pro, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-green-400 text-xs">•</span>
                    <span className="text-xs text-muted-foreground">{pro}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-red-400 mb-2">− Nadelen</p>
              <ul className="space-y-1">
                {matchData.tradeOffs.cons.map((con, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-red-400 text-xs">•</span>
                    <span className="text-xs text-muted-foreground">{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Confidence Indicator */}
      <div className="mb-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-purple-300">Voorspelde succeskans</span>
          <span className="text-sm font-bold text-purple-300">{matchData.confidence}%</span>
        </div>
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-purple-500 rounded-full transition-all"
            style={{ width: `${matchData.confidence}%` }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {matchData.matchType === "best" && (
          <Button 
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
          >
            <CheckCircle2 size={16} className="mr-2" />
            Plaats direct
          </Button>
        )}
        {matchData.matchType === "alternative" && (
          <Button 
            className="flex-1 bg-primary hover:bg-primary/90"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
          >
            Plaats
          </Button>
        )}
        {matchData.matchType === "risky" && (
          <Button 
            className="flex-1 bg-amber-500 hover:bg-amber-600"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
          >
            <AlertTriangle size={16} className="mr-2" />
            Plaats met risico
          </Button>
        )}
        <Button 
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          Meer details
        </Button>
      </div>
    </div>
  );
}

// Metric Item Component
function MetricItem({ 
  icon: Icon, 
  label, 
  value, 
  status 
}: { 
  icon: any; 
  label: string; 
  value: string;
  status?: "positive" | "negative" | "warning";
}) {
  const getColor = () => {
    if (status === "positive") return "text-green-400";
    if (status === "negative") return "text-red-400";
    if (status === "warning") return "text-amber-400";
    return "text-muted-foreground";
  };

  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <Icon size={12} className={getColor()} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`font-semibold text-xs ${status ? getColor() : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}