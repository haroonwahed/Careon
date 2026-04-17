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
  AlertCircle
} from "lucide-react";
import { Button } from "../ui/button";
import { mockCases, mockProviders, Provider } from "../../lib/casesData";

interface MatchingPageProps {
  caseId: string;
  onBack: () => void;
  onConfirmMatch: (providerId: string) => void;
}

export function MatchingPage({ caseId, onBack, onConfirmMatch }: MatchingPageProps) {
  const caseData = mockCases.find(c => c.id === caseId);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  if (!caseData) {
    return null;
  }

  // Get top 3 provider matches based on case requirements
  const topMatches = mockProviders
    .filter(p => p.region === caseData.region || p.region === "Amsterdam") // Example filtering
    .slice(0, 3);

  // Calculate match scores (mock calculation)
  const getMatchScore = (provider: Provider, index: number): number => {
    // Best match gets highest score
    if (index === 0) return 94;
    if (index === 1) return 78;
    return 62;
  };

  const getMatchType = (index: number): "best" | "alternative" | "risky" => {
    if (index === 0) return "best";
    if (index === 1) return "alternative";
    return "risky";
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={onBack}
        className="gap-2 hover:bg-primary/10 hover:text-primary"
      >
        <ArrowLeft size={16} />
        Terug naar case
      </Button>

      {/* Header */}
      <div className="premium-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold">Provider Matching</h1>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                3 matches gevonden
              </span>
            </div>
            <p className="text-muted-foreground">
              {caseData.id} · {caseData.clientName} · {caseData.caseType}
            </p>
          </div>
        </div>

        {/* Case Requirements Summary */}
        <div className="mt-6 p-4 bg-muted/30 rounded-lg">
          <h3 className="font-medium mb-3 text-sm">Zorgvraag samenvatting</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Type zorg</span>
              <p className="font-medium">{caseData.caseType}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Regio</span>
              <p className="font-medium flex items-center gap-1">
                <MapPin size={14} />
                {caseData.region}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Urgentie</span>
              <p className="font-medium capitalize">{caseData.urgency}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Leeftijd cliënt</span>
              <p className="font-medium">{caseData.clientAge} jaar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Provider Matches */}
      <div className="space-y-4">
        {topMatches.map((provider, index) => {
          const matchScore = getMatchScore(provider, index);
          const matchType = getMatchType(index);
          const isSelected = selectedProvider === provider.id;

          return (
            <ProviderMatchCard
              key={provider.id}
              provider={provider}
              matchScore={matchScore}
              matchType={matchType}
              isSelected={isSelected}
              onSelect={() => setSelectedProvider(provider.id)}
              onConfirm={() => onConfirmMatch(provider.id)}
            />
          );
        })}
      </div>

      {/* Decision Guidance */}
      <div className="premium-card p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          Beslissingsondersteuning
        </h3>
        <div className="space-y-3">
          <DecisionGuidanceItem
            title="Aanbeveling"
            description="Jeugdzorg Amsterdam Noord heeft de hoogste match score en beschikbare capaciteit. Snelle reactietijd verwacht."
            type="recommendation"
          />
          <DecisionGuidanceItem
            title="Let op"
            description="De Brug heeft meer capaciteit maar langere reactietijd. Overweeg bij minder urgente gevallen."
            type="info"
          />
          <DecisionGuidanceItem
            title="Waarschuwing"
            description="Horizon Youth Care heeft geen beschikbare plekken. Alleen overwegen bij uitzonderlijke match."
            type="warning"
          />
        </div>
      </div>

      {/* Sticky Action Bar */}
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

// Provider Match Card Component
function ProviderMatchCard({
  provider,
  matchScore,
  matchType,
  isSelected,
  onSelect,
  onConfirm
}: {
  provider: Provider;
  matchScore: number;
  matchType: "best" | "alternative" | "risky";
  isSelected: boolean;
  onSelect: () => void;
  onConfirm: () => void;
}) {
  const getBorderColor = () => {
    if (matchType === "best") return "border-green-500";
    if (matchType === "alternative") return "border-primary";
    return "border-amber-500";
  };

  const getBadgeColor = () => {
    if (matchType === "best") return "bg-green-500/10 text-green-500 border-green-500/30";
    if (matchType === "alternative") return "bg-primary/10 text-primary border-primary/30";
    return "bg-amber-500/10 text-amber-500 border-amber-500/30";
  };

  const getMatchLabel = () => {
    if (matchType === "best") return "Beste match";
    if (matchType === "alternative") return "Alternatief";
    return "Met risico";
  };

  return (
    <div 
      className={`premium-card p-6 border-2 transition-all cursor-pointer ${
        isSelected 
          ? "border-primary ring-2 ring-primary/20" 
          : getBorderColor()
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold">{provider.name}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getBadgeColor()}`}>
              {getMatchLabel()}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{provider.type}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-3xl font-bold text-primary">{matchScore}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <p className="text-xs text-muted-foreground">Match score</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <MetricItem
          icon={MapPin}
          label="Regio"
          value={provider.region}
        />
        <MetricItem
          icon={Users}
          label="Beschikbaar"
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
          label="Reactietijd"
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
              className="px-2 py-1 bg-muted/50 text-xs rounded-md"
            >
              {spec}
            </span>
          ))}
        </div>
      </div>

      {/* Match Explanation */}
      <div className="mb-4 p-3 bg-muted/30 rounded-lg">
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <TrendingUp size={14} className="text-primary" />
          Waarom deze match?
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          {matchType === "best" && (
            <>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 text-green-500 shrink-0" />
                <span>Perfecte match voor {provider.type.toLowerCase()}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 text-green-500 shrink-0" />
                <span>Beschikbare capaciteit en snelle reactietijd</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 text-green-500 shrink-0" />
                <span>Hoge rating en ervaring met vergelijkbare cases</span>
              </li>
            </>
          )}
          {matchType === "alternative" && (
            <>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 text-primary shrink-0" />
                <span>Goede match voor zorgvraag</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 text-amber-500 shrink-0" />
                <span>Langere reactietijd dan ideaal</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 text-primary shrink-0" />
                <span>Ruime capaciteit beschikbaar</span>
              </li>
            </>
          )}
          {matchType === "risky" && (
            <>
              <li className="flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 text-red-500 shrink-0" />
                <span>Geen beschikbare capaciteit</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 text-green-500 shrink-0" />
                <span>Hoogste rating en specialisatie match</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 text-amber-500 shrink-0" />
                <span>Wachtlijst kan oplopen tot 2-3 weken</span>
              </li>
            </>
          )}
        </ul>
      </div>

      {/* Trade-offs */}
      {matchType !== "best" && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Shield size={14} className="text-muted-foreground" />
            Overwegingen
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TradeOffItem
              type="pro"
              text={matchType === "alternative" 
                ? "Meer capaciteit beschikbaar" 
                : "Hoogste kwaliteit rating"}
            />
            <TradeOffItem
              type="con"
              text={matchType === "alternative" 
                ? "12 uur gemiddelde reactietijd" 
                : "Geen directe beschikbaarheid"}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {matchType === "best" && (
          <Button 
            className="flex-1 bg-green-500 hover:bg-green-600"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
          >
            <CheckCircle2 size={16} className="mr-2" />
            Plaats direct
          </Button>
        )}
        {matchType === "alternative" && (
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
        {matchType === "risky" && (
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
    if (status === "positive") return "text-green-500";
    if (status === "negative") return "text-red-500";
    if (status === "warning") return "text-amber-500";
    return "text-muted-foreground";
  };

  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <Icon size={14} className={getColor()} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`font-medium text-sm ${status ? getColor() : ""}`}>{value}</p>
    </div>
  );
}

// Trade-off Item Component
function TradeOffItem({ type, text }: { type: "pro" | "con"; text: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {type === "pro" ? (
        <CheckCircle2 size={14} className="mt-0.5 text-green-500 shrink-0" />
      ) : (
        <AlertCircle size={14} className="mt-0.5 text-red-500 shrink-0" />
      )}
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}

// Decision Guidance Item Component
function DecisionGuidanceItem({ 
  title, 
  description, 
  type 
}: { 
  title: string; 
  description: string; 
  type: "recommendation" | "info" | "warning";
}) {
  const getIcon = () => {
    if (type === "recommendation") return CheckCircle2;
    if (type === "warning") return AlertTriangle;
    return Sparkles;
  };

  const getColor = () => {
    if (type === "recommendation") return "text-green-500";
    if (type === "warning") return "text-amber-500";
    return "text-primary";
  };

  const Icon = getIcon();

  return (
    <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
      <Icon size={18} className={`mt-0.5 ${getColor()}`} />
      <div className="flex-1">
        <p className="font-medium text-sm mb-1">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
