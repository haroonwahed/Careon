/**
 * MatchingPageWithMap - explainable recommendation workspace
 */

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  MapPin,
  Maximize2,
  Navigation,
  Star,
  Users,
} from "lucide-react";
import { Button } from "../ui/button";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { toLegacyCase, toLegacyProvider } from "../../lib/careLegacyAdapters";

interface MatchingPageWithMapProps {
  caseId: string;
  onBack: () => void;
  onConfirmMatch: (providerId: string) => Promise<void> | void;
  isSubmittingMatch?: boolean;
  submitError?: string | null;
}

const PIN_POSITIONS = [
  { top: "22%", left: "58%" },
  { top: "44%", left: "70%" },
  { top: "66%", left: "54%" },
] as const;

export function MatchingPageWithMap({
  caseId,
  onBack,
  onConfirmMatch,
  isSubmittingMatch = false,
  submitError = null,
}: MatchingPageWithMapProps) {
  const alternativesRef = useRef<HTMLDivElement | null>(null);

  const { cases, loading: casesLoading, error: casesError } = useCases({ q: "" });
  const { providers, loading: providersLoading, error: providersError } = useProviders({ q: "" });
  const legacyCases = cases.map(toLegacyCase);
  const legacyProviders = providers.map(toLegacyProvider);

  const caseData = legacyCases.find((item) => item.id === caseId);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [hoveredProviderId, setHoveredProviderId] = useState<string | null>(null);
  const [radius, setRadius] = useState<number>(20);
  const [mapView, setMapView] = useState<"split" | "full">("split");
  const [showOnlyAvailablePins, setShowOnlyAvailablePins] = useState(false);
  const [scenarioMessage, setScenarioMessage] = useState<string | null>(null);

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

  // Keep existing candidate selection logic intact.
  const topMatches = legacyProviders
    .filter((provider) => provider.region === caseData.region || provider.region === "Amsterdam")
    .slice(0, 3);

  // Keep existing scoring logic intact.
  const getMatchScore = (index: number): number => {
    if (index === 0) return 94;
    if (index === 1) return 78;
    return 62;
  };

  // Keep existing scoring logic intact.
  const getDistance = (index: number): number => {
    if (index === 0) return 8;
    if (index === 1) return 15;
    return 23;
  };

  const rankedMatches = useMemo(() => {
    return topMatches.map((provider, index) => {
      const score = getMatchScore(index);
      const distance = getDistance(index);

      const strongPoints =
        index === 0
          ? [
              "Sterke inhoudelijke fit met de zorgvraag",
              "Hoge succeskans op basis van vergelijkbare trajecten",
              "Snelle operationele opstart",
            ]
          : index === 1
            ? ["Meer vrije plekken op korte termijn", "Goede ervaring met complexe casussen"]
            : ["Hoge kwaliteitsscore", "Sterke specialistische expertise"];

      const tradeOffs =
        index === 0
          ? ["Minder buffer bij plotselinge capaciteitsdruk", "Hogere kans op piekbelasting"]
          : index === 1
            ? ["Lagere inhoudelijke fit dan de topkeuze", "Langere reactietijd"]
            : ["Afstand buiten voorkeursradius", "Lagere directe beschikbaarheid"];

      const alternativeReasons =
        index === 1
          ? ["Iets zwakkere specialisatie-fit", "Langere reactietijd dan aanbevolen aanbieder"]
          : index === 2
            ? ["Minder directe beschikbaarheid", "Grotere afstand dan voorkeur"]
            : [];

      return {
        provider,
        index,
        score,
        distance,
        strongPoints,
        tradeOffs,
        alternativeReasons,
        confidenceLabel: index === 0 ? "Hoog vertrouwen" : index === 1 ? "Gemiddeld vertrouwen" : "Voorzichtig vertrouwen",
      };
    });
  }, [topMatches]);

  const bestMatch = rankedMatches[0] ?? null;
  const alternatives = rankedMatches.slice(1, 3);
  const selectedMatch = rankedMatches.find((item) => item.provider.id === selectedProviderId) ?? bestMatch;

  const focusedProviderId = hoveredProviderId ?? selectedProviderId ?? bestMatch?.provider.id ?? null;
  const focusedMatch = rankedMatches.find((item) => item.provider.id === focusedProviderId) ?? null;
  const mapZoom = focusedMatch ? 13 : radius <= 10 ? 12 : radius <= 20 ? 11 : 10;
  const mapQuery = focusedMatch
    ? `${focusedMatch.provider.name}, ${focusedMatch.provider.region}, Nederland`
    : `${caseData.region}, Nederland`;
  const googleMapsEmbedSrc = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${mapZoom}&output=embed`;

  const visiblePins = showOnlyAvailablePins
    ? rankedMatches.filter((item) => item.provider.availableSpots > 0)
    : rankedMatches;

  const hasDirectCapacity = Boolean(bestMatch && bestMatch.provider.availableSpots > 0);

  const handleSelectProvider = (providerId: string) => {
    setSelectedProviderId(providerId);
    setScenarioMessage(null);
  };

  const handleScenarioWaitlist = () => {
    if (!bestMatch) return;
    setSelectedProviderId(bestMatch.provider.id);
    setScenarioMessage(`Wachtlijstvoorstel voorbereid voor ${bestMatch.provider.name}.`);
  };

  const handleScenarioExpandRadius = () => {
    setRadius(50);
    setScenarioMessage("Zoekgebied vergroot naar 50km.");
  };

  const handleScenarioShowAlternatives = () => {
    alternativesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setScenarioMessage("Alternatieven in beeld gebracht.");
  };

  const resetMapView = () => {
    setRadius(20);
    setMapView("split");
    setSelectedProviderId(null);
    setHoveredProviderId(null);
    setShowOnlyAvailablePins(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="border-b border-border bg-card/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[1920px] items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="gap-2 hover:bg-primary/10 hover:text-primary">
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

      <div className="flex flex-1 overflow-hidden">
        <div className={`${mapView === "full" ? "hidden" : "w-[60%]"} overflow-y-auto border-r border-border bg-background`}>
          <div className="mx-auto max-w-5xl space-y-6 p-6 pb-24">
            {submitError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {submitError}
              </div>
            )}

            {scenarioMessage && (
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                {scenarioMessage}
              </div>
            )}

            {bestMatch && (
              <section className="premium-card p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary mb-1">Aanbevolen aanbieder</p>
                    <h2 className="text-2xl font-bold text-foreground">{bestMatch.provider.name}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{bestMatch.provider.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Matchscore</p>
                    <p className="text-3xl font-bold text-green-base">{bestMatch.score}%</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Beste match op basis van specialisatie-fit, verwachte uitkomstkans en operationele haalbaarheid voor deze casus.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Afstand</p>
                    <p className="font-semibold text-foreground">{bestMatch.distance}km</p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Capaciteit</p>
                    <p className={`font-semibold ${bestMatch.provider.availableSpots > 0 ? "text-green-base" : "text-red-base"}`}>
                      {bestMatch.provider.availableSpots}/{bestMatch.provider.capacity}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Reactietijd</p>
                    <p className="font-semibold text-foreground">{bestMatch.provider.responseTime}u</p>
                  </div>
                </div>

                {hasDirectCapacity ? (
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => {
                        void onConfirmMatch(bestMatch.provider.id);
                      }}
                      disabled={isSubmittingMatch}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {isSubmittingMatch ? "Bezig met plaatsen..." : "Plaats direct"}
                    </Button>
                    <Button variant="outline" onClick={() => handleSelectProvider(bestMatch.provider.id)}>
                      Focus op kaart
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-yellow-500/35 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                      Geen directe capaciteit binnen geselecteerde radius
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" onClick={handleScenarioWaitlist}>
                        Plaats op wachtlijst
                      </Button>
                      <Button variant="outline" onClick={handleScenarioExpandRadius}>
                        Vergroot zoekgebied
                      </Button>
                      <Button variant="outline" onClick={handleScenarioShowAlternatives}>
                        Toon alternatieven
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section ref={alternativesRef} className="space-y-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Alternatieven</h3>
                <p className="text-sm text-muted-foreground">Top 3 totaal: aanbevolen aanbieder plus alternatieve opties.</p>
              </div>

              {alternatives.length === 0 && (
                <div className="premium-card p-4 text-sm text-muted-foreground">Geen alternatieve aanbieders beschikbaar.</div>
              )}

              {alternatives.map((item) => {
                const isSelected = selectedProviderId === item.provider.id;
                return (
                  <article
                    key={item.provider.id}
                    onClick={() => handleSelectProvider(item.provider.id)}
                    onMouseEnter={() => setHoveredProviderId(item.provider.id)}
                    onMouseLeave={() => setHoveredProviderId(null)}
                    className={`premium-card p-5 cursor-pointer transition-all ${isSelected ? "border-2 border-primary shadow-lg shadow-primary/15" : "hover:border-primary/40"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-base font-semibold text-foreground">{item.provider.name}</h4>
                        <p className="text-sm text-muted-foreground">{item.provider.type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Matchscore</p>
                        <p className="text-xl font-bold text-foreground">{item.score}%</p>
                      </div>
                    </div>

                    <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                      {item.alternativeReasons.slice(0, 2).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>

                    <div className="mt-4 flex items-center gap-3">
                      {item.provider.availableSpots > 0 ? (
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            void onConfirmMatch(item.provider.id);
                          }}
                          disabled={isSubmittingMatch}
                          className="bg-primary hover:bg-primary/90"
                        >
                          {isSubmittingMatch ? "Bezig..." : "Plaats direct"}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSelectProvider(item.provider.id);
                            setScenarioMessage(`Geen directe capaciteit bij ${item.provider.name}; overweeg wachtlijst.`);
                          }}
                        >
                          Plaats op wachtlijst
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSelectProvider(item.provider.id);
                        }}
                      >
                        Bekijk op kaart
                      </Button>
                    </div>
                  </article>
                );
              })}
            </section>

            {selectedMatch && (
              <section className="premium-card p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-foreground">Waarom deze match?</h3>
                  <span className="rounded-full border border-green-500/40 bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-200">
                    {selectedMatch.confidenceLabel}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Sterke punten</p>
                    <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                      {selectedMatch.strongPoints.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Trade-offs</p>
                    <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                      {selectedMatch.tradeOffs.map((tradeoff) => (
                        <li key={tradeoff}>{tradeoff}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            <section className="premium-card p-6 space-y-3">
              <h3 className="text-lg font-bold text-foreground">Waarom niet andere aanbieders?</h3>

              {alternatives.length === 0 && (
                <p className="text-sm text-muted-foreground">Er zijn momenteel geen concurrerende alternatieven binnen de selectie.</p>
              )}

              {alternatives.map((item) => (
                <div key={`why-not-${item.provider.id}`} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold text-foreground">{item.provider.name}</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                    {item.alternativeReasons.slice(0, 2).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>

            {rankedMatches.length === 0 && (
              <div className="premium-card p-8 text-center">
                <AlertTriangle size={42} className="mx-auto mb-3 text-yellow-base" />
                <h3 className="text-lg font-bold text-foreground mb-2">Geen aanbieders gevonden</h3>
                <p className="text-sm text-muted-foreground">Geen geschikte aanbieders binnen de huidige selectie.</p>
              </div>
            )}
          </div>
        </div>

        <div className={`${mapView === "full" ? "w-full" : "w-[40%]"} relative border-l border-border bg-card/40`}>
          <div className="absolute top-4 right-4 z-10 space-y-3">
            <div className="premium-card p-3 bg-card/95 backdrop-blur">
              <p className="text-xs text-muted-foreground mb-2">Radius</p>
              <div className="flex gap-2">
                {[10, 20, 50].map((value) => (
                  <button
                    key={value}
                    onClick={() => setRadius(value)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      radius === value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                  >
                    {value}km
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowOnlyAvailablePins((state) => !state)}
              className={`premium-card p-2 bg-card/95 backdrop-blur transition-colors ${showOnlyAvailablePins ? "border-primary/70" : "hover:bg-card/80"}`}
              title={showOnlyAvailablePins ? "Toont alleen pins met capaciteit" : "Filter op beschikbare capaciteit"}
            >
              <Filter size={16} className="text-muted-foreground" />
            </button>

            <button
              onClick={resetMapView}
              className="premium-card p-2 bg-card/95 backdrop-blur hover:bg-card/80 transition-colors"
              title="Reset kaartweergave"
            >
              <Navigation size={16} className="text-muted-foreground" />
            </button>

            <button
              onClick={() => setMapView(mapView === "split" ? "full" : "split")}
              className="premium-card p-2 bg-card/95 backdrop-blur hover:bg-card/80 transition-colors"
              title="Wissel kaartweergave"
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
            <p className="text-xs font-semibold text-foreground">Google Maps</p>
            <p className="text-[11px] text-muted-foreground">
              Focus: {focusedMatch ? focusedMatch.provider.name : caseData.region}
            </p>
          </div>

          {visiblePins.map((item) => {
            const isActive = focusedProviderId === item.provider.id;
            const pinPosition = PIN_POSITIONS[item.index] ?? PIN_POSITIONS[PIN_POSITIONS.length - 1];

            return (
              <button
                key={`pin-${item.provider.id}`}
                onClick={() => handleSelectProvider(item.provider.id)}
                onMouseEnter={() => setHoveredProviderId(item.provider.id)}
                onMouseLeave={() => setHoveredProviderId(null)}
                className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 px-2 py-1 text-xs font-semibold transition-all ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground scale-110"
                    : "border-border bg-card/95 text-foreground hover:border-primary/50"
                }`}
                style={{ top: pinPosition.top, left: pinPosition.left }}
                title={`${item.provider.name} (${item.score}%)`}
              >
                {item.score}%
              </button>
            );
          })}

          {focusedMatch && (
            <div className="absolute bottom-4 left-4 right-4 premium-card p-4 bg-card/95 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{focusedMatch.provider.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {focusedMatch.distance}km · Match {focusedMatch.score}% · Capaciteit {focusedMatch.provider.availableSpots}/{focusedMatch.provider.capacity}
                  </p>
                </div>

                {focusedMatch.provider.availableSpots > 0 ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      void onConfirmMatch(focusedMatch.provider.id);
                    }}
                    disabled={isSubmittingMatch}
                  >
                    {isSubmittingMatch ? "Bezig..." : "Plaats direct"}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleScenarioWaitlist}>
                    Wachtlijst
                  </Button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><MapPin size={12} /> {focusedMatch.distance}km</div>
                <div className="flex items-center gap-1"><Users size={12} /> {focusedMatch.provider.availableSpots}/{focusedMatch.provider.capacity}</div>
                <div className="flex items-center gap-1"><Star size={12} /> {focusedMatch.provider.rating.toFixed(1)}</div>
                <div className="flex items-center gap-1"><Clock size={12} /> {focusedMatch.provider.responseTime}u</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
