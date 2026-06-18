/**
 * MatchingPageWithMap - explainable recommendation workspace
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Flag,
  Info,
  MapPin,
  MoreHorizontal,
  MoreVertical,
  PenLine,
  RefreshCw,
  Scale,
  SearchX,
  Send,
  SlidersHorizontal,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { CareDetailHeader, CareWorkflowStrip } from "./CareDetailPageTemplate";
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
import { useProviders, type SpaProvider } from "../../hooks/useProviders";
import { useMatchingCandidates, type MatchingCandidateRow } from "../../hooks/useMatchingCandidates";
import { toLegacyCase, toLegacyProvider } from "../../lib/careLegacyAdapters";
import { apiClient } from "../../lib/apiClient";
import { CARE_PATHS, toCareCaseDetail, toCareCaseEdit } from "../../lib/routes";
import { tokens } from "../../design/tokens";
import { cn } from "../ui/utils";
import { BlockingNotice, CareMatchScore, CarePanel, CareTradeoffList, EmptyState, ErrorState, LoadingState } from "./CareDesignPrimitives";
import { Textarea } from "../ui/textarea";
import { advisoryFromEngineConfidenceLabel } from "../../lib/matchingAdvisory";
import {
  GuidanceContextBanner,
  InlineHelpChip,
} from "../guidance";

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

function MatchingAdvisoryBadge({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex max-w-[7.5rem] flex-col items-center gap-1 text-center">
      <span className="inline-flex min-h-[4.5rem] items-center justify-center rounded-xl border border-border/60 bg-muted/20 px-2 py-2 text-[12px] font-semibold leading-snug text-foreground">
        {label}
      </span>
      {hint ? (
        <span className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

function formatEngineFactorScore(raw: number): string {
  if (!Number.isFinite(raw) || raw <= 0) {
    return "—";
  }
  const normalized = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
  return `${normalized} (factor)`;
}

function taxonomyExplainabilityLines(candidate?: MatchingCandidateRow | null): string[] {
  if (!candidate) {
    return [];
  }
  const lines = [
    candidate.taxonomie_lijn?.trim(),
    candidate.taxonomie_code_lijn?.trim(),
  ].filter((line): line is string => Boolean(line));
  return lines;
}

function resolveProviderForMatch(match: MatchingCandidateRow, providers: SpaProvider[]): SpaProvider | null {
  const providerId = String(match.zorgaanbieder_id ?? "").trim();
  if (!providerId) {
    return null;
  }
  return providers.find((provider) => String(provider.id) === providerId) ?? null;
}

interface MatchingPageWithMapProps {
  caseId: string;
  onBack: () => void;
  onConfirmMatch: (providerId: string) => Promise<void> | void;
  /** After a persisted waitlist proposal, open canonical case detail (SPA or full navigation). */
  onNavigateToCase?: (caseId: string) => void;
  /** Navigate to provider list (SPA-native, avoids hard reload). */
  onNavigateToZorgaanbieders?: () => void;
  isSubmittingMatch?: boolean;
  submitError?: string | null;
}

