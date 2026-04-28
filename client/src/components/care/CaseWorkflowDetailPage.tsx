import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronDown,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Textarea } from "../ui/textarea";
import { CareEmptyState, CareInsightBanner, CarePageHeader, CareSectionCard } from "./CareSurface";
import { useCases } from "../../hooks/useCases";
import {
  INFO_REQUEST_TYPE_LABELS,
  REJECTION_REASON_LABELS,
  type EvaluationDecisionPayload,
  type InfoRequestType,
  type RejectionReasonCode,
} from "../../hooks/useProviderEvaluations";
import {
  executeCaseAction,
  type CaseDecisionActionCode,
} from "../../lib/caseDecisionActions";
import {
  fetchCaseDecisionEvaluation,
  type CaseDecisionRole,
  type DecisionEvaluation,
  type DecisionPriority,
} from "../../lib/decisionEvaluation";
import { getShortActionLabel, getShortReasonLabel } from "../../lib/uxCopy";

interface CaseWorkflowDetailPageProps {
  caseId: string;
  role?: CaseDecisionRole;
  onBack: () => void;
}

const FLOW_STEPS = [
  { id: "casus", label: "Casus", owner: "Gemeente" },
  { id: "samenvatting", label: "Samenvatting", owner: "Systeem" },
  { id: "matching", label: "Matching", owner: "Gemeente" },
  { id: "gemeente_validatie", label: "Gemeente Validatie", owner: "Gemeente" },
  { id: "aanbieder_beoordeling", label: "Beoordeling door aanbieder", owner: "Zorgaanbieder" },
  { id: "plaatsing", label: "Plaatsing", owner: "Gemeente" },
  { id: "intake", label: "Intake", owner: "Zorgaanbieder" },
] as const;

type FlowStepId = typeof FLOW_STEPS[number]["id"];

const STEP_ACTION_HINTS: Record<string, string> = {
  COMPLETE_CASE_DATA: "Casusgegevens aanvullen",
  GENERATE_SUMMARY: "Samenvatting genereren",
  START_MATCHING: "Matching starten",
  SEND_TO_PROVIDER: "Casus versturen naar aanbieder",
  WAIT_PROVIDER_RESPONSE: "Wacht op aanbiederreactie",
  FOLLOW_UP_PROVIDER: "Aanbieder opvolgen",
  REMATCH_CASE: "Casus her-matchen",
  CONFIRM_PLACEMENT: "Plaatsing bevestigen",
  START_INTAKE: "Intake starten",
  MONITOR_CASE: "Casus monitoren",
  ARCHIVE_CASE: "Casus archiveren",
  PROVIDER_ACCEPT: "Aanbieder accepteert",
  PROVIDER_REJECT: "Aanbieder wijst af",
  PROVIDER_REQUEST_INFO: "Aanvullende informatie opvragen",
};

const STEP_REQUIREMENTS: Record<FlowStepId, string> = {
  casus: "Casus compleet.",
  samenvatting: "Samenvatting beschikbaar.",
  matching: "Samenvatting bevestigd.",
  gemeente_validatie: "Matchadvies beschikbaar.",
  aanbieder_beoordeling: "Gemeente validatie afgerond.",
  plaatsing: "Aanbieder akkoord.",
  intake: "Plaatsing bevestigd.",
};

function urgencyBadgeClasses(urgency: string) {
  switch (urgency) {
    case "critical":
      return "border-red-500/35 bg-red-500/10 text-red-300";
    case "warning":
      return "border-amber-500/35 bg-amber-500/10 text-amber-300";
    case "normal":
      return "border-blue-500/35 bg-blue-500/10 text-blue-300";
    default:
      return "border-border bg-muted/30 text-muted-foreground";
  }
}

function priorityClasses(priority: DecisionPriority) {
  switch (priority) {
    case "critical":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    case "high":
      return "border-amber-500/30 bg-amber-500/10 text-amber-100";
    case "medium":
      return "border-border bg-muted/30 text-foreground";
    default:
      return "border-border bg-muted/20 text-muted-foreground";
  }
}

function stepStatusClasses(status: "completed" | "current" | "blocked" | "upcoming") {
  switch (status) {
    case "completed":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-100";
    case "current":
      return "border-primary/45 bg-primary/10 text-foreground";
    case "blocked":
      return "border-red-500/35 bg-red-500/10 text-red-100";
    default:
      return "border-border bg-background/40 text-muted-foreground";
  }
}

function stateLabel(currentState: string, isArchived: boolean) {
  if (isArchived) {
    return "Gearchiveerd";
  }

  switch (currentState) {
    case "DRAFT_CASE":
      return "Casus";
    case "SUMMARY_READY":
      return "Samenvatting";
    case "MATCHING_READY":
      return "Matching";
    case "GEMEENTE_VALIDATED":
      return "Gemeente Validatie";
    case "PROVIDER_REVIEW_PENDING":
    case "PROVIDER_ACCEPTED":
    case "PROVIDER_REJECTED":
      return "Beoordeling door aanbieder";
    case "PLACEMENT_CONFIRMED":
      return "Plaatsing";
    case "INTAKE_STARTED":
      return "Intake";
    default:
      return "Casus";
  }
}

