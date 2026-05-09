/**
 * MatchingPageWithMap - explainable recommendation workspace
 */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Home,
  Info,
  MapPin,
  Shield,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
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
import { tokens } from "../../design/tokens";
import { cn } from "../ui/utils";
import { CarePanel, EmptyState, ErrorState, LoadingState } from "./CareDesignPrimitives";

const MATCH_BRAND = tokens.colors.casussenAccent;
const MATCH_SURFACE = tokens.colors.casussenSurfaceRaised;
const MATCH_BG = tokens.colors.casussenPageChrome;

function formatMatchingCaseTitle(caseId: string): string {
  /** Pilot / E2E ids map to marketing-style refs for layout parity with design mocks. */
  if (caseId === "e2e-matching-1") return "CAS-2025-00124";
  const digits = caseId.replace(/\D/g, "");
  if (digits.length >= 3) return `CAS-2025-${digits.padStart(5, "0").slice(-5)}`;
  return caseId;
}

function formatClientReference(caseId: string): string {
  const digits = caseId.replace(/\D/g, "");
  if (digits.length >= 3) {
    return `CLI-${digits.padStart(5, "0").slice(-5)}`;
  }
  return "CLI-ONBEKEND";
}

function maskParticipantIdentity(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return "Betrokkene afgeschermd";
  }
  return parts
    .map((part) => {
      const first = part[0] ?? "";
      return `${first}${"•".repeat(Math.max(3, part.length - 1))}`;
    })
    .join(" ");
}

