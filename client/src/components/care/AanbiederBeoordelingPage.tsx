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
 *   - Structure: header → sticky decision (accept/reject) → risk & fit → summary → mandatory form.
 *   - Rejection without structured reason + toelichting is blocked (min. 10 tekens).
 *   - Accept records capacity indicator, checkboxes, startdatum, optional opmerking in provider_comment.
 *   - Soft confirmation on reject when urgentie hoog; "Meer info" remains via modal.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileQuestion,
  Loader2,
  MessageSquare,
  XCircle,
} from "lucide-react";
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
import { cn } from "../ui/utils";
import { CareEmptyState } from "./CareSurface";
import { CarePageScaffold } from "./CarePageScaffold";
import {
  CareDominantStatus,
  CareMetricBadge,
  CareMetaChip,
  CarePrimaryList,
  CareSearchFiltersBar,
  CareWorkRow,
} from "./CareUnifiedPage";
import { useCases } from "../../hooks/useCases";
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

function deriveStatusFromCase(caseItem: SpaCase): {
  label: string;
  colorClass: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
} {
  switch (caseItem.status) {
    case "provider_beoordeling":
      return { label: "Aanbieder beoordeling", colorClass: "text-amber-400", icon: Clock };
    case "plaatsing":
      return { label: "Geaccepteerd", colorClass: "text-green-400", icon: CheckCircle2 };
    case "afgerond":
      return { label: "Geaccepteerd", colorClass: "text-green-400", icon: CheckCircle2 };
    default:
      return { label: "Aanbieder beoordeling", colorClass: "text-amber-400", icon: Clock };
  }
}

function urgencyBadgeClass(urgency: SpaCase["urgency"]): string {
  switch (urgency) {
    case "critical": return "bg-red-500/15 text-red-300 border border-red-500/25";
    case "warning":  return "bg-amber-500/15 text-amber-300 border border-amber-500/25";
    case "normal":   return "bg-blue-500/15 text-blue-300 border border-blue-500/25";
    default:         return "bg-muted/40 text-muted-foreground border border-border";
  }
}

function urgencyLabel(urgency: SpaCase["urgency"]): string {
  switch (urgency) {
    case "critical": return "Kritiek";
    case "warning":  return "Hoog";
    case "normal":   return "Normaal";
    default:         return "Laag";
  }
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
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start gap-3 border-b border-border px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-500/25 bg-blue-500/10">
            <FileQuestion className="text-blue-400" size={20} />
          </div>
          <div>
            <p className="font-semibold text-foreground">Meer info</p>
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

function GemeenteView({
  cases,
  loading,
  error,
  refetch,
  searchQuery,
  onSearchChange,
  onCaseClick,
  onNavigateToMatching,
  onNavigateToPlaatsingen,
  onNavigateToCasussen,
}: GemeenteViewProps) {
  const reviewCases = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return cases
      .filter(c => c.status === "provider_beoordeling" || c.status === "plaatsing")
      .filter(c => {
        if (!query) return true;
        return [c.id, c.title, c.regio].join(" ").toLowerCase().includes(query);
      });
  }, [cases, searchQuery]);

  const pendingCount = reviewCases.filter(c => c.status === "provider_beoordeling").length;
  const acceptedCount = reviewCases.filter(c => c.status === "plaatsing").length;

  return (
    <CarePageScaffold
      archetype="worklist"
      title="Aanbieder beoordeling"
      subtitle="Gemeente volgt. Wacht op reactie van de aanbieder; aanbieder beslist."
      metric={
        <CareMetricBadge>
          {pendingCount} wacht · {acceptedCount} geaccepteerd · {reviewCases.length} totaal
        </CareMetricBadge>
      }
      filters={
        <CareSearchFiltersBar
          searchValue={searchQuery}
          onSearchChange={onSearchChange}
          searchPlaceholder="Zoek casus, client of regio..."
        />
      }
    >
      {/* States */}
      {loading && (
        <CareEmptyState title="Aanbieder beoordeling laden…" copy="De lijst wordt opgebouwd." />
      )}

      {!loading && error && (
        <CareEmptyState title="Laden mislukt" copy={error} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
      )}

      {!loading && !error && reviewCases.length === 0 && (
        <CareEmptyState
          title="Geen casussen in deze fase"
          copy="Na gemeente-validatie en verzending verschijnen aanbieders hier voor reactie."
          action={<Button onClick={() => onNavigateToCasussen?.()}>Terug naar werkvoorraad</Button>}
        />
      )}

      {!loading && !error && reviewCases.length > 0 && (
        <CarePrimaryList>
          {reviewCases.map((caseItem) => {
            const statusInfo = deriveStatusFromCase(caseItem);
            const StatusIcon = statusInfo.icon;
            const isAccepted = caseItem.status === "plaatsing";
            const providerName = caseItem.arrangementProvider || "Zorgaanbieder";

            return (
              <CareWorkRow
                key={caseItem.id}
                title={caseItem.title || caseItem.id}
                context={`${caseItem.id} · ${providerName} · ${caseItem.regio}`}
                status={
                  <CareDominantStatus className={cn(statusInfo.colorClass, "border-current/25 bg-transparent")}>
                    <span className="inline-flex items-center gap-1">
                      <StatusIcon size={12} className="shrink-0" />
                      {statusInfo.label}
                    </span>
                  </CareDominantStatus>
                }
                time={
                  <CareMetaChip>
                    {caseItem.wachttijd}d wacht
                  </CareMetaChip>
                }
                contextInfo={
                  <CareMetaChip className={urgencyBadgeClass(caseItem.urgency)}>
                    {urgencyLabel(caseItem.urgency)}
                  </CareMetaChip>
                }
                actionLabel={isAccepted ? "Start intake" : caseItem.urgency === "critical" ? "Reageer nu" : "Bekijk status"}
                actionVariant={isAccepted || caseItem.urgency === "critical" ? "primary" : "ghost"}
                onOpen={() => onCaseClick(caseItem.id)}
                onAction={(event) => {
                  event.stopPropagation();
                  if (isAccepted) {
                    onNavigateToPlaatsingen?.();
                    return;
                  }
                  onCaseClick(caseItem.id);
                }}
                accentTone={caseItem.urgency === "critical" ? "critical" : "neutral"}
              />
            );
          })}
        </CarePrimaryList>
      )}

    </CarePageScaffold>
  );
}

