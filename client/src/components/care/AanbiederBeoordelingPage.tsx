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

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  FileQuestion,
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
  EvaluationStatus,
  InfoRequestType,
  ProviderEvaluation,
  RejectionReasonCode,
} from "../../hooks/useProviderEvaluations";
import {
  INFO_REQUEST_TYPE_LABELS,
  REJECTION_REASON_LABELS,
} from "../../hooks/useProviderEvaluations";
import { apiClient } from "../../lib/apiClient";
import type { SpaCase } from "../../hooks/useCases";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = "gemeente" | "zorgaanbieder" | "admin";

type DecisionModalState = { type: "info_request"; caseId: string } | null;

type CapacitySignal = "vol" | "beperkt" | "beschikbaar";

type PanelMode = "idle" | "accept" | "reject";

type PlacementEvidence = {
  providerResponseStatus: string;
  providerResponseReasonCode: string;
  decisionNotes: string;
  providerResponseNotes: string;
};

function parseInfoRequestFromProviderNotes(raw: string): { typeSlug: string | null; body: string } {
  const t = raw.trim();
  const m = /^\[INFO_TYPE:([^\]]+)]\s*\n?(.*)$/s.exec(t);
  if (m) {
    return { typeSlug: m[1].trim().toLowerCase(), body: (m[2] || "").trim() };
  }
  return { typeSlug: null, body: t };
}

function placementEvidenceIsVisible(p: PlacementEvidence | null): boolean {
  if (!p) return false;
  const st = (p.providerResponseStatus || "").trim().toUpperCase();
  if (st === "NEEDS_INFO") return true;
  if (st && st !== "PENDING") return true;
  const code = (p.providerResponseReasonCode || "").trim();
  if (code && code.toUpperCase() !== "NONE") return true;
  return Boolean((p.decisionNotes || "").trim());
}

function placementEvidenceTone(p: PlacementEvidence): "warning" | "info" | "critical" {
  const st = (p.providerResponseStatus || "").trim().toUpperCase();
  if (st === "REJECTED") return "warning";
  if (st === "NEEDS_INFO") return "info";
  if (st === "NO_CAPACITY" || st === "WAITLIST") return "critical";
  return "info";
}

function formatPlacementEvidenceLine(p: PlacementEvidence): string {
  const st = (p.providerResponseStatus || "").trim().toUpperCase();
  const prNotes = (p.providerResponseNotes || "").trim();

  if (st === "NEEDS_INFO") {
    const parts: string[] = ["Aanbieder vraagt aanvullende informatie"];
    if (prNotes) {
      const { typeSlug, body } = parseInfoRequestFromProviderNotes(prNotes);
      const typeLab =
        typeSlug && typeSlug in INFO_REQUEST_TYPE_LABELS
          ? INFO_REQUEST_TYPE_LABELS[typeSlug as InfoRequestType]
          : typeSlug;
      if (typeLab) parts.push(`type: ${typeLab}`);
      if (body) parts.push(body.length > 120 ? `${body.slice(0, 120)}…` : body);
    }
    const core = parts.join(" · ");
    return core ? `${core} — volledige audit in casusdossier / tijdlijn.` : "Aanvullende informatie gevraagd — zie dossier en tijdlijn voor audit.";
  }

  const parts: string[] = [];
  const code = (p.providerResponseReasonCode || "").trim();
  const stDisp = (p.providerResponseStatus || "").trim();
  if (code && code.toUpperCase() !== "NONE") {
    parts.push(`Redencode: ${code}`);
  } else if (stDisp && stDisp.toUpperCase() !== "PENDING") {
    parts.push(`Status: ${stDisp}`);
  }
  const notes = (p.decisionNotes || "").trim();
  if (notes) {
    parts.push(notes.length > 160 ? `${notes.slice(0, 160)}…` : notes);
  }
  const core = parts.join(" · ");
  return core ? `${core} — volledige audit in casusdossier / tijdlijn.` : "Registratie op plaatsing — zie dossier en tijdlijn voor audit.";
}

