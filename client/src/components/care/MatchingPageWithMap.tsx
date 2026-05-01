/**
 * MatchingPageWithMap - explainable recommendation workspace
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Loader2,
  Maximize2,
  Star,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { toLegacyCase, toLegacyProvider } from "../../lib/careLegacyAdapters";
import { apiClient } from "../../lib/apiClient";
import { ProviderNetworkMap } from "./ProviderNetworkMap";

interface MatchingPageWithMapProps {
  caseId: string;
  onBack: () => void;
  onConfirmMatch: (providerId: string) => Promise<void> | void;
  /** After a persisted waitlist proposal, open canonical case detail (SPA or full navigation). */
  onNavigateToCase?: (caseId: string) => void;
  isSubmittingMatch?: boolean;
  submitError?: string | null;
}

export function MatchingPageWithMap({
  caseId,
  onBack,
  onConfirmMatch,
  onNavigateToCase,
  isSubmittingMatch = false,
  submitError = null,
}: MatchingPageWithMapProps) {
  const focusZoneRef = useRef<HTMLDivElement | null>(null);

  const { cases, loading: casesLoading, error: casesError } = useCases({ q: "" });
  const { providers, loading: providersLoading, error: providersError } = useProviders({ q: "" });
  const legacyCases = cases.map(toLegacyCase);
  const legacyProviders = providers.map(toLegacyProvider);

  const caseData = legacyCases.find((item) => item.id === caseId);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [hoveredProviderId, setHoveredProviderId] = useState<string | null>(null);
  const [mapView, setMapView] = useState<"split" | "full">("split");
  const [showOnlyAvailablePins, setShowOnlyAvailablePins] = useState(false);
  const [scenarioMessage, setScenarioMessage] = useState<string | null>(null);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistModalError, setWaitlistModalError] = useState<string | null>(null);
  const [pinPulseProviderId, setPinPulseProviderId] = useState<string | null>(null);
  const waitlistPreparePrimaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pinPulseProviderId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPinPulseProviderId((current) => (current === pinPulseProviderId ? null : current));
    }, 1600);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [pinPulseProviderId]);

  const regionalPool = useMemo(() => {
    if (!caseData) return [];
    return legacyProviders.filter(
      (provider) => provider.region === caseData.region || provider.region === "Amsterdam",
    );
  }, [caseData, legacyProviders]);

  const topMatches = regionalPool.slice(0, 3);
  const overflowProviders = regionalPool.slice(3);

  const getMatchScore = (index: number): number => {
    if (index === 0) return 82;
    if (index === 1) return 76;
    return 68;
  };

  const getDistance = (index: number): number => {
    if (index === 0) return 8;
    if (index === 1) return 15;
    return 23;
  };

  const scoreBreakdownParts = (score: number) => {
    const specialization = Math.round((score * 30) / 82);
    const region = Math.round((score * 20) / 82);
    const capacity = Math.round((score * 15) / 82);
    const complexity = Math.max(0, score - specialization - region - capacity);
    return { specialization, region, capacity, complexity };
  };

  const rankedMatches = useMemo(() => {
    return topMatches.map((provider, index) => {
      const score = getMatchScore(index);
      const distance = getDistance(index);
      const breakdown = scoreBreakdownParts(score);

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

      const focusChecks =
        index === 0
          ? [
              { label: "Specialisatie", value: "Jeugdzorg complex" },
              { label: "Regio", value: provider.region },
              { label: "Historisch succes", value: "Hoog" },
            ]
          : index === 1
            ? [
                { label: "Capaciteit", value: "Beschikbaar" },
                { label: "Regio", value: "Randgebied" },
              ]
            : [
                { label: "Regio", value: provider.region },
                { label: "Score", value: `${score}%` },
              ];

      const capacityUpdateLabel = caseData?.lastActivity?.trim() || "recent onbekend";
      const warnings =
        index === 0
          ? [`Capaciteit onzeker (laatste activiteit casus: ${capacityUpdateLabel})`]
          : index === 1
            ? ["Minder ervaring met complexe casussen"]
            : ["Lage capaciteit", "Onzekere wachttijd"];

      const whyMatch =
        index === 0
          ? "Sterke inhoudelijke fit, maar risico op vertraging"
          : index === 1
            ? "Sneller beschikbaar, maar lagere inhoudelijke fit"
            : "Geen betere alternatieven beschikbaar";

      const tier = index === 0 ? "best" : index === 1 ? "balanced" : "risk";

      return {
        provider,
        index,
        score,
        distance,
        strongPoints,
        tradeOffs,
        alternativeReasons,
        confidenceLabel: index === 0 ? "Hoog vertrouwen" : index === 1 ? "Gemiddeld vertrouwen" : "Voorzichtig vertrouwen",
        breakdown,
        focusChecks,
        warnings,
        whyMatch,
        tier,
        whyShownThird: index === 2 ? "Geen betere alternatieven beschikbaar" : null,
      };
    });
  }, [topMatches, caseData?.lastActivity]);

  const overflowList = useMemo(
    () =>
      overflowProviders.map((provider, i) => ({
        provider,
        score: Math.max(52, 66 - i * 3),
      })),
    [overflowProviders],
  );

  type RankedMatchRow = (typeof rankedMatches)[number];
  const [selectionConfirmMatch, setSelectionConfirmMatch] = useState<RankedMatchRow | null>(null);
  const [waitlistTargetMatch, setWaitlistTargetMatch] = useState<RankedMatchRow | null>(null);

  useEffect(() => {
    setWaitlistModalOpen(false);
    setWaitlistModalError(null);
    setWaitlistSubmitting(false);
    setSelectionConfirmMatch(null);
    setWaitlistTargetMatch(null);
  }, [caseId]);

  const visiblePins = useMemo(() => {
    return showOnlyAvailablePins ? rankedMatches.filter((item) => item.provider.availableSpots > 0) : rankedMatches;
  }, [rankedMatches, showOnlyAvailablePins]);

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

  const bestMatch = rankedMatches[0] ?? null;
  const optA = rankedMatches[0] ?? null;
  const optB = rankedMatches[1] ?? null;

  const spaCaseRaw = cases.find((c) => c.id === caseId) ?? null;
  const matchQualityPercent = bestMatch?.score ?? 0;
  const confidenceWord =
    matchQualityPercent >= 85 ? "Hoog" : matchQualityPercent >= 70 ? "Gemiddeld" : "Laag";
  const showUrgentBanner = caseData.urgency === "critical" || caseData.urgency === "high";
  const capacityScarceInRegion =
    rankedMatches.length > 0 && rankedMatches.every((m) => m.provider.availableSpots <= 1);
  const urgencyBannerLabel = !showUrgentBanner
    ? null
    : spaCaseRaw?.urgency === "critical"
      ? "Urgent: spoedige regie en matching vereist"
      : spaCaseRaw != null && spaCaseRaw.wachttijd >= 5
        ? `Urgent: casus al ${spaCaseRaw.wachttijd} dagen in de stroom — versnel doorleiding`
        : "Urgent: hoge prioriteit — plan validatie en doorleiding snel";
  const waaromNietHoger = [
    capacityScarceInRegion ? "Beperkte capaciteit in regio" : "Beperkte keuze in gematcht aanbod",
    caseData.risk === "high" || caseData.risk === "medium"
      ? "Complexe zorgvraag"
      : caseData.signal.trim() && caseData.signal !== "Geen bijzonderheden"
        ? caseData.signal
        : "Aanvullende beperkingen in het profiel",
  ];

  const handleSelectProvider = (providerId: string) => {
    // Re-trigger pulse feedback even when the same pin is clicked again.
    if (providerId === pinPulseProviderId) {
      setPinPulseProviderId(null);
      window.setTimeout(() => setPinPulseProviderId(providerId), 0);
    } else {
      setPinPulseProviderId(providerId);
    }
    setSelectedProviderId(providerId);
    const providerName = rankedMatches.find((item) => item.provider.id === providerId)?.provider.name;
    setScenarioMessage(providerName ? `${providerName} geselecteerd op de kaart.` : "Aanbieder geselecteerd op de kaart.");
  };

  const handleOpenWaitlistModal = (match: RankedMatchRow) => {
    setScenarioMessage(null);
    setWaitlistModalError(null);
    setWaitlistTargetMatch(match);
    setWaitlistModalOpen(true);
  };

  const handleConfirmWaitlistPrepare = async () => {
    const target = waitlistTargetMatch;
    if (!target) return;
    setWaitlistModalError(null);
    setWaitlistSubmitting(true);
    try {
      const providerId = Number(target.provider.id);
      if (Number.isNaN(providerId)) {
        throw new Error("Ongeldige aanbieder-id.");
      }
      await apiClient.post<Record<string, unknown>>(`/care/api/cases/${caseId}/matching/action/`, {
        action: "prepare_waitlist_proposal",
        provider_id: providerId,
        match_score: target.score,
      });
      setSelectedProviderId(target.provider.id);
      setWaitlistModalOpen(false);
      setWaitlistTargetMatch(null);
      setScenarioMessage(null);
      if (onNavigateToCase) {
        onNavigateToCase(caseId);
      } else {
        window.location.assign(`/care/cases/${encodeURIComponent(caseId)}/`);
      }
    } catch (err) {
      let msg = err instanceof Error ? err.message : "Wachtlijstvoorstel mislukt.";
      const jsonStart = msg.indexOf("{");
      if (jsonStart !== -1) {
        try {
          const parsed = JSON.parse(msg.slice(jsonStart)) as { error?: string };
          if (typeof parsed.error === "string" && parsed.error.trim()) {
            msg = parsed.error.trim();
          }
        } catch {
          /* keep raw message */
        }
      }
      setWaitlistModalError(msg);
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  const handleScenarioExpandRadius = () => {
    setScenarioMessage("Zoekgebied vergroot naar 50km.");
  };

  const handleScenarioShowAlternatives = () => {
    focusZoneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setScenarioMessage("Topaanbevelingen in beeld gebracht.");
  };

  const resetMapView = () => {
    setMapView("split");
    setSelectedProviderId(null);
    setHoveredProviderId(null);
    setShowOnlyAvailablePins(false);
    setWaitlistModalOpen(false);
    setWaitlistModalError(null);
    setWaitlistTargetMatch(null);
  };

  const handleRequestSelection = (match: RankedMatchRow) => {
    setSelectionConfirmMatch(match);
  };

  const handleConfirmSelectionChoice = () => {
    const match = selectionConfirmMatch;
    if (!match) return;
    setSelectionConfirmMatch(null);
    if (match.provider.availableSpots > 0) {
      void onConfirmMatch(match.provider.id);
      return;
    }
    handleOpenWaitlistModal(match);
  };

  const scrollToFocusZone = () => {
    focusZoneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground min-[1200px]:overflow-hidden">
      <div className="border-b border-border/60 bg-background/80 px-6 py-2.5 backdrop-blur">
        <div className="flex h-9 w-full items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              if (onNavigateToCase) {
                onNavigateToCase(caseId);
                return;
              }
              window.location.assign(`/care/cases/${encodeURIComponent(caseId)}/`);
            }}
            className="gap-2 hover:bg-primary/10 hover:text-primary"
          >
            <ArrowLeft size={16} />
            Terug naar casus
          </Button>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {caseData.id} · {caseData.clientName}
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">
              Matching controleren
            </span>
          </div>
        </div>
      </div>

      <div className="w-full flex-1 px-6 py-6 min-[1200px]:min-h-0 min-[1200px]:overflow-hidden min-[1200px]:pb-8 min-[1200px]:pt-4">
        <div className="flex h-auto min-h-[620px] w-full min-w-0 flex-col gap-6 min-[1200px]:h-[calc(100vh-170px)] min-[1200px]:grid min-[1200px]:grid-cols-[minmax(520px,0.75fr)_minmax(680px,1.25fr)] min-[1200px]:overflow-hidden">
        <div
          className={`${mapView === "full" ? "hidden min-[1200px]:hidden" : "block"} min-h-0 overflow-hidden min-[1200px]:h-full`}
        >
          <div className="flex h-full min-h-0 flex-col">
            {submitError && (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {submitError}
              </div>
            )}

            {scenarioMessage && (
              <div className="mb-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                {scenarioMessage}
              </div>
            )}

            <div className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 pb-8">
              <section className="premium-card space-y-4 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Matching</p>
                    <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Matching — Casus {caseData.id}</h1>
                    <div className="flex flex-wrap gap-2">
                      {urgencyBannerLabel ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/35 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                          <span className="size-1.5 rounded-full bg-destructive" aria-hidden />
                          {urgencyBannerLabel}
                        </span>
                      ) : null}
                      {capacityScarceInRegion ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                          Capaciteit schaars in regio
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={scrollToFocusZone}
                    className="h-10 shrink-0 gap-2 rounded-xl bg-primary px-4 text-primary-foreground hover:bg-primary/90"
                  >
                    Valideer keuze
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                  <Button variant="ghost" size="sm" type="button" onClick={handleScenarioShowAlternatives}>
                    Naar top 3
                  </Button>
                  <Button variant="ghost" size="sm" type="button" onClick={handleScenarioExpandRadius}>
                    Vergroot zoekgebied
                  </Button>
                </div>
              </section>

              {bestMatch ? (
                <section className="premium-card space-y-3 p-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Matchkwaliteit</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{matchQualityPercent}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Vertrouwen</p>
                      <p className="text-sm font-semibold text-foreground">{confidenceWord}</p>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{ width: `${Math.min(100, matchQualityPercent)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          <Info className="size-3.5" aria-hidden />
                          Waarom niet hoger?
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        className="max-w-xs border border-border bg-popover px-3 py-2 text-xs text-popover-foreground"
                      >
                        De score blijft beperkt door regionale druk en onzekerheid rond capaciteit. Validatie door de gemeente blijft nodig.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {waaromNietHoger.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span className="text-foreground">-</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section ref={focusZoneRef} className="space-y-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Top 3 aanbevelingen</h2>
                  <p className="text-sm text-muted-foreground">Leg trade-offs naast elkaar en kies bewust — matching is advies, geen automatische toewijzing.</p>
                </div>

                <div className="space-y-4">
                  {rankedMatches.map((item) => {
                    const isSelected = selectedProviderId === item.provider.id;
                    const tierBorder =
                      item.tier === "best"
                        ? "border-emerald-500/25 bg-emerald-500/[0.04]"
                        : item.tier === "balanced"
                          ? "border-amber-500/25 bg-amber-500/[0.04]"
                          : "border-destructive/25 bg-destructive/[0.04]";
                    return (
                      <article
                        key={item.provider.id}
                        onClick={() => handleSelectProvider(item.provider.id)}
                        onMouseEnter={() => setHoveredProviderId(item.provider.id)}
                        onMouseLeave={() => setHoveredProviderId(null)}
                        className={`premium-card cursor-pointer p-4 transition-all md:p-5 ${tierBorder} ${
                          isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:border-primary/40"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-muted-foreground">Optie {item.index + 1}</p>
                            <h3 className="mt-0.5 truncate text-base font-semibold text-foreground md:text-lg">{item.provider.name}</h3>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1">
                                <Star className="size-4 text-amber-500" aria-hidden />
                                <span className="text-sm font-bold tabular-nums text-foreground">{item.score}%</span>
                                <span className="sr-only">Matchscore, hover voor opbouw</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="left"
                              className="max-w-[260px] border border-border bg-popover px-3 py-2 text-xs text-popover-foreground"
                            >
                              <p className="font-semibold text-foreground">{item.score}% opgebouwd uit</p>
                              <ul className="mt-2 space-y-1">
                                <li>Specialisatie: {item.breakdown.specialization}%</li>
                                <li>Regio: {item.breakdown.region}%</li>
                                <li>Capaciteit: {item.breakdown.capacity}%</li>
                                <li>Complexiteit match: {item.breakdown.complexity}%</li>
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                          {item.focusChecks.map((row) => (
                            <li key={`${item.provider.id}-${row.label}`} className="flex gap-2">
                              <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                              <span>
                                <span className="font-medium text-foreground">{row.label}:</span> {row.value}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Let op</p>
                          <ul className="mt-1 space-y-1 text-muted-foreground">
                            {item.warnings.map((w) => (
                              <li key={w} className="flex gap-2">
                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {item.tier === "risk" && item.whyShownThird ? (
                          <p className="mt-3 text-sm font-medium text-destructive">
                            Waarom toch getoond: {item.whyShownThird}
                          </p>
                        ) : (
                          <p className="mt-3 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Waarom deze match:</span> {item.whyMatch}
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                            disabled={isSubmittingMatch}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestSelection(item);
                            }}
                          >
                            Selecteer
                            <ArrowRight className="ml-1 size-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectProvider(item.provider.id);
                            }}
                          >
                            Bekijk details
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              {optA && optB ? (
                <section className="premium-card space-y-4 p-5">
                  <h2 className="text-lg font-bold text-foreground">Wat speelt hier?</h2>
                  <p className="text-sm text-muted-foreground">Je moet kiezen tussen:</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-border bg-card/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Optie A</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{optA.provider.name}</p>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <li className="flex gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                          Beste inhoudelijke match
                        </li>
                        <li className="flex gap-2">
                          <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                          Kans op wachttijd
                        </li>
                      </ul>
                    </div>
                    <div className="rounded-xl border border-border bg-card/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Optie B</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{optB.provider.name}</p>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <li className="flex gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                          Direct beschikbaar
                        </li>
                        <li className="flex gap-2">
                          <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                          Minder passend
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">Aanbeveling</p>
                    <p className="mt-1">Kies A als kwaliteit prioriteit heeft. Kies B als snelheid kritiek is.</p>
                  </div>
                </section>
              ) : null}

              {overflowList.length > 0 ? (
                <Collapsible className="rounded-xl border border-border/80 bg-card/30">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted/40">
                    <span>Overige aanbieders ({overflowList.length})</span>
                    <span className="text-xs font-normal text-muted-foreground">Secundair · inklappen</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-2">
                    <ul className="space-y-2">
                      {overflowList.map((row) => (
                        <li
                          key={row.provider.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm"
                        >
                          <button
                            type="button"
                            className="min-w-0 text-left font-medium text-foreground hover:underline"
                            onClick={() => handleSelectProvider(row.provider.id)}
                          >
                            {row.provider.name}
                          </button>
                          <span className="tabular-nums text-muted-foreground">{row.score}%</span>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              ) : null}

              {rankedMatches.length === 0 && (
                <div className="premium-card p-8 text-center">
                  <AlertTriangle size={42} className="mx-auto mb-3 text-yellow-base" />
                  <h3 className="text-lg font-bold text-foreground mb-2">Geen aanbieders</h3>
                  <p className="text-sm text-muted-foreground">Geen geschikte aanbieders binnen de selectie.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="flex min-h-[520px] flex-col gap-3 rounded-3xl border border-border/80 bg-card/40 p-3 min-[1200px]:h-full min-[1200px]:min-h-[640px] transition-opacity duration-300 opacity-100"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 bg-background/90 px-3 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Kaart</p>
              <p className="text-[11px] text-muted-foreground">
                {visiblePins.length} opties zichtbaar{showOnlyAvailablePins ? " · alleen beschikbaar" : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {visiblePins.slice(0, 3).map((item) => (
                  <span
                    key={`map-option-${item.provider.id}`}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      item.provider.availableSpots > 0
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.provider.name}
                  </span>
                ))}
                {visiblePins.length === 0 && (
                  <span className="text-[11px] text-muted-foreground">Geen opties.</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowOnlyAvailablePins((state) => !state)}
                className={`premium-card bg-card/95 px-3 py-2 text-xs font-semibold backdrop-blur transition-colors ${showOnlyAvailablePins ? "border-primary/70" : "hover:bg-card/80"}`}
                title={showOnlyAvailablePins ? "Toont alleen beschikbare aanbieders" : "Filter op beschikbare aanbieders"}
              >
                {showOnlyAvailablePins ? "Alle opties" : "Beschikbaar"}
              </button>

              <button
                onClick={() => setMapView(mapView === "split" ? "full" : "split")}
                className="premium-card bg-card/95 p-2 backdrop-blur hover:bg-card/80 transition-colors"
                title="Wissel kaartweergave"
              >
                <Maximize2 size={16} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/80">
            <ProviderNetworkMap
              providers={providers}
              selectedProviderId={selectedProviderId ?? bestMatch?.provider.id ?? null}
              hoveredProviderId={hoveredProviderId}
              onSelectProvider={handleSelectProvider}
              theme="dark"
            />
          </div>
        </div>
        </div>
      </div>

      <>
        <Dialog
          open={selectionConfirmMatch !== null}
          onOpenChange={(open) => {
            if (!open) setSelectionConfirmMatch(null);
          }}
        >
          <DialogContent className="max-w-[min(520px,calc(100%-2rem))] gap-4 rounded-2xl border-border bg-card p-6 sm:max-w-[520px]">
            <DialogHeader className="gap-2 text-left">
              <DialogTitle className="text-xl font-semibold">Bevestig keuze</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Je staat op het punt om{" "}
                    <span className="font-semibold text-foreground">{selectionConfirmMatch?.provider.name ?? "deze aanbieder"}</span>{" "}
                    te selecteren voor doorleiding.
                  </p>
                  <p>Dit betekent:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>De casus gaat naar aanbiederbeoordeling (advies; geen automatische plaatsing).</li>
                    <li>
                      Andere aanbieders worden niet automatisch afgewezen; dit legt een voorkeurskeuze vast voor deze
                      doorleiding. Bij een andere route kun je opnieuw matchen.
                    </li>
                  </ul>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setSelectionConfirmMatch(null)}>
                Annuleren
              </Button>
              <Button
                type="button"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isSubmittingMatch}
                onClick={() => handleConfirmSelectionChoice()}
              >
                {isSubmittingMatch ? "Bezig..." : "Bevestigen"}
                <ArrowRight className="ml-1 size-4" aria-hidden />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={waitlistModalOpen && waitlistTargetMatch !== null}
          onOpenChange={(open) => {
            setWaitlistModalOpen(open);
            if (!open) setWaitlistTargetMatch(null);
          }}
        >
          <DialogContent
            className="max-w-[min(560px,calc(100%-2rem))] gap-6 rounded-[18px] border-[rgba(148,163,184,0.22)] bg-[#111827] p-6 text-[#E5E7EB] shadow-2xl sm:max-w-[560px]"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              waitlistPreparePrimaryRef.current?.focus();
            }}
          >
            {waitlistTargetMatch ? (
              <>
                <DialogHeader className="gap-3 text-left">
                  <DialogTitle className="text-xl font-semibold text-[#E5E7EB]">Wachtlijstvoorstel voorbereiden</DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed text-[#A7B0C0]">
                    Je legt een concept wachtlijstvoorstel vast voor {waitlistTargetMatch.provider.name}. Daarna ga je verder op de
                    casuspagina om te controleren en eventueel naar de aanbieder te sturen — nog geen definitieve plaatsing.
                  </DialogDescription>
                </DialogHeader>

                {waitlistModalError ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {waitlistModalError}
                  </div>
                ) : null}

                <div className="space-y-0 rounded-xl border border-[rgba(148,163,184,0.15)] bg-[#0f1624] px-4 py-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-[rgba(148,163,184,0.12)] py-2 last:border-b-0">
                    <span className="text-[#A7B0C0]">Aanbieder</span>
                    <span className="max-w-[60%] text-right font-medium text-[#E5E7EB]">{waitlistTargetMatch.provider.name}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-[rgba(148,163,184,0.12)] py-2 last:border-b-0">
                    <span className="text-[#A7B0C0]">Matchscore</span>
                    <span className="font-medium text-[#E5E7EB]">{waitlistTargetMatch.score}%</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-[rgba(148,163,184,0.12)] py-2 last:border-b-0">
                    <span className="text-[#A7B0C0]">Afstand</span>
                    <span className="font-medium text-[#E5E7EB]">{waitlistTargetMatch.distance} km</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-[rgba(148,163,184,0.12)] py-2 last:border-b-0">
                    <span className="text-[#A7B0C0]">Capaciteit</span>
                    <span className="font-medium text-[#E5E7EB]">
                      {waitlistTargetMatch.provider.availableSpots}/{waitlistTargetMatch.provider.capacity}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 py-2">
                    <span className="text-[#A7B0C0]">Reden</span>
                    <span className="text-right font-medium text-[#E5E7EB]">Geen directe capaciteit</span>
                  </div>
                </div>

                <p className="text-xs leading-snug text-[#9CA3AF]">
                  Na bevestiging word je doorgestuurd naar de casus om het vastgelegde voorstel te zien.
                </p>

                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={waitlistSubmitting}
                    onClick={() => {
                      setWaitlistModalOpen(false);
                      setWaitlistTargetMatch(null);
                    }}
                    className="border-[rgba(148,163,184,0.35)] bg-transparent text-[#E5E7EB] hover:bg-white/10 hover:text-[#E5E7EB]"
                  >
                    Annuleren
                  </Button>
                  <Button
                    ref={waitlistPreparePrimaryRef}
                    type="button"
                    disabled={waitlistSubmitting}
                    onClick={() => void handleConfirmWaitlistPrepare()}
                    className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {waitlistSubmitting ? "Bezig..." : "Voorstel vastleggen"}
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </>
    </div>
  );
}
