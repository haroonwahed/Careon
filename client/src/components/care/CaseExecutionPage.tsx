import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
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
import { ArrangementAlignmentPanel } from "./ArrangementAlignmentPanel";
import { CasusWorkspaceLayout } from "./CasusWorkspaceLayout";
import {
  CaseAttentionPointsCard,
  CaseDetailEvidenceList,
  CaseExecutionDetailTabs,
  CaseKeyFactsCard,
  CaseOperationalStepper,
  CasePrimaryActionPanel,
  CaseTimelineHistoryList,
  shortenAttentionLabel,
} from "./CaseExecutionWorkspaceSections";
import { imperativeLabelForActionCode } from "./nbaImperativeLabels";
import { useCases } from "../../hooks/useCases";
import { useCurrentUser } from "../../hooks/useCurrentUser";
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
import { ApiRequestError } from "../../lib/apiClient";
import { getShortActionLabel, getShortReasonLabel } from "../../lib/uxCopy";
import {
  canonicalPhaseForCaseExecution,
  canonicalPhaseSubStatusLabel,
  decisionTimelineIndexFromWorkflowState,
  decisionUiPhaseBadgeLabel,
  decisionUiPhaseBadgeShellClass,
  DECISION_WORKSPACE_FLOW_STEPS,
  mapApiPhaseToDecisionUiPhase,
  type DecisionUiPhaseId,
} from "../../lib/decisionPhaseUi";
import { CARE_TERMS } from "../../lib/terminology";
import { toCareCaseEdit } from "../../lib/routes";

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