function usePlacementEvidenceForCase(caseId: string | undefined): PlacementEvidence | null {
  const [evidence, setEvidence] = useState<PlacementEvidence | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!caseId) {
      setEvidence(null);
      return;
    }
    apiClient
      .get<{
        placement?: {
          providerResponseStatus?: string;
          providerResponseReasonCode?: string;
          decisionNotes?: string;
          providerResponseNotes?: string;
        };
      }>(`/care/api/cases/${caseId}/placement-detail/`)
      .then((body) => {
        if (cancelled) return;
        const p = body.placement;
        if (!p || typeof p !== "object" || Object.keys(p).length === 0) {
          setEvidence(null);
          return;
        }
        setEvidence({
          providerResponseStatus: String(p.providerResponseStatus ?? ""),
          providerResponseReasonCode: String(p.providerResponseReasonCode ?? ""),
          decisionNotes: String(p.decisionNotes ?? ""),
          providerResponseNotes: String(p.providerResponseNotes ?? ""),
        });
      })
      .catch(() => {
        if (!cancelled) setEvidence(null);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return placementEvidenceIsVisible(evidence) ? evidence : null;
}

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

function formatNlDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

const EVALUATION_STATUS_LABELS: Record<EvaluationStatus, string> = {
  PENDING: "Wacht op reactie",
  ACCEPTED: "Geaccepteerd",
  REJECTED: "Afgewezen",
  INFO_REQUESTED: "Aanvullende informatie gevraagd",
  CANCELLED: "Geannuleerd",
  SUPERSEDED: "Vervangen",
};

/** True when the zorgaanbieder has submitted a decision recorded on the evaluation row. */
function providerEvaluationActionComplete(ev: ProviderEvaluation | undefined): boolean {
  if (!ev) return false;
  return (
    ev.status === "ACCEPTED"
    || ev.status === "REJECTED"
    || ev.status === "INFO_REQUESTED"
    || ev.status === "CANCELLED"
    || ev.status === "SUPERSEDED"
  );
}

function buildEvaluationMap(rows: ProviderEvaluation[]): Map<string, ProviderEvaluation> {
  const m = new Map<string, ProviderEvaluation>();
  for (const row of rows) {
    if (row.caseId) m.set(row.caseId, row);
  }
  return m;
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

/** Compact read-model line for provider handoff (gemeente + instroom + aanmeldercontext). */
function formatProviderHandoffLine(ev: ProviderEvaluation | null | undefined): string | null {
  if (!ev) return null;
  const parts: string[] = [];
  if (ev.municipalityName?.trim()) {
    parts.push(`Gemeente: ${ev.municipalityName.trim()}`);
  }
  if (ev.entryRouteLabel?.trim()) {
    parts.push(`Instroom: ${ev.entryRouteLabel.trim()}`);
  }
  const prof = ev.aanmelderActorProfile?.trim();
  if (prof && prof !== "ONBEKEND" && ev.aanmelderActorProfileLabel?.trim()) {
    parts.push(`Aanmeldercontext: ${ev.aanmelderActorProfileLabel.trim()}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

const PROVIDER_WHY_US_INTRO =
  "Deze aanvraag is na gemeentelijke validatie en matching bij jullie neergelegd — onderstaande context ondersteunt je reactie (geen automatische toewijzing).";

const PROVIDER_MATCH_ADVISORY_FOOTNOTE =
  "Geen automatische toewijzing; score en fit zijn indicatief.";

/** Context block: keten-handoff + advisory matching/arrangement (row 6 “why us”). */
function ProviderReviewWhyUsBlock({ evaluation }: { evaluation: ProviderEvaluation | null | undefined }) {
  const handoffLine = formatProviderHandoffLine(evaluation);
  const hasMatch = Boolean(evaluation?.matchFitSummary?.trim());
  const hasArrangement = Boolean(evaluation?.arrangementHintLine?.trim());
  const hasCoordinator = Boolean(evaluation?.caseCoordinatorLabel?.trim());
  if (!handoffLine && !hasMatch && !hasArrangement && !hasCoordinator) {
    return null;
  }

  return (
    <div
      className="mt-2 space-y-1.5 rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5"
      data-testid="provider-review-why-us-block"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground/85">
        Waarom deze aanvraag bij jullie ligt
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">{PROVIDER_WHY_US_INTRO}</p>
      {handoffLine ? (
        <p
          className="text-[11px] text-muted-foreground leading-snug"
          data-testid="provider-review-handoff-context"
        >
          {handoffLine}
        </p>
      ) : null}
      {hasMatch ? (
        <p
          className="text-[11px] text-muted-foreground leading-snug"
          data-testid="provider-review-match-hint"
        >
          <span className="font-medium text-foreground/80">Advies match: </span>
          {evaluation!.matchFitSummary!.trim()}
          {evaluation?.matchTradeOffsHint?.trim() ? ` · ${evaluation.matchTradeOffsHint.trim()}` : ""}
          {evaluation?.matchScore != null ? ` · Score-indicator: ${evaluation.matchScore}` : ""}
          <span className="block mt-0.5 text-[10px] text-muted-foreground/90">{PROVIDER_MATCH_ADVISORY_FOOTNOTE}</span>
        </p>
      ) : null}
      {hasArrangement ? (
        <div className="space-y-0.5" data-testid="provider-review-arrangement-block">
          <p className="text-[11px] text-muted-foreground leading-snug" data-testid="provider-review-arrangement-hint">
            {evaluation!.arrangementHintLine!.trim()}
          </p>
          <p
            className="text-[10px] text-muted-foreground/90 leading-snug"
            data-testid="provider-review-arrangement-disclaimer"
          >
            {evaluation?.arrangementHintDisclaimer?.trim() ||
              "Indicatief arrangement — geen budget- of tarieftoezegging."}
          </p>
        </div>
      ) : null}
      {hasCoordinator ? (
        <p className="text-[11px] text-muted-foreground" data-testid="provider-review-coordinator-hint">
          Casusregisseur (gemeente): {evaluation!.caseCoordinatorLabel!.trim()}
        </p>
      ) : null}
    </div>
  );
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
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      data-testid="provider-info-request-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="provider-info-request-title"
    >
      <div className="w-full rounded-2xl border border-border bg-card shadow-xl" style={{ maxWidth: tokens.layout.dialogNarrowMaxWidth }}>
        <div className="flex items-start gap-3 border-b border-border px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-500/25 bg-blue-500/10">
            <FileQuestion className="text-blue-400" size={20} />
          </div>
          <div>
            <p id="provider-info-request-title" className="font-semibold text-foreground">Meer informatie vragen</p>
            <p className="text-sm text-muted-foreground mt-0.5">Casus <span className="font-medium text-foreground">{caseId}</span></p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Type informatie <span className="text-primary">*</span>
            </label>
            <select
              data-testid="provider-info-request-type"
              aria-label="Type informatie"
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
              data-testid="provider-info-request-comment"
              aria-label="Vraag of toelichting"
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
          <Button variant="outline" data-testid="provider-info-request-cancel" onClick={onClose} disabled={submitting}>
            Annuleren
          </Button>
          <Button
            className="gap-2"
            data-testid="provider-info-request-submit"
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
  refetchEvaluations: () => void;
  evaluationByCaseId: Map<string, ProviderEvaluation>;
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
    actionLabel: "Bekijk reactie",
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

function evaluationToGemeenteRows(ev: ProviderEvaluation): ProviderInviteRow[] {
  const statusKind: ProviderInviteRow["statusKind"] =
    ev.status === "REJECTED"
      ? "rejected"
      : ev.status === "ACCEPTED" || ev.status === "INFO_REQUESTED"
        ? "received"
        : "waiting";

  const statusLabel = EVALUATION_STATUS_LABELS[ev.status] ?? ev.status;
  const parts: string[] = [];
  if (ev.rejectionReasonCode) {
    const lab = REJECTION_REASON_LABELS[ev.rejectionReasonCode];
    if (lab) {
      parts.push(`${lab} (redencode: ${ev.rejectionReasonCode})`);
    } else {
      parts.push(`Redencode: ${ev.rejectionReasonCode}`);
    }
  }
  if (ev.informationRequestType) {
    const t = INFO_REQUEST_TYPE_LABELS[ev.informationRequestType];
    if (t) {
      parts.push(`${t} (type-code: ${ev.informationRequestType})`);
    } else {
      parts.push(`type-code: ${ev.informationRequestType}`);
    }
  }
  let responseText: string;
  if (ev.status === "INFO_REQUESTED" && (parts.length > 0 || Boolean(ev.informationRequestComment?.trim()))) {
    const core = parts.length > 0 ? parts.join(" · ") : "Aanvullende informatie gevraagd";
    const tail = (ev.informationRequestComment && ev.informationRequestComment.trim()) || "";
    responseText = tail ? `${core} — ${tail}` : core;
  } else {
    responseText =
      (ev.providerComment && ev.providerComment.trim())
      || (ev.informationRequestComment && ev.informationRequestComment.trim())
      || (parts.length ? parts.join(" · ") : "— Nog geen reactie");
  }

  const responded = formatNlDateTime(ev.respondedAt);
  const requested = formatNlDateTime(ev.requestedAt);
  const statusMeta = responded
    ? `Ontvangen ${responded}`
    : requested
      ? `Uitgenodigd ${requested}`
      : `${ev.daysPending} dagen sinds verzoek`;

  return [
    {
      id: `eval-${ev.id}`,
      name: (ev.providerName || "").trim() || "Aanbieder",
      distanceKm: "—",
      city: ev.region || "—",
      tags:
        [ev.careType, ev.clientLabel, ev.municipalityName?.trim()]
          .filter(Boolean)
          .join(" · ") || "—",
      statusKind,
      statusLabel,
      statusMeta,
      response: responseText,
      fitLabel: ev.matchScore != null ? "Matchscore" : "—",
      fitPct: ev.matchScore,
      actionLabel: "Open casus",
      logo: <User size={20} className="text-muted-foreground" aria-hidden />,
    },
  ];
}

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
    { id: "aanbieder", label: "Reacties", state: "current" as const },
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
  refetchEvaluations,
  evaluationByCaseId,
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
      const ev = evaluationByCaseId.get(c.id);
      const hay = [c.id, c.title, c.regio, ev?.clientLabel, ev?.providerName, ev?.caseTitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [reviewCasesAll, searchQuery, evaluationByCaseId]);

  const focusCase = reviewCases[0] ?? reviewCasesAll[0];
  const focusEvaluation = focusCase ? evaluationByCaseId.get(focusCase.id) : undefined;

  const gemeenteProviderTableRows = useMemo(() => {
    if (focusEvaluation) return evaluationToGemeenteRows(focusEvaluation);
    return GEMEENTE_INVITED_PROVIDER_ROWS;
  }, [focusEvaluation]);

  const dominantActionDeadlineText = useMemo(() => {
    const d = formatNlDateTime(focusEvaluation?.slaDeadlineAt);
    if (d) {
      return `Wacht op reactie van aanbieders. Reactietermijn (registratie): ${d}. Herinner bij overschrijding.`;
    }
    return "Wacht op reactie van aanbieders. Zij beoordelen of de casus past bij capaciteit en inhoud. Herinner bij overschrijding van de reactietermijn.";
  }, [focusEvaluation?.slaDeadlineAt]);
  // `displayCaseId` only resolves inside `showMainGrid` contexts where `focusCase` is guaranteed,
  // so the empty-string fallback is defensive and never user-visible.
  const displayCaseId = focusCase?.id ?? "";
  const hasPhaseCases = reviewCasesAll.length > 0;
  const showMainGrid = !loading && !error && reviewCases.length > 0;
  const placementEvidence = usePlacementEvidenceForCase(focusCase?.id);

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
              Reacties
              <CareInfoPopover ariaLabel="Uitleg reacties" testId="aanbieder-beoordeling-page-info">
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    Volg reacties van zorgaanbieders op deze aanvraag — beslissing ligt bij de aanbieder. Herinner bij
                    overschrijding van de reactietermijn.
                  </p>
                  <p>Status en termijn per uitgenodigde aanbieder op één plek.</p>
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
                Fase: Reacties aanbieder
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
                <Button type="button" variant="outline" onClick={() => { void refetch(); void refetchEvaluations(); }} className="gap-2">
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
                description={dominantActionDeadlineText}
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
              <CareFilterTabGroup aria-label="Weergave reacties">
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
            <LoadingState title="Aanvragen laden…" copy="Even geduld — de aanvraag en aanbieders worden opgehaald." />
          )}

          {!loading && error && (
            <ErrorState
              title="Laden mislukt"
              copy={error}
              action={<Button variant="outline" onClick={() => { void refetch(); void refetchEvaluations(); }}>Opnieuw</Button>}
            />
          )}

          {!loading && !error && reviewCasesAll.length === 0 && (
            <div className="space-y-3">
              <CareAttentionBar
                tone="info"
                icon={<Info size={16} aria-hidden />}
                message="Reacties verschijnen pas na gemeentelijke validatie van het matchvoorstel en verzending naar de aanbieder."
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
                title="Geen aanvragen in deze fase"
                copy="Er zijn nog geen aanvragen naar een aanbieder verzonden. Valideer eerst het voorstel of keer terug naar de werkvoorraad."
              />
            </div>
          )}

          {!loading && !error && reviewCasesAll.length > 0 && reviewCases.length === 0 && searchQuery.trim() !== "" && (
            <EmptyState
              title="Geen aanvragen gevonden"
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
                {placementEvidence && (
                  <div className="mb-4" data-testid="aanbieder-gemeente-placement-evidence">
                    <CareAttentionBar
                      tone={placementEvidenceTone(placementEvidence)}
                      icon={<FileText size={16} aria-hidden />}
                      message={formatPlacementEvidenceLine(placementEvidence)}
                    />
                  </div>
                )}
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
                        {gemeenteProviderTableRows.map((row) => (
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
  evaluation?: ProviderEvaluation | null;
  submitting: boolean;
  submitDecision: (caseId: string, payload: EvaluationDecisionPayload) => Promise<void>;
  onCaseClick: (caseId: string) => void;
  onRequestInfo: () => void;
  outcome: "accepted" | "rejected" | "info_requested" | "inactive" | null;
  onOutcome: (type: "accepted" | "rejected" | "info_requested", caseId: string) => void;
  onNextCase: () => void;
}

function ProviderReviewCaseCard({
  caseItem,
  evaluation,
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

  if (outcome === "inactive") {
    return (
      <div className="rounded-xl border border-border/70 bg-card/50 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Info className="text-muted-foreground shrink-0 mt-0.5" size={20} />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Niet meer actief</p>
            <p className="text-sm text-muted-foreground">Deze aanvraag staat niet meer open voor jouw reactie in dit overzicht.</p>
          </div>
        </div>
        <Button className="h-10 w-auto justify-start gap-2" variant="outline" onClick={onNextCase}>
          Volgende casus
          <ArrowRight size={16} />
        </Button>
      </div>
    );
  }

  if (outcome === "info_requested") {
    const slug = evaluation?.informationRequestType;
    const typeLab = slug ? INFO_REQUEST_TYPE_LABELS[slug] : undefined;
    const detail = (evaluation?.informationRequestComment || "").trim();
    const auditLine =
      typeLab && slug ? `${typeLab} (type-code: ${slug})` : slug ? `type-code: ${slug}` : null;
    return (
      <div
        className="rounded-xl border border-border/70 bg-card/50 p-4 space-y-3"
        data-testid="provider-info-requested-summary"
      >
        <div className="flex items-start gap-3">
          <MessageSquare className="text-primary shrink-0 mt-0.5" size={20} />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Aanvullende informatie gevraagd</p>
            <p className="text-sm text-muted-foreground">De gemeente verwerkt dit verzoek; jij hoeft hier niets meer te doen tot er een update is.</p>
            {auditLine ? (
              <p className="text-[12px] text-muted-foreground" data-testid="provider-info-requested-audit-line">
                {auditLine}
              </p>
            ) : null}
            {detail ? (
              <p className="text-[11px] leading-snug text-muted-foreground/90">
                {detail.length > 220 ? `${detail.slice(0, 220)}…` : detail}
              </p>
            ) : null}
          </div>
        </div>
        <Button className="h-10 w-auto justify-start gap-2" variant="outline" onClick={onNextCase}>
          Volgende casus
          <ArrowRight size={16} />
        </Button>
      </div>
    );
  }

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
    const rejCode = evaluation?.rejectionReasonCode;
    const rejLabel = rejCode ? REJECTION_REASON_LABELS[rejCode] : undefined;
    const rejNote = (evaluation?.providerComment || "").trim();
    const auditLine =
      rejLabel && rejCode
        ? `${rejLabel} (redencode: ${rejCode})`
        : rejCode
          ? `Redencode: ${rejCode}`
          : null;
    return (
      <div
        className="rounded-xl border border-border/70 bg-card/50 p-4 space-y-3"
        data-testid="provider-rejected-summary"
      >
        <div className="flex items-start gap-3">
          <XCircle className="text-destructive shrink-0 mt-0.5" size={20} />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Afgewezen</p>
            <p className="text-sm text-muted-foreground">Casus gaat terug naar matching.</p>
            {auditLine ? (
              <p className="text-[12px] text-muted-foreground" data-testid="provider-rejected-audit-line">
                {auditLine}
              </p>
            ) : null}
            {rejNote ? (
              <p className="text-[11px] leading-snug text-muted-foreground/90">
                {rejNote.length > 220 ? `${rejNote.slice(0, 220)}…` : rejNote}
              </p>
            ) : null}
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
          {evaluation && !outcome ? (
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
              <span className="font-medium text-foreground/90">{EVALUATION_STATUS_LABELS[evaluation.status]}</span>
              {formatNlDateTime(evaluation.slaDeadlineAt) ? (
                <> · Deadline {formatNlDateTime(evaluation.slaDeadlineAt)}</>
              ) : null}
              {evaluation.daysPending > 0 ? <> · {evaluation.daysPending}d sinds uitnodiging</> : null}
            </p>
          ) : null}
          <ProviderReviewWhyUsBlock evaluation={evaluation} />
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
            <div className="space-y-4" data-testid="provider-review-accept-panel">
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

function deriveProviderCardOutcome(
  caseId: string,
  evaluationByCaseId: Map<string, ProviderEvaluation>,
  acceptedCaseIds: Set<string>,
  rejectedCaseIds: Set<string>,
): "accepted" | "rejected" | "info_requested" | null {
  const ev = evaluationByCaseId.get(caseId);
  if (acceptedCaseIds.has(caseId) || ev?.status === "ACCEPTED") return "accepted";
  if (rejectedCaseIds.has(caseId) || ev?.status === "REJECTED") return "rejected";
  if (ev?.status === "INFO_REQUESTED") return "info_requested";
  if (ev?.status === "CANCELLED" || ev?.status === "SUPERSEDED") return "inactive";
  return null;
}

interface ProviderViewProps {
  cases: SpaCase[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  refetchEvaluations: () => void;
  evaluationByCaseId: Map<string, ProviderEvaluation>;
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
  refetchEvaluations,
  evaluationByCaseId,
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
      const ev = evaluationByCaseId.get(c.id);
      const hay = [c.id, c.title, c.regio, ev?.clientLabel, ev?.providerName, ev?.caseTitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [pendingCasesAll, searchQuery, evaluationByCaseId]);

  const activeQueue = useMemo(
    () =>
      pendingCases.filter(c => {
        if (acceptedCaseIds.has(c.id) || rejectedCaseIds.has(c.id)) return false;
        const ev = evaluationByCaseId.get(c.id);
        return !providerEvaluationActionComplete(ev);
      }),
    [pendingCases, acceptedCaseIds, rejectedCaseIds, evaluationByCaseId],
  );
  const activePlacementEvidence = usePlacementEvidenceForCase(activeQueue[0]?.id);
  const doneCases = useMemo(() => {
    const ids = [...acceptedCaseIds, ...rejectedCaseIds].filter(id =>
      pendingCases.some(c => c.id === id),
    );
    const localDone = pendingCases.filter(c => ids.includes(c.id));
    const apiDone = pendingCases.filter(c => providerEvaluationActionComplete(evaluationByCaseId.get(c.id)));
    const seen = new Set<string>();
    const merged: SpaCase[] = [];
    for (const c of [...apiDone, ...localDone]) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        merged.push(c);
      }
    }
    return merged;
  }, [pendingCases, acceptedCaseIds, rejectedCaseIds, evaluationByCaseId]);

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
        testId="aanbieder-beoordeling-zorgaanbieder-root"
        className="pb-8"
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Reacties
            <CareInfoPopover ariaLabel="Uitleg reacties" testId="aanbieder-beoordeling-zorg-page-info">
              <p className="text-muted-foreground">
                Je reageert op een aanmeldersverzoek — kies accepteren of afwijzen; meer info blijft mogelijk.
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
                  ? "1 aanvraag wacht op jouw reactie"
                  : `${activeQueue.length} aanvragen wachten op jouw reactie`
                : "Geen openstaande reacties"
            }
            action={onNavigateToCasussen ? <PrimaryActionButton onClick={onNavigateToCasussen}>Naar aanvragen</PrimaryActionButton> : undefined}
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
          <LoadingState title="Aanvragen laden…" copy="Even geduld — je wachtrij met reactieverzoeken wordt opgehaald." />
        )}

        {!loading && error && (
          <ErrorState
            title="Laden mislukt"
            copy={error}
            action={<Button variant="outline" onClick={() => { void refetch(); void refetchEvaluations(); }}>Opnieuw</Button>}
          />
        )}

        {!loading && !error && pendingCasesAll.length === 0 && (
          <EmptyState
            title="Geen openstaande verzoeken"
            copy="Nieuwe casusverzoeken van gemeenten verschijnen hier zodra een casus naar jouw aanbieder is verzonden."
            action={onNavigateToCasussen ? <Button variant="outline" onClick={onNavigateToCasussen}>Bekijk mijn aanvragen</Button> : undefined}
          />
        )}

        {!loading && !error && pendingCasesAll.length > 0 && pendingCases.length === 0 && searchQuery.trim() !== "" && (
          <EmptyState
            title="Geen aanvragen gevonden"
            copy="Geen openstaande reactie past bij je zoekopdracht. Pas de zoekterm aan of wis het veld."
            action={<Button variant="outline" onClick={() => onSearchChange("")}>Wis zoekopdracht</Button>}
          />
        )}

        {!loading && !error && pendingCases.length > 0 && (
          <div className="space-y-8">
            {activeQueue.length > 0 && (
              <section className="space-y-3" key={focusToken} data-testid="provider-beoordeling-actieve-sectie">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Actieve reactie
                </p>
                {activePlacementEvidence && (
                  <div data-testid="aanbieder-provider-placement-evidence">
                    <CareAttentionBar
                      tone={placementEvidenceTone(activePlacementEvidence)}
                      icon={<FileText size={16} aria-hidden />}
                      message={formatPlacementEvidenceLine(activePlacementEvidence)}
                    />
                  </div>
                )}
                <ProviderReviewCaseCard
                  caseItem={activeQueue[0]}
                  evaluation={evaluationByCaseId.get(activeQueue[0].id)}
                  submitting={submitting}
                  submitDecision={submitDecision}
                  onCaseClick={onCaseClick}
                  onRequestInfo={() => setDecisionModal({ type: "info_request", caseId: activeQueue[0].id })}
                  outcome={null}
                  onOutcome={(type, caseId) => {
                    if (type === "accepted") {
                      setAcceptedCaseIds(prev => new Set([...prev, caseId]));
                    } else if (type === "rejected") {
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
                copy="Alle openstaande reacties in dit overzicht zijn verwerkt."
                action={onNavigateToCasussen ? <Button variant="outline" onClick={onNavigateToCasussen}>Bekijk mijn aanvragen</Button> : undefined}
              />
            )}

            {doneCases.length > 0 && (
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Verwerkte aanvragen (dit overzicht)
                </p>
                <div className="space-y-3">
                  {doneCases.map(c => (
                    <ProviderReviewCaseCard
                      key={c.id}
                      caseItem={c}
                      evaluation={evaluationByCaseId.get(c.id)}
                      submitting={false}
                      submitDecision={submitDecision}
                      onCaseClick={onCaseClick}
                      onRequestInfo={() => setDecisionModal({ type: "info_request", caseId: c.id })}
                      outcome={deriveProviderCardOutcome(c.id, evaluationByCaseId, acceptedCaseIds, rejectedCaseIds)}
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
    evaluations,
    submitDecision: postEvaluationDecision,
    submitting,
    submitError,
    clearSubmitError,
    refetch: refetchEvaluations,
  } = useProviderEvaluations();

  const evaluationByCaseId = useMemo(() => buildEvaluationMap(evaluations), [evaluations]);

  const submitDecisionWithCasesRefresh = useCallback(
    async (caseId: string, payload: EvaluationDecisionPayload) => {
      await postEvaluationDecision(caseId, payload);
      refetch();
      refetchEvaluations();
    },
    [postEvaluationDecision, refetch, refetchEvaluations],
  );

  // Gemeente: monitoring view — no decision authority
  if (role === "gemeente" || role === "admin") {
    return (
      <GemeenteView
        cases={cases}
        loading={loading}
        error={error}
        refetch={refetch}
        refetchEvaluations={refetchEvaluations}
        evaluationByCaseId={evaluationByCaseId}
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
      refetchEvaluations={refetchEvaluations}
      evaluationByCaseId={evaluationByCaseId}
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
