import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Loader2, Send, XCircle } from "lucide-react";
import { apiClient } from "../../lib/apiClient";
import { useCases, type SpaCase } from "../../hooks/useCases";
import { Button } from "../ui/button";
import {
  CareAttentionBar,
  CareContextHint,
  CareInfoPopover,
  CareMetricBadge,
  CarePageScaffold,
  CareSearchFiltersBar,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
} from "./CareDesignPrimitives";
import { UrgencyBadge } from "./UrgencyBadge";
import { tokens } from "../../design/tokens";

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
        title: "Intake en plaatsing",
        description: "Geaccepteerde casussen in plaatsing of intake.",
      };
    case "responses":
      return {
        title: "Plaatsingsreacties",
        description: "Casussen die zijn geaccepteerd en doorgestroomd.",
      };
    default:
      return {
        title: "Nieuwe aanvragen",
        description: "Beoordeel nieuwe verzoeken.",
      };
  }
}

export function IntakeListPage({ onCaseClick, view = "intake", onRequestApproved, role = "zorgaanbieder" }: IntakeListPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
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
  const visibleCases = view === "requests" ? pendingRequests : intakeCases;
  const avgWaitDays =
    visibleCases.length > 0
      ? Math.round(visibleCases.reduce((total, caseItem) => total + caseItem.wachttijd, 0) / visibleCases.length)
      : 0;

  const handleDecision = async (caseId: string, status: "ACCEPTED" | "REJECTED") => {
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
      archetype="worklist"
      className="pb-8"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          {summary.title}
          <CareInfoPopover ariaLabel="Intake-overzicht" testId="intake-page-info">
            <p className="text-muted-foreground">{summary.description}</p>
          </CareInfoPopover>
        </span>
      }
      metric={
        <CareMetricBadge>
          {visibleCases.length} zichtbaar · {pendingRequests.length} open{" "}
          {pendingRequests.length === 1 ? "aanvraag" : "aanvragen"} · {intakeCases.length} plaatsing/intake
        </CareMetricBadge>
      }
      dominantAction={
        <CareAttentionBar
          tone={pendingRequests.length > 0 ? "warning" : "info"}
          icon={<Send size={16} />}
          message={
            pendingRequests.length > 0
              ? pendingRequests.length === 1
                ? "1 open aanvraag — beoordeling nodig"
                : `${pendingRequests.length} open aanvragen — beoordeling nodig`
              : "Geen open aanvragen"
          }
          action={
            visibleCases.length > 0 ? (
              <PrimaryActionButton onClick={() => onCaseClick(visibleCases[0].id)}>
                Bekijk eerste casus
              </PrimaryActionButton>
            ) : undefined
          }
        />
      }
      kpiStrip={
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {[
            { label: "Open aanvragen", value: pendingRequests.length, detail: "Beoordelen" },
            { label: "In plaatsing", value: intakeCases.length, detail: "Volgende stap" },
            { label: "Gem. wachttijd", value: `${avgWaitDays}d`, detail: "Op huidige filters" },
            { label: "Zichtbaar", value: visibleCases.length, detail: "In dit overzicht" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3.5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{item.label}</p>
              <div className="mt-1.5 text-[20px] font-semibold leading-none text-foreground">{item.value}</div>
              <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      }
      filters={
        <CareSearchFiltersBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Zoek op casus, regio of zorgtype"
        />
      }
    >
      {feedback && (
        <div className="rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground">
          {feedback}
        </div>
      )}

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
          title={view === "requests" ? "Geen open verzoeken" : "Geen casussen in dit overzicht"}
          copy={view === "requests" ? "Pas de zoekopdracht of kom later terug." : "Geen plaatsingen of intakes die aan dit filter voldoen."}
        />
      )}

      {!loading && !error && visibleCases.length > 0 && (
        <div className="space-y-3">
          {visibleCases.map((caseItem) => {
            const isPending = caseItem.status === "provider_beoordeling";
            const isBusy = submittingCaseId === caseItem.id;

            return (
              <div
                key={caseItem.id}
                className="panel-surface p-4 transition-all hover:bg-card/80"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold text-foreground">{formatClientReference(caseItem.id)}</h2>
                      <UrgencyBadge urgency={caseItem.urgency} />
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
                        {isPending ? "IN BEOORDELING" : "INTAKE / PLAATSING"}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Betrokkene: {maskParticipantIdentity(caseItem.title || caseItem.id)} · Casus #{caseItem.id} · {caseItem.regio || "Onbekende regio"} · {caseItem.zorgtype || "Onbekend zorgtype"}
                    </p>

                    <p className="text-sm text-foreground/85" style={{ maxWidth: tokens.layout.contentMeasure }}>
                      {caseItem.systemInsight || "Geen toelichting."}
                    </p>

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2.5 py-1">Wachttijd: {caseItem.wachttijd} dagen</span>
                      <span className="rounded-full bg-muted px-2.5 py-1">Actie: {caseItem.recommendedAction}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Button variant="outline" onClick={() => onCaseClick(caseItem.id)}>
                      Bekijk casus
                    </Button>
                    {isPending && role === "zorgaanbieder" && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => handleDecision(caseItem.id, "REJECTED")}
                          disabled={isBusy}
                        >
                          <XCircle size={16} className="mr-2" />
                          Afwijzen
                        </Button>
                        <Button onClick={() => handleDecision(caseItem.id, "ACCEPTED")} disabled={isBusy}>
                          {isBusy ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckCircle2 size={16} className="mr-2" />}
                          Accepteren
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CareContextHint
        icon={<CheckCircle2 className="text-primary" size={20} />}
        title="Workflow"
        copy="Accepteren zet door naar plaatsing en intake. Afwijzen stuurt terug naar matching."
      />
    </CarePageScaffold>
  );
}
