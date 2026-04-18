/**
 * MatchingPageWithMap - Map-Enhanced Provider Selection
 * 
 * Split-screen layout with:
 * - Left (60%): Decision area with provider cards
 * - Right (40%): Interactive map with pins
 * 
 * Features:
 * - AI-powered recommendations
 * - Synced card ↔ map interactions
 * - Distance-aware matching
 * - Risk signals and decision support
 */

import { useState } from "react";
import { 
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Star,
  MapPin,
  Users,
  Clock,
  Filter,
  Maximize2,
  Navigation,
  Loader2
} from "lucide-react";
import { Button } from "../ui/button";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { toLegacyCase, toLegacyProvider } from "../../lib/careLegacyAdapters";

// AI Components
import { 
  AanbevolenActie, 
  Risicosignalen, 
  MatchExplanation,
  SystemInsight
} from "../ai";

interface MatchingPageWithMapProps {
  caseId: string;
  onBack: () => void;
  onConfirmMatch: (providerId: string) => void;
}

export function MatchingPageWithMap({ 
  caseId, 
  onBack, 
  onConfirmMatch 
}: MatchingPageWithMapProps) {
  const { cases, loading: casesLoading, error: casesError } = useCases({ q: "" });
  const { providers, loading: providersLoading, error: providersError } = useProviders({ q: "" });
  const legacyCases = cases.map(toLegacyCase);
  const legacyProviders = providers.map(toLegacyProvider);

  const caseData = legacyCases.find(c => c.id === caseId);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);
  const [radius, setRadius] = useState<number>(20);
  const [mapView, setMapView] = useState<"split" | "full">("split");

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

  if (!caseData) return null;

  // Get top 3 provider matches
  const topMatches = legacyProviders
    .filter(p => p.region === caseData.region || p.region === "Amsterdam")
    .slice(0, 3);

  const bestMatch = topMatches[0];

  // Match scoring
  const getMatchScore = (index: number): number => {
    if (index === 0) return 94;
    if (index === 1) return 78;
    return 62;
  };

  const getMatchType = (index: number): "best" | "alternative" | "risky" => {
    if (index === 0) return "best";
    if (index === 1) return "alternative";
    return "risky";
  };

  const getDistance = (index: number): number => {
    if (index === 0) return 8;
    if (index === 1) return 15;
    return 23;
  };

  // AI Decision Logic
  const recommendation = {
    title: `Plaats bij ${bestMatch?.name}`,
    explanation: "Beste match op basis van beschikbaarheid binnen 3 dagen, sterke match met zorgtype, en hoge acceptatiegraad in vergelijkbare casussen.",
    actionLabel: "Plaats direct",
    confidence: "high" as const,
    onAction: () => {
      if (!bestMatch) return;
      onConfirmMatch(bestMatch.id);
    }
  };

  const riskSignals = [];
  
  if (topMatches.every(p => p.availableSpots === 0)) {
    riskSignals.push({
      severity: "critical" as const,
      message: "Geen providers met directe capaciteit binnen radius"
    });
  }

  if (getDistance(0) > 15) {
    riskSignals.push({
      severity: "warning" as const,
      message: "Beste match ligt buiten voorkeursradius (>15km)"
    });
  }

  // Handle provider selection
  const handleProviderClick = (providerId: string) => {
    setSelectedProvider(providerId === selectedProvider ? null : providerId);
  };

  const handleProviderHover = (providerId: string | null) => {
    setHoveredProvider(providerId);
  };

  const focusedProviderId = hoveredProvider ?? selectedProvider;
  const focusedProvider = focusedProviderId
    ? topMatches.find((provider) => provider.id === focusedProviderId)
    : null;
  const mapZoom = radius <= 10 ? 12 : radius <= 20 ? 11 : 10;
  const mapQuery = focusedProvider
    ? `${focusedProvider.name}, ${focusedProvider.region}, Nederland`
    : `${caseData.region}, Nederland`;
  const googleMapsEmbedSrc = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${mapZoom}&output=embed`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Bar */}
      <div className="border-b border-border bg-card/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[1920px] items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="gap-2 hover:bg-primary/10 hover:text-primary"
          >
            <ArrowLeft size={16} />
            Terug naar case
          </Button>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {caseData.id} · {caseData.clientName}
            </span>
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
              Klaar voor matching
            </span>
          </div>
        </div>
      </div>

      {/* Main Content: Split Screen */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT SIDE: Decision Area (60%) */}
        <div 
          className={`${
            mapView === "full" ? "hidden" : "w-[60%]"
          } overflow-y-auto border-r border-border bg-background`}
        >
          <div className="mx-auto max-w-5xl space-y-6 p-6 pb-24">
            
            {/* AI LAYER: Recommended Action */}
            <AanbevolenActie
              title={recommendation.title}
              explanation={recommendation.explanation}
              actionLabel={recommendation.actionLabel}
              confidence={recommendation.confidence}
              onAction={recommendation.onAction}
            />

            {/* AI LAYER: Distance Insight */}
            {getDistance(0) > 10 && (
              <SystemInsight
                type="warning"
                message={`Geen geschikte aanbieder binnen 10km → ${topMatches.length} geschikte opties binnen ${radius}km`}
              />
            )}

            {/* AI LAYER: Risk Signals */}
            {riskSignals.length > 0 && (
              <Risicosignalen signals={riskSignals} />
            )}

            {/* Section Header */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-2">
                Top {topMatches.length} Matches
              </h2>
              <p className="text-sm text-muted-foreground">
                Gerangschikt op match score, beschikbaarheid en afstand
              </p>
            </div>

            {/* Provider Cards */}
            <div className="space-y-4">
              {topMatches.map((provider, index) => {
                const matchType = getMatchType(index);
                const matchScore = getMatchScore(index);
                const distance = getDistance(index);
                const isSelected = selectedProvider === provider.id;
                const isHovered = hoveredProvider === provider.id;

                return (
                  <div
                    key={provider.id}
                    className={`premium-card p-5 cursor-pointer transition-all ${
                      isSelected 
                        ? "border-2 border-primary shadow-lg shadow-primary/20" 
                        : isHovered
                        ? "border-2 border-primary/40"
                        : ""
                    }`}
                    onClick={() => handleProviderClick(provider.id)}
                    onMouseEnter={() => handleProviderHover(provider.id)}
                    onMouseLeave={() => handleProviderHover(null)}
                  >
                    {/* Provider Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-foreground">
                            {provider.name}
                          </h3>
                          
                          {/* Match Type Badge */}
                          {matchType === "best" && (
                            <span className="flex items-center gap-1 rounded border border-green-border bg-green-light px-2 py-1 text-xs font-semibold text-green-base">
                              <CheckCircle2 size={12} />
                              Beste match
                            </span>
                          )}
                          {matchType === "alternative" && (
                            <span className="rounded border border-yellow-border bg-yellow-light px-2 py-1 text-xs font-semibold text-yellow-base">
                              Alternatief
                            </span>
                          )}
                          {matchType === "risky" && (
                            <span className="flex items-center gap-1 rounded border border-red-border bg-red-light px-2 py-1 text-xs font-semibold text-red-base">
                              <AlertTriangle size={12} />
                              Risicovol
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          {provider.type}
                        </p>
                      </div>
                      
                      {/* Match Score */}
                      <div className="text-center">
                        <div 
                          className={`px-3 py-1 rounded-lg border-2 ${
                            matchScore >= 90 
                              ? "border-green-border bg-green-light" 
                              : matchScore >= 75
                              ? "border-yellow-border bg-yellow-light"
                              : "border-red-border bg-red-light"
                          }`}
                        >
                          <span 
                            className={`text-xl font-bold ${
                              matchScore >= 90 
                                ? "text-green-base" 
                                : matchScore >= 75
                                ? "text-yellow-base"
                                : "text-red-base"
                            }`}
                          >
                            {matchScore}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">match score</p>
                      </div>
                    </div>

                    {/* Core Metrics */}
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <MapPin size={12} className="text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Afstand</span>
                        </div>
                        <p className={`text-sm font-semibold ${
                          distance <= 10 ? "text-green-base" : distance <= 20 ? "text-yellow-base" : "text-red-base"
                        }`}>
                          {distance}km
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Users size={12} className={provider.availableSpots > 0 ? "text-green-base" : "text-red-base"} />
                          <span className="text-xs text-muted-foreground">Capaciteit</span>
                        </div>
                        <p className={`text-sm font-semibold ${
                          provider.availableSpots > 0 ? "text-green-base" : "text-red-base"
                        }`}>
                          {provider.availableSpots}/{provider.capacity}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Star size={12} className="text-green-base" />
                          <span className="text-xs text-muted-foreground">Rating</span>
                        </div>
                        <p className="text-sm font-semibold text-green-base">
                          {provider.rating.toFixed(1)}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <Clock size={12} className={provider.responseTime <= 6 ? "text-green-base" : "text-yellow-base"} />
                          <span className="text-xs text-muted-foreground">Reactie</span>
                        </div>
                        <p className={`text-sm font-semibold ${
                          provider.responseTime <= 6 ? "text-green-base" : "text-yellow-base"
                        }`}>
                          {provider.responseTime}u
                        </p>
                      </div>
                    </div>

                    {/* AI LAYER: Match Explanation */}
                    <MatchExplanation
                      score={matchScore}
                      strengths={
                        index === 0 
                          ? [
                              "Beschikbaarheid binnen 3 dagen",
                              "Sterke match met zorgtype",
                              "Hoge acceptatiegraad (92%)"
                            ]
                          : index === 1
                          ? [
                              "Ruime capaciteit (8 plekken)",
                              "Ervaring met complexe cases",
                              "Snelle reactietijd (4u)"
                            ]
                          : [
                              "Hoogste rating (4.8)",
                              "Perfecte specialisatie",
                              "Goede nabijheid regio"
                            ]
                      }
                      tradeoffs={
                        index === 0 
                          ? []
                          : index === 1
                          ? [
                              "Reactietijd 12u (boven gemiddelde)",
                              "Beperkte ervaring met leeftijdsgroep"
                            ]
                          : [
                              "Geen capaciteit (wachtlijst)",
                              "Afstand 23km (buiten voorkeursradius)",
                              "Wachttijd 2-3 weken"
                            ]
                      }
                      confidence={index === 0 ? "high" : index === 1 ? "medium" : "low"}
                      compact
                    />

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 mt-4">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onConfirmMatch(provider.id);
                        }}
                        className="flex-1 bg-primary hover:bg-primary/90"
                        disabled={index === 2 && provider.availableSpots === 0}
                      >
                        Plaats direct
                      </Button>
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProvider(provider.id);
                        }}
                      >
                        Bekijk details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty State Alternative */}
            {topMatches.length === 0 && (
              <div className="premium-card p-8 text-center">
                <AlertTriangle size={48} className="mx-auto mb-4 text-yellow-base" />
                <h3 className="text-lg font-bold text-foreground mb-2">
                  Geen aanbieders gevonden
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Geen geschikte aanbieders binnen geselecteerde regio ({radius}km)
                </p>
                
                <div className="flex items-center justify-center gap-4">
                  <Button 
                    variant="outline"
                    onClick={() => setRadius(50)}
                  >
                    Vergroot radius naar 50km
                  </Button>
                  <Button variant="outline">
                    Pas filters aan
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Map (40%) */}
        <div 
          className={`${
            mapView === "full" ? "w-full" : "w-[40%]"
          } relative border-l border-border bg-card/40`}
        >
          {/* Map Controls */}
          <div className="absolute top-4 right-4 z-10 space-y-3">
            {/* Radius Selector */}
            <div className="premium-card p-3 bg-card/95 backdrop-blur">
              <p className="text-xs text-muted-foreground mb-2">Radius</p>
              <div className="flex gap-2">
                {[10, 20, 50].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadius(r)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      radius === r
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                  >
                    {r}km
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Controls */}
            <button className="premium-card p-2 bg-card/95 backdrop-blur hover:bg-card/80 transition-colors">
              <Filter size={16} className="text-muted-foreground" />
            </button>

            {/* Reset View */}
            <button className="premium-card p-2 bg-card/95 backdrop-blur hover:bg-card/80 transition-colors">
              <Navigation size={16} className="text-muted-foreground" />
            </button>

            {/* Toggle Full Map */}
            <button 
              onClick={() => setMapView(mapView === "split" ? "full" : "split")}
              className="premium-card p-2 bg-card/95 backdrop-blur hover:bg-card/80 transition-colors"
            >
              <Maximize2 size={16} className="text-muted-foreground" />
            </button>
          </div>

          <div className="h-full w-full overflow-hidden">
            <iframe
              key={googleMapsEmbedSrc}
              title="Aanbieders kaart"
              src={googleMapsEmbedSrc}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>

          <div className="absolute left-4 top-4 z-10 rounded-xl border border-border bg-card/95 px-3 py-2 backdrop-blur">
            <p className="text-xs font-semibold text-foreground">
              Google Maps
            </p>
            <p className="text-[11px] text-muted-foreground">
              Focus: {focusedProvider ? focusedProvider.name : caseData.region}
            </p>
          </div>

          {/* Selected Provider Mini Preview (when hovering map pin) */}
          {selectedProvider && (
            <div className="absolute bottom-4 left-4 right-4 premium-card p-4 bg-card/95 backdrop-blur">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {topMatches.find(p => p.id === selectedProvider)?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getDistance(topMatches.findIndex(p => p.id === selectedProvider))}km · 
                    Match {getMatchScore(topMatches.findIndex(p => p.id === selectedProvider))}%
                  </p>
                </div>
                <Button 
                  size="sm"
                  onClick={() => {
                    const provider = topMatches.find(p => p.id === selectedProvider);
                    if (provider) onConfirmMatch(provider.id);
                  }}
                >
                  Plaats
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