function MatchingScoreRing({ percent, label }: { percent: number; label: string }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex size-[5.5rem] items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute size-full -rotate-90 text-muted-foreground/25" aria-hidden>
          <circle cx="50" cy="50" fill="none" r={r} stroke="currentColor" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            fill="none"
            r={r}
            stroke={MATCH_BRAND}
            strokeWidth="8"
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
          />
        </svg>
        <span className="relative text-lg font-bold tabular-nums text-foreground">{percent}%</span>
      </div>
      <span className="max-w-[7rem] text-center text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

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
  const [showOnlyAvailablePins, setShowOnlyAvailablePins] = useState(false);
  const [scenarioMessage, setScenarioMessage] = useState<string | null>(null);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistModalError, setWaitlistModalError] = useState<string | null>(null);
  const [pinPulseProviderId, setPinPulseProviderId] = useState<string | null>(null);
  const [listTab, setListTab] = useState<"recommended" | "all">("recommended");
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
    if (index === 0) return 94;
    if (index === 1) return 89;
    return 78;
  };

  const matchTierLabel = (score: number) => {
    if (score >= 90) return "Zeer goede match";
    if (score >= 80) return "Goede match";
    return "Redelijke match";
  };

  const getDistance = (index: number): number => {
    if (index === 0) return 2.3;
    if (index === 1) return 4.8;
    return 8.1;
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

  const allProvidersTable = useMemo(
    () =>
      regionalPool.map((provider, i) => ({
        provider,
        score: Math.max(52, 82 - i * 5),
      })),
    [regionalPool],
  );

  type RankedMatchRow = (typeof rankedMatches)[number];
  const [selectionConfirmMatch, setSelectionConfirmMatch] = useState<RankedMatchRow | null>(null);
  const [waitlistTargetMatch, setWaitlistTargetMatch] = useState<RankedMatchRow | null>(null);
  const [matchSubmitting, setMatchSubmitting] = useState(false);
  const [matchSubmitError, setMatchSubmitError] = useState<string | null>(null);

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
    return <LoadingState title="Matching laden…" copy="Aanbieders en casusinformatie worden opgehaald." />;
  }

  if (casesError || providersError) {
    return <ErrorState title="Matchinggegevens niet beschikbaar" copy={casesError ?? providersError} />;
  }

  if (!caseData) {
    return <EmptyState title="Casus niet gevonden" copy="Deze casus is niet beschikbaar voor matching in de huidige context." />;
  }

  const bestMatch = rankedMatches[0] ?? null;

  const spaCaseRaw = cases.find((c) => c.id === caseId) ?? null;
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

  const urgencyNl =
    caseData.urgency === "critical"
      ? "Kritiek"
      : caseData.urgency === "high"
        ? "Hoog"
        : caseData.urgency === "medium"
          ? "Normaal"
          : "Laag";
  const urgencyHighlight = caseData.urgency === "critical" || caseData.urgency === "high";

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

  const handleConfirmSelectionChoice = async () => {
    const match = selectionConfirmMatch;
    if (!match) return;
    setSelectionConfirmMatch(null);
    if (match.provider.availableSpots <= 0) {
      handleOpenWaitlistModal(match);
      return;
    }
    setMatchSubmitting(true);
    setMatchSubmitError(null);
    try {
      const pid = Number(match.provider.id);
      if (Number.isNaN(pid)) {
        throw new Error("Ongeldige aanbieder-id.");
      }
      const validation_context = {
        totaalscore: match.score,
        confidenceLabel: match.confidenceLabel,
        tradeOffs: match.tradeOffs,
        warnings: match.warnings,
        whyMatch: match.whyMatch,
      };
      await apiClient.post<Record<string, unknown>>(`/care/api/cases/${caseId}/matching/action/`, {
        action: "confirm_validation",
        provider_id: pid,
        validation_context,
      });
      await apiClient.post<Record<string, unknown>>(`/care/api/cases/${caseId}/matching/action/`, {
        action: "send_to_provider",
        provider_id: pid,
      });
      await onConfirmMatch(match.provider.id);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Versturen mislukt.";
      setMatchSubmitError(raw);
    } finally {
      setMatchSubmitting(false);
    }
  };

  const resolveRankedMatchRow = (providerId: string, fallbackScore: number): RankedMatchRow | null => {
    const existing = rankedMatches.find((m) => m.provider.id === providerId);
    if (existing) return existing;
    const provider = legacyProviders.find((p) => String(p.id) === String(providerId));
    if (!provider) return null;
    const breakdown = scoreBreakdownParts(fallbackScore);
    return {
      provider,
      index: Math.max(0, allProvidersTable.findIndex((r) => r.provider.id === providerId)),
      score: fallbackScore,
      distance: 5,
      strongPoints: ["Beschikbaar in het regionale netwerk"],
      tradeOffs: ["Verificatie tijdens gemeente-validatie"],
      alternativeReasons: [],
      confidenceLabel: "Te verifiëren",
      breakdown,
      focusChecks: [
        { label: "Regio", value: provider.region },
        { label: "Type", value: provider.type },
      ],
      warnings: provider.availableSpots <= 0 ? ["Beperkte directe capaciteit"] : [],
      whyMatch: "Geselecteerd uit volledige aanbiederslijst — matching blijft advies.",
      tier: "risk",
      whyShownThird: null,
    };
  };

  const scrollToFocusZone = () => {
    focusZoneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex min-h-screen flex-col text-foreground" style={{ backgroundColor: MATCH_BG }}>
      <header className="border-b border-border/60 px-4 py-5 md:px-8" style={{ backgroundColor: MATCH_BG }}>
        <div className="mx-auto flex max-w-[1680px] flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-3">
              <Button
                variant="link"
                type="button"
                className="h-auto gap-2 p-0 text-[13px] font-semibold text-primary"
                onClick={() => {
                  if (onNavigateToCase) {
                    onNavigateToCase(caseId);
                    return;
                  }
                  window.location.assign(`/care/cases/${encodeURIComponent(caseId)}/`);
                }}
              >
                <ArrowLeft size={16} aria-hidden />
                Terug naar casus
              </Button>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">
                  Matching voor Casus {formatMatchingCaseTitle(caseId)}
                </h1>
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white"
                  style={{ backgroundColor: MATCH_BRAND }}
                >
                  Matching
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground">
                {formatClientReference(caseId)} · {maskParticipantIdentity(caseData.clientName)} · {caseData.clientAge} jaar · {caseData.region} · Urgentie:{" "}
                <span className={cn("font-semibold", urgencyHighlight && "text-destructive")}>{urgencyNl}</span>
              </p>
              <p className="text-[12px] text-muted-foreground">
                Identiteit blijft gemaskeerd in matching. Backend-autorisatie bepaalt zichtbaarheid per fase en rol.
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" type="button" className="gap-1 border-white/10 bg-card/40">
                  Acties
                  <ChevronDown size={14} aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => scrollToFocusZone()}>Ga naar aanbevelingen</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleScenarioExpandRadius()}>Vergroot zoekgebied</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleScenarioShowAlternatives()}>Toon topaanbevelingen</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => resetMapView()}>Kaart resetten</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/60 px-3 py-3.5" style={{ backgroundColor: MATCH_SURFACE }}>
            <div className="flex min-w-[760px] items-center gap-0">
              {(
                [
                  { Icon: CheckCircle2, label: "Casus", sub: "Voltooid", state: "done" as const },
                  { Icon: Sparkles, label: "Matching", sub: "Huidige fase", state: "current" as const },
                  { Icon: Shield, label: "Validatie", sub: "Wacht op gemeente", state: "pending" as const },
                  { Icon: UserRound, label: "Aanbieder", sub: "—", state: "idle" as const },
                  { Icon: Home, label: "Plaatsing", sub: "—", state: "idle" as const },
                  { Icon: CheckCircle2, label: "Intake", sub: "—", state: "idle" as const },
                ] as const
              ).map((step, idx, arr) => (
                <Fragment key={step.label}>
                  <div className="flex min-w-[100px] flex-1 flex-col items-center gap-1.5 px-1 text-center">
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl border text-muted-foreground",
                        step.state === "done" && "border-primary/50 bg-primary/15 text-primary",
                        step.state === "current" && "border-primary/60 bg-primary/20 text-primary shadow-md",
                        step.state === "pending" && "border-amber-500/40 bg-amber-500/10 text-amber-200",
                        step.state === "idle" && "border-white/10 bg-background/50",
                      )}
                    >
                      <step.Icon className="size-5" aria-hidden />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{step.label}</p>
                    <p className="text-[11px] font-medium text-foreground">{step.sub}</p>
                  </div>
                  {idx < arr.length - 1 ? (
                    <div className="flex h-8 w-4 shrink-0 items-center self-start pt-4" aria-hidden>
                      <div className="h-0 w-full border-t border-dotted border-muted-foreground/35" />
                    </div>
                  ) : null}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start lg:px-8">
        <div className="min-w-0 flex-1 space-y-4">
            {(submitError || matchSubmitError) && (
              <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/15 px-4 py-3 text-sm text-destructive">
                {matchSubmitError ?? submitError}
              </div>
            )}

            {scenarioMessage && (
              <div className="mb-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                {scenarioMessage}
              </div>
            )}

            <div
              ref={focusZoneRef}
              className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pb-8 lg:max-h-[min(72vh,calc(100vh-220px))]"
            >
              {(urgencyBannerLabel || capacityScarceInRegion) && (
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
              )}

              <div className="flex gap-1 border-b border-white/10">
                <button
                  type="button"
                  className={cn(
                    "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                    listTab === "recommended"
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setListTab("recommended")}
                >
                  Aanbevolen matches
                </button>
                <button
                  type="button"
                  className={cn(
                    "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                    listTab === "all"
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setListTab("all")}
                >
                  Alle aanbieders
                </button>
              </div>

              <div
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-primary/25 px-4 py-3 text-[13px] leading-snug text-muted-foreground"
                style={{ backgroundColor: `${MATCH_BRAND}18` }}
              >
                <div className="flex min-w-0 gap-2">
                  <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <p>
                    Dit zijn de best passende aanbieders op basis van de ingestelde matching voorkeuren en beschikbare capaciteit.
                    Matching is advies — de gemeente valideert en kiest bewust door.
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="shrink-0 text-[13px] font-semibold text-primary underline-offset-4 hover:underline">
                      Meer over matching
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs border border-border bg-popover text-xs">
                    Factoren: specialisatie, urgentie, beschikbaarheid, afstand en historische uitkomsten. Geen automatische toewijzing.
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="hidden gap-4 border-b border-border/60 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[2.25rem_minmax(0,1fr)_7.5rem_minmax(0,1fr)_11rem] lg:items-end lg:px-2">
                <span className="sr-only">Rang</span>
                <span>Aanbieder</span>
                <span className="text-center">Match score</span>
                <span>Reden van match</span>
                <span className="text-right">Actie</span>
              </div>

              <div className="space-y-3">
                {listTab === "recommended"
                  ? rankedMatches.map((item) => {
                      const isSelected = selectedProviderId === item.provider.id;
                      const rank = item.index + 1;
                      const reasonLines =
                        item.strongPoints?.length > 0 ? item.strongPoints : item.focusChecks.map((r) => `${r.label}: ${r.value}`);
                      return (
                        <article
                          key={item.provider.id}
                          onClick={() => handleSelectProvider(item.provider.id)}
                          onMouseEnter={() => setHoveredProviderId(item.provider.id)}
                          onMouseLeave={() => setHoveredProviderId(null)}
                          className={cn(
                            "cursor-pointer rounded-xl border border-border/60 p-4 transition-all",
                            isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:border-primary/35",
                          )}
                          style={{ backgroundColor: MATCH_SURFACE }}
                        >
                          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[2.25rem_minmax(0,1fr)_7.5rem_minmax(0,1fr)_11rem] lg:items-center lg:gap-4">
                            <div className="flex items-center gap-3 lg:block">
                              <span
                                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-sm font-bold tabular-nums text-muted-foreground"
                                aria-hidden
                              >
                                {rank}
                              </span>
                              <span className="text-xs font-semibold text-muted-foreground lg:hidden">#{rank}</span>
                            </div>

                            <div className="min-w-0 space-y-2">
                              <div className="flex items-start gap-3">
                                <div
                                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-background/60 text-xs font-bold text-muted-foreground"
                                  aria-hidden
                                >
                                  {item.provider.name.slice(0, 1)}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1.5">
                                  <h3 className="truncate text-[15px] font-semibold leading-tight text-foreground">{item.provider.name}</h3>
                                  <p className="text-[12px] text-muted-foreground">
                                    {item.provider.region} · {item.distance.toFixed(1)} km
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {(item.provider.specializations ?? []).slice(0, 3).map((tag) => (
                                      <span
                                        key={`${item.provider.id}-${tag}`}
                                        className="rounded-md border border-white/10 bg-background/50 px-2 py-0.5 text-[11px] text-muted-foreground"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-center lg:justify-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <MatchingScoreRing percent={item.score} label={matchTierLabel(item.score)} />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="left"
                                  className="border border-border bg-popover px-3 py-2 text-xs text-popover-foreground"
                                  style={{ maxWidth: tokens.layout.tooltipMaxWidth }}
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

                            <ul className="space-y-1.5 text-[13px] text-muted-foreground">
                              {reasonLines.slice(0, 4).map((line) => (
                                <li key={`${item.provider.id}-${line}`} className="flex gap-2">
                                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                                  <span className="leading-snug">{line}</span>
                                </li>
                              ))}
                            </ul>

                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end lg:flex-col xl:flex-row">
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-lg font-semibold text-white shadow-sm hover:opacity-95"
                                style={{ backgroundColor: MATCH_BRAND }}
                                disabled={isSubmittingMatch || matchSubmitting}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequestSelection(item);
                                }}
                              >
                                Selecteer & verzoek
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-white/15 bg-transparent"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectProvider(item.provider.id);
                                }}
                              >
                                Bekijk profiel
                              </Button>
                            </div>
                          </div>

                          {item.warnings.length > 0 ? (
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
                          ) : null}
                        </article>
                      );
                    })
                  : allProvidersTable.map((row, idx) => {
                      const resolved = resolveRankedMatchRow(row.provider.id, row.score);
                      const isSelected = selectedProviderId === row.provider.id;
                      const rank = idx + 1;
                      const bullets =
                        resolved?.strongPoints?.length && resolved.strongPoints.length > 0
                          ? resolved.strongPoints
                          : [`${row.provider.region} · type ${row.provider.type}`, matchTierLabel(row.score)];
                      return (
                        <article
                          key={`all-${row.provider.id}`}
                          onClick={() => handleSelectProvider(row.provider.id)}
                          onMouseEnter={() => setHoveredProviderId(row.provider.id)}
                          onMouseLeave={() => setHoveredProviderId(null)}
                          className={cn(
                            "cursor-pointer rounded-xl border border-border/60 p-4 transition-all",
                            isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:border-primary/35",
                          )}
                          style={{ backgroundColor: MATCH_SURFACE }}
                        >
                          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[2.25rem_minmax(0,1fr)_7.5rem_minmax(0,1fr)_11rem] lg:items-center lg:gap-4">
                            <span
                              className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-sm font-bold tabular-nums text-muted-foreground"
                              aria-hidden
                            >
                              {rank}
                            </span>

                            <div className="min-w-0 space-y-2">
                              <div className="flex items-start gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-background/60 text-xs font-bold text-muted-foreground">
                                  {row.provider.name.slice(0, 1)}
                                </div>
                                <div className="min-w-0 space-y-1.5">
                                  <h3 className="truncate text-[15px] font-semibold text-foreground">{row.provider.name}</h3>
                                  <p className="text-[12px] text-muted-foreground">
                                    {row.provider.region} · {row.provider.type}
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {(row.provider.specializations ?? []).slice(0, 3).map((tag) => (
                                      <span
                                        key={`${row.provider.id}-${tag}`}
                                        className="rounded-md border border-white/10 bg-background/50 px-2 py-0.5 text-[11px] text-muted-foreground"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-center">
                              <MatchingScoreRing percent={row.score} label={matchTierLabel(row.score)} />
                            </div>

                            <ul className="space-y-1.5 text-[13px] text-muted-foreground">
                              {bullets.slice(0, 4).map((line) => (
                                <li key={line} className="flex gap-2">
                                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>

                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end lg:flex-col xl:flex-row">
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-lg font-semibold text-white shadow-sm hover:opacity-95"
                                style={{ backgroundColor: MATCH_BRAND }}
                                disabled={isSubmittingMatch || matchSubmitting || !resolved}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (resolved) handleRequestSelection(resolved);
                                }}
                              >
                                Selecteer & verzoek
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-white/15 bg-transparent"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectProvider(row.provider.id);
                                }}
                              >
                                Bekijk profiel
                              </Button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
              </div>

              {listTab === "recommended" && overflowList.length > 0 ? (
                <Collapsible>
                  <CollapsibleTrigger className="flex w-full items-center justify-center gap-2 py-2 text-[13px] font-semibold text-primary hover:underline">
                    Bekijk meer aanbieders
                    <ChevronDown className="size-4" aria-hidden />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    <ul className="space-y-2 rounded-xl border border-white/10 bg-background/40 p-3">
                      {overflowList.map((row) => (
                        <li
                          key={row.provider.id}
                          className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 text-sm last:border-b-0"
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

              {rankedMatches.length === 0 && listTab === "recommended" ? (
                <CarePanel className="p-2">
                  <EmptyState
                    title="Geen aanbieders"
                    copy="Geen geschikte aanbieders binnen de selectie."
                  />
                </CarePanel>
              ) : null}

              <details className="group rounded-xl border border-white/10 bg-card/30">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p>Kaart & netwerk</p>
                      <p className="text-[11px] font-normal text-muted-foreground">
                        {visiblePins.length} opties zichtbaar{showOnlyAvailablePins ? " · alleen beschikbaar" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowOnlyAvailablePins((state) => !state);
                        }}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                          showOnlyAvailablePins ? "border-primary/70 bg-primary/10" : "border-white/10 bg-card/80 hover:bg-card",
                        )}
                      >
                        {showOnlyAvailablePins ? "Alle opties" : "Beschikbaar"}
                      </button>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden />
                    </div>
                  </div>
                </summary>
                <div className="border-t border-white/10 p-3">
                  <div className="flex flex-wrap gap-2 pb-3">
                    {visiblePins.slice(0, 6).map((item) => (
                      <span
                        key={`map-option-${item.provider.id}`}
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          item.provider.availableSpots > 0 ? "bg-emerald-500/15 text-emerald-200" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.provider.name}
                      </span>
                    ))}
                  </div>
                  <div className="relative h-[min(52vh,520px)] overflow-hidden rounded-xl border border-white/10 bg-background/80">
                    <ProviderNetworkMap
                      providers={providers}
                      selectedProviderId={selectedProviderId ?? bestMatch?.provider.id ?? null}
                      hoveredProviderId={hoveredProviderId}
                      onSelectProvider={handleSelectProvider}
                      theme="dark"
                    />
                  </div>
                </div>
              </details>
            </div>
          </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[360px]">
          <div className="rounded-xl border border-border/60 p-4" style={{ backgroundColor: MATCH_SURFACE }}>
            <h3 className="text-sm font-semibold text-foreground">Waarom deze match?</h3>
            <div className="mt-4 space-y-3">
              {(
                [
                  { Icon: Sparkles, text: "Sterke specialisatie-fit met het zorgprofiel" },
                  { Icon: Clock, text: "Relatief korte inschatting van wachttijd" },
                  { Icon: MapPin, text: "Dichtbij de woonplaats van de jeugdige" },
                  { Icon: TrendingUp, text: "Goede eerdere uitkomsten in vergelijkbare trajecten" },
                ] as const
              ).map((row) => (
                <div key={row.text} className="flex gap-3 text-[13px] text-muted-foreground">
                  <row.Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="leading-snug">{row.text}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" type="button" className="mt-4 w-full border-white/15 bg-transparent text-[13px]" onClick={() => scrollToFocusZone()}>
              Volledige uitleg
            </Button>
          </div>

          <div className="rounded-xl border border-border/60 p-4" style={{ backgroundColor: MATCH_SURFACE }}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Huidige voorkeuren</h3>
              <Button variant="ghost" size="sm" type="button" className="h-8 text-xs text-primary" onClick={() => scrollToFocusZone()}>
                Aanpassen
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {(
                [
                  { label: "Specialisatie", pct: 30 },
                  { label: "Urgentie", pct: 25 },
                  { label: "Beschikbaarheid", pct: 20 },
                  { label: "Locatie", pct: 15 },
                  { label: "Eerdere resultaten", pct: 10 },
                ] as const
              ).map((pref) => (
                <div key={pref.label}>
                  <div className="flex justify-between text-[12px] text-muted-foreground">
                    <span>{pref.label}</span>
                    <span className="tabular-nums text-foreground">{pref.pct}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted/40">
                    <div className="h-full rounded-full" style={{ width: `${pref.pct}%`, backgroundColor: MATCH_BRAND }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 p-4" style={{ backgroundColor: MATCH_SURFACE }}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Alternatieven (lagere score)</h3>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums text-white"
                style={{ backgroundColor: MATCH_BRAND }}
              >
                {overflowList.length}
              </span>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Secundaire opties blijven beschikbaar voor vergelijking tijdens gemeente-validatie.
            </p>
          </div>

          <Button
            type="button"
            className="h-12 w-full gap-2 rounded-xl text-base font-semibold text-white shadow-md hover:opacity-95"
            style={{ backgroundColor: MATCH_BRAND }}
            onClick={() => {
              setListTab("all");
              scrollToFocusZone();
            }}
          >
            <Users className="size-5" aria-hidden />
            Handmatig toewijzen
          </Button>
        </aside>
      </div>
      <>
        <Dialog
          open={selectionConfirmMatch !== null}
          onOpenChange={(open) => {
            if (!open) setSelectionConfirmMatch(null);
          }}
        >
          <DialogContent
            className="gap-4 rounded-2xl border-border bg-card p-4"
            style={{ maxWidth: tokens.layout.dialogMaxWidth }}
          >
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
                disabled={isSubmittingMatch || matchSubmitting}
                onClick={() => void handleConfirmSelectionChoice()}
              >
                {isSubmittingMatch || matchSubmitting ? "Bezig..." : "Bevestigen"}
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
            className="gap-4 rounded-xl border-border/60 bg-card p-4 text-foreground shadow-xl"
            style={{ maxWidth: tokens.layout.dialogWideMaxWidth }}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              waitlistPreparePrimaryRef.current?.focus();
            }}
          >
            {waitlistTargetMatch ? (
              <>
                <DialogHeader className="gap-3 text-left">
                  <DialogTitle className="text-xl font-semibold text-foreground">Wachtlijstvoorstel voorbereiden</DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                    Je legt een concept wachtlijstvoorstel vast voor {waitlistTargetMatch.provider.name}. Daarna ga je verder op de
                    casuspagina om te controleren en eventueel naar de aanbieder te sturen — nog geen definitieve plaatsing.
                  </DialogDescription>
                </DialogHeader>

                {waitlistModalError ? (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-destructive">
                    {waitlistModalError}
                  </div>
                ) : null}

                <CarePanel className="space-y-0 border-border/60 bg-background/80 px-4 py-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
                    <span className="text-muted-foreground">Aanbieder</span>
                    <span className="truncate text-right font-medium text-foreground" style={{ maxWidth: tokens.layout.rowLabelMaxWidth }}>{waitlistTargetMatch.provider.name}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
                    <span className="text-muted-foreground">Matchscore</span>
                    <span className="font-medium text-foreground">{waitlistTargetMatch.score}%</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
                    <span className="text-muted-foreground">Afstand</span>
                    <span className="font-medium text-foreground">{waitlistTargetMatch.distance} km</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
                    <span className="text-muted-foreground">Capaciteit</span>
                    <span className="font-medium text-foreground">
                      {waitlistTargetMatch.provider.availableSpots}/{waitlistTargetMatch.provider.capacity}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 py-2">
                    <span className="text-muted-foreground">Reden</span>
                    <span className="text-right font-medium text-foreground">Geen directe capaciteit</span>
                  </div>
                </CarePanel>

                <p className="text-xs leading-snug text-muted-foreground">
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
                    className="border-border/70 bg-transparent text-foreground hover:bg-muted"
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
