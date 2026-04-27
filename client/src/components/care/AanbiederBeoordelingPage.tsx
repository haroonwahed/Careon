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
 *   - Shows incoming review queue from municipalities.
 *   - Full case context: summary, match explanation, risk signals.
 *   - CTAs: "Accepteren" / "Afwijzen" / "Meer info".
 *   - Rejection requires reason code + comment.
 *   - Info request requires type + question.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileQuestion,
  Info,
  Loader2,
  MessageSquare,
  Search,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useCases } from "../../hooks/useCases";
import { useProviderEvaluations } from "../../hooks/useProviderEvaluations";
import type {
  EvaluationDecisionPayload,
  RejectionReasonCode,
  InfoRequestType,
} from "../../hooks/useProviderEvaluations";
import {
  REJECTION_REASON_LABELS,
  INFO_REQUEST_TYPE_LABELS,
} from "../../hooks/useProviderEvaluations";
import type { SpaCase } from "../../hooks/useCases";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = "gemeente" | "zorgaanbieder" | "admin";

type DecisionModalState =
  | { type: "reject"; caseId: string }
  | { type: "info_request"; caseId: string }
  | null;

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
      return { label: "Wacht op aanbieder", colorClass: "text-amber-400", icon: Clock };
    case "plaatsing":
      return { label: "Geaccepteerd", colorClass: "text-green-400", icon: CheckCircle2 };
    case "afgerond":
      return { label: "Geaccepteerd", colorClass: "text-green-400", icon: CheckCircle2 };
    default:
      return { label: "Wacht op aanbieder", colorClass: "text-amber-400", icon: Clock };
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

// ─── Rejection modal ──────────────────────────────────────────────────────────

interface RejectionModalProps {
  caseId: string;
  onClose: () => void;
  onConfirm: (payload: EvaluationDecisionPayload) => Promise<void>;
  submitting: boolean;
}

