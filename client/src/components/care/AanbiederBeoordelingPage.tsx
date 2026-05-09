/**
 * AanbiederBeoordelingPage — role-adaptive provider evaluation page.
 *
 * GEMEENTE VIEW (monitoring):
 *   - Shows cases sent to providers for review.
 *   - Displays provider status, SLA, comments, and rejection reason.
 *   - CTAs: "Informatie aanvullen" / "Nieuwe match zoeken" / "Plaatsing starten".
 *   - No accept/reject buttons — gemeente never decides.
 *
 * ZORGAANBIEDER VIEW (decision):
 *   - Structure: case context → sticky besluit (accepteren/afwijzen) → formulier na keuze.
 *   - Afwijzing vereist gestructureerde reden + toelichting (min. 10 tekens).
 *   - Acceptatie: capaciteitsindicator, checkboxes, startdatum, optionele opmerking in provider_comment.
 *   - Bevestigingsdialoog bij afwijzen bij hoge urgentie; meer info via modal.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Loader2,
  Lock,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Send,
  Star,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../ui/utils";
import {
  CareAlertCard,
  CareAttentionBar,
  CareFilterTabButton,
  CareFilterTabGroup,
  CareInfoPopover,
  CareMetricBadge,
  CarePageScaffold,
  CareSearchFiltersBar,
  CareSection,
  CareSectionBody,
  CareSectionHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
} from "./CareDesignPrimitives";
import { tokens } from "../../design/tokens";
import { RegieRailEdgeTab, RegieRailToggleButton } from "./RegieRailControls";
import { useCases } from "../../hooks/useCases";
import { useRailCollapsed } from "../../hooks/useRailCollapsed";
import { useProviderEvaluations } from "../../hooks/useProviderEvaluations";
import type {
  EvaluationDecisionPayload,
  RejectionReasonCode,
  InfoRequestType,
} from "../../hooks/useProviderEvaluations";
import { INFO_REQUEST_TYPE_LABELS } from "../../hooks/useProviderEvaluations";
import type { SpaCase } from "../../hooks/useCases";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = "gemeente" | "zorgaanbieder" | "admin";

type DecisionModalState = { type: "info_request"; caseId: string } | null;

type CapacitySignal = "vol" | "beperkt" | "beschikbaar";

type PanelMode = "idle" | "accept" | "reject";

/** UI labels mapped to canonical API rejection codes (structured feedback for matching). */
const STRUCTURED_REJECTION_OPTIONS: { code: RejectionReasonCode; label: string }[] = [
  { code: "geen_capaciteit", label: "Geen capaciteit" },
  { code: "specialisatie_past_niet", label: "Zorgvraag past niet" },
  { code: "regio_niet_passend", label: "Regio niet passend" },
  { code: "urgentie_niet_haalbaar", label: "Wachttijd te lang" },
  { code: "andere_reden", label: "Anders" },
];

interface AanbiederBeoordelingPageProps {
  role: UserRole;
  onCaseClick: (caseId: string) => void;
  onNavigateToMatching?: () => void;
  onNavigateToPlaatsingen?: () => void;
  onNavigateToCasussen?: () => void;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function urgencyLabel(urgency: SpaCase["urgency"]): string {
  switch (urgency) {
    case "critical": return "Kritiek";
    case "warning":  return "Hoog";
    case "normal":   return "Normaal";
    default:         return "Laag";
  }
}

function urgencyToneTextClass(urgency: SpaCase["urgency"]): string {
  switch (urgency) {
    case "critical": return "text-destructive";
    case "warning":  return "text-amber-300";
    case "normal":   return "text-blue-300";
    default:         return "text-muted-foreground";
  }
}

function formatClientReference(caseId: string): string {
  const digits = caseId.replace(/\D/g, "");
  if (digits.length >= 3) {
    return `CLI-${digits.padStart(5, "0").slice(-5)}`;
  }
  return "CLI-ONBEKEND";
}

function maskParticipantIdentity(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "Betrokkene afgeschermd";
  }
  return parts
    .map((part) => `${part[0] ?? ""}${"•".repeat(Math.max(3, part.length - 1))}`)
    .join(" ");
}

// ─── Info request modal ───────────────────────────────────────────────────────

interface InfoRequestModalProps {
  caseId: string;
  onClose: () => void;
  onConfirm: (payload: EvaluationDecisionPayload) => Promise<void>;
  submitting: boolean;
}

