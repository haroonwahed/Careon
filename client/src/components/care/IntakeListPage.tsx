import { useMemo, useState } from "react";
import { Clock3, Loader2, Send } from "lucide-react";
import { apiClient } from "../../lib/apiClient";
import { useCases, type SpaCase } from "../../hooks/useCases";
import { Button } from "../ui/button";
import {
  CareAttentionBar,
  CareQueueInlineAction,
  CareDominantStatus,
  CareMetaChip,
  CareMetricBadge,
  CareOperationalQueueHeader,
  CarePageScaffold,
  CarePrimaryList,
  CareSectionHeader,
  CareWorkspaceSection,
  CareSearchFiltersBar,
  CareWorkListCard,
  CareWorkRow,
  CARE_RHYTHM,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./CareDesignPrimitives";
import { CareSlaCountdown } from "./CareSlaCountdown";
import { slaCountdownFromHours, slaTargetHoursForStatus } from "../../lib/careSla";
import { cn } from "../ui/utils";

interface IntakeListPageProps {
  onCaseClick: (caseId: string) => void;
  view?: "requests" | "responses" | "intake";
  onRequestApproved?: (caseId: string) => void;
  role?: "gemeente" | "zorgaanbieder" | "admin";
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

function matchesSearch(caseItem: SpaCase, query: string): boolean {
  if (!query) {
    return true;
  }

  const haystack = [caseItem.id, caseItem.title, caseItem.regio, caseItem.zorgtype]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function requestBadge(view: IntakeListPageProps["view"]): { title: string; description: string } {
  switch (view) {
    case "intake":
      return {
        title: "Intake",
        description: "Plan en volg intakes na bevestigde plaatsing.",
      };
    case "responses":
      return {
        title: "Plaatsingsreacties",
        description: "Casussen die zijn geaccepteerd en doorgestroomd.",
      };
    default:
      return {
        title: "Aanvragen",
        description: "Nieuwe verzoeken die opvolging vragen.",
      };
  }
}

export function IntakeListPage({ onCaseClick, view = "intake", onRequestApproved, role = "zorgaanbieder" }: IntakeListPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [breachOnly, setBreachOnly] = useState(false);
  const [submittingCaseId, setSubmittingCaseId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { cases, loading, error, refetch } = useCases({ q: searchQuery });

  const pendingRequests = useMemo(
    () => cases.filter((caseItem) => caseItem.status === "provider_beoordeling" && matchesSearch(caseItem, searchQuery)),
    [cases, searchQuery],
  );
  const intakeCases = useMemo(
    () => cases.filter((caseItem) => caseItem.status === "plaatsing" && matchesSearch(caseItem, searchQuery)),
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
  const visibleCases = breachOnly ? breachedCases : allVisibleCases;
  const attentionMessage =
    feedback ??
    (visibleCases.length > 0
      ? visibleCases.length === 1
        ? "1 casus wacht op opvolging"
        : `${visibleCases.length} casussen wachten op opvolging`
      : "Geen intakes om op te volgen");

  const handleDecision = async (caseId: string, status: "ACCEPTED") => {
    if (submittingCaseId) {
      return;
    }

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
    <CarePageScaffold
      archetype="queue"
      className="pb-8"
      titleClassName="text-[32px] sm:text-[36px] lg:text-[38px]"
      title={summary.title}
      subtitle={summary.description}
      metric={<CareMetricBadge>{visibleCases.length} zichtbaar</CareMetricBadge>}
      dominantAction={
        visibleCases.length > 0 ? (
          <CareAttentionBar
            layout="compact"
            tone="warning"
            icon={<Send size={16} />}
            message={attentionMessage}
            action={<CareQueueInlineAction onClick={() => onCaseClick(visibleCases[0].id)}>Bekijk eerste casus</CareQueueInlineAction>}
          />
        ) : undefined
      }
      actions={
        <Button variant="outline" onClick={() => void refetch()}>
          Ververs
        </Button>
      }
    >
      <CareWorkspaceSection
        testId="intake-workspace"
        aria-labelledby="intake-werkvoorraad-heading"
        bodyBleedX
        header={
          <CareSectionHeader
            className="lg:flex-col lg:items-stretch"
            title={<span id="intake-werkvoorraad-heading">Werkvoorraad</span>}
            meta={
              <div className={cn("w-full min-w-0", CARE_RHYTHM.metaStack)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex w-fit items-center rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 text-[12px] font-semibold text-muted-foreground">
                    {allVisibleCases.length} casussen
                  </span>
                  {breachedCases.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBreachOnly((v) => !v)}
                      className={cn(
                        "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold transition-colors",
                        breachOnly
                          ? "border-care-urgent-border bg-care-urgent-bg text-care-urgent-text"
                          : "border-care-urgent-border/60 bg-care-urgent-bg/30 text-care-urgent-text hover:bg-care-urgent-bg",
                      )}
                      aria-pressed={breachOnly}
                    >
                      {breachedCases.length} verlopen SLA
                      {breachOnly && <span aria-hidden> ×</span>}
                    </button>
                  )}
                </div>
                <CareSearchFiltersBar
                  variant="workspace"
                  className="px-0"
                  searchValue={searchQuery}
                  onSearchChange={setSearchQuery}
                  searchPlaceholder="Zoek op casus, regio of zorgtype"
                />
              </div>
            }
          />
        }
      >
        {loading && <LoadingState title="Laden…" copy="Intake-overzicht wordt opgebouwd." />}

        {!loading && error && (
          <ErrorState
            title="Fout bij laden"
            copy={error}
            action={<Button variant="outline" onClick={() => void refetch()}>Opnieuw</Button>}
          />
        )}

        {!loading && !error && visibleCases.length === 0 && (
          <EmptyState
            title="Geen intakes om op te volgen"
            copy="Er zijn geen geplande of openstaande intakes die nu opvolging vragen."
          />
        )}

        {!loading && !error && visibleCases.length > 0 && (
          <CareWorkListCard
            testId="intake-worklist"
            header={
              <CareOperationalQueueHeader
                labels={["Urgentie", "Casus", "Operationeel", "Status", "Wachttijd", "Volgende actie"]}
              />
            }
          >
            <div className="divide-y divide-border/40">
              <CarePrimaryList>
                {visibleCases.map((caseItem) => {
                  const isPending = caseItem.status === "provider_beoordeling";
                  const isBusy = submittingCaseId === caseItem.id;
                  const canDecide = isPending && role === "zorgaanbieder";

                  return (
                    <CareWorkRow
                      key={caseItem.id}
                      density="operational"
                      leading={
                        <CareMetaChip
                          className={cn(
                            "h-6 px-2 text-[11px] font-semibold",
                            caseItem.urgency === "critical"
                              ? "border bg-care-urgent-bg text-care-urgent-text border-care-urgent-border"
                              : caseItem.urgency === "warning"
                                ? "border bg-care-warning-bg text-care-warning-text border-care-warning-border"
                                : "border-border bg-muted/30 text-foreground",
                          )}
                        >
                          {caseItem.urgency === "critical" ? "Kritiek" : caseItem.urgency === "warning" ? "Hoog" : "Normaal"}
                        </CareMetaChip>
                      }
                      title={formatClientReference(caseItem.id)}
                      context={
                        <>
                          <CareMetaChip className="font-mono text-[11px]">{caseItem.id}</CareMetaChip>
                          <CareMetaChip>{caseItem.regio || "Regio onbekend"}</CareMetaChip>
                          <span className="line-clamp-1 min-w-0 max-w-[min(100%,28rem)] text-[11px] text-foreground/85">
                            {caseItem.systemInsight || caseItem.recommendedAction || "Geen toelichting."}
                          </span>
                        </>
                      }
                      status={
                        <CareDominantStatus>
                          {view === "intake"
                            ? (caseItem.intakeStartDate ? "Intake gepland" : "Plaatsing bevestigd")
                            : isPending
                              ? "In beoordeling"
                              : "Intake / plaatsing"}
                        </CareDominantStatus>
                      }
                      time={(() => {
                        const slaTarget = slaTargetHoursForStatus(caseItem.status, caseItem.urgency);
                        return slaTarget != null ? (
                          <CareSlaCountdown elapsedHours={caseItem.wachttijd * 24} targetHours={slaTarget} />
                        ) : (
                          <CareMetaChip>
                            <Clock3 size={12} aria-hidden />
                            {caseItem.wachttijd}d wacht
                          </CareMetaChip>
                        );
                      })()}
                      contextInfo={
                        <CareMetaChip>{maskParticipantIdentity(caseItem.title || caseItem.id)}</CareMetaChip>
                      }
                      actionLabel={canDecide ? (isBusy ? "Verwerken…" : "Accepteren") : "Bekijk casus"}
                      actionVariant={canDecide ? "primary" : "ghost"}
                      accentTone={caseItem.urgency === "critical" ? "critical" : caseItem.urgency === "warning" ? "warning" : "neutral"}
                      onOpen={() => onCaseClick(caseItem.id)}
                      onAction={(event) => {
                        event.stopPropagation();
                        if (canDecide && !isBusy) {
                          void handleDecision(caseItem.id, "ACCEPTED");
                        } else {
                          onCaseClick(caseItem.id);
                        }
                      }}
                    />
                  );
                })}
              </CarePrimaryList>
            </div>
          </CareWorkListCard>
        )}
      </CareWorkspaceSection>
    </CarePageScaffold>
  );
}