function RejectionModal({ caseId, onClose, onConfirm, submitting }: RejectionModalProps) {
  const [reasonCode, setReasonCode] = useState<RejectionReasonCode | "">("");
  const [comment, setComment] = useState("");
  const isValid = Boolean(reasonCode && comment.trim().length >= 10);

  const handleSubmit = async () => {
    if (!isValid || !reasonCode) return;
    await onConfirm({
      status: "REJECTED",
      rejection_reason_code: reasonCode,
      provider_comment: comment.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start gap-3 border-b border-border px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10">
            <XCircle className="text-red-400" size={20} />
          </div>
          <div>
            <p className="font-semibold text-foreground">Casus afwijzen</p>
            <p className="text-sm text-muted-foreground mt-0.5">Casus <span className="font-medium text-foreground">{caseId}</span></p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Reden voor afwijzing <span className="text-red-400">*</span>
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as RejectionReasonCode)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
            >
              <option value="">Kies reden...</option>
              {Object.entries(REJECTION_REASON_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Toelichting <span className="text-red-400">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Geef een toelichting op de afwijzing zodat de gemeente weet wat de volgende stap is..."
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
            className="gap-2 bg-red-500 hover:bg-red-600 text-white"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Afwijzen bevestigen
          </Button>
        </div>
      </div>
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">Beoordeling door aanbieder</h1>
        <p className="text-sm text-muted-foreground">
          Volg de status van casussen die ter acceptatie / afwijzing zijn ingediend bij zorgaanbieders.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
        <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm text-foreground">
          De gemeente bewaakt de status van beoordeling door aanbieders. Acceptatie / afwijzing
          zijn voorbehouden aan de zorgaanbieder.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Wacht op beoordeling</p>
          <p className="text-2xl font-semibold text-amber-400">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Geaccepteerd</p>
          <p className="text-2xl font-semibold text-green-400">{acceptedCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-2xl border border-border bg-muted/35 p-3 flex items-center gap-2">
        <Search className="text-muted-foreground shrink-0" size={18} />
        <Input
          type="text"
          placeholder="Zoek op casus-ID, cliënt of regio..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 p-0 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* States */}
      {loading && (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">
          Beoordelingen laden…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border bg-card p-10 text-center space-y-3">
          <p className="text-base font-semibold text-foreground">Beoordelingen konden niet geladen worden</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>
        </div>
      )}

      {!loading && !error && reviewCases.length === 0 && (
        <div className="rounded-2xl border bg-card p-12 text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Geen casussen in beoordeling door aanbieder</p>
          <p className="text-sm text-muted-foreground">
            Casussen verschijnen hier nadat een match is geselecteerd en verstuurd naar een zorgaanbieder.
          </p>
          <Button onClick={() => onNavigateToCasussen?.()}>Ga naar casussen</Button>
        </div>
      )}

      {!loading && !error && reviewCases.length > 0 && (
        <div className="space-y-3">
          {reviewCases.map((caseItem) => {
            const statusInfo = deriveStatusFromCase(caseItem);
            const StatusIcon = statusInfo.icon;
            const isAccepted = caseItem.status === "plaatsing";
            const providerName = caseItem.arrangementProvider || "Zorgaanbieder";

            return (
              <div key={caseItem.id} className="rounded-2xl border bg-card p-5">
                <div className="flex items-start justify-between gap-6">
                  {/* Left: case info */}
                  <div className="flex-1 grid grid-cols-[1fr_1fr_1fr] gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Casus</p>
                      <p className="text-sm font-semibold text-foreground">{caseItem.id}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{caseItem.title || caseItem.regio}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Aanbieder</p>
                      <p className="text-sm font-medium text-foreground">{providerName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{caseItem.regio}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Urgentie</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${urgencyBadgeClass(caseItem.urgency)}`}>
                        {urgencyLabel(caseItem.urgency)}
                      </span>
                    </div>
                  </div>

                  {/* Right: status + CTA */}
                  <div className="text-right min-w-[220px]">
                    <div className="flex items-center justify-end gap-2 mb-3">
                      <StatusIcon size={15} className={statusInfo.colorClass} />
                      <span className={`text-sm font-semibold ${statusInfo.colorClass}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => onCaseClick(caseItem.id)}
                      >
                        Casus bekijken
                        <ArrowRight size={13} />
                      </Button>

                      {isAccepted && (
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => onNavigateToPlaatsingen?.()}
                        >
                          <CheckCircle2 size={13} />
                          Plaatsing starten
                        </Button>
                      )}

                      {!isAccepted && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => onCaseClick(caseItem.id)}
                        >
                          <Send size={13} />
                          Opvolgen
                        </Button>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mt-3">
                      {caseItem.wachttijd} dag{caseItem.wachttijd !== 1 ? "en" : ""} in behandeling
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            <div className="icon-surface flex h-10 w-10 items-center justify-center rounded-full border border-border">
              <ShieldAlert className="text-primary" size={20} />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Gemeente bewaakt — aanbieder beslist</p>
              <p className="text-sm text-muted-foreground">
                De gemeente verstuurt de casus en volgt de beoordeling op. Acceptatie / afwijzing is altijd de verantwoordelijkheid van de zorgaanbieder.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
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

  const pendingCases = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return cases
      .filter(c => c.status === "provider_beoordeling")
      .filter(c => {
        if (!query) return true;
        return [c.id, c.title, c.regio].join(" ").toLowerCase().includes(query);
      });
  }, [cases, searchQuery]);

  const handleAccept = async (caseId: string) => {
    try {
      await submitDecision(caseId, { status: "ACCEPTED" });
      setAcceptedCaseIds(prev => new Set([...prev, caseId]));
    } catch {
      // submitError is set in the hook
    }
  };

  return (
    <div className="space-y-6">
      {/* Modals */}
      {decisionModal?.type === "reject" && (
        <RejectionModal
          caseId={decisionModal.caseId}
          onClose={() => setDecisionModal(null)}
          onConfirm={(payload) => submitDecision(decisionModal.caseId, payload)}
          submitting={submitting}
        />
      )}
      {decisionModal?.type === "info_request" && (
        <InfoRequestModal
          caseId={decisionModal.caseId}
          onClose={() => setDecisionModal(null)}
          onConfirm={(payload) => submitDecision(decisionModal.caseId, payload)}
          submitting={submitting}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">Beoordeling door aanbieder</h1>
        <p className="text-sm text-muted-foreground">
          Beoordeel inkomende casusverzoeken van gemeenten. Accepteer / wijs af of vraag meer informatie op.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Open verzoeken</p>
          <p className="text-2xl font-semibold text-amber-400">{pendingCases.length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Geaccepteerd</p>
          <p className="text-2xl font-semibold text-green-400">{acceptedCaseIds.size}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Gem. wachttijd</p>
          <p className="text-2xl font-semibold text-foreground">
            {pendingCases.length > 0
              ? Math.round(pendingCases.reduce((sum, c) => sum + c.wachttijd, 0) / pendingCases.length)
              : 0}
            <span className="text-base font-normal text-muted-foreground ml-1">dagen</span>
          </p>
        </div>
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-foreground">{submitError}</p>
          </div>
          <button onClick={clearSubmitError} className="text-muted-foreground hover:text-foreground">
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="rounded-2xl border border-border bg-muted/35 p-3 flex items-center gap-2">
        <Search className="text-muted-foreground shrink-0" size={18} />
        <Input
          type="text"
          placeholder="Zoek op casus-ID, regio..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 p-0 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* States */}
      {loading && (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">
          Verzoeken laden…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border bg-card p-10 text-center space-y-3">
          <p className="text-base font-semibold text-foreground">Verzoeken konden niet geladen worden</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>
        </div>
      )}

      {!loading && !error && pendingCases.length === 0 && (
        <div className="rounded-2xl border bg-card p-12 text-center space-y-3">
          <CheckCircle2 size={32} className="mx-auto text-green-400 opacity-60" />
          <p className="text-lg font-semibold text-foreground">Geen openstaande verzoeken</p>
          <p className="text-sm text-muted-foreground">
            Nieuwe casusverzoeken van gemeenten verschijnen hier.
          </p>
          {onNavigateToCasussen && (
            <Button variant="outline" onClick={onNavigateToCasussen}>Bekijk mijn casussen</Button>
          )}
        </div>
      )}

      {!loading && !error && pendingCases.length > 0 && (
        <div className="space-y-4">
          {pendingCases.map((caseItem) => {
            const isAccepted = acceptedCaseIds.has(caseItem.id);

            if (isAccepted) {
              return (
                <div key={caseItem.id} className="rounded-2xl border border-green-500/25 bg-green-500/5 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={20} className="text-green-400" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{caseItem.id} — Geaccepteerd</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Gemeente wordt geïnformeerd. Plaatsing en intake volgen.
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-primary" onClick={() => onCaseClick(caseItem.id)}>
                      Bekijk casus <ArrowRight size={13} />
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={caseItem.id} className="rounded-2xl border bg-card p-5 space-y-4">
                {/* Case header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground">{caseItem.id}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${urgencyBadgeClass(caseItem.urgency)}`}>
                        {urgencyLabel(caseItem.urgency)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{caseItem.title || caseItem.regio}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Regio</p>
                    <p className="text-sm font-medium text-foreground">{caseItem.regio}</p>
                  </div>
                </div>

                {/* Case context */}
                <div className="grid grid-cols-3 gap-4 rounded-xl border border-border bg-muted/20 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Zorgtype</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{caseItem.zorgtype}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Wachttijd</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{caseItem.wachttijd} dagen</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Samenvatting</p>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {caseItem.systemInsight || "Geen samenvatting beschikbaar"}
                    </p>
                  </div>
                </div>

                {/* Risk signals */}
                {caseItem.problems.length > 0 && (
                  <div className="space-y-1.5">
                    {caseItem.problems.map((problem) => (
                      <div key={problem.type} className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                        <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                        <span className="text-xs text-foreground">{problem.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Separator */}
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
                    Uw beslissing
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleAccept(caseItem.id)}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={13} />
                      )}
                      Accepteren
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50"
                      onClick={() => setDecisionModal({ type: "info_request", caseId: caseItem.id })}
                      disabled={submitting}
                    >
                      <MessageSquare size={13} />
                      Meer info
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                      onClick={() => setDecisionModal({ type: "reject", caseId: caseItem.id })}
                      disabled={submitting}
                    >
                      <XCircle size={13} />
                      Afwijzen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-muted-foreground hover:text-foreground ml-auto"
                      onClick={() => onCaseClick(caseItem.id)}
                    >
                      Volledig dossier
                      <ArrowRight size={13} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
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
