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
import { getShortReasonLabel } from "../../lib/uxCopy";

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
              Matching controleren
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
                    <p className="text-sm text-muted-foreground mt-1">{bestMatch.provider.type} · {bestMatch.provider.region}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Matchscore</p>
                    <p className="text-3xl font-bold text-green-base">{bestMatch.score}%</p>
                  </div>
                </div>

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

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {bestMatch.confidenceLabel}
                  </span>
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {bestMatch.provider.availableSpots > 0 ? "Capaciteit" : "Geen capaciteit"}
                  </span>
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
                      {isSubmittingMatch ? "Doorsturen..." : "Stuur door naar aanbiederbeoordeling"}
                    </Button>
                    <Button variant="outline" onClick={() => handleSelectProvider(bestMatch.provider.id)}>
                      Op kaart
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-yellow-500/35 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                      Geen directe capaciteit.
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" onClick={handleScenarioWaitlist}>
                        Vraag heroverweging aan
                      </Button>
                      <Button variant="outline" onClick={handleScenarioExpandRadius}>
                        Vergroot zoekgebied
                      </Button>
                      <Button variant="outline" onClick={handleScenarioShowAlternatives}>
                        Bekijk alternatieven
                      </Button>
                    </div>
                  </div>
                )}

                <details className="rounded-2xl border border-border/80 bg-background/60 px-4 py-3 text-sm">
                  <summary className="cursor-pointer list-none font-medium text-foreground">Details</summary>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Sterk</p>
                      <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                        {bestMatch.strongPoints.slice(0, 2).map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Trade-offs</p>
                      <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                        {bestMatch.tradeOffs.slice(0, 2).map((tradeoff) => (
                          <li key={tradeoff}>{tradeoff}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </details>
              </section>
            )}

            <section ref={alternativesRef} className="space-y-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Alternatieven</h3>
                <p className="text-sm text-muted-foreground">Controleer alternatieven voor gemeentelijke validatie.</p>
              </div>

              {alternatives.length === 0 && <div className="premium-card p-4 text-sm text-muted-foreground">Geen alternatieven.</div>}

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
                        <p className="text-sm text-muted-foreground">{item.provider.type} · {item.provider.region}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Matchscore</p>
                        <p className="text-xl font-bold text-foreground">{item.score}%</p>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground">{getShortReasonLabel(item.alternativeReasons[0] ?? "Alternatief")}</p>

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
                          {isSubmittingMatch ? "Doorsturen..." : "Stuur door naar aanbiederbeoordeling"}
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
                          Vraag heroverweging aan
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSelectProvider(item.provider.id);
                        }}
                      >
                        Op kaart
                      </Button>
                    </div>

                    <details className="mt-4 rounded-xl border border-border/80 bg-background/60 px-3 py-3 text-sm">
                      <summary className="cursor-pointer list-none font-medium text-foreground">Details</summary>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Sterk</p>
                          <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-5">
                            {item.strongPoints.slice(0, 2).map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Trade-offs</p>
                          <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-5">
                            {item.tradeOffs.slice(0, 2).map((tradeoff) => (
                              <li key={tradeoff}>{tradeoff}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </details>
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
                <details className="rounded-2xl border border-border/80 bg-background/60 px-4 py-3 text-sm">
                  <summary className="cursor-pointer list-none font-medium text-foreground">Toelichting</summary>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">Sterk</p>
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
                </details>
              </section>
            )}

            <section className="premium-card p-6 space-y-3">
              <h3 className="text-lg font-bold text-foreground">Waarom niet andere aanbieders?</h3>

              {alternatives.length === 0 && (
                <p className="text-sm text-muted-foreground">Geen concurrerende alternatieven.</p>
              )}

              {alternatives.map((item) => (
                <div key={`why-not-${item.provider.id}`} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold text-foreground">{item.provider.name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{getShortReasonLabel(item.alternativeReasons[0] ?? "Alternatief")}</p>
                  <details className="mt-3 rounded-xl border border-border/80 bg-background/60 px-3 py-3 text-sm">
                    <summary className="cursor-pointer list-none font-medium text-foreground">Details</summary>
                    <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                      {item.alternativeReasons.slice(0, 2).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              ))}
            </section>

            {rankedMatches.length === 0 && (
              <div className="premium-card p-8 text-center">
                <AlertTriangle size={42} className="mx-auto mb-3 text-yellow-base" />
                <h3 className="text-lg font-bold text-foreground mb-2">Geen aanbieders</h3>
                <p className="text-sm text-muted-foreground">Geen geschikte aanbieders binnen de selectie.</p>
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
            <p className="text-xs font-semibold text-foreground">Kaart</p>
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
                    {focusedMatch.distance} km · Score {focusedMatch.score}% · {focusedMatch.provider.availableSpots}/{focusedMatch.provider.capacity}
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
                    {isSubmittingMatch ? "Bezig..." : "Stuur door naar aanbiederbeoordeling"}
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