// ─── Zorgaanbieder helpers (risk/fit + summary) ───────────────────────────────

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

function fitPositiveLines(c: SpaCase): string[] {
  const lines: string[] = [];
  lines.push(`Specialisatie sluit aan (${c.zorgtype})`);
  lines.push(`Regio binnen bereik (${c.regio})`);
  const lowFriction = c.problems.every(p => p.type !== "capacity" && p.type !== "no-match");
  if (lowFriction) {
    lines.push("Historisch goede matches in vergelijkbare profielen");
  } else {
    lines.push("Match op basis van huidige contract- en regiocriteria");
  }
  return lines;
}

function attentionLines(c: SpaCase): string[] {
  const lines: string[] = [];
  if (c.problems.some(p => p.type === "capacity")) {
    lines.push("Capaciteit mogelijk krap");
  }
  if (c.urgency === "critical" || c.urgency === "warning") {
    lines.push("Zorgvraag intensief / hoge urgentie");
  }
  if (c.wachttijd <= 5) {
    lines.push("Intake binnen korte termijn gewenst");
  }
  if (lines.length === 0) {
    lines.push("Controleer of intake binnen de afgesproken termijn haalbaar is");
  }
  return lines;
}

function summaryBulletLines(c: SpaCase): string[] {
  const lines: string[] = [];
  const lead = c.title?.trim() || c.systemInsight?.slice(0, 80) || "Casus met begeleidingsvraag";
  lines.push(lead);
  lines.push(`Urgentie: ${urgencyLabel(c.urgency)}`);
  if (c.urgency === "critical" || c.urgency === "warning") {
    lines.push("Risico: escalatie bij vertraging");
  }
  lines.push(c.wachttijd > 14 ? "Verwachte duur: langdurig traject" : "Verwachte duur: afhankelijk van intake en plaatsing");
  return lines;
}

