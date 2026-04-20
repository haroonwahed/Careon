import { ArrowLeft, ArrowRight, AlertTriangle, Building2, CalendarClock, CheckCircle2, Clock3, MapPin, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCase } from "../../lib/workflowUi";

interface CaseWorkflowDetailPageProps {
  caseId: string;
  onBack: () => void;
  onStartMatching: (caseId: string) => void;
  onOpenWorkflow: (page: "casussen" | "beoordelingen" | "matching" | "plaatsingen" | "intake") => void;
}

function urgencyClasses(urgency: "critical" | "warning" | "normal" | "stable") {
  switch (urgency) {
    case "critical":
      return "bg-red-500/10 text-red-400 border-red-500/30";
    case "warning":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "normal":
      return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    default:
      return "bg-muted/40 text-muted-foreground border-border";
  }
}

function primaryActionLabel(phase: string) {
  switch (phase) {
    case "intake":
      return "Start beoordeling";
    case "beoordeling":
      return "Beoordeling hervatten";
    case "matching":
      return "Start matching";
    case "plaatsing":
      return "Bevestig plaatsing";
    default:
      return "Bekijk plaatsing";
  }
}

export function CaseWorkflowDetailPage({ caseId, onBack, onStartMatching, onOpenWorkflow }: CaseWorkflowDetailPageProps) {
  const { cases, loading, error } = useCases({ q: "" });
  const { providers } = useProviders({ q: "" });
  const spaCase = cases.find((item) => item.id === caseId);
  const workflowCase = spaCase ? buildWorkflowCase(spaCase, providers) : null;

  if (loading) {
    return <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">Casus laden…</div>;
  }

  if (error || !workflowCase) {
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

  const handlePrimaryAction = () => {
    if (workflowCase.phase === "matching") {
      onStartMatching(workflowCase.id);
      return;
    }
    if (workflowCase.phase === "plaatsing" || workflowCase.phase === "afgerond") {
      onOpenWorkflow("plaatsingen");
      return;
    }
    onOpenWorkflow("beoordelingen");
  };

  return (
    <div className="space-y-6 pb-12">
      <Button variant="ghost" onClick={onBack} className="gap-2 hover:bg-primary/10 hover:text-primary">
        <ArrowLeft size={16} />
        Terug naar casussen
      </Button>

      <div className="space-y-6">
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h1 className="text-2xl font-semibold text-foreground">{workflowCase.id}</h1>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{workflowCase.phaseLabel}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${urgencyClasses(workflowCase.urgency)}`}>{workflowCase.urgencyLabel}</span>
              </div>
              <p className="text-sm text-muted-foreground">{workflowCase.region} · {workflowCase.clientAge} jaar · {workflowCase.clientLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
              <p className="mt-1 text-sm font-medium text-foreground">{workflowCase.phaseLabel}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={18} className="text-primary" />
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">Volgende stap</p>
              </div>
              <h2 className="text-2xl font-semibold text-foreground">{primaryActionLabel(workflowCase.phase)}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{workflowCase.workflowState.nextActionDetail}</p>
            </div>
            <Button onClick={handlePrimaryAction} className="shrink-0 gap-2">
              {primaryActionLabel(workflowCase.phase)}
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6">
          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Casus summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Cliënt</p>
                  <p className="mt-1 font-medium text-foreground">{workflowCase.clientLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Leeftijd</p>
                  <p className="mt-1 font-medium text-foreground">{workflowCase.clientAge} jaar</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Regio</p>
                  <p className="mt-1 font-medium text-foreground">{workflowCase.region}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dagen in fase</p>
                  <p className="mt-1 font-medium text-foreground">{workflowCase.daysInCurrentPhase}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {workflowCase.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{tag}</span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Beoordeling</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-foreground">{workflowCase.phase === "intake" ? "Nog niet gestart" : workflowCase.phase === "provider_beoordeling" ? "Lopend" : "Afgerond"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Wachttijd</span>
                  <span className="font-medium text-foreground">{workflowCase.daysInCurrentPhase} dagen</span>
                </div>
                <p className="text-muted-foreground">De beoordeling stuurt door naar matching zodra de zorgvraag en urgentie bevestigd zijn.</p>
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Matching</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Readiness</span>
                  <span className="font-medium text-foreground">{workflowCase.readyForMatching ? "Klaar" : "Nog niet klaar"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Aanbevolen aanbieders</span>
                  <span className="font-medium text-foreground">{workflowCase.recommendedProvidersCount}</span>
                </div>
                <p className="text-muted-foreground">{workflowCase.recommendedProvidersCount > 0 ? `Beste huidige optie: ${workflowCase.recommendedProviderName ?? "nog niet gekozen"}.` : "Er zijn nog geen passende aanbieders in de huidige selectie."}</p>
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Plaatsing</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-foreground">{workflowCase.placementStatusLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-medium text-foreground">{workflowCase.recommendedProviderName ?? "Nog niet gekozen"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Intake</span>
                  <span className="font-medium text-foreground">{workflowCase.intakeDateLabel ?? "Volgt na bevestiging"}</span>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Status timeline</h3>
              <div className="space-y-3">
                {workflowCase.workflowState.timelineEvents.slice(0, 5).map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/70" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{event.actorName} · {event.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">System signals</h3>
              <div className="space-y-3">
                {workflowCase.workflowState.signals.length === 0 && (
                  <p className="text-sm text-muted-foreground">Geen actieve signalen.</p>
                )}
                {workflowCase.workflowState.signals.map((signal) => (
                  <div key={signal.id} className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="flex items-start gap-2">
                      <ShieldAlert size={16} className={signal.severity === "critical" ? "text-red-400" : signal.severity === "warning" ? "text-amber-400" : "text-blue-400"} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{signal.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{signal.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Recent activity</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Clock3 size={16} className="mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">{workflowCase.daysInCurrentPhase} dagen in huidige fase</p>
                    <p className="text-muted-foreground">Bewaking loopt via de casus-workflow.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Regio {workflowCase.region}</p>
                    <p className="text-muted-foreground">Capaciteit en aanbieders worden regionaal meegewogen.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building2 size={16} className="mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">{workflowCase.recommendedProvidersCount} provideropties beschikbaar</p>
                    <p className="text-muted-foreground">Gebruik matching of plaatsing om de volgende stap uit te voeren.</p>
                  </div>
                </div>
                {workflowCase.blockReason && (
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={16} className="mt-0.5 text-red-400" />
                    <div>
                      <p className="font-medium text-foreground">Blokkade</p>
                      <p className="text-muted-foreground">{workflowCase.blockReason}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <CalendarClock size={16} className="mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Workflowdoel</p>
                    <p className="text-muted-foreground">Werk deze casus door naar intake zonder losse schermen of dubbel werk.</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}