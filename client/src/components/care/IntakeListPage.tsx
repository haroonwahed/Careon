import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Loader2, Search, Send, XCircle } from "lucide-react";
import { apiClient } from "../../lib/apiClient";
import { useCases, type SpaCase } from "../../hooks/useCases";
import { Button } from "../ui/button";
import { UrgencyBadge } from "./UrgencyBadge";

interface IntakeListPageProps {
  onCaseClick: (caseId: string) => void;
  view?: "requests" | "responses" | "intake";
  onRequestApproved?: (caseId: string) => void;
  role?: "gemeente" | "zorgaanbieder" | "admin";
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
        description: "Geaccepteerde casussen die nu in plaatsing of intake zitten.",
      };
    case "responses":
      return {
        title: "Plaatsingsreacties",
        description: "Overzicht van casussen die al zijn geaccepteerd en zijn doorgestroomd naar intake.",
      };
    default:
      return {
        title: "Nieuwe aanvragen",
        description: "Beoordeel nieuwe verzoeken van gemeenten en accepteer of wijs af.",
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

  const handleDecision = async (caseId: string, status: "APPROVED" | "REJECTED") => {
    if (submittingCaseId) {
      return;
    }

    setSubmittingCaseId(caseId);
    setFeedback(null);

    try {
      await apiClient.post(`/care/api/cases/${caseId}/placement-action/`, { status });
      refetch();

      if (status === "APPROVED") {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">{summary.title}</h1>
        <p className="text-sm text-muted-foreground">{summary.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Open aanvragen</p>
            <Send size={18} className="text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-foreground">{pendingRequests.length}</p>
        </div>
        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">In intake</p>
            <CheckCircle2 size={18} className="text-green-500" />
          </div>
          <p className="text-3xl font-bold text-foreground">{intakeCases.length}</p>
        </div>
        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Gemiddelde wachttijd</p>
            <Clock3 size={18} className="text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-foreground">
            {visibleCases.length > 0
              ? Math.round(visibleCases.reduce((total, caseItem) => total + caseItem.wachttijd, 0) / visibleCases.length)
              : 0}
            <span className="ml-1 text-base font-medium text-muted-foreground">dagen</span>
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <input
          type="text"
          placeholder="Zoek op casus, regio of zorgtype"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {feedback && (
        <div className="rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground">
          {feedback}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          <span>Laden…</span>
        </div>
      )}

      {!loading && error && (
        <div className="premium-card p-6 text-sm text-destructive">
          Fout bij laden: {error}
        </div>
      )}

      {!loading && !error && visibleCases.length === 0 && (
        <div className="premium-card p-8 text-center text-sm text-muted-foreground">
          {view === "requests"
            ? "Er staan momenteel geen open aanbiedersverzoeken klaar."
            : "Er zijn nog geen casussen in deze fase."}
        </div>
      )}

      {!loading && !error && visibleCases.length > 0 && (
        <div className="space-y-3">
          {visibleCases.map((caseItem) => {
            const isPending = caseItem.status === "provider_beoordeling";
            const isBusy = submittingCaseId === caseItem.id;

            return (
              <div
                key={caseItem.id}
                className="premium-card p-6 transition-all hover:bg-card/80"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold text-foreground">{caseItem.title || `Casus ${caseItem.id}`}</h2>
                      <UrgencyBadge urgency={caseItem.urgency} />
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
                        {isPending ? "IN BEOORDELING" : "INTAKE / PLAATSING"}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Casus #{caseItem.id} · {caseItem.regio || "Onbekende regio"} · {caseItem.zorgtype || "Onbekend zorgtype"}
                    </p>

                    <p className="max-w-3xl text-sm text-foreground/85">
                      {caseItem.systemInsight || "Geen aanvullende toelichting beschikbaar."}
                    </p>

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2.5 py-1">Wachttijd: {caseItem.wachttijd} dagen</span>
                      <span className="rounded-full bg-muted px-2.5 py-1">Volgende stap: {caseItem.recommendedAction}</span>
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
                        <Button onClick={() => handleDecision(caseItem.id, "APPROVED")} disabled={isBusy}>
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

      <div className="premium-card border-blue-500/20 bg-blue-500/5 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-blue-500/10 p-2">
            <CheckCircle2 className="text-blue-500" size={22} />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Workflow</p>
            <p className="text-sm text-muted-foreground">
              Accepteren zet de casus door naar plaatsing en intake. Afwijzen stuurt de casus terug naar matching zodat de gemeente een andere aanbieder kan kiezen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