function similarCasesStub(caseId: string): { id: string; outcome: string }[] {
  const n = caseId.replace(/\D/g, "") || "42";
  const seed = parseInt(n, 10) || 42;
  return [
    { id: `C-${8000 + (seed % 1999)}`, outcome: "succesvol geplaatst" },
    { id: `C-${6000 + (seed % 2999)}`, outcome: "afgewezen (capaciteit)" },
  ];
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
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="text-green-400 shrink-0 mt-0.5" size={22} />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Casus geaccepteerd</p>
            <p className="text-sm text-muted-foreground">
              Volgende stap: plaatsing door de gemeente. Daarna intake volgens afspraak.
            </p>
          </div>
        </div>
        <Button className="w-full sm:w-auto gap-2" onClick={onNextCase}>
          Ga naar volgende casus
          <ArrowRight size={16} />
        </Button>
      </div>
    );
  }

  if (outcome === "rejected") {
    return (
      <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <XCircle className="text-red-400 shrink-0 mt-0.5" size={22} />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Casus afgewezen</p>
            <p className="text-sm text-muted-foreground">
              Deze casus gaat terug naar matching. Bedankt voor je feedback — dit helpt toekomstige matches verbeteren.
            </p>
          </div>
        </div>
        <Button variant="outline" className="w-full sm:w-auto gap-2 border-border" onClick={onNextCase}>
          Ga naar volgende casus
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
              <span className="block">
                Je staat op het punt deze casus af te wijzen met een gemotiveerde reden.
              </span>
              {strongMatchNudge && (
                <span className="block text-amber-200/90">
                  Deze casus heeft een sterke inhoudelijke match op urgentie en profiel. Controleer of afwijzen de juiste keuze is.
                </span>
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

      <div className="rounded-xl border border-border/80 bg-card/40 overflow-hidden shadow-sm">
        {/* 1 — Header */}
        <div className="border-b border-border/70 bg-muted/10 px-4 py-4 sm:px-5">
          <p className="text-lg font-semibold tracking-tight text-foreground">
            {caseItem.id} — Gemeente {caseItem.regio}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
              Beoordeling vereist
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={12} className="shrink-0" />
              Verwachte reactie binnen 48 uur
            </span>
          </div>
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-foreground leading-relaxed">
            <span className="font-semibold text-amber-200">Let op: </span>
            Deze casus is als mogelijke match voorgesteld. Jouw beslissing bepaalt of plaatsing mogelijk is.{" "}
            <span className="font-medium text-foreground">Jij bent nu verantwoordelijk voor deze beoordeling.</span>
          </div>
        </div>

        {/* 2 — Decision panel (sticky) */}
        <div
          className={cn(
            "sticky top-0 z-20 border-b border-border/70 px-4 py-4 sm:px-5",
            "bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
            Wat is je beslissing?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              type="button"
              size="lg"
              className={cn(
                "h-14 text-base font-semibold gap-2 bg-green-600 hover:bg-green-700 text-white shadow-md",
                panelMode === "accept" && "ring-2 ring-green-400/80 ring-offset-2 ring-offset-background",
              )}
              onClick={() => setPanelMode("accept")}
              disabled={submitting}
            >
              <CheckCircle2 size={20} />
              Accepteren
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className={cn(
                "h-14 text-base font-semibold gap-2 border-red-500/40 text-red-200 hover:bg-red-500/10",
                panelMode === "reject" && "ring-2 ring-red-400/80 ring-offset-2 ring-offset-background",
              )}
              onClick={() => setPanelMode("reject")}
              disabled={submitting}
            >
              <XCircle size={20} />
              Afwijzen
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              onClick={onRequestInfo}
            >
              <MessageSquare size={14} />
              Meer info aanvragen
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onCaseClick(caseItem.id)}
            >
              Bekijk volledige casus
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-5 space-y-6">
          {/* Capacity indicator (system signal) */}
          <div className="rounded-lg border border-border/60 bg-muted/5 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
              Huidige capaciteit (indicatie)
            </p>
            <div className="flex flex-wrap gap-2">
              {(["vol", "beperkt", "beschikbaar"] as const).map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={capacitySignal === key ? "default" : "outline"}
                  className={cn(
                    "h-9 text-xs",
                    key === "vol" && capacitySignal === key && "bg-red-600 hover:bg-red-700",
                    key === "beperkt" && capacitySignal === key && "bg-amber-600 hover:bg-amber-700",
                    key === "beschikbaar" && capacitySignal === key && "bg-emerald-600 hover:bg-emerald-700",
                  )}
                  onClick={() => setCapacitySignal(key)}
                >
                  {key === "vol" && "Vol"}
                  {key === "beperkt" && "Beperkt"}
                  {key === "beschikbaar" && "Beschikbaar"}
                </Button>
              ))}
            </div>
          </div>

          {/* 3 — Risk & fit */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Waarom deze casus bij jullie past</p>
            <ul className="space-y-1.5">
              {fitPositiveLines(caseItem).map(line => (
                <li key={line} className="flex gap-2 text-sm text-foreground/90">
                  <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={16} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-200 mb-1.5">Aandachtspunten</p>
              <ul className="list-disc pl-4 space-y-1 text-sm text-foreground/90">
                {attentionLines(caseItem).map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Similar cases */}
          <div className="rounded-lg border border-border/60 bg-muted/5 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
              Vergelijkbare casussen
            </p>
            <ul className="space-y-1 text-sm text-foreground/85">
              {similarCasesStub(caseItem.id).map(row => (
                <li key={row.id}>
                  <span className="font-medium text-foreground">{row.id}</span>
                  {" → "}
                  {row.outcome}
                </li>
              ))}
            </ul>
          </div>

          {/* 4 — Summary */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">Samenvatting</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {summaryBulletLines(caseItem).map(line => (
                <li key={line} className="text-foreground/90">{line}</li>
              ))}
            </ul>
          </div>

          {/* 5 — Decision form */}
          {panelMode === "idle" && (
            <p className="text-sm text-muted-foreground border-t border-border pt-4">
              Kies <span className="font-medium text-foreground">Accepteren</span> of{" "}
              <span className="font-medium text-foreground">Afwijzen</span> om het beslissingsformulier te openen. Afwijzing zonder toelichting is niet mogelijk — gestructureerde feedback verbetert matching.
            </p>
          )}

          {panelMode === "accept" && (
            <div className="border-t border-border pt-5 space-y-4">
              <p className="text-sm font-semibold text-foreground">Je accepteert deze casus</p>
              <p className="text-xs text-muted-foreground">Bevestig onderstaande punten en kies een startdatum.</p>
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
                  className="w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
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
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                disabled={!acceptFormValid || submitting}
                onClick={() => void handleSubmitAccept()}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                Bevestigen
                <ArrowRight size={16} />
              </Button>
            </div>
          )}

          {panelMode === "reject" && (
            <div className="border-t border-border pt-5 space-y-4">
              <p className="text-sm font-semibold text-foreground">Je wijst deze casus af</p>
              <p className="text-xs text-muted-foreground">Kies een reden en geef een toelichting — dit is verplicht voor kwaliteit van matching.</p>

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
                variant="outline"
                className="gap-2 border-red-500/40 text-red-200 hover:bg-red-500/10"
                disabled={!rejectFormValid || submitting}
                onClick={() => setRejectConfirmOpen(true)}
              >
                Afwijzen
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

  const pendingCases = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return cases
      .filter(c => c.status === "provider_beoordeling")
      .filter(c => {
        if (!query) return true;
        return [c.id, c.title, c.regio].join(" ").toLowerCase().includes(query);
      });
  }, [cases, searchQuery]);

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
        title="Aanbieder beoordeling"
        subtitle="Afwijzing zonder reden = systeemfout. Gestructureerde feedback verbetert matching en beslissingen."
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
          <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-foreground">{submitError}</p>
            </div>
            <button type="button" onClick={clearSubmitError} className="text-muted-foreground hover:text-foreground">
              <XCircle size={16} />
            </button>
          </div>
        )}

        {loading && (
          <CareEmptyState title="Verzoeken laden…" copy="De wachtrij wordt opgebouwd." />
        )}

        {!loading && error && (
          <CareEmptyState title="Laden mislukt" copy={error} action={<Button variant="outline" onClick={refetch}>Opnieuw</Button>} />
        )}

        {!loading && !error && pendingCases.length === 0 && (
          <CareEmptyState
            title="Geen openstaande verzoeken"
            copy="Nieuwe casusverzoeken van gemeenten verschijnen hier."
            action={onNavigateToCasussen ? <Button variant="outline" onClick={onNavigateToCasussen}>Bekijk mijn casussen</Button> : undefined}
          />
        )}

        {!loading && !error && pendingCases.length > 0 && (
          <div className="space-y-8">
            {activeQueue.length > 0 && (
              <section className="space-y-3" key={focusToken}>
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
              <CareEmptyState
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
  const { submitDecision, submitting, submitError, clearSubmitError } = useProviderEvaluations();

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
      submitDecision={submitDecision}
      submitting={submitting}
      submitError={submitError}
      clearSubmitError={clearSubmitError}
    />
  );
}