function stateIndex(currentState: string, isArchived: boolean) {
  if (isArchived) {
    return FLOW_STEPS.length - 1;
  }

  switch (currentState) {
    case "DRAFT_CASE":
      return 0;
    case "SUMMARY_READY":
      return 1;
    case "MATCHING_READY":
      return 2;
    case "GEMEENTE_VALIDATED":
      return 3;
    case "PROVIDER_REVIEW_PENDING":
    case "PROVIDER_ACCEPTED":
    case "PROVIDER_REJECTED":
      return 4;
    case "PLACEMENT_CONFIRMED":
      return 5;
    case "INTAKE_STARTED":
      return 6;
    default:
      return 0;
  }
}

function priorityLabel(priority: DecisionPriority) {
  switch (priority) {
    case "critical":
      return "Kritiek";
    case "high":
      return "Hoog";
    case "medium":
      return "Normaal";
    default:
      return "Laag";
  }
}

function roleLabel(role: CaseDecisionRole) {
  switch (role) {
    case "zorgaanbieder":
      return "Zorgaanbieder";
    case "admin":
      return "Admin";
    default:
      return "Gemeente";
  }
}

function stepDisplayStatus(
  index: number,
  currentIndex: number,
  hasBlockers: boolean,
) {
  if (index < currentIndex) {
    return "completed" as const;
  }
  if (index === currentIndex) {
    return hasBlockers ? "blocked" as const : "current" as const;
  }
  return hasBlockers ? "blocked" as const : "upcoming" as const;
}

function requiredPreviousStep(action: string): string {
  switch (action) {
    case "COMPLETE_CASE_DATA":
    case "GENERATE_SUMMARY":
      return "Casus";
    case "START_MATCHING":
      return "Samenvatting";
    case "SEND_TO_PROVIDER":
      return "Gemeente Validatie";
    case "PROVIDER_ACCEPT":
    case "PROVIDER_REJECT":
    case "PROVIDER_REQUEST_INFO":
      return "Beoordeling door aanbieder";
    case "CONFIRM_PLACEMENT":
      return "Beoordeling door aanbieder";
    case "START_INTAKE":
      return "Plaatsing";
    case "FOLLOW_UP_PROVIDER":
    case "REMATCH_CASE":
      return "Beoordeling door aanbieder";
    case "ARCHIVE_CASE":
      return "Intake";
    default:
      return "Vorige stap";
  }
}

