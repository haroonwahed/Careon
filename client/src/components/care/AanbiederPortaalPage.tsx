import { useState, useCallback } from "react";
import { CheckCircle2, XCircle, HelpCircle, ArrowRight, RefreshCw } from "lucide-react";
import { apiClient } from "../../lib/apiClient";
import { useCases, type SpaCase } from "../../hooks/useCases";
import { Button } from "../ui/button";
import {
  CareAlertCard,
  CareMetaChip,
  CarePageScaffold,
  CarePrimaryList,
  CareSectionHeader,
  CareWorkListCard,
  CareWorkRow,
  EmptyState,
  ErrorState,
  LoadingState,
  OPERATIONAL_QUEUE_HEADER_GRID_CLASS,
  PrimaryActionButton,
} from "./CareDesignPrimitives";
import { cn } from "../ui/utils";

interface AanbiederPortaalPageProps {
  onCaseClick: (caseId: string) => void;
}

interface DecisionDialogState {
  caseId: string;
  caseTitle: string;
  action: "ACCEPTED" | "REJECTED" | "INFO_REQUESTED";
}

const REJECTION_REASONS: Array<{ code: string; label: string }> = [
  { code: "CAPACITY", label: "Capaciteit" },
  { code: "WAITLIST", label: "Wachtlijst" },
  { code: "CARE_MISMATCH", label: "Zorgvraag past niet" },
  { code: "REGION_MISMATCH", label: "Regio past niet" },
  { code: "SAFETY_RISK", label: "Veiligheidsrisico" },
  { code: "ADMINISTRATIVE_BLOCK", label: "Administratieve blokkade" },
  { code: "OTHER", label: "Anders" },
];

function workflowStateLabel(state: string | undefined): string {
  switch (state) {
    case "PROVIDER_REVIEW_PENDING": return "Wacht op uw reactie";
    case "PROVIDER_ACCEPTED": return "Geaccepteerd";
    case "PROVIDER_REJECTED": return "Afgewezen";
    case "PLACEMENT_CONFIRMED": return "Plaatsing bevestigd";
    default: return "Openstaand";
  }
}

function providerResponseLabel(status: string | null | undefined): string {
  switch (status) {
    case "ACCEPTED": return "Geaccepteerd";
    case "REJECTED": return "Afgewezen";
    case "NEEDS_INFO": return "Informatie gevraagd";
    case "PENDING": return "Wacht op reactie";
    default: return "Openstaand";
  }
}

function isPendingProviderDecision(c: SpaCase): boolean {
  return (
    c.status === "provider_beoordeling" ||
    c.workflowState === "PROVIDER_REVIEW_PENDING" ||
    (c.placementProviderResponseStatus != null && c.placementProviderResponseStatus === "PENDING")
  );
}

function isRespondedProviderDecision(c: SpaCase): boolean {
  return (
    c.placementProviderResponseStatus === "ACCEPTED" ||
    c.placementProviderResponseStatus === "REJECTED" ||
    c.placementProviderResponseStatus === "NEEDS_INFO"
  );
}

function urgencyLabel(c: SpaCase): string {
  return c.urgency === "critical" ? "Spoed" : c.urgency === "warning" ? "Hoog" : c.urgency === "normal" ? "Normaal" : "Laag";
}

function urgencyTone(c: SpaCase): "critical" | "warning" | "neutral" {
  return c.urgency === "critical" ? "critical" : c.urgency === "warning" ? "warning" : "neutral";
}

interface DecisionDialogProps {
  state: DecisionDialogState;
  onClose: () => void;
  onSuccess: () => void;
}