export function MatchingPageWithMap({
  caseId,
  onBack,
  onConfirmMatch,
  onNavigateToCase,
  onNavigateToZorgaanbieders,
  isSubmittingMatch = false,
  submitError = null,
}: MatchingPageWithMapProps) {
  const focusZoneRef = useRef<HTMLDivElement | null>(null);

  const { cases, loading: casesLoading, error: casesError } = useCases({ q: "" });
  const { providers, loading: providersLoading, error: providersError } = useProviders({ q: "" });
  const legacyCases = cases.map(toLegacyCase);
  const legacyProviders = providers.map(toLegacyProvider);

  const { matches: apiMatches, loading: matchCandidatesLoading, incompleteCode } = useMatchingCandidates(caseId);

  const liveApiRanked = useMemo(() => {
    if (!apiMatches.length) return null;
    const rows: { legacy: ReturnType<typeof toLegacyProvider>; api: MatchingCandidateRow }[] = [];
    for (const m of apiMatches) {
      const spa = resolveProviderForMatch(m, providers);
      if (!spa) continue;
      rows.push({ legacy: toLegacyProvider(spa), api: m });
      if (rows.length >= 3) break;
    }
      return rows.length ? rows : null;
  }, [apiMatches, providers]);

  const caseData = legacyCases.find((item) => item.id === caseId);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [hoveredProviderId, setHoveredProviderId] = useState<string | null>(null);
  const [showOnlyAvailablePins, setShowOnlyAvailablePins] = useState(false);
  const [scenarioMessage, setScenarioMessage] = useState<string | null>(null);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistModalError, setWaitlistModalError] = useState<string | null>(null);
  const [pinPulseProviderId, setPinPulseProviderId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"overzicht" | "aanmelding" | "documenten" | "activiteit">("overzicht");
  const [matchingHelpOpen, setMatchingHelpOpen] = useState(false);
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

  const overflowProviders = regionalPool.slice(3);

  const rankedMatches = useMemo(() => {
    if (liveApiRanked && liveApiRanked.length > 0) {
      return liveApiRanked.map(({ legacy: provider, api }, index) => {
        const advisory = advisoryFromEngineConfidenceLabel(api.confidence_label || "");
        const distance: number | null = null;
        const taxonomyLines = taxonomyExplainabilityLines(api);
        const tradeFromApi = (api.trade_offs ?? []).map(t => String(t)).filter(Boolean);
        const rawScore = Number(api.totaalscore) || 0;
        const matchScore = rawScore > 0 && rawScore <= 1 ? Math.round(rawScore * 100) : Math.max(0, Math.min(100, Math.round(rawScore)));
        const strongParts = [api.fit_samenvatting, api.verificatie_advies].map(s => (s || "").trim()).filter(Boolean);
        const combinedStrongParts = [...taxonomyLines, ...strongParts];
        const strongPoints =
          combinedStrongParts.length > 0 ? combinedStrongParts : ["Matchadvies uit de keten-engine (advies)."];
        const tradeOffs =
          tradeFromApi.length > 0
            ? tradeFromApi.slice(0, 3)
            : index === 0
              ? ["Capaciteit en wachttijd kunnen verschuiven — verifieer vóór doorleiding."]
              : ["Zie verificatie-advies voor afronding."];
        const capacityUpdateLabel = caseData?.lastActivity?.trim() || "recent onbekend";
        const regionWarn = (api.region_pressure_signal || "").trim();
        const warnings = regionWarn
          ? [regionWarn]
          : index === 0
            ? [`Capaciteit onzeker (laatste activiteit casus: ${capacityUpdateLabel})`]
            : [];
        const whyMatch = api.fit_samenvatting || taxonomyLines[0] || "Geselecteerd op basis van actuele matching.";
        const tier = index === 0 ? "best" : index === 1 ? "balanced" : "risk";
        return {
          provider,
          index,
          distance,
          strongPoints,
          tradeOffs,
          alternativeReasons: [] as string[],
          advisoryLabel: advisory.label,
          advisoryHint: advisory.hint,
          taxonomyLines,
          engineFactors: {
            specialization: api.score_inhoudelijke_fit,
            region: api.score_regio_contract_fit,
            capacity: api.score_capaciteit_wachttijd_fit,
            complexity: api.score_complexiteit_veiligheid_fit,
          },
          focusChecks: [
            { label: "Regio", value: provider.region },
            { label: "Advies", value: advisory.label },
          ],
          warnings,
          whyMatch,
          tier,
          whyShownThird: index === 2 ? api.fit_samenvatting || null : null,
          matchScore,
        };
      });
    }
    return [];
  }, [liveApiRanked, caseData?.lastActivity]);

  const overflowList = useMemo(() => {
    if (!apiMatches.length || apiMatches.length <= 3) return [];
    return apiMatches.slice(3).map((m) => {
      const raw = Number(m.totaalscore) || 0;
      const score = raw > 0 && raw <= 1 ? Math.round(raw * 100) : Math.max(0, Math.min(100, Math.round(raw)));
      const spa = resolveProviderForMatch(m, providers);
      if (!spa) return null;
      const advisory = advisoryFromEngineConfidenceLabel(m.confidence_label || "");
      return { provider: toLegacyProvider(spa), advisoryLabel: advisory.label };
    }).filter((row): row is { provider: ReturnType<typeof toLegacyProvider>; advisoryLabel: string } => row != null);
  }, [apiMatches, providers]);

  const allProvidersTable = useMemo(() => {
    const rows: { provider: ReturnType<typeof toLegacyProvider>; score: number }[] = [];
    for (const m of apiMatches) {
      const spa = resolveProviderForMatch(m, providers);
      if (!spa) continue;
      const raw = Number(m.totaalscore) || 0;
      const score = raw > 0 && raw <= 1 ? Math.round(raw * 100) : Math.max(0, Math.min(100, Math.round(raw)));
      rows.push({ provider: toLegacyProvider(spa), score });
    }
    return rows;
  }, [apiMatches, providers]);

  type RankedMatchRow = (typeof rankedMatches)[number];
  const [selectionConfirmMatch, setSelectionConfirmMatch] = useState<RankedMatchRow | null>(null);
  const [waitlistTargetMatch, setWaitlistTargetMatch] = useState<RankedMatchRow | null>(null);
  const [matchSubmitting, setMatchSubmitting] = useState(false);
  const [matchSubmitError, setMatchSubmitError] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

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

  if (casesLoading || providersLoading || matchCandidatesLoading) {
    return <LoadingState title="Matching laden…" copy="Aanbieders en casusinformatie worden opgehaald." />;
  }

  if (casesError || providersError) {
    return <ErrorState title="Matchinggegevens niet beschikbaar" copy={casesError ?? providersError} />;
  }

  if (!caseData) {
    return <EmptyState title="Casus niet gevonden" copy="Deze casus is niet beschikbaar voor matching in de huidige context." />;
  }

  const spaCaseRaw = cases.find((c) => c.id === caseId) ?? null;
  const placementPressureLabel = spaCaseRaw?.placementPressureLabel ?? (spaCaseRaw?.urgency === "critical"
    ? "Spoed"
    : spaCaseRaw?.urgency === "warning"
      ? "Hoog"
      : spaCaseRaw?.urgency === "normal"
        ? "Normaal"
        : "Laag");
  const showUrgentBanner = caseData.urgency === "critical" || caseData.urgency === "high";
  const capacityScarceInRegion =
    rankedMatches.length > 0 && rankedMatches.every((m) => m.provider.availableSpots <= 1);
  const urgencyBannerLabel = !showUrgentBanner
    ? null
    : spaCaseRaw?.urgency === "critical"
      ? `Plaatsingsdruk ${placementPressureLabel}: spoedige coördinatie en matching vereist`
      : spaCaseRaw != null && spaCaseRaw.wachttijd >= 5
        ? `Plaatsingsdruk ${placementPressureLabel}: casus al ${spaCaseRaw.wachttijd} dagen in de stroom — versnel doorleiding`
        : `Plaatsingsdruk ${placementPressureLabel}: hoge prioriteit — plan validatie en doorleiding snel`;

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
        match_score: apiMatches.find((m) => String(m.zorgaanbieder_id ?? "").trim() === String(providerId))?.totaalscore,
      });
      setSelectedProviderId(target.provider.id);
      setWaitlistModalOpen(false);
      setWaitlistTargetMatch(null);
      setScenarioMessage(null);
      if (onNavigateToCase) {
        onNavigateToCase(caseId);
      } else {
        window.location.assign(toCareCaseDetail(caseId));
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
    const isOverride = match.index !== 0;
    if (isOverride && !overrideReason.trim()) return;
    setSelectionConfirmMatch(null);
    setOverrideReason("");
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
      const apiRow = apiMatches.find((m) => String(m.zorgaanbieder_id ?? "").trim() === String(pid));
      const validation_context = {
        totaalscore: apiRow?.totaalscore,
        confidenceLabel: match.advisoryLabel,
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
        ...(match.index !== 0 && overrideReason.trim() ? { override_reason: overrideReason.trim() } : {}),
      });
      await onConfirmMatch(match.provider.id);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Versturen mislukt.";
      setMatchSubmitError(raw);
    } finally {
      setMatchSubmitting(false);
    }
  };

  const resolveRankedMatchRow = (providerId: string): RankedMatchRow | null => {
    const existing = rankedMatches.find((m) => m.provider.id === providerId);
    if (existing) return existing;
    const apiRow = apiMatches.find((m) => String(m.zorgaanbieder_id ?? "").trim() === String(providerId));
    if (!apiRow) return null;
    const provider = legacyProviders.find((p) => String(p.id) === String(providerId));
    if (!provider) return null;
    const advisory = advisoryFromEngineConfidenceLabel(apiRow?.confidence_label || "");
    // @ts-ignore
    return {
      provider,
      index: Math.max(0, allProvidersTable.findIndex((r) => r.provider.id === providerId)),
      distance: null,
      strongPoints: apiRow?.fit_samenvatting?.trim()
        ? [apiRow.fit_samenvatting.trim()]
        : ["Beschikbaar in het regionale netwerk"],
      tradeOffs: apiRow?.trade_offs?.length
        ? apiRow.trade_offs.slice(0, 3)
        : ["Verificatie tijdens gemeente-validatie"],
      alternativeReasons: [],
      advisoryLabel: advisory.label,
      advisoryHint: advisory.hint,
      engineFactors: {
        specialization: apiRow?.score_inhoudelijke_fit ?? 0,
        region: apiRow?.score_regio_contract_fit ?? 0,
        capacity: apiRow?.score_capaciteit_wachttijd_fit ?? 0,
        complexity: apiRow?.score_complexiteit_veiligheid_fit ?? 0,
      },
      focusChecks: [
        { label: "Regio", value: provider.region },
        { label: "Type", value: provider.type },
      ],
      warnings: apiRow?.region_pressure_signal?.trim()
        ? [apiRow.region_pressure_signal.trim()]
        : provider.availableSpots <= 0
          ? ["Beperkte directe capaciteit"]
          : [],
      whyMatch: apiRow?.fit_samenvatting?.trim()
        ? apiRow.fit_samenvatting.trim()
        : "Geselecteerd uit volledige aanbiederslijst — matching blijft advies.",
      tier: apiRow ? "balanced" : "risk",
      whyShownThird: null,
    };
  };

  const scrollToFocusZone = () => {
    focusZoneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };


  return (
    <div data-care-page-archetype="workspace" className="flex min-h-full flex-col text-foreground overflow-hidden">
      <style>{`
        [data-care-page-archetype="workspace"] {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        [data-care-page-archetype="workspace"]::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* ── Header ── */}
      <header className="px-6 py-4">
        <div className="mx-auto flex max-w-[1536px] flex-col gap-4">
          <CareDetailHeader
            onBack={onBack}
            backLabel="Terug naar matchingsoverzicht"
            title={`Matching voor casus #${caseId}`}
            badges={
              <>
                <span className="rounded-full bg-violet-500/15 px-3 py-1 text-[11px] font-semibold text-violet-300">
                  Matching
                </span>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold",
                    urgencyHighlight
                      ? "bg-care-urgent-bg text-care-urgent-text"
                      : "bg-amber-500/15 text-amber-300",
                  )}
                >
                  {urgencyNl}
                </span>
                <span className="rounded-full border border-border/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  Advies
                </span>
              </>
            }
            contextItems={[
              { icon: <UserRound className="size-3.5" />, node: "Cliëntgegevens afgeschermd" },
              { icon: <Calendar className="size-3.5" />, node: `${caseData.clientAge} jaar` },
              { icon: <MapPin className="size-3.5" />, node: caseData.region },
              {
                icon: <Flag className="size-3.5" />,
                node: (
                  <>
                    Urgentie:{" "}
                    <span className={cn("font-medium", urgencyHighlight && "text-care-urgent-text")}>{urgencyNl}</span>
                  </>
                ),
              },
            ]}
            updatedAtLabel={caseData.lastActivity}
            onRefresh={() => window.location.reload()}
            refreshLabel="Vernieuw casusgegevens"
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="h-9 gap-1.5 rounded-full border-border/60 bg-background/60 px-3.5 text-[12px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  >
                    <MoreVertical className="size-3.5" aria-hidden />
                    Casusacties
                    <ChevronDown className="size-3" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => window.location.assign(toCareCaseDetail(caseId))}>
                    Open casusdetail
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onBack}>Terug naar overzicht</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          {incompleteCode === "SUMMARY_INCOMPLETE" ? (
            <p
              className="rounded-lg border bg-care-warning-bg text-care-warning-text border-care-warning-border px-3 py-2 text-[12px]"
              role="status"
            >
              Casusoverzicht nog incompleet — live matchscores volgen zodra het casusoverzicht gereed is. Onderstaande rangorde blijft indicatief.
            </p>
          ) : null}

          {/* Compact workflow stepper */}
          <section className="rounded-xl border border-border/60 bg-card/30 px-5 py-3 overflow-x-auto">
            <CareWorkflowStrip activeIndex={1} />
          </section>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="mx-auto flex w-full max-w-[1536px] flex-1 flex-col gap-6 px-6 py-5 lg:flex-row lg:gap-6 lg:items-start">
        {/* Left panel */}
        <div className="min-w-0 flex-1 space-y-4">
          {(submitError || matchSubmitError) && (
            <BlockingNotice className="mb-4" message={matchSubmitError ?? submitError} />
          )}

          {scenarioMessage && (
            <div className="mb-4 rounded-2xl border bg-care-info-bg text-care-info-text border-care-info-border px-4 py-3 text-sm">
              {scenarioMessage}
            </div>
          )}

          <div
            ref={focusZoneRef}
            className="mt-2 space-y-4 pb-8"
          >
            {/* Urgency / capacity banners */}
            {(urgencyBannerLabel || capacityScarceInRegion) && (
              <div className="flex flex-wrap gap-2">
                {urgencyBannerLabel ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-care-urgent-border bg-care-urgent-bg px-2.5 py-1 text-xs font-semibold text-care-urgent-text">
                    <span className="size-1.5 rounded-full bg-care-urgent-solid" aria-hidden />
                    {urgencyBannerLabel}
                  </span>
                ) : null}
                {capacityScarceInRegion ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-care-warning-border bg-care-warning-bg px-2.5 py-1 text-xs font-semibold text-care-warning-text">
                    <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                    Capaciteit schaars in regio
                  </span>
                ) : null}
              </div>
            )}

            {rankedMatches.length > 0 ? (
            <>
            {/* Recommended matches panel */}
            <div className="rounded-[22px] border border-border/60 p-4 md:p-5">
            {/* Section heading */}
            <h2 className="text-[15px] font-semibold text-foreground">Aanbevolen matches</h2>

            {/* Match cards */}
            <div className="mt-4 space-y-3">
              {rankedMatches.map((item) => {
                const isSelected = selectedProviderId === item.provider.id;
                const qualityBadge =
                  item.index === 0
                    ? { label: "Beste match", cls: "bg-violet-500/15 text-violet-400" }
                    : item.index === 1
                      ? { label: "Goede match", cls: "bg-emerald-500/15 text-emerald-400" }
                      : { label: "Reserve", cls: "bg-muted/40 text-muted-foreground" };
                const scoreColor =
                  (item.matchScore ?? 0) >= 80
                    ? "text-emerald-500"
                    : (item.matchScore ?? 0) >= 60
                      ? "text-emerald-400"
                      : "text-amber-400";
                return (
                  <article
                    key={item.provider.id}
                    onClick={() => handleSelectProvider(item.provider.id)}
                    onMouseEnter={() => setHoveredProviderId(item.provider.id)}
                    onMouseLeave={() => setHoveredProviderId(null)}
                    className={cn(
                      "cursor-pointer rounded-[22px] border p-4 transition-all",
                      isSelected
                        ? "border-primary/40 bg-primary/5 ring-1 ring-primary/30"
                        : "border-border/60 hover:border-border/80",
                    )}
                  >
                    {/* Card main row */}
                    <div className="flex items-center gap-3">
                      {/* Radio */}
                      <input
                        type="radio"
                        name="matching-provider"
                        value={item.provider.id}
                        checked={isSelected}
                        onChange={() => handleSelectProvider(item.provider.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="size-4 shrink-0 accent-primary"
                        aria-label={`Selecteer ${item.provider.name}`}
                      />

                      {/* Logo square */}
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/30 bg-background/60 text-xs font-bold text-muted-foreground"
                        aria-hidden
                      >
                        {item.provider.name.slice(0, 1)}
                      </div>

                      {/* Name + tags */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground truncate">{item.provider.name}</span>
                          <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", qualityBadge.cls)}>
                            {qualityBadge.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(item.provider.specializations ?? []).slice(0, 4).map((tag) => (
                            <span
                              key={`${item.provider.id}-${tag}`}
                              className="rounded-full border border-border/30 bg-background/50 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Fit score */}
                      <div className="flex shrink-0 flex-col items-end">
                        <span className="text-[11px] text-muted-foreground">Fit score</span>
                        {(item.matchScore ?? 0) > 0 ? (
                          <span className={cn("text-[22px] font-bold tabular-nums leading-none", scoreColor)}>
                            {item.matchScore}%
                          </span>
                        ) : (
                          <span className="text-[22px] font-bold tabular-nums leading-none text-muted-foreground">—</span>
                        )}
                      </div>

                      {/* Chevron */}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </div>

                    {/* Warnings */}
                    {item.warnings.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-care-warning-border bg-care-warning-bg px-3 py-2 text-sm">
                        <p className="text-[11px] font-semibold text-care-warning-text">Let op</p>
                        <ul className="mt-1 space-y-1 text-muted-foreground">
                          {item.warnings.map((w) => (
                            <li key={w} className="flex gap-2">
                              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-care-warning-text" aria-hidden />
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {/* Selected CTA row */}
                    {isSelected && (
                      <div className="border-t border-border/40 mt-4 pt-4 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1 gap-1.5 rounded-lg bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                          disabled={isSubmittingMatch || matchSubmitting}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRequestSelection(item);
                          }}
                        >
                          <Send className="size-3.5" aria-hidden />
                          Stuur naar aanbieder
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 border border-border/30 bg-transparent"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenWaitlistModal(item);
                          }}
                        >
                          <PenLine className="size-3.5" aria-hidden />
                          Handmatige override
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="border border-border/30 bg-transparent px-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="size-4" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenWaitlistModal(item); }}>
                              Wachtlijst voorbereiden
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleScenarioExpandRadius(); }}>
                              Vergroot zoekgebied
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {item.tradeOffs.length > 0 && (
                          <div className="w-full mt-2">
                            <CareTradeoffList
                              heading="Afwegingen"
                              items={item.tradeOffs.map((t) => ({
                                label: t,
                                tone: item.index === 0 ? "neutral" as const : "negative" as const,
                              }))}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Overflow collapsible */}
            {overflowList.length > 0 ? (
              <Collapsible>
                <CollapsibleTrigger className="flex w-full items-center justify-center gap-2 py-2 text-[13px] font-semibold text-primary hover:underline">
                  <span>Bekijk meer matches</span>
                  <ChevronDown className="size-4" aria-hidden />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  <ul className="space-y-2 rounded-xl border border-border/30 bg-background/40 p-3">
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
                        <span className="text-muted-foreground">{row.advisoryLabel}</span>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
            </div>
            </>
            ) : (
            <>
              {/* Empty state — no matching providers */}
              <div className="rounded-[22px] border border-border/60 p-5 md:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <SearchX className="size-6 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold leading-snug text-foreground">Geen passende aanbieders gevonden</h2>
                  </div>
                </div>

                {/* Beperkende criteria — icon left of label, count right-aligned */}
                <div className="mt-5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Beperkende criteria</h3>
                  <ul className="mt-1.5 divide-y divide-border/40">
                    {(
                      [
                        { Icon: AlertCircle, tone: "text-amber-400", label: "Uitgesloten door ontbrekende capaciteit", count: 4 },
                        { Icon: MapPin, tone: "text-sky-400", label: "Buiten de gekozen regio", count: 2 },
                        { Icon: Users, tone: "text-violet-400", label: "Geen passende specialisatie", count: 1 },
                        { Icon: Check, tone: "text-emerald-400", label: "Voldoet aan alle criteria", count: 0 },
                      ] as const
                    ).map((row) => (
                      <li key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="flex min-w-0 items-center gap-2.5 text-[13px] text-muted-foreground">
                          <row.Icon className={cn("size-4 shrink-0", row.tone)} aria-hidden />
                          <span className="truncate">{row.label}</span>
                        </span>
                        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actions — one primary, one secondary, anchored bottom-left */}
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    className="gap-2 rounded-xl bg-primary font-medium text-primary-foreground hover:bg-primary/90"
                    onClick={() => window.location.assign(toCareCaseEdit(caseId, "casus"))}
                  >
                    Pas criteria aan
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 rounded-xl border-border/60 bg-background/40"
                    onClick={() => onNavigateToZorgaanbieders?.() ?? window.location.assign(CARE_PATHS.ZORGAANBIEDERS)}
                  >
                    <Users className="size-4" aria-hidden />
                    Bekijk alle aanbieders
                  </Button>
                </div>
              </div>

              {/* Advisory banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] border border-border/50 bg-card/30 px-4 py-3">
                <span className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
                  <Info className="size-4 shrink-0" aria-hidden />
                  Matching is adviserend. Gebruik de suggesties als ondersteuning voor beoordeling.
                </span>
                <button
                  type="button"
                  className="shrink-0 text-[13px] font-medium text-primary hover:underline"
                  onClick={() => setMatchingHelpOpen(true)}
                >
                  Meer over matching
                </button>
              </div>

              {/* Detail tabs */}
              <div className="rounded-[22px] border border-border/60 p-4 md:p-5">
                <div className="flex items-center gap-1 border-b border-border/50">
                  {(
                    [
                      { id: "overzicht", label: "Overzicht" },
                      { id: "aanmelding", label: "Aanmelding" },
                      { id: "documenten", label: "Documenten" },
                      { id: "activiteit", label: "Activiteit" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDetailTab(tab.id)}
                      className={cn(
                        "-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
                        detailTab === tab.id
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="pt-4">
                  {detailTab === "overzicht" ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[13px] font-semibold text-foreground">Huidige criteria</h3>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                          onClick={() => window.location.assign(toCareCaseEdit(caseId, "casus"))}
                        >
                          <PenLine className="size-3.5" aria-hidden />
                          Criteria aanpassen
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        {(
                          [
                            { Icon: SlidersHorizontal, label: "Complexiteit", value: caseData.risk === "high" ? "Hoog" : "Meervoudig" },
                            { Icon: Activity, label: "Zorgintensiteit", value: caseData.caseType || "Regulier" },
                            { Icon: Flag, label: "Urgentie", value: urgencyNl },
                            { Icon: MapPin, label: "Regio", value: caseData.region },
                          ] as const
                        ).map((card) => (
                          <div key={card.label} className="rounded-[14px] border border-border/50 bg-background/40 p-3">
                            <card.Icon className="size-4 text-muted-foreground" aria-hidden />
                            <p className="mt-2 text-[11px] text-muted-foreground">{card.label}</p>
                            <p className="text-[13px] font-semibold text-foreground">{card.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : detailTab === "aanmelding" ? (
                    <p className="text-[13px] text-muted-foreground">
                      {maskParticipantIdentity(caseData.clientName)} · {caseData.clientAge} jaar · {caseData.region}. Aanmeldgegevens zijn afgeschermd in deze weergave.
                    </p>
                  ) : detailTab === "documenten" ? (
                    <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
                      <FileText className="size-4 shrink-0" aria-hidden />
                      Nog geen documenten gekoppeld aan deze casus.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
                      <Clock className="size-4 shrink-0" aria-hidden />
                      Casus doorgestuurd naar matching · bijgewerkt {caseData.lastActivity}.
                    </div>
                  )}
                </div>
              </div>
            </>
            )}
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[340px]">
          {rankedMatches.length === 0 ? (
            <>
              {/* Card 1 — Waarom geen match? */}
              <div className="rounded-[22px] border border-border/60 bg-card/45 p-4 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <h3 className="care-text-subheading text-foreground">Waarom geen match?</h3>
                  <Info className="size-3.5 text-muted-foreground/70" aria-hidden />
                </div>
                <ul className="mt-3 space-y-2.5">
                  {(
                    [
                      { Icon: AlertCircle, tone: "text-amber-400", text: "Onvoldoende capaciteit in de regio" },
                      { Icon: MapPin, tone: "text-sky-400", text: "Gekozen regio beperkt de resultaten" },
                      { Icon: Users, tone: "text-violet-400", text: "Passende specialisatie niet beschikbaar" },
                    ] as const
                  ).map((reason) => (
                    <li key={reason.text} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
                      <reason.Icon className={cn("mt-0.5 size-4 shrink-0", reason.tone)} aria-hidden />
                      <span className="leading-snug">{reason.text}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mt-3.5 text-[13px] font-semibold text-primary hover:underline"
                  onClick={() => onNavigateToZorgaanbieders?.() ?? window.location.assign(CARE_PATHS.ZORGAANBIEDERS)}
                >
                  Bekijk uitgesloten aanbieders →
                </button>
              </div>

              {/* Card 2 — Huidige criteria */}
              <div className="rounded-[22px] border border-border/60 bg-card/45 p-4 shadow-sm">
                <h3 className="care-text-subheading text-foreground">Huidige criteria</h3>
                <dl className="mt-3 space-y-2">
                  {[
                    { label: "Complexiteit", value: caseData.risk === "high" ? "Hoog" : "Meervoudig" },
                    { label: "Zorgintensiteit", value: caseData.caseType || "Regulier" },
                    { label: "Urgentie", value: urgencyNl },
                    { label: "Regio", value: caseData.region },
                  ].map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-2 text-[13px]">
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className="text-right font-medium text-foreground">{row.value}</dd>
                    </div>
                  ))}
                </dl>
                <button
                  type="button"
                  className="mt-3.5 text-[13px] font-semibold text-primary hover:underline"
                  onClick={() => window.location.assign(toCareCaseEdit(caseId, "casus"))}
                >
                  Alle criteria bekijken →
                </button>
              </div>

              {/* Card 3 — Status & vervolg */}
              <div className="rounded-[22px] border border-border/60 bg-card/45 p-4 shadow-sm">
                <h3 className="care-text-subheading text-foreground">Status &amp; vervolg</h3>
                <dl className="mt-3 space-y-3">
                  <div>
                    <dt className="text-[11px] font-medium text-muted-foreground/70">Actiehouder</dt>
                    <dd className="mt-1 flex items-center gap-2">
                      <UserRound className="size-4 text-muted-foreground" aria-hidden />
                      <span className="text-[13px] font-medium text-foreground">{spaCaseRaw?.owner || "Gemeente"}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-muted-foreground/70">Volgende stap</dt>
                    <dd className="mt-1 text-[13px] font-medium text-foreground">Criteria aanpassen of wachtlijst opnemen</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="mt-3.5 text-[13px] font-semibold text-primary hover:underline"
                  onClick={() => window.location.assign(toCareCaseDetail(caseId))}
                >
                  Bekijk activiteit →
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Panel 1 — Waarom deze match */}
              <div className="rounded-[22px] border border-border/60 bg-card/45 p-3.5 shadow-sm">
                <h3 className="care-text-subheading text-foreground">Waarom deze match</h3>
                <div className="mt-2.5 space-y-2">
                  {(
                    [
                      { Icon: Scale, text: "Sterke specialisatie-fit met het zorgprofiel" },
                      { Icon: Clock, text: "Relatief korte inschatting van wachttijd" },
                      { Icon: MapPin, text: "Dichtbij de woonplaats van de jeugdige" },
                      { Icon: TrendingUp, text: "Goede eerdere uitkomsten in vergelijkbare trajecten" },
                    ] as const
                  ).map((row) => (
                    <div key={row.text} className="flex gap-2.5 text-[13px] text-muted-foreground">
                      <row.Icon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                      <span className="leading-snug">{row.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Panel 2 — Voorkeuren */}
              <div className="rounded-[22px] border border-border/60 bg-card/45 p-3.5 shadow-sm">
                <h3 className="care-text-subheading text-foreground">Voorkeuren</h3>
                <dl className="mt-2.5 space-y-1.5">
                  {[
                    { label: "Complexiteit", value: caseData.risk === "high" ? "Hoog" : "Meervoudig" },
                    { label: "Zorgintensiteit", value: caseData.caseType || "Regulier" },
                    { label: "Urgentie", value: urgencyNl },
                    { label: "Regio", value: caseData.region },
                  ].map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-2 text-[13px]">
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className="font-medium text-foreground text-right">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Panel 3 — Status & vervolg */}
              <div className="rounded-[22px] border border-border/60 bg-card/45 p-3.5 shadow-sm">
                <h3 className="care-text-subheading text-foreground">Status &amp; vervolg</h3>
                <dl className="mt-2.5 space-y-2">
                  <div>
                    <dt className="text-[11px] text-muted-foreground/70 font-medium">Actiehouder</dt>
                    <dd className="flex items-center gap-2 mt-1">
                      <Building2 className="size-4 text-muted-foreground" aria-hidden />
                      <span className="text-[13px] font-medium text-foreground">{spaCaseRaw?.owner || "Gemeente"}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground/70 font-medium">Volgende stap</dt>
                    <dd className="flex items-center gap-2 mt-1">
                      <ArrowRight className="size-4 text-primary" aria-hidden />
                      <span className="text-[13px] font-medium text-foreground">Stuur naar aanbieder</span>
                    </dd>
                  </div>
                </dl>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ── Dialogs ── */}
      <>
        <Dialog open={matchingHelpOpen} onOpenChange={setMatchingHelpOpen}>
          <DialogContent style={{ maxWidth: tokens.layout.dialogNarrowMaxWidth }}>
            <DialogHeader>
              <DialogTitle>Over matching</DialogTitle>
              <DialogDescription>
                Matching is adviserend. De keten-engine rangschikt aanbieders op basis van de
                ingestelde criteria; de uiteindelijke beoordeling en doorleiding blijven een
                handmatige beslissing.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2 text-[13px] text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <SlidersHorizontal className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                Pas de criteria aan om de zoekruimte te verbreden of te versmallen.
              </li>
              <li className="flex items-start gap-2.5">
                <Users className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                Bekijk alle aanbieders om buiten de huidige criteria te zoeken.
              </li>
              <li className="flex items-start gap-2.5">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                Uitgesloten aanbieders blijven zichtbaar met de reden van uitsluiting.
              </li>
            </ul>
            <DialogFooter>
              <Button type="button" onClick={() => setMatchingHelpOpen(false)}>Sluiten</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={selectionConfirmMatch !== null}
          onOpenChange={(open) => {
            if (!open) { setSelectionConfirmMatch(null); setOverrideReason(""); }
          }}
        >
          <DialogContent
            className="gap-4 rounded-2xl border-border bg-card p-4"
            style={{ maxWidth: tokens.layout.dialogMaxWidth }}
          >
            {(() => {
              const isOverride = (selectionConfirmMatch?.index ?? 0) !== 0;
              const overrideReasonMissing = isOverride && !overrideReason.trim();
              return (
                <>
                  <DialogHeader className="gap-2 text-left">
                    <DialogTitle className="text-xl font-semibold">
                      {isOverride ? "Afwijking van topaanbeveling" : "Bevestig keuze"}
                    </DialogTitle>
                    <DialogDescription asChild>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        {isOverride && (
                          <div className="rounded-lg border border-care-warning-border bg-care-warning-bg px-3 py-2 text-[13px]">
                            <p className="font-semibold text-care-warning-text">Handmatige overschrijving vereist</p>
                            <p className="mt-0.5">Je selecteert niet de topbeaanbeveling van de keten-engine. Geef een toelichting — dit wordt vastgelegd in het auditlog.</p>
                          </div>
                        )}
                        <p>
                          Je staat op het punt om{" "}
                          <span className="font-semibold text-foreground">{selectionConfirmMatch?.provider.name ?? "deze aanbieder"}</span>{" "}
                          te selecteren voor doorleiding.
                        </p>
                        {!isOverride && (
                          <ul className="list-disc space-y-1 pl-5">
                            <li>De casus gaat naar aanbiederreactie (advies; geen automatische plaatsing).</li>
                            <li>Andere aanbieders worden niet automatisch afgewezen.</li>
                          </ul>
                        )}
                        {isOverride && (
                          <div className="space-y-1.5">
                            <label className="block text-[12px] font-semibold text-foreground" htmlFor="override-reason">
                              Reden van overschrijving <span className="text-care-urgent-text">*</span>
                            </label>
                            <Textarea
                              id="override-reason"
                              placeholder="Bijv. aanbieder heeft specifieke specialisatie die de engine niet meewoog, of cliëntvoorkeur…"
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                              rows={3}
                              className="text-[13px]"
                              aria-required
                            />
                          </div>
                        )}
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => { setSelectionConfirmMatch(null); setOverrideReason(""); }}>
                      Annuleren
                    </Button>
                    <Button
                      type="button"
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={isSubmittingMatch || matchSubmitting || overrideReasonMissing}
                      title={overrideReasonMissing ? "Vul een reden in voor de overschrijving" : undefined}
                      onClick={() => void handleConfirmSelectionChoice()}
                    >
                      {isSubmittingMatch || matchSubmitting ? "Bezig..." : isOverride ? "Selecteren met toelichting" : "Bevestigen"}
                      <ArrowRight className="ml-1 size-4" aria-hidden />
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
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
                  <DialogTitle className="text-xl font-semibold text-foreground">
                    Wachtlijstvoorstel voorbereiden
                  </DialogTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <InlineHelpChip
                      title="Wanneer op wachtlijst?"
                      triggerLabel="Wanneer op wachtlijst?"
                      testId="matching-waitlist-help"
                    >
                      <p>Gebruik de wachtlijst wanneer directe plaatsing niet mogelijk is maar opvolging nodig blijft.</p>
                    </InlineHelpChip>
                  </div>
                  <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                    Je legt een concept wachtlijstvoorstel vast voor {waitlistTargetMatch.provider.name}. Daarna ga je verder op de
                    casuspagina om te controleren en eventueel naar de aanbieder te sturen — nog geen definitieve plaatsing.
                  </DialogDescription>
                </DialogHeader>

                {waitlistModalError ? (
                  <div className="rounded-xl border border-care-urgent-border bg-care-urgent-bg px-3 py-2 text-sm text-care-urgent-text">
                    {waitlistModalError}
                  </div>
                ) : null}

                <CarePanel className="space-y-0 border-border/60 bg-background/80 px-4 py-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
                    <span className="text-muted-foreground">Aanbieder</span>
                    <span className="truncate text-right font-medium text-foreground" style={{ maxWidth: tokens.layout.rowLabelMaxWidth }}>{waitlistTargetMatch.provider.name}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
                    <span className="text-muted-foreground">Matchadvies</span>
                    <span className="font-medium text-foreground">{waitlistTargetMatch.advisoryLabel}</span>
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