function ActionCard({
  label,
  message,
  detail,
  severity,
}: {
  label: string;
  message: string;
  detail?: string;
  severity: string;
}) {
  const severityClassesMap: Record<string, string> = {
    critical: "border-red-500/25 bg-red-500/8",
    high: "border-amber-500/25 bg-amber-500/8",
    medium: "border-border bg-muted/20",
    low: "border-border bg-muted/10",
    info: "border-border bg-muted/10",
    warning: "border-amber-500/20 bg-amber-500/8",
  };

  return (
    <div className={`rounded-2xl border p-4 ${severityClassesMap[severity] ?? severityClassesMap.medium}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        {detail && <Badge variant="outline" className="shrink-0">{detail}</Badge>}
      </div>
    </div>
  );
}

function blockerChecklistItem(blockerCode: string, caseId: string) {
  const fallback = {
    label: "Casusgegevens controleren",
    href: `/care/casussen/${caseId}/edit/`,
  };
  const mapping: Record<string, { label: string; href: string }> = {
    INCOMPLETE_CASE: {
      label: "Vul ontbrekende casusgegevens aan",
      href: `/care/casussen/${caseId}/edit/?section=casus`,
    },
    MISSING_REQUIRED_CASE_DATA: {
      label: "Controleer verplichte gegevens",
      href: `/care/casussen/${caseId}/edit/?section=casus`,
    },
    MISSING_SUMMARY: {
      label: "Maak samenvatting af",
      href: `/care/beoordelingen/`,
    },
    MISSING_MATCH_RESULT: {
      label: "Rond matching af",
      href: `/care/matching/`,
    },
    PROVIDER_NOT_SELECTED: {
      label: "Selecteer een aanbieder",
      href: `/care/matching/`,
    },
  };
  return mapping[blockerCode] ?? fallback;
}

function GeoConfidenceBadge({
  coverageBasis,
  coverageStatus,
}: {
  coverageBasis?: string | null;
  coverageStatus?: string | null;
}) {
  const normalizedBasis = coverageBasis ?? "unknown";
  if (normalizedBasis === "geo_distance") {
    return (
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-100" data-testid="geo-confidence-badge">
        <p className="font-semibold">Distance-based</p>
        <p className="mt-1 text-blue-100/90">
          Afstand is op coördinaten gebaseerd. {coverageStatus === "outside_radius" ? "Controleer radius of kies alternatief." : "Gebruik dit als primaire geo-evidence."}
        </p>
      </div>
    );
  }
  if (normalizedBasis === "region_fallback" || normalizedBasis === "provider_region_coverage") {
    return (
      <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100" data-testid="geo-confidence-badge">
        <p className="font-semibold">Region fallback</p>
        <p className="mt-1 text-amber-100/90">
          Match is regio-gebaseerd. Verifieer afstand handmatig voor plaatsingsbesluit.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-100" data-testid="geo-confidence-badge">
      <p className="font-semibold">Geo unknown</p>
      <p className="mt-1 text-red-100/90">
        Coördinaten ontbreken. Vraag geo-gegevens aan voordat je op afstand beslist.
      </p>
    </div>
  );
}

function factorLabel(key: string) {
  const labels: Record<string, string> = {
    specialization: "Specialisatie",
    capacity: "Capaciteit",
    region: "Regio",
    urgency: "Urgentie",
    complexity: "Complexiteit",
  };
  return labels[key] ?? key;
}

function lowConfidenceFactors(
  factorBreakdown?: Record<string, number> | null,
  weaknesses?: string[] | null,
) {
  const rankedFactors = Object.entries(factorBreakdown ?? {})
    .filter(([, score]) => Number.isFinite(score))
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([factor, score]) => `${factorLabel(factor)} (${Math.round(score * 100)}%)`);
  if (rankedFactors.length > 0) {
    return rankedFactors;
  }
  return (weaknesses ?? []).slice(0, 2);
}

function hasWarningFlags(warningFlags?: Record<string, boolean> | null) {
  if (!warningFlags) {
    return false;
  }
  return Object.values(warningFlags).some(Boolean);
}

function hasRepeatedRejectionSignal(evaluation: DecisionEvaluation | null) {
  if (!evaluation) {
    return false;
  }
  const repeatedRisk = evaluation.risks.some((risk) => risk.code === "REPEATED_PROVIDER_REJECTIONS");
  const repeatedAlert = evaluation.alerts.some((alert) => alert.code === "REPEATED_PROVIDER_REJECTIONS");
  const rejectionActionHint = evaluation.alerts.some((alert) => alert.recommended_action === "REMATCH_CASE");
  return repeatedRisk || repeatedAlert || rejectionActionHint;
}

function rejectionDiagnosis(latestReason: string, nextAction?: string | null) {
  const normalizedReason = latestReason.toLowerCase();
  if (normalizedReason.includes("capac") || normalizedReason.includes("wacht")) {
    return "Patroon: capaciteits- of wachttijdknelpunt bij aanbieders.";
  }
  if (normalizedReason.includes("special") || normalizedReason.includes("expert")) {
    return "Patroon: specialistische match is nog onvoldoende overtuigend.";
  }
  if (normalizedReason.includes("regio") || normalizedReason.includes("afstand")) {
    return "Patroon: regionale dekking of reisafstand veroorzaakt afwijzing.";
  }
  if (nextAction === "REMATCH_CASE") {
    return "Patroon: herhaalde afwijzingen vragen eerst om gerichte bijsturing.";
  }
  return "Patroon: dezelfde casuscontext leidt tot herhaalde afwijzingen.";
}

function rejectionInterventions(latestReason: string, nextAction?: string | null) {
  const options = [
    "Verrijk casusgegevens",
    "Verbreden regio",
    "Controleer zorgvorm",
    "Escaleren naar regie",
    "Benader aanbieder met aanvullende toelichting",
  ];
  const normalizedReason = latestReason.toLowerCase();
  if (normalizedReason.includes("capac") || normalizedReason.includes("wacht")) {
    return ["Verbreden regio", "Escaleren naar regie"];
  }
  if (normalizedReason.includes("special") || normalizedReason.includes("expert")) {
    return ["Verrijk casusgegevens", "Controleer zorgvorm"];
  }
  if (normalizedReason.includes("regio") || normalizedReason.includes("afstand")) {
    return ["Verbreden regio", "Benader aanbieder met aanvullende toelichting"];
  }
  if (nextAction === "REMATCH_CASE") {
    return ["Verrijk casusgegevens", "Benader aanbieder met aanvullende toelichting"];
  }
  return options.slice(0, 2);
}

function ProviderDecisionDialog({
  open,
  mode,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  open: boolean;
  mode: "reject" | "info";
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: EvaluationDecisionPayload) => Promise<void>;
  submitting: boolean;
}) {
  const [reason, setReason] = useState<RejectionReasonCode | "">("");
  const [infoType, setInfoType] = useState<InfoRequestType | "">("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
      setInfoType("");
      setComment("");
    }
  }, [open]);

  const canSubmit = mode === "reject"
    ? Boolean(reason && comment.trim().length >= 10)
    : Boolean(infoType && comment.trim().length >= 10);

  const submit = async () => {
    if (mode === "reject") {
      if (!reason || comment.trim().length < 10) {
        return;
      }
      await onSubmit({
        status: "REJECTED",
        rejection_reason_code: reason,
        provider_comment: comment.trim(),
      });
      onOpenChange(false);
      return;
    }

    if (!infoType || comment.trim().length < 10) {
      return;
    }
    await onSubmit({
      status: "INFO_REQUESTED",
      information_request_type: infoType,
      information_request_comment: comment.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "reject" ? "Casus afwijzen" : "Aanvullende informatie vragen"}</DialogTitle>
          <DialogDescription>
            {mode === "reject"
              ? "Geef een reden en een korte toelichting zodat de gemeente weet wat de volgende stap is."
              : "Selecteer welk type informatie nodig is en geef een korte toelichting."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "reject" ? (
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Reden</span>
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value as RejectionReasonCode)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
              >
                <option value="">Kies een reden...</option>
                {Object.entries(REJECTION_REASON_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Informatietype</span>
              <select
                value={infoType}
                onChange={(event) => setInfoType(event.target.value as InfoRequestType)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
              >
                <option value="">Kies een type...</option>
                {Object.entries(INFO_REQUEST_TYPE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </label>
          )}

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Toelichting</span>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={mode === "reject"
                ? "Leg kort uit waarom de casus niet passend is..."
                : "Leg kort uit welke informatie nodig is..."}
              rows={4}
            />
            {comment.length > 0 && comment.trim().length < 10 && (
              <p className="text-xs text-red-400">Voeg minimaal 10 tekens toe.</p>
            )}
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuleren
          </Button>
          <Button onClick={submit} disabled={!canSubmit || submitting} className="gap-2">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Bevestigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CaseWorkflowDetailPage({ caseId, role = "gemeente", onBack }: CaseWorkflowDetailPageProps) {
  const { cases, loading, error } = useCases({ q: "" });
  const spaCase = cases.find((item) => item.id === caseId);
  const [decisionEvaluation, setDecisionEvaluation] = useState<DecisionEvaluation | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<CaseDecisionActionCode | null>(null);
  const [providerDialog, setProviderDialog] = useState<"reject" | "info" | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const loadDecisionEvaluation = async () => {
    setDecisionLoading(true);
    setDecisionError(null);
    try {
      const payload = await fetchCaseDecisionEvaluation(caseId);
      setDecisionEvaluation(payload);
    } catch (fetchError) {
      setDecisionError(fetchError instanceof Error ? fetchError.message : "Beslisinformatie kon niet worden geladen.");
    } finally {
      setDecisionLoading(false);
    }
  };

  useEffect(() => {
    void loadDecisionEvaluation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const currentState = decisionEvaluation?.current_state ?? "";
  const isArchived = currentState === "ARCHIVED";
  const currentIndex = stateIndex(currentState, isArchived);
  const nextBestAction = decisionEvaluation?.next_best_action ?? null;
  const selectedProviderName = decisionEvaluation?.decision_context.selected_provider_name ?? null;
  const selectedProviderId = decisionEvaluation?.decision_context.selected_provider_id ?? null;
  const activeActionLookup = new Set(decisionEvaluation?.allowed_actions.map((action) => action.action) ?? []);
  const nextActionAllowed = nextBestAction ? activeActionLookup.has(nextBestAction.action) : false;
  const nextActionBlocked = nextBestAction
    ? decisionEvaluation?.blocked_actions.find((action) => action.action === nextBestAction.action) ?? null
    : null;
  const hasBlockers = Boolean(decisionEvaluation?.blockers?.length);

  const handleAction = async (action: CaseDecisionActionCode, payload?: Record<string, unknown>) => {
    if (!decisionEvaluation) {
      return;
    }

    setPendingAction(action);
    try {
      const result = await executeCaseAction(caseId, action, {
        decisionEvaluation,
        role,
        payload,
      });
      if (result.kind === "navigate" && result.href) {
        window.location.assign(result.href);
        return;
      }
      if (result.message) {
        toast.success(result.message);
      }
      await loadDecisionEvaluation();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "Actie mislukt.";
      toast.error(message);
      setDecisionError(message);
    } finally {
      setPendingAction(null);
    }
  };

  const handlePrimaryAction = async () => {
    if (!nextBestAction) {
      return;
    }
    await handleAction(nextBestAction.action as CaseDecisionActionCode);
  };

  const allowedActions = (decisionEvaluation?.allowed_actions ?? []).filter(
    (action) => !nextBestAction || action.action !== nextBestAction.action,
  );

  const timeline = useMemo(() => {
    return FLOW_STEPS.map((step, index) => {
      const status = stepDisplayStatus(index, currentIndex, Boolean(decisionEvaluation?.blockers.length));
      return { ...step, status };
    });
  }, [currentIndex, decisionEvaluation?.blockers.length]);

  if (loading) {
    return <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">Casus laden…</div>;
  }

  if (error || !spaCase) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft size={16} />
          Terug naar casussen
        </Button>
        <div className="rounded-2xl border bg-card p-10 text-center space-y-2">
          <p className="text-lg font-semibold text-foreground">Casus niet beschikbaar</p>
          <p className="text-sm text-muted-foreground">{error ?? "Deze casus kon niet geladen worden."}</p>
        </div>
      </div>
    );
  }

  const decisionPanelMessage = decisionLoading
    ? "Beslissingsinformatie laden…"
    : decisionError
      ? decisionError
      : null;
  const bannerActionLabel = nextBestAction?.label ?? (isArchived ? "Casus gearchiveerd" : "Geen vervolgstap beschikbaar");
  const bannerActionMessage = nextBestAction?.reason ?? (isArchived ? "Deze casus is alleen-lezen en hoort niet meer in de actieve werkvoorraad." : "De beslissingsengine gaf geen actieve vervolgstap terug.");
  const bannerActionPriority = nextBestAction?.priority ?? "low";
  const bannerActionDescription = nextBestAction ? `Actie: ${nextBestAction.action}` : "Geen actie beschikbaar";
  const bannerActionDisabledReason = nextActionBlocked?.reason ?? "Deze actie is op dit moment niet beschikbaar.";
  const primaryDisabledReason = hasBlockers
    ? "Los eerst de open blokkades op via de checklist."
    : bannerActionDisabledReason;
  const lowConfidenceMode = Boolean(
    (decisionEvaluation?.confidence_score ?? 1) < 0.65
      || (decisionEvaluation?.weaknesses?.length ?? 0) > 0
      || hasWarningFlags(decisionEvaluation?.warning_flags),
  );
  const topWeakFactors = lowConfidenceFactors(decisionEvaluation?.factor_breakdown, decisionEvaluation?.weaknesses);
  const verificationSteps = (decisionEvaluation?.verification_guidance ?? []).slice(0, 2);
  const tradeOffs = (decisionEvaluation?.tradeoffs ?? []).slice(0, 2);
  const rejectionCount = decisionEvaluation?.decision_context.provider_rejection_count ?? 0;
  const latestRejectionReason = decisionEvaluation?.decision_context.latest_rejection_reason ?? "";
  const rejectionLoopMode = rejectionCount >= 2 || hasRepeatedRejectionSignal(decisionEvaluation);
  const rejectionPattern = rejectionDiagnosis(latestRejectionReason, nextBestAction?.action ?? null);
  const rejectionActions = rejectionInterventions(latestRejectionReason, nextBestAction?.action ?? null);

  return (
    <div className="space-y-6 pb-12">
      <Button variant="ghost" onClick={onBack} className="gap-2 hover:bg-primary/10 hover:text-primary">
        <ArrowLeft size={16} />
        Terug naar casussen
      </Button>

      <CarePageHeader
        eyebrow={<><FileText size={16} className="text-primary" /><span>Casus</span></>}
        title={spaCase.title}
        subtitle={`${spaCase.id} · ${spaCase.regio} · ${spaCase.zorgtype}`}
        meta={
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.08em] text-muted-foreground">
            <span>Rol: {roleLabel(role)}</span>
            <span>•</span>
            <span>Huidige staat: {stateLabel(currentState, isArchived)}</span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{stateLabel(currentState, isArchived)}</Badge>
            <Badge variant="outline" className={urgencyBadgeClasses(spaCase.urgency)}>
              {spaCase.urgency === "critical" ? "Kritiek" : spaCase.urgency === "warning" ? "Hoog" : spaCase.urgency === "normal" ? "Normaal" : "Laag"}
            </Badge>
            {selectedProviderName && (
              <Badge variant="secondary" className="gap-1.5">
                <Building2 size={12} />
                {selectedProviderName}
              </Badge>
            )}
          </div>
        }
      />

      {(() => {
        const resolvedState = decisionEvaluation?.current_state || spaCase.workflowState || currentState;
        const archivedGuidance = resolvedState === "ARCHIVED";
        const guidanceStepIndex = stateIndex(resolvedState, archivedGuidance);
        const stepOwner = FLOW_STEPS[guidanceStepIndex]?.owner ?? "—";
        const blockerLine = decisionEvaluation?.blockers?.length
          ? getShortReasonLabel(decisionEvaluation.blockers[0].message, 100)
          : "Geen open blokkades.";
        const nextLine = nextBestAction
          ? `${getShortActionLabel(nextBestAction.label)} — ${getShortReasonLabel(nextBestAction.reason ?? "", 100)}`
          : decisionLoading
            ? "Volgende stap wordt geladen…"
            : "Nog geen vervolgstap beschikbaar.";
        const showDraftSummaryHint =
          resolvedState === "DRAFT_CASE"
          && (nextBestAction?.action === "GENERATE_SUMMARY" || nextBestAction?.action === "COMPLETE_CASE_DATA" || !nextBestAction);

        return (
          <div className="rounded-2xl border border-border/70 bg-muted/10 px-4 py-3 text-sm text-foreground space-y-2">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-1">
              <p>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Staat </span>
                <span className="text-foreground">{stateLabel(resolvedState, archivedGuidance)}</span>
              </p>
              <p>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Eigenaar </span>
                <span className="text-foreground">{stepOwner}</span>
              </p>
              <p>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Blokkade </span>
                <span className="text-foreground">{blockerLine}</span>
              </p>
              <p>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Volgende stap </span>
                <span className="text-foreground">{nextLine}</span>
              </p>
            </div>
            {showDraftSummaryHint && (
              <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                Je zit in de casusfase: werk toe naar een samenvatting. Matching start je daarna zelf; die wordt niet automatisch gestart.
              </p>
            )}
            {hasBlockers && (
              <div className="border-t border-border/50 pt-2" data-testid="missing-data-checklist">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Checklist open blokkades</p>
                <div className="mt-2 space-y-2">
                  {decisionEvaluation?.blockers.map((blocker) => {
                    const checklist = blockerChecklistItem(blocker.code, caseId);
                    return (
                      <div key={`checklist-${blocker.code}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/30 px-3 py-2">
                        <div>
                          <p className="text-xs font-medium text-foreground">{checklist.label}</p>
                          <p className="text-xs text-muted-foreground">{getShortReasonLabel(blocker.message, 88)}</p>
                        </div>
                        <a
                          href={checklist.href}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Openen
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <GeoConfidenceBadge
              coverageBasis={decisionEvaluation?.coverage_basis}
              coverageStatus={decisionEvaluation?.coverage_status}
            />
            {lowConfidenceMode && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 space-y-2" data-testid="low-confidence-panel">
                <p className="font-semibold text-amber-100">Waarom extra controleren?</p>
                <p className="text-amber-100/90">
                  {getShortReasonLabel(decisionEvaluation?.confidence_reason ?? "Confidence is laag of onzeker.", 140)}
                </p>
                {topWeakFactors.length > 0 && (
                  <div>
                    <p className="font-medium">Zwakke factoren</p>
                    <ul className="mt-1 space-y-1">
                      {topWeakFactors.map((factor) => (
                        <li key={`weak-${factor}`}>- {factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {verificationSteps.length > 0 && (
                  <div>
                    <p className="font-medium">Verificatie</p>
                    <ul className="mt-1 space-y-1">
                      {verificationSteps.map((step) => (
                        <li key={`verify-${step}`}>- {getShortReasonLabel(step, 110)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {tradeOffs.length > 0 && (
                  <div>
                    <p className="font-medium">Trade-offs</p>
                    <ul className="mt-1 space-y-1">
                      {tradeOffs.map((tradeoff) => (
                        <li key={`tradeoff-${tradeoff}`}>- {getShortReasonLabel(tradeoff, 110)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      <CareInsightBanner
        tone="primary"
        title={getShortActionLabel(decisionPanelMessage ?? bannerActionLabel)}
        copy={getShortReasonLabel(decisionPanelMessage ?? bannerActionMessage, 96)}
        action={(
          <div className="space-y-2">
            <Button
              onClick={handlePrimaryAction}
              disabled={decisionLoading || hasBlockers || !nextBestAction || !nextActionAllowed || Boolean(nextActionBlocked?.reason) || (nextBestAction.action === "SEND_TO_PROVIDER" && !selectedProviderId)}
              className="gap-2"
            >
              {getShortActionLabel(nextBestAction?.label ?? "Geen vervolgactie")}
              <ArrowRight size={16} />
            </Button>
            {(hasBlockers || (!nextActionAllowed && nextActionBlocked)) && (
              <p className="max-w-xs text-xs text-muted-foreground">{getShortReasonLabel(primaryDisabledReason, 80)}</p>
            )}
            {nextBestAction && nextActionAllowed && nextBestAction.action === "SEND_TO_PROVIDER" && !selectedProviderId && (
              <p className="max-w-xs text-xs text-muted-foreground">Nog geen geselecteerde aanbieder.</p>
            )}
            {lowConfidenceMode && (
              <p className="max-w-xs text-xs text-amber-200">
                Controleer deze punten vóór versturen naar aanbieder.
              </p>
            )}
            {rejectionLoopMode && (
              <p className="max-w-xs text-xs text-amber-200">
                Voorkom herhaling: kies eerst een gerichte interventie.
              </p>
            )}
          </div>
        )}
      />

      {rejectionLoopMode && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 space-y-2" data-testid="rejection-loop-panel">
          <p className="font-semibold text-amber-100">Waarom loopt deze casus vast?</p>
          <p className="text-xs text-amber-100/90">Afwijzingen door aanbieders: {rejectionCount}</p>
          {latestRejectionReason && (
            <p className="text-xs text-amber-100/90">Laatste reden: {getShortReasonLabel(latestRejectionReason, 140)}</p>
          )}
          <p className="text-xs text-amber-100/90">{rejectionPattern}</p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-100/90">Aanbevolen interventie vóór rematch</p>
            <ul className="mt-1 space-y-1 text-xs text-amber-100/90">
              {rejectionActions.map((action) => (
                <li key={`intervention-${action}`}>- {action}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <CareSectionCard
        title="Casuspad"
        subtitle={stateLabel(currentState, isArchived)}
        className="p-5"
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {timeline.map((step, index) => (
            <div key={step.id} className={`rounded-2xl border px-3 py-3 text-xs ${stepStatusClasses(step.status)}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{step.label}</p>
                <span className="text-[11px] uppercase tracking-[0.08em] opacity-80">{index + 1}</span>
              </div>
              <p className="mt-1 opacity-80">{step.owner}</p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                {step.status === "completed"
                  ? "Voltooid"
                  : step.status === "current"
                    ? "Huidig"
                    : step.status === "blocked"
                      ? "Geblokkeerd"
                      : "Komt later"}
              </p>
            </div>
          ))}
        </div>
      </CareSectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)] gap-6">
        <div className="space-y-6">
          <CareSectionCard title="Blokkades" subtitle="Wat blokkeert.">
            {decisionEvaluation?.blockers?.length ? (
              <div className="space-y-3">
                {decisionEvaluation.blockers.map((blocker) => (
                  <div key={blocker.code} className="rounded-[24px] border border-red-500/20 bg-red-500/6 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-200">
                        {blocker.severity}
                      </Badge>
                      <p className="font-semibold text-foreground">{getShortReasonLabel(blocker.message, 88)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {blocker.blocking_actions.map((action) => (
                        <Badge key={`${blocker.code}-${action}`} variant="secondary">
                          Blokkeert: {STEP_ACTION_HINTS[action] ?? action}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <CareEmptyState title="Geen blokkades." className="border-0 bg-transparent p-0 text-left shadow-none" />
            )}
          </CareSectionCard>

          <CareSectionCard title="Risico's" subtitle="Signalen voor opvolging.">
            {decisionEvaluation?.risks?.length ? (
              <div className="space-y-3">
                {decisionEvaluation.risks.map((risk) => (
                  <ActionCard
                    key={risk.code}
                    label={risk.message}
                    message={risk.message}
                    detail={risk.severity}
                    severity={risk.severity}
                  />
                ))}
              </div>
            ) : (
              <CareEmptyState title="Geen opvallende risico's." className="border-0 bg-transparent p-0 text-left shadow-none" />
            )}
          </CareSectionCard>

          <CareSectionCard title="Alerts" subtitle="Volgende signalen.">
            {decisionEvaluation?.alerts?.length ? (
              <div className="space-y-3">
                {decisionEvaluation.alerts.map((alert) => (
                  <div key={alert.code} className="rounded-[24px] border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={priorityClasses(alert.severity as DecisionPriority)}>
                        {alert.severity}
                      </Badge>
                      <p className="font-semibold text-foreground">{alert.title}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{getShortReasonLabel(alert.message, 88)}</p>
                    <p className="mt-2 text-xs text-foreground/80">Actie: {STEP_ACTION_HINTS[alert.recommended_action] ?? alert.recommended_action}</p>
                  </div>
                ))}
              </div>
            ) : (
              <CareEmptyState title="Geen actieve alerts." className="border-0 bg-transparent p-0 text-left shadow-none" />
            )}
          </CareSectionCard>

          <CareSectionCard title="Beschikbare acties" subtitle="Alleen acties voor deze rol.">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="outline">{roleLabel(role)}</Badge>
              <p className="text-xs text-muted-foreground">Route-acties</p>
            </div>

            {allowedActions.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {allowedActions.map((action) => {
                  const isLoading = pendingAction === action.action;
                  const disabled = !action.allowed || isLoading || (action.action === "SEND_TO_PROVIDER" && !selectedProviderId);
                  const variant = action.action === "ARCHIVE_CASE" || action.action === "PROVIDER_REJECT"
                    ? "destructive"
                    : action.action === "PROVIDER_REQUEST_INFO" || action.action === "WAIT_PROVIDER_RESPONSE" || action.action === "MONITOR_CASE"
                      ? "outline"
                      : "default";

                  const onClick = async () => {
                    if (action.action === "PROVIDER_REJECT") {
                      setProviderDialog("reject");
                      return;
                    }
                    if (action.action === "PROVIDER_REQUEST_INFO") {
                      setProviderDialog("info");
                      return;
                    }
                    if (action.action === "ARCHIVE_CASE") {
                      setArchiveOpen(true);
                      return;
                    }
                    await handleAction(action.action as CaseDecisionActionCode);
                  };

                  return (
                      <Button
                        key={action.action}
                        size="sm"
                        variant={variant as "default" | "outline" | "destructive"}
                      disabled={disabled}
                      onClick={onClick}
                      className="gap-2"
                    >
                      {isLoading && <Loader2 size={14} className="animate-spin" />}
                      {getShortActionLabel(action.label)}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <CareEmptyState title="Geen beschikbare acties voor deze rol." className="border-0 bg-transparent p-0 text-left shadow-none" />
            )}
          </CareSectionCard>

          <CareSectionCard title="Geblokkeerd" subtitle="Zichtbaar voor uitleg.">
            {decisionEvaluation?.blocked_actions?.length ? (
              <div className="space-y-3">
                {decisionEvaluation.blocked_actions.map((action) => (
                  <div key={action.action} className="rounded-[24px] border border-border bg-muted/15 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Geblokkeerd</Badge>
                      <p className="font-semibold text-foreground">{action.label}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{getShortReasonLabel(action.reason, 88)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Vorige stap: {requiredPreviousStep(action.action)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <CareEmptyState title="Geen geweigerde acties." className="border-0 bg-transparent p-0 text-left shadow-none" />
            )}
          </CareSectionCard>
        </div>

        <div className="space-y-6">
          <CareSectionCard title="Beslissingscontext" subtitle="Technische details.">
            <Collapsible defaultOpen={false}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Toon details</p>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    Toon details
                    <ChevronDown size={14} />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="mt-4">
                {decisionLoading && (
                  <div className="mb-4 rounded-2xl border border-border bg-muted/15 p-3 text-sm text-muted-foreground">
                    Beslissingsinformatie wordt geladen.
                  </div>
                )}
                {decisionError && (
                  <div className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
                    {decisionError}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 text-sm">
                  {[
                    ["required_data_complete", String(decisionEvaluation?.decision_context.required_data_complete ?? false)],
                    ["has_summary", String(decisionEvaluation?.decision_context.has_summary ?? false)],
                    ["has_matching_result", String(decisionEvaluation?.decision_context.has_matching_result ?? false)],
                    ["latest_match_confidence", decisionEvaluation?.decision_context.latest_match_confidence ?? "null"],
                    ["provider_review_status", decisionEvaluation?.decision_context.provider_review_status ?? ""],
                    ["provider_rejection_count", decisionEvaluation?.decision_context.provider_rejection_count ?? 0],
                    ["latest_rejection_reason", decisionEvaluation?.decision_context.latest_rejection_reason ?? ""],
                    ["placement_confirmed", String(decisionEvaluation?.decision_context.placement_confirmed ?? false)],
                    ["intake_started", String(decisionEvaluation?.decision_context.intake_started ?? false)],
                    ["case_age_hours", decisionEvaluation?.decision_context.case_age_hours ?? "null"],
                    ["hours_in_current_state", decisionEvaluation?.decision_context.hours_in_current_state ?? "null"],
                    ["urgency", decisionEvaluation?.decision_context.urgency ?? ""],
                    ["capacity_signals", decisionEvaluation?.decision_context.capacity_signals?.length ?? 0],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-muted/10 px-3 py-2">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CareSectionCard>

          <CareSectionCard title="Laatste gebeurtenissen" subtitle="Recente statuswijzigingen.">
            {decisionEvaluation?.timeline_signals?.recent_events?.length ? (
              <div className="space-y-3">
                {decisionEvaluation.timeline_signals.recent_events.slice(0, 5).map((event) => (
                  <div key={`${event.timestamp}-${event.event_type}-${event.user_action}`} className="flex items-start gap-3 rounded-2xl border border-border bg-background/40 p-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/70" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.user_action || event.event_type}</p>
                      <p className="text-xs text-muted-foreground">{event.timestamp} · {event.action_source}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <CareEmptyState title="Geen recente gebeurtenissen beschikbaar." className="border-0 bg-transparent p-0 text-left shadow-none" />
            )}
          </CareSectionCard>

          <CareSectionCard title="Casus samenvatting" subtitle="Kerngegevens.">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Casus</p>
                <p className="mt-1 font-medium text-foreground">{spaCase.title}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Regio</p>
                <p className="mt-1 font-medium text-foreground">{spaCase.regio}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Zorgvraag</p>
                <p className="mt-1 font-medium text-foreground">{spaCase.zorgtype}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Wachttijd</p>
                <p className="mt-1 font-medium text-foreground">{spaCase.wachttijd} dagen</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {spaCase.problems.map((problem) => (
                <Badge key={problem.label} variant="outline">
                  {problem.label}
                </Badge>
              ))}
            </div>
          </CareSectionCard>
        </div>
      </div>

      <ProviderDecisionDialog
        open={providerDialog !== null}
        mode={providerDialog === "info" ? "info" : "reject"}
        onOpenChange={(open) => setProviderDialog(open ? (providerDialog ?? "reject") : null)}
        onSubmit={async (payload) => {
          if (payload.status === "REJECTED") {
            await handleAction("PROVIDER_REJECT", {
              rejection_reason_code: payload.rejection_reason_code,
              provider_comment: payload.provider_comment,
            });
            return;
          }

          await handleAction("PROVIDER_REQUEST_INFO", {
            information_request_type: payload.information_request_type,
            information_request_comment: payload.information_request_comment,
          });
        }}
        submitting={pendingAction === "PROVIDER_REJECT" || pendingAction === "PROVIDER_REQUEST_INFO"}
      />

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Casus archiveren?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze casus blijft bewaard, maar verdwijnt uit actieve overzichten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (event) => {
                event.preventDefault();
                setArchiveOpen(false);
                await handleAction("ARCHIVE_CASE");
              }}
            >
              Casus archiveren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
