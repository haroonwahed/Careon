import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Loader2,
  MoreVertical,
  RefreshCw,
  UserRound,
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
import { CareMetaChip } from "./CareDesignPrimitives";
import { imperativeLabelForActionCode } from "./nbaImperativeLabels";
import { NextBestAction } from "../design/NextBestAction";
import { ProcessTimeline } from "../design/ProcessTimeline";
import { useCases } from "../../hooks/useCases";
import { tokens } from "../../design/tokens";
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
import {
  canonicalPhaseForCaseExecution,
  canonicalPhaseSubStatusLabel,
  decisionTimelineIndexFromWorkflowState,
  decisionUiPhaseBadgeLabel,
  decisionUiPhaseBadgeShellClass,
  DECISION_WORKSPACE_FLOW_STEPS,
  mapApiPhaseToDecisionUiPhase,
} from "../../lib/decisionPhaseUi";
import { CARE_TERMS } from "../../lib/terminology";

interface CaseExecutionPageProps {
  caseId: string;
  role?: CaseDecisionRole;
  onBack: () => void;
}

type FlowStepId =
  | "casus"
  | "samenvatting"
  | "matching"
  | "gemeente_validatie"
  | "aanbieder_beoordeling"
  | "plaatsing"
  | "intake";

function phaseDecisionEyebrow(stepId: FlowStepId): string {
  const labels: Record<FlowStepId, string> = {
    casus: "Casusbasis",
    samenvatting: "Samenvatting",
    matching: "Matching",
    gemeente_validatie: CARE_TERMS.workflow.gemeenteValidatie,
    aanbieder_beoordeling: CARE_TERMS.workflow.aanbiederBeoordeling,
    plaatsing: CARE_TERMS.workflow.plaatsing,
    intake: CARE_TERMS.workflow.intake,
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
    aanbieder_beoordeling: CARE_TERMS.workflow.aanbiederBeoordeling,
    plaatsing: `${CARE_TERMS.workflow.plaatsing} afronden`,
    intake: `${CARE_TERMS.workflow.intake} starten`,
  };
  return titles[stepId];
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

function operationalRequirementItems(evaluation: DecisionEvaluation | null): string[] {
  if (!evaluation) {
    return ["Controleer casusstatus."];
  }
  const items: string[] = [];
  if (!evaluation.decision_context.required_data_complete) {
    items.push("Vul ontbrekende casusgegevens aan");
  }
  if (!evaluation.decision_context.has_summary) {
    items.push("Controleer en voltooi samenvatting");
  }
  if (!evaluation.decision_context.has_matching_result) {
    items.push("Start matching");
  }
  if (!evaluation.decision_context.selected_provider_id && evaluation.current_state === "MATCHING_READY") {
    items.push("Selecteer aanbieder");
  }
  if (
    evaluation.current_state === "PROVIDER_REVIEW"
    && evaluation.decision_context.provider_review_status !== "ACCEPTED"
  ) {
    items.push("Wacht op aanbiederbeoordeling of stuur opvolging");
  }
  if (evaluation.current_state === "ACCEPTED" && !evaluation.decision_context.placement_confirmed) {
    items.push("Bevestig plaatsing");
  }
  if (evaluation.current_state === "PLACED" && !evaluation.decision_context.intake_started) {
    items.push("Start intake");
  }
  if (items.length === 0) {
    items.push("Controleer status en vervolgactie.");
  }
  return Array.from(new Set(items)).slice(0, 3);
}

function CaseWorkflowTimeline({
  steps,
  activeIndex,
}: {
  steps: readonly { id: string; label: string; owner: string }[];
  activeIndex: number;
}) {
  const waitingActionLabel = "matching starten";
  const pulseBetweenPercent = (() => {
    if (steps.length < 2) {
      return null;
    }
    const safeIndex = Math.max(0, Math.min(activeIndex, steps.length - 1));
    const nextIndex = Math.min(safeIndex + 1, steps.length - 1);
    if (nextIndex === safeIndex) {
      return null;
    }
    // Step centers are evenly distributed on a 0-100 scale.
    // Pulse sits exactly between current and next center.
    const stepSpan = 100 / (steps.length - 1);
    const currentCenter = safeIndex * stepSpan;
    const nextCenter = nextIndex * stepSpan;
    return (currentCenter + nextCenter) / 2;
  })();
  const phaseStateLabel = (index: number) => {
    if (index < activeIndex) {
      return "Afgerond";
    }
    if (index === activeIndex) {
      return activeIndex === 0 ? "✓ Casus aangemaakt" : "Actief";
    }
    if (index === activeIndex + 1) {
      return `Wacht op: ${waitingActionLabel}`;
    }
    return "Nog niet gestart";
  };
  return (
    <ProcessTimeline className="rounded-2xl border border-border/70 bg-card/40 px-4 py-3.5 md:px-5 md:py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Voortgang</h2>
      </div>
      <div className="relative">
        <div className="absolute hidden md:block" style={{ top: "16px", left: "12.5%", right: "12.5%" }} aria-hidden>
            <div className="relative h-2">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dotted border-border/80" />
            {pulseBetweenPercent != null ? (
              <span
                className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary/90 animate-pulse ring-4 ring-primary/20"
                style={{ left: `${pulseBetweenPercent}%`, transform: "translate(-50%, -50%)" }}
              />
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-4 md:gap-0">
          {steps.map((step, index) => {
            const isCurrent = index === activeIndex;
            const circleTone = isCurrent
              ? "border-primary/55 bg-primary text-primary-foreground ring-1 ring-primary/35 shadow-md"
              : "border-border/70 bg-background/70 text-muted-foreground";
            return (
              <div key={step.id} className="relative min-w-0 px-0.5 pt-0 md:px-1.5 md:pt-9 md:text-center">
                <div
                  className="mb-2 flex items-center gap-2 md:absolute md:left-1/2 md:-translate-x-1/2 md:flex-col md:items-center md:gap-0"
                  style={{ top: tokens.layout.edgeZero }}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold",
                      "motion-safe:transition-[color,background-color,border-color,box-shadow] motion-safe:duration-500 motion-safe:ease-out",
                      circleTone,
                    )}
                  >
                    {index + 1}
                  </div>
                  <div className="hidden md:block" />
                </div>
                <p className={`mx-auto w-fit text-[13px] font-semibold leading-tight ${isCurrent ? "text-foreground" : "text-foreground/90"}`}>{step.label}</p>
                <span
                  className={cn(
                    "mt-1 inline-flex h-5 w-fit items-center rounded-sm border px-1.5 text-[10px] font-medium",
                    isCurrent
                      ? "border-primary/35 bg-primary/20 text-primary-foreground"
                      : "border-border/70 bg-background/75 text-muted-foreground",
                  )}
                >
                  {phaseStateLabel(index)}
                </span>
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
      <DialogContent className="sm:max-w-none" style={{ maxWidth: tokens.layout.dialogNarrowMaxWidth }}>
        <DialogHeader>
          <DialogTitle>{mode === "reject" ? "Casus afwijzen" : "Aanvullende informatie vragen"}</DialogTitle>
          <DialogDescription>
            {mode === "reject"
              ? "Geef een reden en een korte toelichting zodat de gemeente weet wat de volgende stap is."
              : "Selecteer welk type informatie nodig is en geef een korte toelichting."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
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
  const { cases, loading, error, refetch } = useCases({ q: "" });
  const spaCase = cases.find((item) => item.id === caseId);
  const [decisionEvaluation, setDecisionEvaluation] = useState<DecisionEvaluation | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<CaseDecisionActionCode | null>(null);
  const [providerDialog, setProviderDialog] = useState<"reject" | "info" | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [summaryFlowOpen, setSummaryFlowOpen] = useState(false);
  const [showRequiredDetails, setShowRequiredDetails] = useState(true);
  const [refreshingHeader, setRefreshingHeader] = useState(false);

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

  const handleHeaderRefresh = async () => {
    setRefreshingHeader(true);
    try {
      await Promise.all([
        Promise.resolve(refetch()),
        loadDecisionEvaluation(),
      ]);
      toast.success("Casusgegevens ververst.");
    } catch {
      toast.error("Verversen is mislukt.");
    } finally {
      setRefreshingHeader(false);
    }
  };

  const currentState = decisionEvaluation?.current_state ?? "";
  const isArchived = currentState === "ARCHIVED";
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
      await handleAction("COMPLETE_CASE_DATA");
      return;
    }
    await handleAction(nextBestAction.action as CaseDecisionActionCode);
  };

  const allowedActions = (decisionEvaluation?.allowed_actions ?? []).filter(
    (action) => !nextBestAction || action.action !== nextBestAction.action,
  );

  const decisionTimelineSteps = useMemo(() => DECISION_WORKSPACE_FLOW_STEPS.map((step) => ({ ...step })), []);

  if (loading) {
    return <div className="text-muted-foreground">Casus laden…</div>;
  }

  if (error || !spaCase) {
    return (
      <div className="space-y-2">
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
  const guidanceCanonicalPhase = canonicalPhaseForCaseExecution({
    evaluationPhase: decisionEvaluation?.phase,
    currentState: resolvedState,
  }) as FlowStepId;
  const decisionTimelineIndex = decisionTimelineIndexFromWorkflowState(
    resolvedState,
    resolvedState === "ARCHIVED",
  );
  const stepOwner = DECISION_WORKSPACE_FLOW_STEPS[decisionTimelineIndex]?.owner ?? "Gemeente";
  const dominantBlocker = decisionEvaluation?.blockers?.[0] ?? null;
  const blockerIsMissingSummary = dominantBlocker?.code === "MISSING_SUMMARY";
  const summaryNeedsCaseCompletion = blockerIsMissingSummary || nextBestAction?.action === "GENERATE_SUMMARY";
  const primaryButtonLabel = nextBestAction
    ? summaryNeedsCaseCompletion
      ? "Controleer casusstatus"
      : (
        nextBestAction.action === "MONITOR_CASE"
          ? (
            !decisionEvaluation?.decision_context.required_data_complete || !decisionEvaluation?.decision_context.has_summary
              ? "Controleer casusstatus"
              : "Controleer casusstatus"
          )
          : (imperativeLabelForActionCode(nextBestAction.action, nextBestAction.label)
              ?? getShortActionLabel(nextBestAction.label))
      )
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
    || (
      !summaryNeedsCaseCompletion
      && (
        !nextActionAllowed
        || Boolean(nextActionBlocked?.reason)
        || (nextBestAction?.action === "SEND_TO_PROVIDER" && !selectedProviderId)
      )
    );
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
    CONFIRM_PLACEMENT: "Acceptatie door de aanbieder ontbreekt.",
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
  const matchingAllowed = activeActionLookup.has("START_MATCHING");
  const matchingBlockedReason = decisionEvaluation?.blocked_actions.find((action) => action.action === "START_MATCHING")?.reason
    ?? "Matching is nog niet beschikbaar.";
  const summaryPreview = spaCase.systemInsight?.trim()
    ? spaCase.systemInsight.trim()
    : "Samenvatting gereed. Controleer de casuscontext en start daarna matching.";
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
  const workspaceStatusVariant = decisionLoading ? "progress" : dominantBlocker ? "blocked" : "active";
  const workspaceStatusHint = blockerIsMissingSummary
    ? "Casusgegevens onvolledig"
    : dominantBlocker
      ? getShortReasonLabel(dominantBlocker.message, 72)
      : null;

  const gateItems = operationalRequirementItems(decisionEvaluation);
  const activeStepLabel = DECISION_WORKSPACE_FLOW_STEPS[decisionTimelineIndex]?.label ?? "Onbekende fase";
  const statusLine = summaryNeedsCaseCompletion
    ? "Matching nog niet gestart."
    : dominantBlocker
      ? "Casus wacht op vervolgstap."
      : activeStepLabel.toLowerCase() === "casus gestart"
        ? "Casus aangemaakt en gereed voor matching."
        : `${activeStepLabel} is actief.`;
  const statusDotTone = summaryNeedsCaseCompletion || dominantBlocker
    ? "bg-amber-400"
    : "bg-emerald-400";
  const displayNextTransitionLabel = gateItems[0] ?? "Start matching";
  const displayNextStepHeading = displayNextTransitionLabel.toLowerCase().includes("controleer")
    ? "Start matching"
    : displayNextTransitionLabel;
  const pendingRequiredItems = gateItems.filter((item) => item !== "Controleer status en vervolgactie.");
  const completedRequiredItems = ["Casus aangemaakt"];
  const hasRequiredDetails = pendingRequiredItems.length > 0;
  const pendingIconForItem = (item: string) => {
    if (/matching/i.test(item)) {
      return <ArrowRight size={12} />;
    }
    if (/aanbieder|beoordeling/i.test(item)) {
      return <UserRound size={12} />;
    }
    if (/intake/i.test(item)) {
      return <Clock3 size={12} />;
    }
    if (/plaatsing/i.test(item)) {
      return <CheckCircle2 size={12} />;
    }
    return <Clock3 size={12} />;
  };

  const flowProgress = (
    <CaseWorkflowTimeline
      steps={decisionTimelineSteps}
      activeIndex={decisionTimelineIndex}
    />
  );

  const caseHero = (
    <div className="rounded-2xl bg-card/40 px-5 py-4">
      <div className="grid gap-2.5 pb-3 md:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Status</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className={`size-2 rounded-full ${statusDotTone}`} aria-hidden />
            {statusLine}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Eigenaar</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{stepOwner}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Laatste wijziging</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Clock3 size={13} className="text-muted-foreground" />
            {updatedAtLabel ?? "Onbekend"}
          </p>
        </div>
      </div>

      <NextBestAction className="flex shrink-0 flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <ArrowRight size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Volgende stap</p>
            <p className="mt-1 text-[24px] leading-tight font-semibold text-foreground">
              {summaryNeedsCaseCompletion ? "Start matching" : (displayNextStepHeading || primaryButtonLabel || "Start matching")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Wacht op: matching starten.</p>
          </div>
        </div>
        {nextBestAction ? (
          <Button
            type="button"
            onClick={handlePrimaryAction}
            disabled={actionButtonDisabled}
            className="h-11 min-h-[44px] w-auto min-w-[220px] justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
          >
            {summaryNeedsCaseCompletion
              ? "Start matching"
              : (displayNextStepHeading || primaryButtonLabel || getShortActionLabel(nextBestAction.label))}
            <ArrowRight size={16} />
          </Button>
        ) : null}
      </NextBestAction>
      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Benodigd voor volgende fase</p>
          </div>
          <button
            type="button"
            onClick={() => setShowRequiredDetails((current) => !current)}
            disabled={!hasRequiredDetails}
            aria-expanded={hasRequiredDetails ? showRequiredDetails : undefined}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-border/50 bg-background/40 px-2 text-[11px] font-semibold text-foreground/90 disabled:opacity-100"
          >
            {completedRequiredItems.length} van {completedRequiredItems.length + pendingRequiredItems.length} voltooid
            {hasRequiredDetails ? (
              <ChevronDown
                size={11}
                className={cn("text-muted-foreground/80 transition-transform", showRequiredDetails ? "rotate-180" : "")}
              />
            ) : null}
          </button>
        </div>
        <div className="rounded-lg border border-border/55 bg-background/35 px-3.5 py-2.5">
          <div className="space-y-2">
            {completedRequiredItems.map((item) => (
              <div key={item} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                    <CheckCircle2 size={12} />
                  </span>
                  <span className="text-sm font-medium text-foreground">{item}</span>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="inline-flex h-5 items-center rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] font-semibold text-emerald-300">
                    Voltooid
                  </span>
                  <p className="text-xs text-muted-foreground">{updatedAtLabel ?? "—"}</p>
                </div>
              </div>
            ))}
            {hasRequiredDetails && showRequiredDetails ? (
              <div className="space-y-1 border-t border-border/50 pt-2">
                {pendingRequiredItems.map((item) => (
                  <div key={item} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-500/35 bg-amber-500/12 text-amber-300">
                        {pendingIconForItem(item)}
                      </span>
                      <span className="text-sm text-foreground/90">Wacht op: {item.toLowerCase()}</span>
                    </div>
                    <span className="inline-flex h-5 items-center rounded-sm border border-amber-500/35 bg-amber-500/12 px-1.5 text-[10px] font-semibold text-amber-300">
                      Open
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {hasRequiredDetails && !showRequiredDetails ? (
              <p className="text-xs text-muted-foreground">Open voor vereiste acties.</p>
            ) : null}
            {!hasRequiredDetails ? (
              <p className="text-xs text-muted-foreground">Geen aanvullende acties vereist.</p>
            ) : null}
          </div>
        </div>
      </div>
      {(actionButtonDisabled || decisionError) && (
        <p className="text-[12px] text-destructive">
          {decisionError ?? getShortReasonLabel(primaryDisabledReason, 110)}
        </p>
      )}
    </div>
  );

  const decisionPanel = null;

  const contextStack = flowProgress;

  return (
    <>
      <CasusWorkspaceLayout
        onBack={onBack}
        flowProgress={null}
        title={`CASUS #${spaCase.id.replace(/\D/g, "") || spaCase.id} — ${spaCase.title}`}
        metaLine=""
        phaseLabel=""
        phaseId={undefined}
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
        onRefresh={handleHeaderRefresh}
        refreshing={refreshingHeader}
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
        <DialogContent className="sm:max-w-none" style={{ maxWidth: tokens.layout.dialogWideMaxWidth }}>
          <DialogHeader>
            <DialogTitle>Samenvatting</DialogTitle>
            <DialogDescription>
              {summaryNeedsCaseCompletion
                ? "Casusgegevens zijn nog niet compleet; samenvatting volgt automatisch zodra de casus is aangevuld."
                : "Controleer de samenvatting en ga daarna verder met matching."}
            </DialogDescription>
          </DialogHeader>

          {summaryNeedsCaseCompletion ? (
            <div className="space-y-3">
              <div className="border border-border/70 p-3 text-sm text-foreground space-y-2">
                <p className="font-medium">Casusgegevens onvolledig</p>
                <p className="text-muted-foreground">
                  Vul de casus aan zodat samenvatting en matching automatisch kunnen doorlopen.
                </p>
              </div>
              <div className="border border-border/70 p-3 text-sm text-foreground space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Samenvatting</p>
                  <p>Samenvatting wordt automatisch verwerkt zodra de casus compleet is.</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Volgende stap</p>
                  <p>Vul casus aan om matching te starten.</p>
                </div>
              </div>
            </div>
          ) : null}
          {!summaryNeedsCaseCompletion && (
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
            {summaryNeedsCaseCompletion ? (
              <Button
                onClick={async () => {
                  await handleAction("COMPLETE_CASE_DATA");
                  setSummaryFlowOpen(false);
                }}
                disabled={Boolean(pendingAction)}
                className="gap-2"
              >
                {pendingAction === "COMPLETE_CASE_DATA" && <Loader2 size={14} className="animate-spin" />}
                Vul casus aan
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
