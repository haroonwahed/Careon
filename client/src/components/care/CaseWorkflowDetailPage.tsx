import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronDown,
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

interface CaseWorkflowDetailPageProps {
  caseId: string;
  role?: CaseDecisionRole;
  onBack: () => void;
}

const FLOW_STEPS = [
  { id: "casus", label: "Casus", owner: "Gemeente" },
  { id: "samenvatting", label: "Samenvatting", owner: "Systeem" },
  { id: "matching", label: "Matching", owner: "Gemeente" },
  { id: "aanbieder_beoordeling", label: "Aanbieder Beoordeling", owner: "Zorgaanbieder" },
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
  casus: "Casusgegevens moeten compleet zijn.",
  samenvatting: "Samenvatting of casuscontrole moet beschikbaar zijn.",
  matching: "De samenvatting moet compleet zijn voordat matching start.",
  aanbieder_beoordeling: "Een geselecteerde match moet naar de aanbieder zijn verstuurd.",
  plaatsing: "De aanbieder moet de casus eerst accepteren.",
  intake: "Plaatsing moet bevestigd zijn.",
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
    case "PROVIDER_REVIEW_PENDING":
    case "PROVIDER_ACCEPTED":
    case "PROVIDER_REJECTED":
      return "Aanbieder Beoordeling";
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
    case "PROVIDER_REVIEW_PENDING":
    case "PROVIDER_ACCEPTED":
    case "PROVIDER_REJECTED":
      return 3;
    case "PLACEMENT_CONFIRMED":
      return 4;
    case "INTAKE_STARTED":
      return 5;
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
    case "SEND_TO_PROVIDER":
      return "Samenvatting";
    case "PROVIDER_ACCEPT":
    case "PROVIDER_REJECT":
    case "PROVIDER_REQUEST_INFO":
      return "Aanbieder Beoordeling";
    case "CONFIRM_PLACEMENT":
      return "Aanbieder Beoordeling";
    case "START_INTAKE":
      return "Plaatsing";
    case "FOLLOW_UP_PROVIDER":
    case "REMATCH_CASE":
      return "Aanbieder Beoordeling";
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

  return (
    <div className="space-y-6 pb-12">
      <Button variant="ghost" onClick={onBack} className="gap-2 hover:bg-primary/10 hover:text-primary">
        <ArrowLeft size={16} />
        Terug naar casussen
      </Button>

      <div className="space-y-6">
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-foreground">{spaCase.title}</h1>
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
              <p className="text-sm text-muted-foreground">
                {spaCase.id} · {spaCase.regio} · {spaCase.zorgtype}
              </p>
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Rol: {roleLabel(role)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Huidige staat</p>
              <p className="mt-1 text-sm font-medium text-foreground">{stateLabel(currentState, isArchived)}</p>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">Volgende stap</p>
              </div>
              <h2 className="text-2xl font-semibold text-foreground">{decisionPanelMessage ?? bannerActionLabel}</h2>
              <p className="text-sm text-muted-foreground">{decisionPanelMessage ?? bannerActionMessage}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={priorityClasses(bannerActionPriority)}>
                  Prioriteit: {priorityLabel(bannerActionPriority)}
                </Badge>
                <Badge variant="outline">{bannerActionDescription}</Badge>
              </div>
              {!decisionPanelMessage && nextBestAction && (
                <p className="text-sm text-muted-foreground">{nextBestAction.reason}</p>
              )}
            </div>
            <div className="shrink-0 space-y-2">
              <Button
                onClick={handlePrimaryAction}
                disabled={decisionLoading || !nextBestAction || !nextActionAllowed || Boolean(nextActionBlocked?.reason) || (nextBestAction.action === "SEND_TO_PROVIDER" && !selectedProviderId)}
                className="gap-2"
              >
                {nextBestAction?.label ?? "Geen vervolgactie"}
                <ArrowRight size={16} />
              </Button>
              {!nextActionAllowed && nextActionBlocked && (
                <p className="max-w-xs text-xs text-muted-foreground">{bannerActionDisabledReason}</p>
              )}
              {nextBestAction && nextActionAllowed && nextBestAction.action === "SEND_TO_PROVIDER" && !selectedProviderId && (
                <p className="max-w-xs text-xs text-muted-foreground">Er is nog geen geselecteerde aanbieder beschikbaar om te versturen.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground">Casuspad</h2>
            <p className="text-xs text-muted-foreground">Huidige stap: {stateLabel(currentState, isArchived)}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {timeline.map((step, index) => (
              <div key={step.id} className={`rounded-xl border px-3 py-3 text-xs ${stepStatusClasses(step.status)}`}>
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
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)] gap-6">
          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Blokkades</h3>
              {decisionEvaluation?.blockers?.length ? (
                <div className="space-y-3">
                  {decisionEvaluation.blockers.map((blocker) => (
                    <div key={blocker.code} className="rounded-2xl border border-red-500/20 bg-red-500/6 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-200">
                          {blocker.severity}
                        </Badge>
                        <p className="font-semibold text-foreground">{blocker.message}</p>
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
                <div className="rounded-2xl border border-border bg-muted/15 p-4 text-sm text-muted-foreground">
                  Geen blokkades.
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Risico's</h3>
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
                <div className="rounded-2xl border border-border bg-muted/15 p-4 text-sm text-muted-foreground">
                  Geen opvallende risico's.
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Alerts</h3>
              {decisionEvaluation?.alerts?.length ? (
                <div className="space-y-3">
                  {decisionEvaluation.alerts.map((alert) => (
                    <div key={alert.code} className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={priorityClasses(alert.severity as DecisionPriority)}>
                          {alert.severity}
                        </Badge>
                        <p className="font-semibold text-foreground">{alert.title}</p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{alert.message}</p>
                      <p className="mt-2 text-xs text-foreground/80">Aanbevolen actie: {STEP_ACTION_HINTS[alert.recommended_action] ?? alert.recommended_action}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-muted/15 p-4 text-sm text-muted-foreground">
                  Geen actieve alerts.
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground">Beschikbare acties</h3>
                <Badge variant="outline">{roleLabel(role)}</Badge>
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
                        {action.label}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-border bg-muted/15 p-4 text-sm text-muted-foreground">
                  Geen beschikbare acties voor deze rol.
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Geblokkeerde acties</h3>
              {decisionEvaluation?.blocked_actions?.length ? (
                <div className="space-y-3">
                  {decisionEvaluation.blocked_actions.map((action) => (
                    <div key={action.action} className="rounded-2xl border border-border bg-muted/15 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Geblokkeerd</Badge>
                        <p className="font-semibold text-foreground">{action.label}</p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{action.reason}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Vereiste vorige stap: {requiredPreviousStep(action.action)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-muted/15 p-4 text-sm text-muted-foreground">
                  Geen geweigerde acties.
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-5">
              <Collapsible defaultOpen={false}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-foreground">Beslissingscontext</h3>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      Toon details
                      <ChevronDown size={14} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-4">
                  {decisionLoading && (
                    <div className="mb-4 rounded-xl border border-border bg-muted/15 p-3 text-sm text-muted-foreground">
                      Beslissingsinformatie wordt geladen.
                    </div>
                  )}
                  {decisionError && (
                    <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
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
                      <div key={label as string} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/10 px-3 py-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium text-foreground">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Laatste gebeurtenissen</h3>
              {decisionEvaluation?.timeline_signals?.recent_events?.length ? (
                <div className="space-y-3">
                  {decisionEvaluation.timeline_signals.recent_events.slice(0, 5).map((event) => (
                    <div key={`${event.timestamp}-${event.event_type}-${event.user_action}`} className="flex items-start gap-3">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/70" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{event.user_action || event.event_type}</p>
                        <p className="text-xs text-muted-foreground">{event.timestamp} · {event.action_source}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Geen recente gebeurtenissen beschikbaar.</p>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Casus samenvatting</h3>
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
                  <p className="text-muted-foreground">Leeftijdsschatting</p>
                  <p className="mt-1 font-medium text-foreground">{spaCase.wachttijd} dagen wachtduur</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {spaCase.problems.map((problem) => (
                  <Badge key={problem.label} variant="outline">
                    {problem.label}
                  </Badge>
                ))}
              </div>
            </section>
          </div>
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
