import { useMemo, useState } from "react";
import { ChevronRight, Clock3, Loader2 } from "lucide-react";
import { apiClient } from "../../lib/apiClient";
import { useCases, type SpaCase } from "../../hooks/useCases";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import {
  CareDominantStatus,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import {
  CareCommandShell,
  CareMetricStrip,
  CareMetricCard,
  CareWorklist,
  CareWorklistToolbar,
  CareWorklistColumnHeader,
  CareWorklistBody,
  CareWorklistRow,
  CareWorklistRowAction,
  CareWorklistPagination,
  ROW_ACTION_CLASSES,
} from "./CareCommandPrimitives";
import { CareSlaCountdown } from "./CareSlaCountdown";
import { slaCountdownFromHours, slaTargetHoursForStatus } from "../../lib/careSla";

interface IntakeListPageProps {
  onCaseClick: (caseId: string) => void;
  view?: "requests" | "responses" | "intake";
  onRequestApproved?: (caseId: string) => void;
  role?: "gemeente" | "zorgaanbieder" | "admin";
}

function formatClientReference(caseId: string): string {
  const digits = caseId.replace(/\D/g, "");
  if (digits.length >= 3) return `CLI-${digits.padStart(5, "0").slice(-5)}`;
  return "CLI-ONBEKEND";
}

function maskParticipantIdentity(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Betrokkene afgeschermd";
  return parts.map((part) => `${part[0] ?? ""}${"•".repeat(Math.max(3, part.length - 1))}`).join(" ");
}

function matchesSearch(caseItem: SpaCase, query: string): boolean {
  if (!query) return true;
  const haystack = [caseItem.id, caseItem.title, caseItem.regio, caseItem.zorgtype].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function requestBadge(view: IntakeListPageProps["view"]): { title: string; description: string } {
  switch (view) {
    case "intake": return { title: "Intake", description: "Plan en volg intakes na bevestigde plaatsing." };
    case "responses": return { title: "Plaatsingsreacties", description: "Casussen die zijn geaccepteerd en doorgestroomd." };
    default: return { title: "Aanvragen", description: "Nieuwe verzoeken die opvolging vragen." };
  }
}

const INTAKE_COLS = "6rem minmax(12rem,2fr) minmax(10rem,1.4fr) minmax(9rem,1.1fr) minmax(9rem,1fr)";

export function IntakeListPage({ onCaseClick, view = "intake", onRequestApproved, role = "zorgaanbieder" }: IntakeListPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [breachOnly, setBreachOnly] = useState(false);
  const [submittingCaseId, setSubmittingCaseId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { cases, loading, error, refetch } = useCases({ q: searchQuery });

  const pendingRequests = useMemo(
    () => cases.filter((c) => c.status === "provider_beoordeling" && matchesSearch(c, searchQuery)),
    [cases, searchQuery],
  );
  const intakeCases = useMemo(
    () => cases.filter((c) => c.status === "plaatsing" && matchesSearch(c, searchQuery)),
    [cases, searchQuery],
  );

  const summary = requestBadge(view);
  const allVisibleCases = view === "requests" ? pendingRequests : intakeCases;
  const breachedCases = useMemo(
    () => allVisibleCases.filter((c) => {
      const target = slaTargetHoursForStatus(c.status, c.urgency);
      return target != null && slaCountdownFromHours(c.wachttijd * 24, target).status === "breached";
    }),
    [allVisibleCases],
  );
  const criticalCases = useMemo(
    () => allVisibleCases.filter((c) => c.urgency === "critical"),
    [allVisibleCases],
  );
  const visibleCases = breachOnly ? breachedCases : allVisibleCases;

  const handleDecision = async (caseId: string, status: "ACCEPTED") => {
    if (submittingCaseId) return;
    setSubmittingCaseId(caseId);
    setFeedback(null);
    try {
      await apiClient.post(`/care/api/cases/${caseId}/provider-decision/`, { status });
      refetch();
      if (status === "ACCEPTED") {
        setFeedback(`Casus ${caseId} is geaccepteerd en doorgestuurd naar intake.`);
        onRequestApproved?.(caseId);
      } else {
        setFeedback(`Casus ${caseId} is afgewezen en teruggezet naar matching.`);
      }
    } catch (decisionError) {
      setFeedback(decisionError instanceof Error ? decisionError.message : "Actie kon niet worden verwerkt.");
    } finally {
      setSubmittingCaseId(null);
    }
  };

  return (
    <CareCommandShell
      title={summary.title}
      subtitle={summary.description}
      actions={
        <Button variant="outline" className="h-9 rounded-[10px] px-4 text-[13px]" onClick={() => void refetch()}>
          Ververs
        </Button>
      }
    >
      <CareMetricStrip>
        <CareMetricCard
          value={breachedCases.length}
          label="Verlopen SLA"
          tone="urgent"
          isActive={breachOnly}
          onClick={() => setBreachOnly((v) => !v)}
        />
        <CareMetricCard
          value={criticalCases.length}
          label="Kritiek urgentie"
          tone="warning"
          isActive={false}
        />
        <CareMetricCard
          value={allVisibleCases.length}
          label="Totaal zichtbaar"
          tone="neutral"
          isActive={false}
        />
      </CareMetricStrip>

      {feedback && (
        <div className="mb-4 rounded-[10px] border border-care-success-border bg-care-success-bg px-4 py-2.5 text-[13px] text-care-success-text">
          {feedback}
        </div>
      )}

      {loading && <LoadingState title="Laden…" copy="Intake-overzicht wordt opgebouwd." />}

      {!loading && error && (
        <ErrorState title="Fout bij laden" copy={error} action={<Button variant="outline" onClick={() => void refetch()}>Opnieuw</Button>} />
      )}

      {!loading && !error && visibleCases.length === 0 && (
        <EmptyState title="Geen intakes om op te volgen" copy="Er zijn geen geplande of openstaande intakes die nu opvolging vragen." />
      )}

      {!loading && !error && visibleCases.length > 0 && (
        <CareWorklist testId="intake-workspace">
          <CareWorklistToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Zoek op casus, regio of zorgtype"
          />

          <div className="overflow-x-auto" data-testid="intake-worklist">
            <CareWorklistColumnHeader
              columns={["Urgentie", "Casus", "Details", "Termijn", "Actie"]}
              cols={INTAKE_COLS}
              minWidth="800px"
            />
            <CareWorklistBody>
              {visibleCases.map((caseItem) => {
                const isPending = caseItem.status === "provider_beoordeling";
                const isBusy = submittingCaseId === caseItem.id;
                const canDecide = isPending && role === "zorgaanbieder";
                const actionLabel = canDecide ? (isBusy ? "Verwerken…" : "Accepteren") : "Bekijk casus";

                const slaTarget = slaTargetHoursForStatus(caseItem.status, caseItem.urgency);

                return (
                  <CareWorklistRow
                    key={caseItem.id}
                    cols={INTAKE_COLS}
                    minWidth="800px"
                    accentTone={caseItem.urgency === "critical" ? "urgent" : caseItem.urgency === "warning" ? "warning" : "neutral"}
                    onRowClick={() => onCaseClick(caseItem.id)}
                  >
                    {/* Urgentie */}
                    <div className="flex items-start">
                      <span className={cn(
                        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                        caseItem.urgency === "critical"
                          ? "border-care-urgent-border bg-care-urgent-bg text-care-urgent-text"
                          : caseItem.urgency === "warning"
                            ? "border-care-warning-border bg-care-warning-bg text-care-warning-text"
                            : "border-border bg-muted/30 text-foreground",
                      )}>
                        {caseItem.urgency === "critical" ? "Kritiek" : caseItem.urgency === "warning" ? "Hoog" : "Normaal"}
                      </span>
                    </div>

                    {/* Casus */}
                    <div className="min-w-0">
                      <span className="block truncate text-[13px] font-medium leading-tight text-foreground">
                        {formatClientReference(caseItem.id)}
                      </span>
                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] text-muted-foreground">{caseItem.id}</span>
                        {caseItem.regio && <span className="text-[11px] text-muted-foreground">{caseItem.regio}</span>}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="min-w-0">
                      <CareDominantStatus>
                        {view === "intake"
                          ? (caseItem.intakeStartDate ? "Intake gepland" : "Plaatsing bevestigd")
                          : isPending ? "In beoordeling" : "Intake / plaatsing"}
                      </CareDominantStatus>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/80">
                        {maskParticipantIdentity(caseItem.title || caseItem.id)}
                      </p>
                      {(caseItem.systemInsight || caseItem.recommendedAction) && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/70">
                          {caseItem.systemInsight || caseItem.recommendedAction}
                        </p>
                      )}
                    </div>

                    {/* Termijn */}
                    <div className="flex items-start">
                      {slaTarget != null ? (
                        <CareSlaCountdown elapsedHours={caseItem.wachttijd * 24} targetHours={slaTarget} />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                          <Clock3 size={12} aria-hidden />
                          {caseItem.wachttijd}d wacht
                        </span>
                      )}
                    </div>

                    {/* Actie */}
                    <CareWorklistRowAction>
                      <button
                        type="button"
                        disabled={isBusy}
                        className={cn(canDecide ? ROW_ACTION_CLASSES.primary : ROW_ACTION_CLASSES.default, isBusy && "opacity-60 cursor-wait")}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canDecide && !isBusy) {
                            void handleDecision(caseItem.id, "ACCEPTED");
                          } else {
                            onCaseClick(caseItem.id);
                          }
                        }}
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
                        {actionLabel}
                        {!isBusy && <ChevronRight size={12} className="shrink-0 opacity-60" aria-hidden />}
                      </button>
                    </CareWorklistRowAction>
                  </CareWorklistRow>
                );
              })}
            </CareWorklistBody>
          </div>

          <CareWorklistPagination count={visibleCases.length} singular="casus" plural="casussen" />
        </CareWorklist>
      )}
    </CareCommandShell>
  );
}