function InfoRequestModal({ caseId, onClose, onConfirm, submitting }: InfoRequestModalProps) {
  const [infoType, setInfoType] = useState<InfoRequestType | "">("");
  const [comment, setComment] = useState("");
  const isValid = Boolean(infoType && comment.trim().length >= 10);

  const handleSubmit = async () => {
    if (!isValid || !infoType) return;
    await onConfirm({
      status: "INFO_REQUESTED",
      information_request_type: infoType,
      information_request_comment: comment.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full rounded-2xl border border-border bg-card shadow-xl" style={{ maxWidth: tokens.layout.dialogNarrowMaxWidth }}>
        <div className="flex items-start gap-3 border-b border-border px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-500/25 bg-blue-500/10">
            <FileQuestion className="text-blue-400" size={20} />
          </div>
          <div>
            <p className="font-semibold text-foreground">Meer informatie vragen</p>
            <p className="text-sm text-muted-foreground mt-0.5">Casus <span className="font-medium text-foreground">{caseId}</span></p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Type informatie <span className="text-primary">*</span>
            </label>
            <select
              value={infoType}
              onChange={(e) => setInfoType(e.target.value as InfoRequestType)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
            >
              <option value="">Kies type...</option>
              {Object.entries(INFO_REQUEST_TYPE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Vraag / toelichting <span className="text-primary">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Omschrijf welke informatie je nodig hebt om de casus te beoordelen..."
              rows={4}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground"
            />
            {comment.length > 0 && comment.trim().length < 10 && (
              <p className="mt-1 text-xs text-red-400">Voeg minimaal 10 tekens toe.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Annuleren</Button>
          <Button
            className="gap-2"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Informatie opvragen
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Gemeente view (monitoring) ───────────────────────────────────────────────

interface GemeenteViewProps {
  cases: SpaCase[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onCaseClick: (caseId: string) => void;
  onNavigateToMatching?: () => void;
  onNavigateToPlaatsingen?: () => void;
  onNavigateToCasussen?: () => void;
}

/** Canonical monitoring layout — pixel baseline matches design mock (provider rows + sidebar). */

type ProviderInviteRow = {
  id: string;
  name: string;
  distanceKm: string;
  city: string;
  tags: string;
  statusKind: "waiting" | "received" | "rejected";
  statusLabel: string;
  statusMeta: string;
  response: string;
  fitLabel: string;
  fitPct: number | null;
  actionLabel: string;
  logo: ReactNode;
};

const GEMEENTE_INVITED_PROVIDER_ROWS: ProviderInviteRow[] = [
  {
    id: "levvel",
    name: "Levvel Jeugd & Opvoedhulp",
    distanceKm: "2.3",
    city: "Amsterdam",
    tags: "Trauma · intensieve hulp",
    statusKind: "waiting",
    statusLabel: "Wacht op reactie",
    statusMeta: "Uitgenodigd op 12 mei 2025",
    response: "— Nog geen reactie",
    fitLabel: "Zeer goede match",
    fitPct: 92,
    actionLabel: "Bekijk profiel",
    logo: (
      <span className="text-[13px] font-bold tracking-tight text-orange-400">Levvel</span>
    ),
  },
  {
    id: "enver",
    name: "Enver Jeugdhulp",
    distanceKm: "4.7",
    city: "Amsterdam",
    tags: "Gezinsbegeleiding · schoolverzuim",
    statusKind: "received",
    statusLabel: "Reactie ontvangen",
    statusMeta: "Ontvangen op 13 mei 2025",
    response: "Interesse. Kan binnen 7 dagen starten",
    fitLabel: "Goede match",
    fitPct: 89,
    actionLabel: "Bekijk beoordeling",
    logo: <img src="/partners/logo-enver.png" alt="" className="h-6 w-auto object-contain" />,
  },
  {
    id: "arkin",
    name: "Arkin Jeugd & Gezin",
    distanceKm: "6.1",
    city: "Amsterdam",
    tags: "Psychische problematiek",
    statusKind: "rejected",
    statusLabel: "Afgewezen",
    statusMeta: "Ontvangen op 13 mei 2025",
    response: "Geen capaciteit. Wachttijd > 4 weken",
    fitLabel: "—",
    fitPct: null,
    actionLabel: "Bekijk bericht",
    logo: (
      <span className="flex items-center gap-1 text-[13px] font-semibold text-orange-300">
        <Star size={14} className="shrink-0 fill-amber-400 text-amber-400" aria-hidden />
        Arkin
      </span>
    ),
  },
];

function statusPillClass(kind: ProviderInviteRow["statusKind"]): string {
  switch (kind) {
    case "waiting":
      return "border-amber-500/35 bg-amber-500/12 text-amber-200";
    case "received":
      return "border-emerald-500/35 bg-emerald-500/12 text-emerald-200";
    case "rejected":
      return "border-red-500/35 bg-red-500/12 text-red-200";
    default:
      return "border-border/70 bg-muted/30 text-muted-foreground";
  }
}

function GemeenteBeoordelingStepper({ embedded = false }: { embedded?: boolean }) {
  const steps = [
    { id: "casus", label: "Casus", state: "done" as const },
    { id: "matching", label: "Matching", state: "done" as const },
    { id: "aanbieder", label: "Aanbieder beoordeling", state: "current" as const },
    { id: "plaatsing", label: "Plaatsing", state: "locked" as const },
    { id: "intake", label: "Intake", state: "locked" as const },
  ];

  return (
    <div
      className={cn(
        "px-3 py-3 md:px-4 md:py-3.5",
        embedded
          ? "border-0 bg-transparent p-0 md:p-0"
          : "rounded-[10px] border border-border/60 bg-card/40",
      )}
      style={embedded ? undefined : { borderRadius: tokens.radius.md }}
    >
      <div className="relative flex flex-wrap items-start justify-between gap-4 md:flex-nowrap md:gap-1">
        <div
          className="pointer-events-none absolute left-0 right-0 top-[18px] hidden h-px bg-border/70 md:block"
          aria-hidden
        />
        {steps.map((step) => (
          <div key={step.id} className="relative z-[1] flex min-w-[5.5rem] flex-1 flex-col items-center text-center">
            <div
              className={cn(
                "mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-semibold",
                step.state === "done" && "border-primary/50 bg-primary/15 text-primary",
                step.state === "current" && "border-primary/60 bg-primary/20 text-primary ring-2 ring-primary/20",
                step.state === "locked" && "border-border/70 bg-background/80 text-muted-foreground",
              )}
            >
              {step.state === "done" && <CheckCircle2 size={16} strokeWidth={2.25} aria-hidden />}
              {step.state === "current" && <User size={16} strokeWidth={2.25} aria-hidden />}
              {step.state === "locked" && <Lock size={14} strokeWidth={2.25} aria-hidden />}
            </div>
            <p
              className={cn(
                "max-w-[7.5rem] text-[11px] font-semibold leading-tight md:text-[12px]",
                step.state === "current" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GemeenteView({
  cases,
  loading,
  error,
  refetch,
  searchQuery,
  onSearchChange,
  onCaseClick,
  onNavigateToMatching,
  onNavigateToPlaatsingen: _onNavigateToPlaatsingen,
  onNavigateToCasussen,
}: GemeenteViewProps) {
  const [activeTab, setActiveTab] = useState<"overzicht" | "aanbieders" | "berichten" | "bestanden">("overzicht");
  const { collapsed: railCollapsed, toggle: toggleRail, setCollapsed: setRailCollapsed } = useRailCollapsed();

  const reviewCasesAll = useMemo(
    () => cases.filter(c => c.status === "provider_beoordeling" || c.status === "plaatsing"),
    [cases],
  );

  const reviewCases = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return reviewCasesAll.filter(c => {
      if (!query) return true;
      return [c.id, c.title, c.regio].join(" ").toLowerCase().includes(query);
    });
  }, [reviewCasesAll, searchQuery]);

  const focusCase = reviewCases[0] ?? reviewCasesAll[0];
  // `displayCaseId` only resolves inside `showMainGrid` contexts where `focusCase` is guaranteed,
  // so the empty-string fallback is defensive and never user-visible.
  const displayCaseId = focusCase?.id ?? "";
  const hasPhaseCases = reviewCasesAll.length > 0;
  const showMainGrid = !loading && !error && reviewCases.length > 0;

  const handleBack = () => {
    if (focusCase) {
      onCaseClick(focusCase.id);
      return;
    }
    onNavigateToCasussen?.();
  };

  const tabs = [
    { id: "overzicht" as const, label: "Overzicht" },
    { id: "aanbieders" as const, label: "Aanbieders", count: 3 },
    { id: "berichten" as const, label: "Berichten", count: 2 },
    { id: "bestanden" as const, label: "Bestanden" },
  ];

  const shellExtrasReady = !loading && !error && hasPhaseCases;

  return (
    <div
      data-testid="aanbieder-beoordeling-gemeente-root"
      className="flex w-full flex-col gap-8 xl:flex-row xl:items-start xl:gap-8"
    >
      <div className="min-w-0 flex-1">
        <CarePageScaffold
          archetype="decision"
          className="pb-8"
          title={(
            <span className="inline-flex flex-wrap items-center gap-2">
              Aanbieder beoordeling
              <CareInfoPopover ariaLabel="Uitleg aanbieder beoordeling" testId="aanbieder-beoordeling-page-info">
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    Monitor aanbiederreactie — beslissing ligt bij de aanbieder. Volg uitnodigingen, reacties en
                    geschiktheid; herinner of schakel bij overschrijding van de reactietermijn.
                  </p>
                  <p>Volg status en reactietermijn per uitgenodigde aanbieder voor deze casus.</p>
                </div>
              </CareInfoPopover>
            </span>
          )}
          metric={(
            <div className="flex flex-wrap items-center gap-2">
              {focusCase ? (
                <span className="font-mono text-[13px] text-foreground">{focusCase.id}</span>
              ) : (
                <span className="text-[13px] text-muted-foreground">Geen casus geselecteerd</span>
              )}
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-tight",
                  "border-primary/45 bg-primary/15 text-primary",
                )}
                style={{ maxWidth: tokens.layout.phaseBadgeMaxWidth }}
              >
                Fase: Aanbieder beoordeling
              </span>
            </div>
          )}
          actions={(
            <div className="flex flex-col items-start gap-1 md:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  className="gap-2 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <ArrowLeft size={16} aria-hidden />
                  Terug naar casus
                </Button>
                <Button type="button" variant="outline" onClick={() => void refetch()} className="gap-2">
                  <RefreshCw size={14} aria-hidden />
                  Ververs
                </Button>
                {showMainGrid ? (
                  <RegieRailToggleButton
                    collapsed={railCollapsed}
                    onToggle={toggleRail}
                    testId="aanbieder-beoordeling-rail-toggle"
                  />
                ) : null}
              </div>
            </div>
          )}
          dominantAction={
            shellExtrasReady ? (
              <CareAlertCard
                testId="aanbieder-beoordeling-dominant"
                className="shadow-sm"
                tone="info"
                icon={<Clock size={24} aria-hidden />}
                metric={3}
                title="aanbieders uitgenodigd"
                description="Wacht op reactie van aanbieders. Zij beoordelen of de casus past bij capaciteit en inhoud. Reactietermijn verloopt op 15 mei 2025 om 14:00."
                primaryAction={(
                  <Button
                    type="button"
                    size="lg"
                    className="h-11 gap-2 rounded-xl px-5 text-[14px] font-semibold shadow-md"
                    onClick={() =>
                      toast.message("Herinnering gepland", {
                        description: "Aanbieders ontvangen een herinnering.",
                      })}
                  >
                    <Send size={16} aria-hidden />
                    Herinner aanbieders
                  </Button>
                )}
              />
            ) : undefined
          }
          kpiStrip={
            shellExtrasReady ? (
              <CareSection testId="aanbieder-beoordeling-keten" aria-label="Voortgang keten">
                <CareSectionHeader title="Voortgang keten" />
                <CareSectionBody className="mt-3">
                  <GemeenteBeoordelingStepper embedded />
                </CareSectionBody>
              </CareSection>
            ) : undefined
          }
          filters={
            shellExtrasReady ? (
              <CareFilterTabGroup aria-label="Weergave aanbieder beoordeling">
                {tabs.map((tab) => (
                  <CareFilterTabButton
                    key={tab.id}
                    selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                    {tab.count != null ? ` (${tab.count})` : ""}
                  </CareFilterTabButton>
                ))}
              </CareFilterTabGroup>
            ) : undefined
          }
        >
          {loading && (
            <LoadingState title="Casussen laden…" copy="Even geduld — de casus en aanbieders worden opgehaald." />
          )}

          {!loading && error && (
            <ErrorState title="Laden mislukt" copy={error} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
          )}

          {!loading && !error && reviewCasesAll.length === 0 && (
            <div className="space-y-3">
              <CareAttentionBar
                tone="info"
                icon={<Info size={16} aria-hidden />}
                message="Aanbieder beoordeling verschijnt pas nadat de gemeente matching heeft gevalideerd en de casus heeft verzonden."
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    {onNavigateToMatching ? (
                      <PrimaryActionButton onClick={onNavigateToMatching}>Naar matching</PrimaryActionButton>
                    ) : null}
                    {onNavigateToCasussen ? (
                      <Button variant="outline" onClick={() => onNavigateToCasussen()}>
                        Terug naar werkvoorraad
                      </Button>
                    ) : null}
                  </div>
                }
              />
              <EmptyState
                title="Geen casussen in deze fase"
                copy="Er zijn nu nog geen casussen verzonden naar een aanbieder. Valideer eerst de matching of keer terug naar de werkvoorraad."
              />
            </div>
          )}

          {!loading && !error && reviewCasesAll.length > 0 && reviewCases.length === 0 && searchQuery.trim() !== "" && (
            <EmptyState
              title="Geen casussen gevonden"
              copy="Geen resultaat voor deze zoekopdracht. Pas de zoekterm aan."
              action={<Button variant="outline" onClick={() => onSearchChange("")}>Wis zoekopdracht</Button>}
            />
          )}

          {showMainGrid && (
            <CareSection testId="aanbieder-beoordeling-uitnodigingen" aria-labelledby="aanbieder-uitnodigingen-heading">
              <CareSectionHeader
                title={<span id="aanbieder-uitnodigingen-heading">Uitgenodigde aanbieders</span>}
              />
              <CareSectionBody>
                {activeTab === "overzicht" && (
                  <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/35">
                    <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-border/60 bg-muted/15">
                          <th className="px-4 py-3 font-semibold text-muted-foreground">Aanbieder</th>
                          <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                          <th className="px-4 py-3 font-semibold text-muted-foreground">Reactie</th>
                          <th className="px-4 py-3 font-semibold text-muted-foreground">Geschiktheid</th>
                          <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Volgende stap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {GEMEENTE_INVITED_PROVIDER_ROWS.map((row) => (
                          <tr key={row.id} className="border-b border-border/50 last:border-b-0">
                            <td className="px-4 py-4 align-top">
                              <div className="flex gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-border/60 bg-background/50">
                                  {row.logo}
                                </div>
                                <div className="min-w-0 space-y-1">
                                  <p className="font-semibold leading-tight text-foreground">{row.name}</p>
                                  <p className="text-[12px] text-muted-foreground">
                                    {row.city} · {row.distanceKm} km
                                  </p>
                                  <p className="text-[11px] leading-snug text-muted-foreground">{row.tags}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="space-y-1.5">
                                <span
                                  className={cn(
                                    "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                    statusPillClass(row.statusKind),
                                  )}
                                >
                                  {row.statusLabel}
                                </span>
                                <p className="text-[11px] text-muted-foreground">{row.statusMeta}</p>
                              </div>
                            </td>
                            <td className="max-w-[14rem] px-4 py-4 align-top text-[12px] leading-snug text-muted-foreground">
                              {row.response}
                            </td>
                            <td className="px-4 py-4 align-top">
                              {row.fitPct != null ? (
                                <div className="space-y-1.5">
                                  <p className="text-[12px] font-semibold text-foreground">
                                    {row.fitPct}%{" "}
                                    <span className="font-medium text-muted-foreground">{row.fitLabel}</span>
                                  </p>
                                  <div className="h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-muted/50">
                                    <div
                                      className="h-full rounded-full bg-primary"
                                      style={{ width: `${row.fitPct}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[12px] text-muted-foreground">— Niet beschikbaar</span>
                              )}
                            </td>
                            <td className="px-4 py-4 align-top text-right">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 border-border/70 bg-background/50 text-[12px] font-semibold"
                                  onClick={() => onCaseClick(focusCase?.id ?? displayCaseId)}
                                >
                                  {row.actionLabel}
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 shrink-0 text-muted-foreground"
                                      aria-label={`Meer acties voor ${row.name}`}
                                    >
                                      <MoreHorizontal size={18} aria-hidden />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => onNavigateToMatching?.()}>Naar matching</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onCaseClick(focusCase?.id ?? displayCaseId)}>
                                      Open casus
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab !== "overzicht" && (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                    {activeTab === "aanbieders" && "Alle uitgenodigde aanbieders staan in het overzicht."}
                    {activeTab === "berichten" && "Berichten worden hier getoond zodra ze beschikbaar zijn."}
                    {activeTab === "bestanden" && "Bestanden voor deze fase worden hier getoond."}
                  </div>
                )}

                <p className="mt-4 text-center text-[11px] text-muted-foreground md:text-left">
                  <span className="inline-flex items-center gap-1">
                    <Info size={12} className="shrink-0 opacity-70" aria-hidden />
                    De beoordelingsperiode duurt maximaal 72 uur.
                  </span>
                </p>
              </CareSectionBody>
            </CareSection>
          )}
        </CarePageScaffold>
      </div>

      {showMainGrid ? (
        <aside
          data-testid="aanbieder-beoordeling-right-rail"
          className={cn(
            "w-full shrink-0 space-y-4 xl:w-[300px] xl:pt-1",
            railCollapsed && "xl:hidden",
          )}
        >
          <section className="rounded-xl border border-border/50 bg-card/40 p-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/50 pb-3">
              <FileText size={16} className="text-primary" aria-hidden />
              <h2 className="text-[13px] font-semibold text-foreground">Casus informatie</h2>
            </div>
            <div className="space-y-4 pt-4">
              <div className="flex gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-primary/10 text-sm font-semibold text-primary-foreground"
                  aria-hidden
                >
                  {focusCase ? formatClientReference(focusCase.id).slice(0, 2) : "CL"}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[15px] font-semibold text-foreground">
                    {focusCase ? formatClientReference(focusCase.id) : "CLI-ONBEKEND"}
                  </p>
                  {focusCase?.regio ? (
                    <p className="text-[12px] text-muted-foreground">{focusCase.regio}</p>
                  ) : null}
                  {focusCase ? (
                    <p className="text-[12px] text-muted-foreground">
                      Urgentie:{" "}
                      <span className={cn("font-semibold", urgencyToneTextClass(focusCase.urgency))}>
                        {urgencyLabel(focusCase.urgency)}
                      </span>
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    Betrokkene: {maskParticipantIdentity(focusCase?.title?.trim() || "Betrokkene")}
                  </p>
                </div>
              </div>
              {focusCase?.systemInsight?.trim() ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Hulpvraag</p>
                  <p className="text-[13px] leading-relaxed text-foreground">
                    {focusCase.systemInsight.trim()}
                  </p>
                </div>
              ) : null}
              {focusCase?.intakeStartDate ? (
                <div className="flex items-start gap-2 text-[13px] text-muted-foreground">
                  <CalendarDays size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                  <span>
                    Gewenste start: <span className="font-medium text-foreground">{focusCase.intakeStartDate}</span>
                  </span>
                </div>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full justify-between text-[13px] font-semibold"
                onClick={() => onCaseClick(focusCase?.id ?? displayCaseId)}
              >
                Bekijk casusdetails
                <ArrowRight size={16} aria-hidden />
              </Button>
            </div>
          </section>

          <Button
            type="button"
            variant="outline"
            disabled
            aria-disabled="true"
            className="h-11 w-full gap-2 border-border/70 bg-background/50 text-[13px] font-semibold"
          >
            <MessageSquare size={16} aria-hidden />
            Notitie toevoegen (binnenkort)
          </Button>
        </aside>
      ) : null}

      {showMainGrid && railCollapsed ? (
        <RegieRailEdgeTab
          onExpand={() => setRailCollapsed(false)}
          testId="aanbieder-beoordeling-rail-edge-tab"
        />
      ) : null}
    </div>
  );
}

// ─── Zorgaanbieder helpers ────────────────────────────────────────────────────

function capacityLabel(signal: CapacitySignal): string {
  switch (signal) {
    case "vol":
      return "Vol";
    case "beperkt":
      return "Beperkt";
    default:
      return "Beschikbaar";
  }
}

// ─── Zorgaanbieder: single-case review card ───────────────────────────────────

interface ProviderReviewCaseCardProps {
  caseItem: SpaCase;
  submitting: boolean;
  submitDecision: (caseId: string, payload: EvaluationDecisionPayload) => Promise<void>;
  onCaseClick: (caseId: string) => void;
  onRequestInfo: () => void;
  outcome: "accepted" | "rejected" | null;
  onOutcome: (type: "accepted" | "rejected", caseId: string) => void;
  onNextCase: () => void;
}

function ProviderReviewCaseCard({
  caseItem,
  submitting,
  submitDecision,
  onCaseClick,
  onRequestInfo,
  outcome,
  onOutcome,
  onNextCase,
}: ProviderReviewCaseCardProps) {
  const [panelMode, setPanelMode] = useState<PanelMode>("idle");
  const [capacitySignal, setCapacitySignal] = useState<CapacitySignal>("beschikbaar");
  const [confirmCapacity, setConfirmCapacity] = useState(false);
  const [confirmIntake, setConfirmIntake] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [acceptRemark, setAcceptRemark] = useState("");
  const [rejectCode, setRejectCode] = useState<RejectionReasonCode | "">("");
  const [rejectAndersDetail, setRejectAndersDetail] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);

  const acceptFormValid =
    confirmCapacity && confirmIntake && Boolean(startDate.trim());
  const rejectFormValid = Boolean(
    rejectCode
      && rejectComment.trim().length >= 10
      && (rejectCode !== "andere_reden" || rejectAndersDetail.trim().length >= 3),
  );

  const strongMatchNudge =
    caseItem.urgency === "critical" || caseItem.urgency === "warning";

  const handleSubmitAccept = async () => {
    if (!acceptFormValid) return;
    const comment = [
      `Huidige capaciteit (indicator): ${capacityLabel(capacitySignal)}`,
      "Bevestigd: capaciteit beschikbaar; intake mogelijk binnen termijn",
      `Voorgestelde startdatum: ${startDate}`,
      acceptRemark.trim() && `Opmerking: ${acceptRemark.trim()}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await submitDecision(caseItem.id, { status: "ACCEPTED", provider_comment: comment });
      onOutcome("accepted", caseItem.id);
    } catch {
      /* submitError from hook */
    }
  };

  const executeReject = async () => {
    if (!rejectFormValid || !rejectCode) return;
    const mergedComment = [
      rejectCode === "andere_reden" && rejectAndersDetail.trim()
        ? `Anders: ${rejectAndersDetail.trim()}`
        : null,
      rejectComment.trim(),
    ]
      .filter(Boolean)
      .join(" — ");
    try {
      await submitDecision(caseItem.id, {
        status: "REJECTED",
        rejection_reason_code: rejectCode,
        provider_comment: mergedComment,
      });
      setRejectConfirmOpen(false);
      onOutcome("rejected", caseItem.id);
    } catch {
      setRejectConfirmOpen(false);
    }
  };

  if (outcome === "accepted") {
    return (
      <div className="rounded-xl border border-border/70 bg-card/50 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="text-primary shrink-0 mt-0.5" size={20} />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Geaccepteerd</p>
            <p className="text-sm text-muted-foreground">Gemeente bevestigt plaatsing; daarna intake.</p>
          </div>
        </div>
        <Button className="h-10 w-auto justify-start gap-2" onClick={onNextCase}>
          Volgende casus
          <ArrowRight size={16} />
        </Button>
      </div>
    );
  }

  if (outcome === "rejected") {
    return (
      <div className="rounded-xl border border-border/70 bg-card/50 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <XCircle className="text-destructive shrink-0 mt-0.5" size={20} />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Afgewezen</p>
            <p className="text-sm text-muted-foreground">Casus gaat terug naar matching.</p>
          </div>
        </div>
        <Button variant="outline" className="h-10 w-auto justify-start gap-2" onClick={onNextCase}>
          Volgende casus
          <ArrowRight size={16} />
        </Button>
      </div>
    );
  }

  return (
    <>
      <AlertDialog open={rejectConfirmOpen} onOpenChange={setRejectConfirmOpen}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground space-y-2">
              <span className="block">Afwijzen is definitief voor dit verzoek.</span>
              {strongMatchNudge && (
                <span className="block text-amber-200/90">Hoge urgentie — controleer of afwijzen passend is.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                void executeReject();
              }}
            >
              {submitting ? <Loader2 className="animate-spin size-4" /> : "Ja, afwijzen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div
        className="rounded-xl border border-border/80 bg-card/40 overflow-hidden shadow-sm"
        aria-busy={submitting}
      >
        <div className="border-b border-border/60 px-4 py-4 sm:px-5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {formatClientReference(caseItem.id)}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {maskParticipantIdentity(caseItem.title?.trim() || caseItem.id)} · {caseItem.regio} · {urgencyLabel(caseItem.urgency)} · {caseItem.wachttijd}d · {caseItem.zorgtype}
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Jouw besluit: acceptatie {"->"} gemeenteplaatsing; afwijzing {"->"} hermatching.
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Identiteit blijft afgeschermd tot geautoriseerde fase-overgang; reveal wordt auditbaar vastgelegd.
          </p>
        </div>

        <div
          className={cn(
            "sticky z-20 border-b border-border/70 px-4 py-3 sm:px-5",
            "bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85",
          )}
          style={{ top: tokens.layout.edgeZero }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={panelMode === "idle" ? "default" : panelMode === "accept" ? "outline" : "ghost"}
              size={panelMode === "idle" ? "lg" : "default"}
              className={cn(
                "gap-2",
                panelMode === "idle" && "shadow-sm",
                panelMode === "accept" && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background border-primary/35",
                panelMode === "reject" && "h-10 px-3 text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setPanelMode("accept")}
              disabled={submitting}
            >
              <CheckCircle2 size={18} />
              Accepteren
            </Button>
            <Button
              type="button"
              variant={panelMode === "idle" ? "outline" : panelMode === "reject" ? "outline" : "ghost"}
              size="default"
              className={cn(
                "h-10 gap-2",
                panelMode === "idle" &&
                  "border-destructive/25 text-destructive hover:bg-destructive/10 hover:text-destructive",
                panelMode === "accept" && "text-destructive/85 hover:bg-destructive/10 hover:text-destructive",
                panelMode === "reject" &&
                  "border-destructive/30 text-destructive ring-2 ring-destructive/20 ring-offset-2 ring-offset-background hover:bg-destructive/10",
              )}
              onClick={() => setPanelMode("reject")}
              disabled={submitting}
            >
              <XCircle size={18} />
              Afwijzen
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 font-normal text-muted-foreground hover:text-foreground"
              onClick={onRequestInfo}
            >
              <MessageSquare size={14} className="shrink-0 opacity-80" />
              Meer informatie vragen
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 gap-1 font-normal text-muted-foreground hover:text-foreground"
              onClick={() => onCaseClick(caseItem.id)}
            >
              Open casus
              <ArrowRight size={12} className="shrink-0 opacity-80" />
            </Button>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-5 space-y-4">
          {panelMode === "idle" && (
            <p className="text-sm text-muted-foreground" data-testid="provider-review-idle-hint">
              Kies accepteren of afwijzen.
            </p>
          )}
          {panelMode === "accept" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/5 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  Capaciteit (indicatie)
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["vol", "beperkt", "beschikbaar"] as const).map((key) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={capacitySignal === key ? "default" : "outline"}
                      className="h-9 text-xs"
                      onClick={() => setCapacitySignal(key)}
                    >
                      {key === "vol" && "Vol"}
                      {key === "beperkt" && "Beperkt"}
                      {key === "beschikbaar" && "Beschikbaar"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`cap-${caseItem.id}`}
                    checked={confirmCapacity}
                    onCheckedChange={v => setConfirmCapacity(v === true)}
                  />
                  <Label htmlFor={`cap-${caseItem.id}`} className="text-sm font-normal leading-snug cursor-pointer">
                    Capaciteit beschikbaar
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`intake-${caseItem.id}`}
                    checked={confirmIntake}
                    onCheckedChange={v => setConfirmIntake(v === true)}
                  />
                  <Label htmlFor={`intake-${caseItem.id}`} className="text-sm font-normal leading-snug cursor-pointer">
                    Intake mogelijk binnen termijn
                  </Label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`start-${caseItem.id}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Startdatum
                </Label>
                <input
                  id={`start-${caseItem.id}`}
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                  style={{ maxWidth: tokens.layout.dialogContentMaxWidth }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`acc-rm-${caseItem.id}`} className="text-xs text-muted-foreground">
                  Opmerking (optioneel)
                </Label>
                <textarea
                  id={`acc-rm-${caseItem.id}`}
                  value={acceptRemark}
                  onChange={e => setAcceptRemark(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground"
                  placeholder="Bijv. afstemming met team ..."
                />
              </div>
              <Button
                variant="default"
                size="lg"
                className="h-11 w-full justify-center gap-2 sm:w-auto sm:min-w-[14rem] sm:justify-start"
                disabled={!acceptFormValid || submitting}
                onClick={() => void handleSubmitAccept()}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                Bevestig acceptatie
                <ArrowRight size={16} />
              </Button>
            </div>
          )}

          {panelMode === "reject" && (
            <div className="space-y-4">
              <RadioGroup
                value={rejectCode || undefined}
                onValueChange={v => setRejectCode(v as RejectionReasonCode)}
                className="space-y-2"
              >
                {STRUCTURED_REJECTION_OPTIONS.map(opt => (
                  <div key={opt.code} className="flex items-start gap-3">
                    <RadioGroupItem value={opt.code} id={`${caseItem.id}-${opt.code}`} className="mt-1" />
                    <Label htmlFor={`${caseItem.id}-${opt.code}`} className="font-normal cursor-pointer leading-snug">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {rejectCode === "andere_reden" && (
                <div className="space-y-1.5 pl-1">
                  <Label className="text-xs text-muted-foreground">Toelichting bij &apos;Anders&apos;</Label>
                  <input
                    type="text"
                    value={rejectAndersDetail}
                    onChange={e => setRejectAndersDetail(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                    placeholder="Korte specificatie..."
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor={`rej-comm-${caseItem.id}`} className="text-xs font-semibold text-muted-foreground">
                  Toelichting <span className="text-red-400">*</span>
                </Label>
                <textarea
                  id={`rej-comm-${caseItem.id}`}
                  value={rejectComment}
                  onChange={e => setRejectComment(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 resize-none"
                  placeholder="Leg kort uit wat dit betekent voor planning en matching..."
                />
                {rejectComment.length > 0 && rejectComment.trim().length < 10 && (
                  <p className="text-xs text-red-400">Minimaal 10 tekens — anders is de feedback niet bruikbaar.</p>
                )}
              </div>

              <Button
                variant="destructive"
                size="lg"
                className="h-11 w-full justify-center gap-2 sm:w-auto sm:min-w-[14rem] sm:justify-start"
                disabled={!rejectFormValid || submitting}
                onClick={() => setRejectConfirmOpen(true)}
              >
                Bevestig afwijzing
                <ArrowRight size={16} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Zorgaanbieder view (decision) ────────────────────────────────────────────

interface ProviderViewProps {
  cases: SpaCase[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onCaseClick: (caseId: string) => void;
  onNavigateToCasussen?: () => void;
  submitDecision: (caseId: string, payload: EvaluationDecisionPayload) => Promise<void>;
  submitting: boolean;
  submitError: string | null;
  clearSubmitError: () => void;
}

function ProviderView({
  cases,
  loading,
  error,
  refetch,
  searchQuery,
  onSearchChange,
  onCaseClick,
  onNavigateToCasussen,
  submitDecision,
  submitting,
  submitError,
  clearSubmitError,
}: ProviderViewProps) {
  const [decisionModal, setDecisionModal] = useState<DecisionModalState>(null);
  const [acceptedCaseIds, setAcceptedCaseIds] = useState<Set<string>>(new Set());
  const [rejectedCaseIds, setRejectedCaseIds] = useState<Set<string>>(new Set());
  const [focusToken, setFocusToken] = useState(0);

  const pendingCasesAll = useMemo(
    () => cases.filter(c => c.status === "provider_beoordeling"),
    [cases],
  );

  const pendingCases = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return pendingCasesAll.filter(c => {
      if (!query) return true;
      return [c.id, c.title, c.regio].join(" ").toLowerCase().includes(query);
    });
  }, [pendingCasesAll, searchQuery]);

  const activeQueue = useMemo(
    () => pendingCases.filter(c => !acceptedCaseIds.has(c.id) && !rejectedCaseIds.has(c.id)),
    [pendingCases, acceptedCaseIds, rejectedCaseIds],
  );
  const doneCases = useMemo(() => {
    const ids = [...acceptedCaseIds, ...rejectedCaseIds].filter(id =>
      pendingCases.some(c => c.id === id),
    );
    return pendingCases.filter(c => ids.includes(c.id));
  }, [pendingCases, acceptedCaseIds, rejectedCaseIds]);

  const handleNextCase = () => {
    setFocusToken(t => t + 1);
  };

  return (
    <>
      {decisionModal?.type === "info_request" && (
        <InfoRequestModal
          caseId={decisionModal.caseId}
          onClose={() => setDecisionModal(null)}
          onConfirm={(payload) => submitDecision(decisionModal.caseId, payload)}
          submitting={submitting}
        />
      )}

      <CarePageScaffold
        archetype="worklist"
        className="pb-8"
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Aanbieder beoordeling
            <CareInfoPopover ariaLabel="Uitleg aanbieder beoordeling" testId="aanbieder-beoordeling-zorg-page-info">
              <p className="text-muted-foreground">
                Je beoordeelt een gemeenteverzoek — kies accepteren of afwijzen; meer info blijft mogelijk.
              </p>
            </CareInfoPopover>
          </span>
        }
        dominantAction={
          <CareAttentionBar
            tone={activeQueue.length > 0 ? "warning" : "info"}
            icon={<Clock size={16} />}
            message={
              activeQueue.length > 0
                ? activeQueue.length === 1
                  ? "1 casus wacht op jouw beoordeling"
                  : `${activeQueue.length} casussen wachten op jouw beoordeling`
                : "Geen openstaande beoordeling"
            }
            action={onNavigateToCasussen ? <PrimaryActionButton onClick={onNavigateToCasussen}>Naar casussen</PrimaryActionButton> : undefined}
          />
        }
        metric={
          <CareMetricBadge>
            {activeQueue.length} open
            {activeQueue.length > 0
              ? ` · gem. ${Math.round(activeQueue.reduce((sum, c) => sum + c.wachttijd, 0) / activeQueue.length)}d in wachtrij`
              : ""}
          </CareMetricBadge>
        }
        filters={
          <CareSearchFiltersBar
            searchValue={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder="Zoek op casus-ID, regio..."
          />
        }
      >
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3"
          >
            <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-foreground">{submitError}</p>
            </div>
            <button type="button" onClick={clearSubmitError} className="text-muted-foreground hover:text-foreground">
              <XCircle size={16} />
            </button>
          </div>
        )}

        {submitting && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground"
          >
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            <span>Beoordeling wordt verzonden…</span>
          </div>
        )}

        {loading && (
          <LoadingState title="Casussen laden…" copy="Even geduld — je wachtrij met beoordelingsverzoeken wordt opgehaald." />
        )}

        {!loading && error && (
          <ErrorState title="Laden mislukt" copy={error} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
        )}

        {!loading && !error && pendingCasesAll.length === 0 && (
          <EmptyState
            title="Geen openstaande verzoeken"
            copy="Nieuwe casusverzoeken van gemeenten verschijnen hier zodra een casus naar jouw aanbieder is verzonden."
            action={onNavigateToCasussen ? <Button variant="outline" onClick={onNavigateToCasussen}>Bekijk mijn casussen</Button> : undefined}
          />
        )}

        {!loading && !error && pendingCasesAll.length > 0 && pendingCases.length === 0 && searchQuery.trim() !== "" && (
          <EmptyState
            title="Geen casussen gevonden"
            copy="Geen openstaande beoordeling past bij je zoekopdracht. Pas de zoekterm aan of wis het veld."
            action={<Button variant="outline" onClick={() => onSearchChange("")}>Wis zoekopdracht</Button>}
          />
        )}

        {!loading && !error && pendingCases.length > 0 && (
          <div className="space-y-8">
            {activeQueue.length > 0 && (
              <section className="space-y-3" key={focusToken} data-testid="provider-beoordeling-actieve-sectie">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Actieve beoordeling
                </p>
                <ProviderReviewCaseCard
                  caseItem={activeQueue[0]}
                  submitting={submitting}
                  submitDecision={submitDecision}
                  onCaseClick={onCaseClick}
                  onRequestInfo={() => setDecisionModal({ type: "info_request", caseId: activeQueue[0].id })}
                  outcome={null}
                  onOutcome={(type, caseId) => {
                    if (type === "accepted") {
                      setAcceptedCaseIds(prev => new Set([...prev, caseId]));
                    } else {
                      setRejectedCaseIds(prev => new Set([...prev, caseId]));
                    }
                  }}
                  onNextCase={handleNextCase}
                />
              </section>
            )}

            {activeQueue.length === 0 && doneCases.length > 0 && (
              <EmptyState
                title="Wachtrij afgerond"
                copy="Alle openstaande beoordelingen in dit overzicht zijn verwerkt."
                action={onNavigateToCasussen ? <Button variant="outline" onClick={onNavigateToCasussen}>Bekijk mijn casussen</Button> : undefined}
              />
            )}

            {doneCases.length > 0 && (
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Verwerkte casussen (dit overzicht)
                </p>
                <div className="space-y-3">
                  {doneCases.map(c => (
                    <ProviderReviewCaseCard
                      key={c.id}
                      caseItem={c}
                      submitting={false}
                      submitDecision={submitDecision}
                      onCaseClick={onCaseClick}
                      onRequestInfo={() => setDecisionModal({ type: "info_request", caseId: c.id })}
                      outcome={acceptedCaseIds.has(c.id) ? "accepted" : "rejected"}
                      onOutcome={() => { /* read-only success state */ }}
                      onNextCase={handleNextCase}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </CarePageScaffold>
    </>
  );
}

// ─── Root component (role dispatcher) ─────────────────────────────────────────

export function AanbiederBeoordelingPage({
  role,
  onCaseClick,
  onNavigateToMatching,
  onNavigateToPlaatsingen,
  onNavigateToCasussen,
}: AanbiederBeoordelingPageProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { cases, loading, error, refetch } = useCases({ q: "" });
  const {
    submitDecision: postEvaluationDecision,
    submitting,
    submitError,
    clearSubmitError,
  } = useProviderEvaluations();

  const submitDecisionWithCasesRefresh = useCallback(
    async (caseId: string, payload: EvaluationDecisionPayload) => {
      await postEvaluationDecision(caseId, payload);
      refetch();
    },
    [postEvaluationDecision, refetch],
  );

  // Gemeente: monitoring view — no decision authority
  if (role === "gemeente" || role === "admin") {
    return (
      <GemeenteView
        cases={cases}
        loading={loading}
        error={error}
        refetch={refetch}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCaseClick={onCaseClick}
        onNavigateToMatching={onNavigateToMatching}
        onNavigateToPlaatsingen={onNavigateToPlaatsingen}
        onNavigateToCasussen={onNavigateToCasussen}
      />
    );
  }

  // Zorgaanbieder: decision view — accept / reject / info-request
  return (
    <ProviderView
      cases={cases}
      loading={loading}
      error={error}
      refetch={refetch}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onCaseClick={onCaseClick}
      onNavigateToCasussen={onNavigateToCasussen}
      submitDecision={submitDecisionWithCasesRefresh}
      submitting={submitting}
      submitError={submitError}
      clearSubmitError={clearSubmitError}
    />
  );
}