function DecisionDialog({ state, onClose, onSuccess }: DecisionDialogProps) {
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actionLabel =
    state.action === "ACCEPTED"
      ? "Accepteren"
      : state.action === "REJECTED"
        ? "Afwijzen"
        : "Informatie aanvragen";

  const canSubmit =
    state.action === "ACCEPTED"
      ? true
      : state.action === "REJECTED"
        ? rejectionReason !== ""
        : notes.trim().length >= 10;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, string> = {
        status: state.action,
        provider_comment: notes,
      };
      if (state.action === "REJECTED") {
        payload["rejection_reason_code"] = rejectionReason;
      }
      if (state.action === "INFO_REQUESTED") {
        payload["information_request_comment"] = notes;
      }
      const result = await apiClient.post<{ ok: boolean; error?: string }>(
        `/care/api/cases/${state.caseId}/provider-decision/`,
        payload,
      );
      if (result.ok) {
        onSuccess();
      } else {
        setError(result.error || "Beslissing kon niet worden vastgelegd.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Er is een fout opgetreden.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={actionLabel}
    >
      <div
        className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <div>
          <h2 className="care-text-heading text-foreground">{actionLabel}</h2>
          <p className="text-[13px] text-muted-foreground mt-1 leading-snug">{state.caseTitle}</p>
        </div>

        {error && (
          <div role="alert" className="text-[13px] text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {state.action === "REJECTED" && (
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">Reden voor afwijzing *</label>
            <select
              className="w-full rounded-lg border border-border/60 bg-background text-foreground text-[13px] px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            >
              <option value="">Selecteer een reden…</option>
              {REJECTION_REASONS.map((r) => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">
            {state.action === "INFO_REQUESTED" ? "Toelichting / gevraagde informatie *" : "Opmerkingen (optioneel)"}
          </label>
          <textarea
            className="w-full rounded-lg border border-border/60 bg-background text-foreground text-[13px] px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            rows={3}
            placeholder={
              state.action === "INFO_REQUESTED"
                ? "Beschrijf welke informatie u nodig heeft…"
                : "Eventuele opmerkingen voor de regisseur…"
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {state.action === "INFO_REQUESTED" && notes.trim().length < 10 && (
            <p className="text-[11px] text-muted-foreground">Minimaal 10 tekens vereist.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Annuleren
          </Button>
          <Button
            type="button"
            variant={state.action === "REJECTED" ? "destructive" : "default"}
            disabled={!canSubmit || submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Bezig…" : actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AanbiederPortaalPage({ onCaseClick }: AanbiederPortaalPageProps) {
  const { cases, loading, error, refetch } = useCases({ q: "" });
  const [dialog, setDialog] = useState<DecisionDialogState | null>(null);

  const pendingCases = cases.filter(isPendingProviderDecision);
  const respondedCases = cases.filter(isRespondedProviderDecision);

  const openDialog = useCallback((c: SpaCase, action: DecisionDialogState["action"]) => {
    setDialog({ caseId: c.id, caseTitle: c.title || c.id, action });
  }, []);

  const handleSuccess = useCallback(() => {
    setDialog(null);
    refetch();
  }, [refetch]);

  const topPending = pendingCases[0] ?? null;

  const attentionCard = topPending ? (
    <CareAlertCard
      density="compact"
      tone="warning"
      icon={<HelpCircle size={18} aria-hidden />}
      metric={null}
      showMetric={false}
      title={`${pendingCases.length} casus${pendingCases.length === 1 ? "" : "sen"} wacht${pendingCases.length === 1 ? "" : "en"} op uw reactie`}
      description={`U bent geselecteerd als aanbieder voor ${pendingCases.length === 1 ? "een casus" : `${pendingCases.length} casussen`}. Reageer zo snel mogelijk om de doorstroom niet te vertragen.`}
      primaryAction={(
        <PrimaryActionButton
          type="button"
          className="h-10 rounded-full px-5 text-[13px] font-semibold"
          onClick={() => onCaseClick(topPending.id)}
        >
          Bekijk casus
          <ArrowRight size={16} aria-hidden className="ml-2" />
        </PrimaryActionButton>
      )}
    />
  ) : undefined;

  return (
    <>
      {dialog && (
        <DecisionDialog
          state={dialog}
          onClose={() => setDialog(null)}
          onSuccess={handleSuccess}
        />
      )}

      <CarePageScaffold
        archetype="queue"
        className="pb-4"
        title="Mijn beoordelingen"
        subtitle="Bekijk casussen die aan u zijn toegewezen en laat uw reactie weten."
        actions={(
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-border/70 bg-background/20 px-4 text-[14px] font-medium"
            onClick={refetch}
          >
            <RefreshCw size={15} className="mr-2" aria-hidden />
            Vernieuwen
          </Button>
        )}
        dominantAction={attentionCard}
      >
        {loading && <LoadingState title="Casussen laden…" copy="Uw toegewezen casussen worden opgehaald." />}

        {!loading && error && (
          <ErrorState
            title="Casussen konden niet worden geladen"
            copy={error}
            action={<Button variant="outline" onClick={refetch}>Opnieuw proberen</Button>}
          />
        )}

        {!loading && !error && pendingCases.length === 0 && respondedCases.length === 0 && (
          <EmptyState
            title="Geen toegewezen casussen"
            copy="Er zijn momenteel geen casussen aan u toegewezen. U ontvangt een melding wanneer een regisseur u selecteert."
          />
        )}

        {!loading && !error && pendingCases.length > 0 && (
          <div className="space-y-3">
            <CareSectionHeader
              title="Wacht op uw reactie"
              meta={<CareMetaChip>{pendingCases.length} casus{pendingCases.length === 1 ? "" : "sen"}</CareMetaChip>}
            />
            <CareWorkListCard
              testId="aanbieder-pending-list"
              header={(
                <div className={cn(OPERATIONAL_QUEUE_HEADER_GRID_CLASS, "min-w-[48rem]")}>
                  <span>Urgentie</span>
                  <span>Casus</span>
                  <span>Status</span>
                  <span>Acties</span>
                </div>
              )}
            >
              <CarePrimaryList>
                {pendingCases.map((c) => (
                  <CareWorkRow
                    key={c.id}
                    testId={`aanbieder-pending-${c.id}`}
                    density="operational"
                    accentTone={urgencyTone(c)}
                    leading={(
                      <CareMetaChip className="h-6 px-2 text-[11px] font-semibold text-foreground">
                        {urgencyLabel(c)}
                      </CareMetaChip>
                    )}
                    title={(
                      <div className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold leading-tight text-foreground">
                          {c.id}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                          {c.title || "Aanvraag zonder titel"}
                        </span>
                      </div>
                    )}
                    titleAriaLabel={`Open casus ${c.id}`}
                    context={(
                      <CareMetaChip className="max-w-full truncate text-[11px]">
                        {workflowStateLabel(c.workflowState)}
                      </CareMetaChip>
                    )}
                    status={(
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="h-7 rounded-full px-3 text-[12px] font-semibold"
                          onClick={(e) => { e.stopPropagation(); openDialog(c, "ACCEPTED"); }}
                        >
                          <CheckCircle2 size={13} className="mr-1" aria-hidden />
                          Accepteren
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full px-3 text-[12px] font-medium text-muted-foreground"
                          onClick={(e) => { e.stopPropagation(); openDialog(c, "INFO_REQUESTED"); }}
                        >
                          <HelpCircle size={13} className="mr-1" aria-hidden />
                          Info vragen
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full px-3 text-[12px] font-medium text-destructive border-destructive/30 hover:bg-destructive/8"
                          onClick={(e) => { e.stopPropagation(); openDialog(c, "REJECTED"); }}
                        >
                          <XCircle size={13} className="mr-1" aria-hidden />
                          Afwijzen
                        </Button>
                      </div>
                    )}
                    owner={null}
                    nextAction={null}
                    actionLabel="Bekijk casus"
                    onOpen={() => onCaseClick(c.id)}
                    onAction={(e) => { e.stopPropagation(); onCaseClick(c.id); }}
                    actionVariant="ghost"
                  />
                ))}
              </CarePrimaryList>
            </CareWorkListCard>
          </div>
        )}

        {!loading && !error && respondedCases.length > 0 && (
          <div className="space-y-3 mt-6">
            <CareSectionHeader
              title="Eerder beantwoord"
              meta={<CareMetaChip>{respondedCases.length}</CareMetaChip>}
            />
            <CareWorkListCard
              testId="aanbieder-responded-list"
              header={(
                <div className={cn(OPERATIONAL_QUEUE_HEADER_GRID_CLASS, "min-w-[48rem]")}>
                  <span>Urgentie</span>
                  <span>Casus</span>
                  <span>Uw reactie</span>
                  <span></span>
                </div>
              )}
            >
              <CarePrimaryList>
                {respondedCases.map((c) => (
                  <CareWorkRow
                    key={c.id}
                    testId={`aanbieder-responded-${c.id}`}
                    density="operational"
                    accentTone={
                      c.placementProviderResponseStatus === "ACCEPTED"
                        ? "neutral"
                        : c.placementProviderResponseStatus === "REJECTED"
                          ? "critical"
                          : "warning"
                    }
                    leading={(
                      <CareMetaChip className="h-6 px-2 text-[11px] font-semibold text-foreground">
                        {urgencyLabel(c)}
                      </CareMetaChip>
                    )}
                    title={(
                      <div className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold leading-tight text-foreground">
                          {c.id}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                          {c.title || "Aanvraag"}
                        </span>
                      </div>
                    )}
                    titleAriaLabel={`Open casus ${c.id}`}
                    context={(
                      <CareMetaChip
                        className={cn(
                          "max-w-full truncate text-[11px] font-semibold",
                          c.placementProviderResponseStatus === "ACCEPTED" && "text-emerald-600 dark:text-emerald-400",
                          c.placementProviderResponseStatus === "REJECTED" && "text-destructive",
                        )}
                      >
                        {providerResponseLabel(c.placementProviderResponseStatus)}
                      </CareMetaChip>
                    )}
                    status={null}
                    owner={null}
                    nextAction={null}
                    actionLabel="Bekijk casus"
                    onOpen={() => onCaseClick(c.id)}
                    onAction={(e) => { e.stopPropagation(); onCaseClick(c.id); }}
                    actionVariant="ghost"
                  />
                ))}
              </CarePrimaryList>
            </CareWorkListCard>
          </div>
        )}
      </CarePageScaffold>
    </>
  );
}