function formatWaitingIndicator(hoursInState: number | null | undefined, stateLabel: string): string | null {
  if (hoursInState == null || Number.isNaN(hoursInState)) {
    return null;
  }
  if (hoursInState < 48) {
    const roundedHours = Math.max(1, Math.round(hoursInState));
    return `${roundedHours} uur zonder voortgang (${stateLabel.toLowerCase()})`;
  }
  const days = Math.max(1, Math.round(hoursInState / 24));
  if (days >= 7) {
    return `${days} dagen zonder voortgang — doorlooptijd overschreden`;
  }
  return `${days} dag${days === 1 ? "" : "en"} zonder voortgang (${stateLabel.toLowerCase()})`;
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
  const { me } = useCurrentUser();
  const spaCase = cases.find((item) => item.id === caseId);
  const [decisionEvaluation, setDecisionEvaluation] = useState<DecisionEvaluation | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<CaseDecisionActionCode | null>(null);
  const [providerDialog, setProviderDialog] = useState<"reject" | "info" | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [summaryFlowOpen, setSummaryFlowOpen] = useState(false);
  const [refreshingHeader, setRefreshingHeader] = useState(false);
  const [detailTab, setDetailTab] = useState("overzicht");

  const loadDecisionEvaluation = async () => {
    setDecisionLoading(true);
    setDecisionError(null);
    try {
      const payload = await fetchCaseDecisionEvaluation(caseId);
      setDecisionEvaluation(payload);
      return payload;
    } catch (fetchError) {
      if (fetchError instanceof ApiRequestError && fetchError.status === 404) {
        setDecisionError(
          "Deze casus bestaat niet of is voor uw account niet zichtbaar (geen gekoppelde plaatsing).",
        );
      } else {
        setDecisionError(fetchError instanceof Error ? fetchError.message : "Beslisinformatie kon niet worden geladen.");
      }
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
  const organizationLabel = me?.organization?.name?.trim() ?? "";
  const organizationMunicipalityLabel = organizationLabel
    ? (organizationLabel.toLowerCase().startsWith("gemeente ") ? organizationLabel : `Gemeente ${organizationLabel}`)
    : "Gemeente";
  const municipalityOwnerLabel = spaCase.regio && spaCase.regio !== "—"
    ? `Gemeente ${spaCase.regio}`
    : organizationMunicipalityLabel;
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
      { action: "BUDGET_APPROVE", label: "Budget akkoord", reason: "Nog niet toegestaan vanuit de huidige fase.", allowed: false },
      { action: "BUDGET_REJECT", label: "Budget afwijzen", reason: "Nog niet toegestaan vanuit de huidige fase.", allowed: false },
      { action: "BUDGET_REQUEST_INFO", label: "Budget: meer info", reason: "Nog niet toegestaan vanuit de huidige fase.", allowed: false },
      { action: "BUDGET_DEFER", label: "Budget uitstellen", reason: "Nog niet toegestaan vanuit de huidige fase.", allowed: false },
      { action: "COMPLETE_WIJKTEAM_INTAKE", label: "Wijkteam intake afronden", reason: "Nog niet toegestaan vanuit de huidige fase.", allowed: false },
      { action: "COMPLETE_ZORGVRAAG_ASSESSMENT", label: "Zorgvraagbeoordeling afronden", reason: "Nog niet toegestaan vanuit de huidige fase.", allowed: false },
      { action: "ACTIVATE_PLACEMENT_MONITORING", label: "Actieve plaatsing activeren", reason: "Nog niet toegestaan vanuit de huidige fase.", allowed: false },
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
  const decisionCtx = decisionEvaluation?.decision_context;
  const providerRejectionSignal =
    (decisionCtx?.provider_rejection_count ?? 0) > 0
    || Boolean(decisionCtx?.latest_rejection_reason?.trim())
    || Boolean(decisionCtx?.latest_rejection_reason_code?.trim());
  const providerResponseEvidenceParts = [
    decisionCtx?.latest_rejection_reason_code?.trim(),
    decisionCtx?.latest_rejection_reason?.trim(),
  ].filter(Boolean) as string[];
  const providerResponseEvidenceRow = providerRejectionSignal
    ? {
      label: "Laatste aanbiederreactie",
      value: providerResponseEvidenceParts.length > 0 ? providerResponseEvidenceParts.join(" · ") : "Geregistreerd",
      impact: `Volledige redencode en notities staan in de casustijdlijn en audittrail (${decisionCtx?.provider_rejection_count ?? 0} signalen).`,
      tone: "warning" as const,
    }
    : null;
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
    ...(providerResponseEvidenceRow ? [providerResponseEvidenceRow] : []),
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
    || row.label === "Laatste aanbiederreactie"
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
      ? "Wacht op regieactie."
      : activeStepLabel.toLowerCase() === "casus gestart"
        ? "Casus aangemaakt en gereed voor matching."
        : `${activeStepLabel} is actief.`;
  const statusDotTone = summaryNeedsCaseCompletion || dominantBlocker
    ? "bg-amber-400"
    : "bg-emerald-400";
  const currentPhaseLabel = decisionUiPhaseBadgeLabel(mapApiPhaseToDecisionUiPhase(resolvedState));
  const waitForStateLabel = nextBestAction?.label ?? activeStepLabel;
  const waitingSignal = formatWaitingIndicator(
    decisionEvaluation?.decision_context.hours_in_current_state,
    waitForStateLabel,
  );
  const matchingAvailabilityLabel = decisionEvaluation?.decision_context.has_matching_result
    ? "Matchadvies beschikbaar"
    : (
      decisionEvaluation?.decision_context.has_summary
        ? "Matchvoorstel in voorbereiding"
        : "Matching nog niet mogelijk: samenvatting ontbreekt"
    );
  const providerSelectionLabel = decisionEvaluation?.decision_context.selected_provider_name
    ? `Geselecteerde aanbieder: ${decisionEvaluation.decision_context.selected_provider_name}`
    : (
      decisionEvaluation?.decision_context.has_matching_result
        ? "Aanbiederkeuze nog nodig"
        : "Aanbiederkeuze volgt na matching"
    );
  const operationalContextSignals = [
    waitingSignal,
    matchingAvailabilityLabel,
    providerSelectionLabel,
    missingGeo ? "Geen aanbieder binnen regio bevestigd" : "Regiodekking beschikbaar",
    decisionEvaluation?.decision_context.urgency?.toLowerCase().includes("spoed")
      ? "Spoedplaatsing vereist"
      : null,
    resolvedState === "MATCHING_READY" ? `Wacht op ${CARE_TERMS.workflow.gemeenteValidatie.toLowerCase()}` : null,
    dominantBlocker ? getShortReasonLabel(dominantBlocker.message, 68) : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 3);
  const statusAttentionCount = operationalContextSignals.length;
  const statusTriggerCopy = statusAttentionCount > 0
    ? `${statusAttentionCount} open aandachtspunt${statusAttentionCount === 1 ? "" : "en"}`
    : "Stabiele voortgang";
  const matchingProposalStatusLabel = !decisionEvaluation?.decision_context.has_matching_result
    ? "Nog geen passend voorstel"
    : decisionEvaluation?.confidence_score == null
      ? "Matchvoorstel beschikbaar"
      : decisionEvaluation.confidence_score >= 0.75
        ? "Voorstel is goed onderbouwd"
        : decisionEvaluation.confidence_score >= 0.45
          ? "Voorstel vraagt aanvullende controle"
          : "Voorstel vraagt herbeoordeling";
  const actionHolderLabel = (() => {
    if (summaryNeedsCaseCompletion) {
      return municipalityOwnerLabel;
    }
    if (resolvedState === "PROVIDER_REVIEW") {
      return selectedProviderName || CARE_TERMS.roles.zorgaanbieder;
    }
    if (resolvedState === "PLACED" && !decisionEvaluation?.decision_context.intake_started) {
      return selectedProviderName || "Intakecoordinator";
    }
    return stepOwner;
  })();
  const waitingOnLabel = (() => {
    if (summaryNeedsCaseCompletion) {
      return "Samenvatting wordt verwerkt";
    }
    if (resolvedState === "MATCHING_READY" && !selectedProviderId) {
      return `Wacht op ${CARE_TERMS.workflow.gemeenteValidatie.toLowerCase()}`;
    }
    if (resolvedState === "PROVIDER_REVIEW") {
      return "Wacht op reactie aanbieder";
    }
    if (resolvedState === "ACCEPTED" && !decisionEvaluation?.decision_context.placement_confirmed) {
      return "Wacht op plaatsing";
    }
    if (resolvedState === "PLACED" && !decisionEvaluation?.decision_context.intake_started) {
      return "Wacht op intake-start";
    }
    return "Wacht op doorstroming";
  })();
  const ctaSupportLine = summaryNeedsCaseCompletion
    ? "Matching wordt gestart zodra samenvatting compleet is."
    : nextBestAction?.action === "START_MATCHING"
      ? (
        decisionEvaluation?.decision_context.has_summary
          ? "Matchvoorstel wordt opgebouwd op basis van actuele casuscontext."
          : "Aanvullende gegevens zijn vereist voordat matching kan starten."
      )
      : (
        dominantBlocker
          ? getShortReasonLabel(dominantBlocker.message, 100)
          : "Deze stap ondersteunt veilige doorstroming."
      );
  const situationInsight = spaCase.systemInsight
    ? getShortReasonLabel(spaCase.systemInsight, 90)
    : "Geen aanvullende situatienotitie beschikbaar.";
  const arrangementCareContext = {
    zorgvorm: spaCase.zorgtype,
    regio: spaCase.regio,
    aanmelder: spaCase.owner,
    zorgintensiteit:
      spaCase.urgency === "critical"
        ? "Spoed / hoog"
        : spaCase.urgency === "warning"
          ? "Verhoogd"
          : spaCase.urgency === "normal"
            ? "Standaard"
            : "Laag / stabiel",
    startperiode: (() => {
      if (!spaCase.intakeStartDate) {
        return "—";
      }
      const parsed = new Date(spaCase.intakeStartDate);
      return Number.isNaN(parsed.getTime())
        ? "—"
        : parsed.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
    })(),
    korteSamenvatting: situationInsight,
  };
  const careSituationSummaryLines = [
    `Situatie: ${situationInsight}`,
    `Zorgvraag: ${spaCase.zorgtype}`,
    `Regio: ${spaCase.regio}`,
    `Urgentie: ${spaCase.urgency}`,
    missingGeo ? "Locatiebasis onvolledig voor volledige matching." : "Locatiebasis beschikbaar voor matching.",
  ].slice(0, 5);
  const displayNextTransitionLabel = gateItems[0] ?? "Start matching";
  const displayNextStepHeading = displayNextTransitionLabel.toLowerCase().includes("controleer")
    ? "Start matching"
    : displayNextTransitionLabel;

  const trajectoryExited = resolvedState === "ARCHIVED";
  const showArrangementAlignment = role === "gemeente" || role === "admin";

  const attentionItems = attentionRollup.map((row) => {
    const severity = row.key.startsWith("blocker") ? "critical" : row.key.startsWith("risk") ? "warning" : "info";
    return {
      key: row.key,
      label: shortenAttentionLabel(row.headline, row.body),
      tone: severity as "critical" | "warning" | "info",
    };
  });

  const stepWarningIndexes = dominantBlocker || summaryNeedsCaseCompletion
    ? [decisionTimelineIndex]
    : [];

  const caseFacts = [
    { label: "Zorgvraag", value: spaCase.zorgtype || "—", title: spaCase.zorgtype },
    { label: "Regio", value: spaCase.regio || "—" },
    { label: "Zorgintensiteit", value: arrangementCareContext.zorgintensiteit },
    { label: "Startperiode", value: arrangementCareContext.startperiode },
    { label: "Aanmelder", value: spaCase.owner || "—" },
    {
      label: "Bronregistratie",
      value: spaCase.arrangementProvider?.trim() || spaCase.arrangementTypeCode?.trim() || "—",
      title: spaCase.arrangementProvider || spaCase.arrangementTypeCode,
    },
  ];

  const primaryCtaLabel = nextBestAction
    ? (summaryNeedsCaseCompletion
      ? "Start matching"
      : (displayNextStepHeading || primaryButtonLabel || getShortActionLabel(nextBestAction.label)))
    : null;

  const historyEvents = (decisionEvaluation?.timeline_signals.recent_events ?? []).slice(0, 12).map((event) => ({
    timestamp: formatUpdatedAtLabel(event.timestamp) ?? event.timestamp,
    label: event.user_action || event.event_type,
    source: event.action_source,
  }));

  const overviewEvidence = compactEvidenceRows.map((row) => ({
    label: row.label,
    value: row.value,
  }));

  const flowProgress = (
    <CaseOperationalStepper
      steps={decisionTimelineSteps}
      activeIndex={decisionTimelineIndex}
      warningStepIndexes={stepWarningIndexes}
    />
  );

  const caseHero = (
    <div className="space-y-3">
      {trajectoryExited ? (
        <div
          data-testid="case-uitstroom-banner"
          role="status"
          className="rounded-lg bg-emerald-500/8 px-3 py-2 text-sm text-foreground"
        >
          <p className="font-semibold">Traject afgesloten — uitstroom</p>
        </div>
      ) : null}
      <CasePrimaryActionPanel
        statusLabel={statusLine}
        actionHolderLabel={actionHolderLabel}
        waitingOnLabel={waitingOnLabel}
        nextStepLabel={summaryNeedsCaseCompletion ? "Start matching" : (displayNextStepHeading || "Volgende actie")}
        primaryCtaLabel={primaryCtaLabel}
        onPrimaryAction={() => void handlePrimaryAction()}
        primaryDisabled={actionButtonDisabled}
        disabledReason={primaryDisabledReason}
        errorMessage={decisionError}
      />
    </div>
  );

  const contextStack = (
    <div className="space-y-4">
      {flowProgress}
      <CaseKeyFactsCard facts={caseFacts} />
      {showArrangementAlignment ? (
        <ArrangementAlignmentPanel caseId={caseId} careContext={arrangementCareContext} variant="compact" />
      ) : null}
      <CaseAttentionPointsCard
        items={attentionItems}
        onShowAll={attentionItems.length > 3 ? () => setDetailTab("overzicht") : undefined}
      />
      <CaseExecutionDetailTabs
        activeTab={detailTab}
        onTabChange={setDetailTab}
        overzicht={(
          <div className="space-y-3">
            <CaseDetailEvidenceList rows={overviewEvidence} />
            {verificationSteps.length > 0 ? (
              <ul className="surface-section rounded-xl px-4 py-3 text-[13px] text-muted-foreground md:px-5">
                {verificationSteps.map((step) => (
                  <li key={step} className="py-1">{step}</li>
                ))}
              </ul>
            ) : null}
            {attentionRollup.length > 3 ? (
              <ul className="surface-section rounded-xl px-4 py-3 md:px-5">
                {attentionRollup.map((row) => (
                  <li key={row.key} className="border-b border-border/30 py-2 text-[13px] last:border-0">
                    <span className="font-medium text-foreground">{row.headline}: </span>
                    <span className="text-muted-foreground">{row.body}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        arrangement={showArrangementAlignment ? (
          <ArrangementAlignmentPanel caseId={caseId} careContext={arrangementCareContext} variant="full" />
        ) : (
          <p className="text-sm text-muted-foreground">Geen arrangement-advies voor uw rol.</p>
        )}
        matching={(
          <CaseDetailEvidenceList
            rows={[
              { label: "Matchadvies", value: decisionEvaluation?.decision_context.has_matching_result ? "Beschikbaar" : "Ontbreekt" },
              { label: "Aanbieder", value: selectedProviderName || "Nog niet gekozen" },
              { label: "Voorstelstatus", value: matchingProposalStatusLabel },
              { label: "Confidence", value: decisionEvaluation?.confidence_score != null ? `${Math.round(decisionEvaluation.confidence_score * 100)}%` : "—" },
              { label: "Wachttijd", value: waitingSignal ?? "—" },
            ]}
          />
        )}
        validatie={(
          <CaseDetailEvidenceList
            rows={[
              { label: "Gemeentelijke validatie", value: resolvedState === "MATCHING_READY" ? "Vereist" : "Niet actief" },
              { label: "Verplichte gegevens", value: decisionEvaluation?.decision_context.required_data_complete ? "Compleet" : "Onvolledig" },
              { label: "Samenvatting", value: decisionEvaluation?.decision_context.has_summary ? "Beschikbaar" : "Ontbreekt" },
            ]}
          />
        )}
        historie={<CaseTimelineHistoryList events={historyEvents} />}
        documenten={(
          <div className="surface-section rounded-xl px-4 py-3.5 text-[13px] md:px-5">
            <p className="text-muted-foreground">Documenten en bijlagen beheer je in de casusbewerking.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3 rounded-full" asChild>
              <a href={toCareCaseEdit(caseId, "casus")}>Open casus bewerken</a>
            </Button>
          </div>
        )}
      />
    </div>
  );

  return (
    <>
      <CasusWorkspaceLayout
        onBack={onBack}
        flowProgress={null}
        title={`CASUS #${spaCase.id.replace(/\D/g, "") || spaCase.id} — ${spaCase.title}`}
        metaLine={null}
        phaseLabel={currentPhaseLabel}
        phaseId={mapApiPhaseToDecisionUiPhase(resolvedState) as DecisionUiPhaseId}
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
                Casusacties
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setSummaryFlowOpen(true)}>Samenvatting</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setArchiveOpen(true)}>Casus archiveren</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={toCareCaseEdit(caseId, "casus")}>Casus bewerken</a>
              </DropdownMenuItem>
              {missingGeo ? (
                <DropdownMenuItem asChild>
                  <a href={toCareCaseEdit(caseId, "locatie")}>Locatie aanvullen</a>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        updatedAtLabel={updatedAtLabel}
        onRefresh={handleHeaderRefresh}
        refreshing={refreshingHeader}
        caseHero={caseHero}
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
                    window.location.assign(toCareCaseEdit(caseId, "casus"));
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
