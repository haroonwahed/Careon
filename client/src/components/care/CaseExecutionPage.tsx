import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  MoreVertical,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
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
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";
import { CasusWorkspaceLayout } from "./CasusWorkspaceLayout";
import { imperativeLabelForActionCode } from "./nbaImperativeLabels";
import { NextBestAction } from "../design/NextBestAction";
import { ProcessTimeline } from "../design/ProcessTimeline";
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

interface CaseExecutionPageProps {
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

function caseExecutionPhaseBadgeClass(stepId: FlowStepId): string {
  switch (stepId) {
    case "samenvatting":
      return "border-amber-500/40 bg-amber-500/12 text-amber-100";
    case "matching":
      return "border-sky-500/40 bg-sky-500/12 text-sky-100";
    case "gemeente_validatie":
      return "border-violet-500/40 bg-violet-500/12 text-violet-100";
    case "aanbieder_beoordeling":
      return "border-fuchsia-500/40 bg-fuchsia-500/12 text-fuchsia-100";
    case "plaatsing":
      return "border-emerald-500/40 bg-emerald-500/12 text-emerald-100";
    case "intake":
      return "border-cyan-500/40 bg-cyan-500/12 text-cyan-100";
    case "casus":
    default:
      return "border-border/80 bg-muted/35 text-foreground";
  }
}

const STEP_REQUIREMENTS: Record<FlowStepId, string> = {
  casus: "Klaar",
  samenvatting: "Nog nodig",
  matching: "Wacht",
  gemeente_validatie: "Wacht",
  aanbieder_beoordeling: "Wacht",
  plaatsing: "Wacht",
  intake: "Wacht",
};

/** Dwell-based urgency on the active step (yellow → orange → red). */
function timelineTimePressureTier(
  hours: number | null | undefined,
): "none" | "warn" | "elevated" | "critical" {
  if (hours == null || Number.isNaN(hours) || hours < 24) {
    return "none";
  }
  if (hours < 72) {
    return "warn";
  }
  if (hours < 168) {
    return "elevated";
  }
  return "critical";
}

const TIMELINE_PRESSURE_CIRCLE: Record<"warn" | "elevated" | "critical", string> = {
  warn: "border-amber-500/70 bg-amber-500/12 text-amber-800 dark:text-amber-300 shadow-[0_0_0_1px_rgba(245,158,11,0.22)]",
  elevated:
    "border-orange-500/75 bg-orange-500/12 text-orange-900 dark:text-orange-300 shadow-[0_0_0_1px_rgba(249,115,22,0.26)]",
  critical:
    "border-destructive/80 bg-destructive/15 text-destructive shadow-[0_0_0_1px_rgba(239,68,68,0.32)] motion-safe:animate-pulse",
};

function phaseDecisionEyebrow(stepId: FlowStepId): string {
  const labels: Record<FlowStepId, string> = {
    casus: "Casusbasis",
    samenvatting: "Samenvatting",
    matching: "Matching",
    gemeente_validatie: "Gemeente validatie",
    aanbieder_beoordeling: "Beoordeling door aanbieder",
    plaatsing: "Plaatsing",
    intake: "Intake",
  };
  return labels[stepId];
}

function phaseDecisionTitle(stepId: FlowStepId, blockerIsMissingSummary: boolean): string {
  if (blockerIsMissingSummary) {
    return "Samenvatting vereist";
  }
  const titles: Record<FlowStepId, string> = {
    casus: "Casus vastleggen",
    samenvatting: "Samenvatting vereist",
    matching: "Matching resultaat",
    gemeente_validatie: "Matchadvies controleren",
    aanbieder_beoordeling: "Wacht op aanbieder",
    plaatsing: "Plaatsing afronden",
    intake: "Intake starten",
  };
  return titles[stepId];
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

function attentionIcon(severity: DecisionPriority): string {
  if (severity === "critical") {
    return "🔴";
  }
  if (severity === "high" || severity === "medium") {
    return "🟠";
  }
  return "🟢";
}

function formatUpdatedAtLabel(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function CaseWorkflowTimeline({
  steps,
  activeIndex,
  blocked,
  compactHint,
  hoursInCurrentState,
}: {
  steps: typeof FLOW_STEPS;
  activeIndex: number;
  blocked: boolean;
  compactHint: Record<string, string>;
  hoursInCurrentState?: number | null;
}) {
  return (
    <ProcessTimeline className="rounded-2xl bg-background/70 px-3 py-3 md:px-4 md:py-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Processtatus</h2>
        <p className="text-[12px] text-muted-foreground">{steps.length} stappen</p>
      </div>
      <div className="relative">
        <div className="absolute left-3 right-3 top-[20px] hidden h-px bg-border/80 md:block" />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-7 md:gap-0">
          {steps.map((step, index) => {
            const isCurrent = index === activeIndex;
            const isCompleted = index < activeIndex;
            const isBlocked = isCurrent && blocked;
            const dwellPressure = isCurrent && !isBlocked ? timelineTimePressureTier(hoursInCurrentState) : "none";
            const circleTone = isCompleted
              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
              : isBlocked
                ? "border-destructive/80 bg-destructive/10 text-destructive"
                : isCurrent && dwellPressure !== "none"
                  ? TIMELINE_PRESSURE_CIRCLE[dwellPressure]
                  : isCurrent
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/70 bg-background/80 text-muted-foreground";
            const stateText = isCompleted
              ? "Klaar"
              : isBlocked
                ? "Geblokkeerd"
                : isCurrent && dwellPressure === "critical"
                  ? "Escaleer"
                  : isCurrent && dwellPressure !== "none"
                    ? "Aandacht"
                    : isCurrent
                      ? "Actief"
                      : "Volgt";
            const hintTone = isCompleted
              ? "text-emerald-400"
              : isBlocked
                ? "text-destructive"
                : isCurrent && dwellPressure === "critical"
                  ? "text-destructive"
                  : isCurrent && dwellPressure === "elevated"
                    ? "text-orange-700 dark:text-orange-300"
                    : isCurrent && dwellPressure === "warn"
                      ? "text-amber-800 dark:text-amber-300"
                      : isCurrent
                        ? "text-foreground"
                        : "text-muted-foreground";

            return (
              <div key={step.id} className="relative min-w-0 px-0.5 pt-0 md:px-1.5 md:pt-10">
                <div className="mb-2 flex items-center gap-2 md:absolute md:left-1.5 md:top-0 md:flex-col md:items-start md:gap-0">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-semibold",
                      "motion-safe:transition-[color,background-color,border-color,box-shadow] motion-safe:duration-500 motion-safe:ease-out",
                      circleTone,
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={16} className="motion-safe:transition-opacity motion-safe:duration-300" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="hidden md:block" />
                </div>
                <p className={`text-[14px] font-semibold ${isCurrent ? "text-foreground" : "text-foreground/90"}`}>{step.label}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{step.owner}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${hintTone}`}>
                    {stateText}
                  </span>
                </div>
                <p className={`mt-1 text-[11px] leading-snug ${hintTone}`}>{compactHint[step.id] ?? STEP_REQUIREMENTS[step.id]}</p>
              </div>
            );
          })}
        </div>
      </div>
    </ProcessTimeline>
  );
}

function AttentionRow({
  icon,
  headline,
  body,
  tone,
}: {
  icon: string;
  headline: string;
  body: string;
  tone: "critical" | "warning" | "info";
}) {
  const toneClasses: Record<string, string> = {
    critical: "border-destructive/60 bg-destructive/8",
    warning: "border-amber-500/50 bg-amber-500/8",
    info: "border-primary/40 bg-primary/8",
  };

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${toneClasses[tone]}`}>
      <span className="shrink-0 text-base" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground">{headline}</p>
        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{body}</p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
    </div>
  );
}

function buildAttentionRollup(evaluation: DecisionEvaluation | null): Array<{
  key: string;
  icon: string;
  headline: string;
  body: string;
}> {
  if (!evaluation) {
    return [];
  }
  const rows: Array<{ key: string; icon: string; headline: string; body: string }> = [];
  const seen = new Set<string>();
  const push = (key: string, headline: string, body: string, severity: DecisionPriority) => {
    const norm = body.trim().toLowerCase();
    if (!norm || seen.has(norm)) {
      return;
    }
    seen.add(norm);
    rows.push({ key, icon: attentionIcon(severity), headline, body: body.trim() });
  };
  for (const blocker of evaluation.blockers) {
    push(`blocker-${blocker.code}`, "Blokkade", blocker.message, blocker.severity);
  }
  for (const risk of evaluation.risks.slice(0, 4)) {
    push(`risk-${risk.code}`, "Risico", risk.message, risk.severity);
  }
  for (const alert of evaluation.alerts.slice(0, 4)) {
    push(`alert-${alert.code}`, alert.title || "Signaal", alert.message, alert.severity);
  }
  return rows.slice(0, 8);
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

export function CaseExecutionPage({ caseId, role = "gemeente", onBack }: CaseExecutionPageProps) {
  const { cases, loading, error } = useCases({ q: "" });
  const spaCase = cases.find((item) => item.id === caseId);
  const [decisionEvaluation, setDecisionEvaluation] = useState<DecisionEvaluation | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<CaseDecisionActionCode | null>(null);
  const [providerDialog, setProviderDialog] = useState<"reject" | "info" | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [summaryFlowOpen, setSummaryFlowOpen] = useState(false);
  const [summaryFlowStep, setSummaryFlowStep] = useState<"intro" | "review">("intro");

  const loadDecisionEvaluation = async () => {
    setDecisionLoading(true);
    setDecisionError(null);
    try {
      const payload = await fetchCaseDecisionEvaluation(caseId);
      setDecisionEvaluation(payload);
      return payload;
    } catch (fetchError) {
      setDecisionError(fetchError instanceof Error ? fetchError.message : "Beslisinformatie kon niet worden geladen.");
      return null;
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
    if (nextBestAction.action === "GENERATE_SUMMARY") {
      setSummaryFlowStep("intro");
      setSummaryFlowOpen(true);
      return;
    }
    await handleAction(nextBestAction.action as CaseDecisionActionCode);
  };

  const allowedActions = (decisionEvaluation?.allowed_actions ?? []).filter(
    (action) => !nextBestAction || action.action !== nextBestAction.action,
  );

  const missingSummaryAtCurrentStep = decisionEvaluation?.blockers?.[0]?.code === "MISSING_SUMMARY";
  const workflowIndex = missingSummaryAtCurrentStep ? 1 : currentIndex;
  const timeline = useMemo(() => FLOW_STEPS.map((step) => ({ ...step })), []);

  // Do not auto-open summary flow on case load.
  // Users should explicitly open it via the primary action.

  if (loading) {
    return <div className="text-muted-foreground">Casus laden…</div>;
  }

  if (error || !spaCase) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft size={16} />
          Terug naar casussen
        </Button>
        <div className="space-y-2 border-b border-border/70 pb-5 text-left">
          <p className="text-lg font-semibold text-foreground">Casus niet beschikbaar</p>
          <p className="text-sm text-muted-foreground">{error ?? "Deze casus kon niet geladen worden."}</p>
        </div>
      </div>
    );
  }

  const primaryDisabledReason = nextActionBlocked?.reason ?? "Deze actie is op dit moment niet beschikbaar.";
  const verificationSteps = (decisionEvaluation?.verification_guidance ?? []).slice(0, 2);
  const resolvedState = decisionEvaluation?.current_state || spaCase.workflowState || currentState;
  const guidanceStepIndex = stateIndex(resolvedState, resolvedState === "ARCHIVED");
  const stepOwner = FLOW_STEPS[guidanceStepIndex]?.owner ?? "Gemeente";
  const dominantBlocker = decisionEvaluation?.blockers?.[0] ?? null;
  const blockerIsMissingSummary = dominantBlocker?.code === "MISSING_SUMMARY";
  const primaryButtonLabel = nextBestAction
    ? imperativeLabelForActionCode(nextBestAction.action, nextBestAction.label)
      ?? getShortActionLabel(nextBestAction.label)
    : null;
  const nextActionReason = getShortReasonLabel(nextBestAction?.reason ?? "Deze actie is nodig om de workflow veilig te laten doorgaan.", 170);
  const impossibleActions = decisionEvaluation?.blocked_actions?.length
    ? decisionEvaluation.blocked_actions
    : [
      { action: "START_MATCHING", label: "Matching starten", reason: "Nog niet toegestaan vanuit de huidige fase.", allowed: false },
      { action: "SEND_TO_PROVIDER", label: "Casus versturen naar aanbieder", reason: "Nog niet toegestaan vanuit de huidige fase.", allowed: false },
      { action: "CONFIRM_PLACEMENT", label: "Plaatsing bevestigen", reason: "Nog niet toegestaan vanuit de huidige fase.", allowed: false },
      { action: "START_INTAKE", label: "Intake starten", reason: "Nog niet toegestaan vanuit de huidige fase.", allowed: false },
    ];
  const missingGeo = (decisionEvaluation?.coverage_basis ?? "unknown") === "unknown";
  const actionButtonDisabled = decisionLoading
    || !nextBestAction
    || !nextActionAllowed
    || Boolean(nextActionBlocked?.reason)
    || (nextBestAction?.action === "SEND_TO_PROVIDER" && !selectedProviderId);
  const evidenceRows = [
    {
      label: "Verplichte gegevens",
      value: decisionEvaluation?.decision_context.required_data_complete ? "Compleet" : "Onvolledig",
      impact: decisionEvaluation?.decision_context.required_data_complete
        ? "Workflow kan door naar volgende verificatie."
        : "Zonder volledige casusbasis blijft vervolgstap beperkt.",
      tone: decisionEvaluation?.decision_context.required_data_complete ? "success" : "warning",
    },
    {
      label: "Samenvatting",
      value: decisionEvaluation?.decision_context.has_summary ? "Beschikbaar" : "Ontbreekt",
      impact: decisionEvaluation?.decision_context.has_summary
        ? "Matching-input is aanwezig."
        : "Zonder samenvatting is matchadvies niet betrouwbaar.",
      tone: decisionEvaluation?.decision_context.has_summary ? "success" : "danger",
    },
    {
      label: "Matchresultaat",
      value: decisionEvaluation?.decision_context.has_matching_result ? "Beschikbaar" : "Niet beschikbaar",
      impact: decisionEvaluation?.decision_context.has_matching_result
        ? "Gemeentevalidatie kan plaatsvinden."
        : "Nog geen voorstel om te valideren.",
      tone: decisionEvaluation?.decision_context.has_matching_result ? "info" : "warning",
    },
    {
      label: "Confidence",
      value: decisionEvaluation?.confidence_score != null ? `${Math.round(decisionEvaluation.confidence_score * 100)}%` : "Niet beschikbaar",
      impact: decisionEvaluation?.confidence_reason ?? "Geen samenvatting of matchresultaat beschikbaar.",
      tone: decisionEvaluation?.confidence_score != null ? "info" : "warning",
    },
    {
      label: "Geo",
      value: missingGeo ? "Onbekend" : "Beschikbaar",
      impact: missingGeo
        ? "Afstands- en regio-afwegingen blijven beperkt."
        : "Afstand kan worden meegewogen in matching.",
      tone: missingGeo ? "warning" : "success",
    },
    {
      label: "Laatste gebeurtenis",
      value: decisionEvaluation?.timeline_signals.latest_event_type ?? "Niet beschikbaar",
      impact: decisionEvaluation?.timeline_signals.latest_event_at ?? "Geen timestamp beschikbaar.",
      tone: "neutral",
    },
  ];
  const lockedActionFallbackReasons: Record<string, string> = {
    START_MATCHING: "Samenvatting ontbreekt.",
    SEND_TO_PROVIDER: "Gemeentevalidatie ontbreekt.",
    CONFIRM_PLACEMENT: "Aanbiederacceptatie ontbreekt.",
    START_INTAKE: "Plaatsing ontbreekt.",
  };
  const evidenceStatusIcon: Record<string, string> = {
    danger: "🔴",
    warning: "🟠",
    success: "🟢",
    info: "⚪",
    neutral: "🟢",
  };
  const compactEvidenceRows = evidenceRows.filter((row) => (
    row.label === "Samenvatting"
    || row.label === "Matchresultaat"
    || row.label === "Confidence"
    || row.label === "Laatste gebeurtenis"
  ));
  const processCompactHint: Record<string, string> = {
    casus: "Basis compleet",
    samenvatting: "Samenvatting nodig",
    matching: "Wacht op samenvatting",
    gemeente_validatie: "Wacht op matching",
    aanbieder_beoordeling: "Wacht op validatie",
    plaatsing: "Wacht op akkoord",
    intake: "Wacht op plaatsing",
  };
  const matchingAllowed = activeActionLookup.has("START_MATCHING");
  const matchingBlockedReason = decisionEvaluation?.blocked_actions.find((action) => action.action === "START_MATCHING")?.reason
    ?? "Matching is nog niet beschikbaar.";
  const summaryPreview = spaCase.systemInsight?.trim()
    ? spaCase.systemInsight.trim()
    : "Samenvatting is gegenereerd. Controleer de casuscontext en start daarna matching.";
  const summaryRiskItems = decisionEvaluation?.risks?.length
    ? decisionEvaluation.risks.slice(0, 3).map((risk) => risk.message)
    : [
      blockerIsMissingSummary
        ? "Samenvatting ontbreekt nog; matching blijft vergrendeld."
        : "Geen kritieke blokkades op basis van huidige casuscontext.",
    ];
  const summaryMatchInputs = [
    `Regio: ${spaCase.regio}`,
    `Zorgvraag: ${spaCase.zorgtype}`,
    `Urgentie: ${spaCase.urgency}`,
    missingGeo ? "Locatie: onbekend (aanvullen aanbevolen)" : "Locatie: beschikbaar",
  ];
  const updatedAtLabel = formatUpdatedAtLabel(decisionEvaluation?.timeline_signals.latest_event_at);
  const attentionRollup = buildAttentionRollup(decisionEvaluation);
  const workspacePhaseLabel = FLOW_STEPS[workflowIndex]?.label ?? "Casus";
  const workspaceStatusVariant = decisionLoading ? "progress" : dominantBlocker ? "blocked" : "active";
  const workspaceStatusHint = dominantBlocker ? getShortReasonLabel(dominantBlocker.message, 72) : null;

  const matchingOutcome = decisionEvaluation?.decision_context.matching_outcome ?? null;
  const activeFlowStepId = (FLOW_STEPS[guidanceStepIndex]?.id ?? "casus") as FlowStepId;

  const hoursInFlowState = decisionEvaluation?.decision_context?.hours_in_current_state ?? null;
  const timelineActiveStepId = FLOW_STEPS[workflowIndex]?.id;
  const timelineCompactHint: Record<string, string> = { ...processCompactHint };
  if (timelineActiveStepId && typeof hoursInFlowState === "number" && hoursInFlowState >= 24) {
    const base = timelineCompactHint[timelineActiveStepId] ?? STEP_REQUIREMENTS[timelineActiveStepId as FlowStepId];
    timelineCompactHint[timelineActiveStepId] = `${base} · ${Math.round(hoursInFlowState)}u in deze stap`;
  }

  const flowProgress = (
    <CaseWorkflowTimeline
      steps={timeline}
      activeIndex={workflowIndex}
      blocked={hasBlockers}
      compactHint={timelineCompactHint}
      hoursInCurrentState={hoursInFlowState}
    />
  );

  const decisionIntroBody = (() => {
    if (blockerIsMissingSummary) {
      return "De casus bevat onvoldoende gestructureerde informatie. Zonder samenvatting kan er geen matching plaatsvinden.";
    }
    switch (activeFlowStepId) {
      case "matching":
        return matchingOutcome
          ? getShortReasonLabel(matchingOutcome, 200)
          : "Controleer het matchadvies en valideer of pas aan voordat je naar de aanbieder gaat. Matching is adviserend.";
      case "gemeente_validatie":
        return "Valideer of pas het matchvoorstel aan. Daarna kan de casus naar de aanbieder.";
      case "aanbieder_beoordeling":
        return selectedProviderName
          ? `${selectedProviderName} heeft de casus ontvangen. Wacht op acceptatie of afwijzing.`
          : "De casus wacht op beoordeling door de gekozen aanbieder.";
      case "plaatsing":
        return "Bevestig de plaatsing en plan intake zodra de aanbieder heeft geaccepteerd.";
      case "intake":
        return "Start of volg intake na bevestigde plaatsing.";
      default:
        return getShortReasonLabel(nextActionReason, 200);
    }
  })();

  const phaseWhatHappens = (() => {
    if (blockerIsMissingSummary) {
      return [
        "AI analyseert de casus en vat de zorgvraag samen.",
        "Risico’s en urgentie worden zichtbaar voor matching.",
        "Daarna wordt matching voorbereid (niet automatisch toegewezen).",
      ];
    }
    if (activeFlowStepId === "matching" || activeFlowStepId === "gemeente_validatie") {
      return [
        "Je beoordeelt het matchvoorstel en de confidence.",
        "Je legt vast waarom je akkoord bent of wat je aanpast.",
        "Daarna kan de casus naar de aanbieder (geen sprong naar intake).",
      ];
    }
    if (activeFlowStepId === "aanbieder_beoordeling") {
      return [
        "De aanbieder beoordeelt of de casus past.",
        "Jij volgt de status en escaleert bij vertraging.",
        "Zonder acceptatie geen plaatsing.",
      ];
    }
    return [
      "Werk de keten stap voor stap af volgens de huidige fase.",
      "Blokkades hebben voorrang op nieuwe acties.",
      "Alle stappen blijven traceerbaar.",
    ];
  })();

  const caseHero = (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold leading-none tracking-tight",
              caseExecutionPhaseBadgeClass(activeFlowStepId),
            )}
            title="Fase in de canonieke keten"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-current opacity-90" aria-hidden />
            <span className="truncate">{FLOW_STEPS[guidanceStepIndex]?.label ?? "Casus"}</span>
          </span>
        </div>
        {dominantBlocker ? (
          <>
            <p className="text-[10px] font-bold tracking-[0.16em] text-red-200/90">BLOKKADE</p>
            <p className="text-[15px] font-semibold text-destructive">
              {getShortReasonLabel(dominantBlocker.message, 100)}
            </p>
            <p className="text-[13px] leading-snug text-muted-foreground">
              {blockerIsMissingSummary
                ? "Deze casus kan niet door naar matching zolang dit ontbreekt."
                : getShortReasonLabel(nextActionReason, 140)}
            </p>
          </>
        ) : (
          <>
            <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground">ACTIE</p>
            <p className="text-[15px] font-semibold text-foreground">
              {primaryButtonLabel ?? getShortReasonLabel(nextBestAction?.label ?? "Geen actie vastgesteld", 80)}
            </p>
            <p className="text-[13px] text-muted-foreground">{getShortReasonLabel(nextActionReason, 140)}</p>
          </>
        )}
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2 py-0.5">
            <Clock3 size={12} aria-hidden />
            {spaCase.wachttijd === 0 ? "Vandaag actief" : `${spaCase.wachttijd} dagen in overzicht`}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2 py-0.5">
            {selectedProviderName ? `Aanbieder: ${selectedProviderName}` : "Geen aanbieder"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2 py-0.5">
            Urgentie: {spaCase.urgency}
          </span>
        </div>
        {(actionButtonDisabled || decisionError) && (
          <p className="text-[12px] text-destructive">
            {decisionError ?? getShortReasonLabel(primaryDisabledReason, 110)}
          </p>
        )}
      </div>
      <NextBestAction className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:max-w-md">
        {nextBestAction ? (
          <Button
            type="button"
            onClick={handlePrimaryAction}
            disabled={actionButtonDisabled}
            className="h-12 min-h-[48px] w-full min-w-[200px] self-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground sm:self-center"
          >
            {primaryButtonLabel ?? getShortActionLabel(nextBestAction.label)}
            <ArrowRight size={16} />
          </Button>
        ) : (
          <p className="w-full max-w-md rounded-xl border border-dashed border-border/70 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
            Geen workflowactie door het systeem vastgesteld. Controleer signalen hieronder of vernieuw beslisinformatie.
          </p>
        )}
        <Button
          asChild
          variant="outline"
          type="button"
          className="h-12 w-full rounded-full border-border/70 bg-background/70 text-foreground hover:bg-muted/40"
        >
          <a href={`/care/casussen/${caseId}/edit/?section=casus`}>Casusgegevens controleren</a>
        </Button>
      </NextBestAction>
    </div>
  );

  const decisionPanel = (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
          {phaseDecisionEyebrow(activeFlowStepId)}
        </p>
        <h2 className="text-[18px] font-semibold leading-snug text-foreground md:text-[20px]">
          {phaseDecisionTitle(activeFlowStepId, blockerIsMissingSummary)}
        </h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{decisionIntroBody}</p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Wat gebeurt er</p>
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-muted-foreground">
          {phaseWhatHappens.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {decisionEvaluation?.risks && decisionEvaluation.risks.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">
            Risico
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[12px] text-muted-foreground">
            {decisionEvaluation.risks.slice(0, 4).map((risk) => (
              <li key={risk.code}>{getShortReasonLabel(risk.message, 120)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {attentionRollup.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Signalen
          </p>
          <div className="space-y-2">
            {attentionRollup.map((item) => (
              <AttentionRow
                key={item.key}
                icon={item.icon}
                headline={item.headline}
                body={item.body}
                tone={item.icon === "🔴" ? "critical" : item.icon === "🟠" ? "warning" : "info"}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  const detailsSurface = "rounded-2xl border border-border/70 bg-background/50";

  const contextStack = (
    <>
      {missingGeo && !dominantBlocker ? (
        <section className="border-l-2 border-amber-500/30 bg-amber-500/6 px-4 py-3 md:px-5 md:py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-600 dark:text-amber-300">
            Locatie onbekend
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">Vul locatie aan voor betere matching en plaatsing.</p>
          <Button
            asChild
            variant="outline"
            type="button"
            className="mt-3 border-amber-500/35 bg-background/80 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
          >
            <a href={`/care/casussen/${caseId}/edit/?section=locatie`}>Locatiegegevens aanvullen</a>
          </Button>
        </section>
      ) : null}

      <details open className={cn(detailsSurface, "overflow-hidden")}>
        <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-semibold text-foreground hover:bg-muted/30">
          Samenvatting & kern
        </summary>
        <div className="border-t border-border/60 px-4 pb-4 pt-2" data-testid="case-context-panel">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/65 px-2.5 py-1 text-[11px] text-muted-foreground">
              Regio · {spaCase.regio}
            </span>
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/65 px-2.5 py-1 text-[11px] text-muted-foreground">
              Vraag · {spaCase.zorgtype}
            </span>
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/65 px-2.5 py-1 text-[11px] text-muted-foreground">
              Urgentie · {spaCase.urgency}
            </span>
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/65 px-2.5 py-1 text-[11px] text-muted-foreground">
              Wachttijd · {spaCase.wachttijd} weken
            </span>
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/65 px-2.5 py-1 text-[11px] text-muted-foreground">
              Eigenaar · {stepOwner}
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-snug text-muted-foreground">Kern voor de volgende beslissing. Alles hier stuurt door naar de volgende stap.</p>
        </div>
      </details>

      <details open className={cn(detailsSurface, "overflow-hidden")}>
        <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-semibold text-foreground hover:bg-muted/30">
          Verificatie & context
        </summary>
        <div className="border-t border-border/60 px-4 pb-4 pt-2">
          <div className="space-y-2 text-[12px] text-muted-foreground">
            <p>
              Confidence:{" "}
              {decisionEvaluation?.confidence_score != null
                ? `${Math.round(decisionEvaluation.confidence_score * 100)}%`
                : "—"}
            </p>
            <p>
              Waarom:{" "}
              {getShortReasonLabel(decisionEvaluation?.confidence_reason ?? "Nog geen onderbouwing beschikbaar.", 80)}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Check</p>
            <ol className="list-decimal space-y-1 pl-4">
              {(verificationSteps.length ? verificationSteps : [
                "Genereer samenvatting",
                "Controleer verplichte gegevens",
                missingGeo ? "Vul locatie aan" : "Leg verificatie vast",
              ]).slice(0, 3).map((step) => (
                <li key={`verify-${step}`}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </details>

      <details className={cn(detailsSurface, "overflow-hidden")}>
        <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-semibold text-foreground hover:bg-muted/30">
          Bewijs (overzicht)
        </summary>
        <div className="border-t border-border/60 p-3">
          <div className="overflow-hidden rounded-xl border border-border/70">
            <div className="grid grid-cols-[1.2fr_1fr_1.2fr_auto] gap-2 border-b border-border/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <p>Signaal</p>
              <p>Waarde</p>
              <p>Impact</p>
              <p />
            </div>
            {compactEvidenceRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1.2fr_1fr_1.2fr_auto] gap-2 border-b border-border/60 px-3 py-2 text-[12px] text-muted-foreground last:border-b-0"
              >
                <p>{row.label}</p>
                <p>{row.value}</p>
                <p>{getShortReasonLabel(row.impact, 28)}</p>
                <p>{evidenceStatusIcon[row.tone] ?? "⚪"}</p>
              </div>
            ))}
          </div>
        </div>
      </details>

      <details className={cn(detailsSurface, "overflow-hidden")}>
        <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-semibold text-foreground hover:bg-muted/30">
          Meer acties
        </summary>
        <div className="border-t border-border/60 px-4 pb-4 pt-3">
          <p className="text-[11px] text-muted-foreground">Primaire actie staat in het actieblok hierboven.</p>
          <div className="mt-3 space-y-2">
            <Button
              asChild
              variant="outline"
              type="button"
              className="w-full justify-start border-border/70 bg-background/70 text-foreground hover:bg-muted/40"
            >
              <a href={`/care/casussen/${caseId}/edit/?section=casus`}>Casusgegevens bewerken</a>
            </Button>
            {missingGeo ? (
              <Button
                asChild
                variant="outline"
                type="button"
                className="w-full justify-start border-border/70 bg-background/70 text-foreground hover:bg-muted/40"
              >
                <a href={`/care/casussen/${caseId}/edit/?section=locatie`}>Locatie aanvullen</a>
              </Button>
            ) : null}
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Niet actief</p>
          <div className="mt-2 space-y-2">
            {impossibleActions.slice(0, 4).map((action) => (
              <div key={`locked-${action.action}`} className="border-l-2 border-border/70 px-3 py-2">
                <p className="text-[12px] text-muted-foreground">{getShortActionLabel(action.label)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {getShortReasonLabel(lockedActionFallbackReasons[action.action] ?? action.reason, 90)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </details>

      {decisionEvaluation?.timeline_signals?.recent_events?.length ? (
        <details className={cn(detailsSurface, "overflow-hidden")}>
          <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-semibold text-foreground hover:bg-muted/30">
            Activiteit & historie
          </summary>
          <div className="border-t border-border/60 px-4 pb-4 pt-3">
            <ul className="space-y-2">
              {decisionEvaluation.timeline_signals.recent_events.slice(0, 8).map((event) => (
                <li
                  key={`${event.timestamp}-${event.event_type}-${event.user_action}`}
                  className="border-l-2 border-border/70 px-3 py-2 text-[12px] text-foreground"
                >
                  {event.user_action || event.event_type} · {event.timestamp}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </>
  );

  return (
    <>
      <CasusWorkspaceLayout
        onBack={onBack}
        flowProgress={flowProgress}
        title={`CASUS #${spaCase.id.replace(/\D/g, "") || spaCase.id} — ${spaCase.title}`}
        metaLine={`Regio: ${spaCase.regio} · Zorgvraag: ${spaCase.zorgtype} · Eigenaar: ${stepOwner}`}
        phaseLabel={workspacePhaseLabel}
        statusVariant={workspaceStatusVariant}
        statusHint={workspaceStatusHint}
        headerActions={(
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className="h-10 gap-2 rounded-full border-border/70 bg-background/70 px-4 text-[13px] font-medium text-foreground hover:bg-muted/40"
              >
                <MoreVertical size={16} />
                Meer acties
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setSummaryFlowOpen(true)}>Samenvatting</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setArchiveOpen(true)}>Casus archiveren</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={`/care/casussen/${caseId}/edit/?section=casus`}>Casus bewerken</a>
              </DropdownMenuItem>
              {missingGeo ? (
                <DropdownMenuItem asChild>
                  <a href={`/care/casussen/${caseId}/edit/?section=locatie`}>Locatie aanvullen</a>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        updatedAtLabel={updatedAtLabel}
        caseHero={caseHero}
        decisionPanel={decisionPanel}
        contextStack={contextStack}
      />

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

      <Dialog open={summaryFlowOpen} onOpenChange={setSummaryFlowOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{summaryFlowStep === "intro" ? "Samenvatting" : "Controle"}</DialogTitle>
            <DialogDescription>
              {summaryFlowStep === "intro"
              ? "Maak de casus matchklaar."
              : "Controleer kerngegevens en ga door."}
            </DialogDescription>
          </DialogHeader>

          {summaryFlowStep === "intro" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Daarna volgt matching.
              </p>
              <div className="border border-border/70 p-3 text-sm text-muted-foreground">
                Daarna: matching, validatie, aanbieder.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="border border-border/70 p-3 text-sm">
                <p><strong>Regio:</strong> {spaCase.regio}</p>
                <p><strong>Zorgvraag:</strong> {spaCase.zorgtype}</p>
                <p><strong>Urgentie:</strong> {spaCase.urgency}</p>
                <p><strong>Eigenaar:</strong> {stepOwner}</p>
              </div>
              <div className="border border-border/70 p-3 text-sm text-foreground space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Doel</p>
                  <p>{summaryPreview}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Risico's</p>
                  <ul className="list-disc pl-4">
                    {summaryRiskItems.map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Inputs</p>
                  <ul className="list-disc pl-4">
                    {summaryMatchInputs.map((input) => (
                      <li key={input}>{input}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {!matchingAllowed && (
                <p className="text-xs text-red-400">{getShortReasonLabel(matchingBlockedReason, 120)}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryFlowOpen(false)} disabled={Boolean(pendingAction)}>
              Sluiten
            </Button>
            {summaryFlowStep === "intro" ? (
              <Button
                onClick={async () => {
                  await handleAction("GENERATE_SUMMARY");
                  const payload = await loadDecisionEvaluation();
                  if (payload?.decision_context.has_summary) {
                    setSummaryFlowStep("review");
                  }
                }}
                disabled={Boolean(pendingAction)}
                className="gap-2"
              >
                {pendingAction === "GENERATE_SUMMARY" && <Loader2 size={14} className="animate-spin" />}
                Genereer samenvatting
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSummaryFlowOpen(false);
                    window.location.assign(`/care/casussen/${caseId}/edit/?section=casus`);
                  }}
                  disabled={Boolean(pendingAction)}
                >
                  Bewerken
                </Button>
                <Button
                  onClick={async () => {
                    await handleAction("START_MATCHING");
                    setSummaryFlowOpen(false);
                  }}
                  disabled={!matchingAllowed || Boolean(pendingAction)}
                  className="gap-2"
                >
                  {pendingAction === "START_MATCHING" && <Loader2 size={14} className="animate-spin" />}
                  Start matching
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
