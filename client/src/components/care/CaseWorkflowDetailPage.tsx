import { ArrowLeft, ArrowRight, AlertTriangle, Building2, CalendarClock, Clock3, MapPin, ShieldAlert, Sparkles, Check, Lock, Edit2, X, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { buildWorkflowCase } from "../../lib/workflowUi";

interface CaseWorkflowDetailPageProps {
  caseId: string;
  onBack: () => void;
  onStartMatching: (caseId: string) => void;
  onOpenWorkflow: (page: "casussen" | "matching" | "plaatsingen" | "intake") => void;
  onEditCase?: (caseId: string) => void;
  onCloseCase?: (caseId: string) => void;
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

function fallbackActionLabel(phase: string) {
  switch (phase) {
    case "casus":
    case "intake":
      return "Start matching";
    case "matching":
    case "aanbieder_selectie":
      return "Kies aanbieder";
    case "provider_beoordeling":
      return "Wacht op aanbiedersreactie";
    case "plaatsing":
      return "Plan intake";
    case "intake_provider":
      return "Volg intake op";
    default:
      return "Bekijk plaatsing";
  }
}

function queueLabel(page: "casussen" | "matching" | "plaatsingen" | "intake") {
  switch (page) {
    case "matching":
      return "Open matchingqueue";
    case "plaatsingen":
      return "Open plaatsingsqueue";
    case "intake":
      return "Open intake";
    default:
      return "Terug naar casussen";
  }
}

function previousStepTarget(phase: string): "casussen" | "matching" | "plaatsingen" | "intake" {
  switch (phase) {
    case "matching":
    case "aanbieder_selectie":
      return "casussen";
    case "provider_beoordeling":
    case "plaatsing":
    case "intake_provider":
      return "matching";
    case "afgerond":
      return "plaatsingen";
    default:
      return "casussen";
  }
}

export function CaseWorkflowDetailPage({ caseId, onBack, onStartMatching, onOpenWorkflow, onEditCase, onCloseCase }: CaseWorkflowDetailPageProps) {
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
    if (workflowCase.nextBestActionUrl === "matching") {
      onStartMatching(workflowCase.id);
      return;
    }
    onOpenWorkflow(workflowCase.nextBestActionUrl);
  };

  const handlePreviousStep = () => {
    onOpenWorkflow(previousStepTarget(workflowCase.phase));
  };

  const actionLabel = workflowCase.nextBestActionLabel || fallbackActionLabel(workflowCase.phase);
  const queueActionLabel = queueLabel(workflowCase.nextBestActionUrl);
  const previousTarget = previousStepTarget(workflowCase.phase);
  const previousTargetLabel = queueLabel(previousTarget);
  const workflowSteps = ["intake", "matching", "provider_beoordeling", "plaatsing", "afgerond"];
  const currentStepIndex = Math.max(workflowSteps.indexOf(workflowCase.phase), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2 hover:bg-primary/10 hover:text-primary">
          <ArrowLeft size={16} />
          Terug naar casussen
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onEditCase?.(caseId)}>
            <Edit2 size={14} />
            Bewerken
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onCloseCase?.(caseId)}>
            <X size={14} />
            Sluiten
          </Button>
        </div>
      </div>

      {/* Workflow State Bar */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          {[
            { label: "Casus", phase: "intake" },
            { label: "Matching", phase: "matching" },
            { label: "Bij Aanbieder", phase: "provider_beoordeling" },
            { label: "Intake", phase: "plaatsing" },
            { label: "Afgerond", phase: "afgerond" },
          ].map((step, idx, arr) => (
            <div key={step.phase} className="flex items-center flex-1">
              <button
                className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-all flex-1 ${
                  workflowCase.phase === step.phase
                    ? "bg-primary/15 text-primary font-semibold"
                    : idx < currentStepIndex
                      ? "text-emerald-400"
                      : "text-muted-foreground"
                }`}
              >
                <span className="text-xs font-semibold">{step.label}</span>
                <span className="text-lg">
                  {workflowCase.phase === step.phase ? "◉" : idx < currentStepIndex ? "✓" : "○"}
                </span>
              </button>
              {idx < arr.length - 1 && <ChevronRight size={16} className="text-muted-foreground/50 mx-1" />}
            </div>
          ))}
        </div>
      </div>

      {/* Case ID Header */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Casus {workflowCase.id}</h1>
            <p className="text-sm text-muted-foreground mt-1">{workflowCase.clientLabel}, {workflowCase.clientAge} jaar · {workflowCase.region}</p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">{workflowCase.phaseLabel}</span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${urgencyClasses(workflowCase.urgency)}`}>{workflowCase.urgencyLabel}</span>
          </div>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN - Actions (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* VOLGENDE ACTIE - Dominant */}
          <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-card p-6 shadow-lg shadow-primary/10">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-primary" />
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Volgende actie</span>
              </div>
              <h2 className="text-3xl font-bold text-foreground">{actionLabel}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{workflowCase.workflowState.nextActionDetail}</p>
              <Button onClick={handlePrimaryAction} size="lg" className="w-full gap-2 h-12 mt-2">
                {workflowCase.phase === "intake" ? "Start matching" : queueActionLabel}
                <ArrowRight size={18} />
              </Button>
            </div>
          </div>

          {/* CASUS STATUS */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4">Casusstatus</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold text-foreground">
                  {workflowCase.phaseLabel}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Wachttijd</span>
                <span className="font-semibold text-foreground">{workflowCase.daysInCurrentPhase} dagen</span>
              </div>
              {workflowCase.phase === "intake" ? (
                <p className="text-xs text-muted-foreground mt-2">Deze casus is klaar om direct in matching opgepakt te worden.</p>
              ) : workflowCase.phase === "afgerond" ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 mt-3">
                  <Check size={14} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-xs text-emerald-400 font-medium">Casus afgerond</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">Deze casus zit in de vervolgflow na matching.</p>
              )}
            </div>
          </div>

          {/* MATCHING Section */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4">Matching</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold text-foreground">{workflowCase.phase === "intake" ? "Klaar om te starten" : workflowCase.phase === "matching" ? "Lopend" : "Afgerond"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Aanbieders</span>
                <span className="font-semibold text-foreground">{workflowCase.recommendedProvidersCount}</span>
              </div>
              {workflowCase.phase === "intake" ? (
                <Button onClick={() => onStartMatching(workflowCase.id)} variant="outline" className="w-full mt-3 gap-2 h-9 text-sm">
                  Start matching
                  <ArrowRight size={14} />
                </Button>
              ) : workflowCase.phase === "matching" ? (
                <Button onClick={() => onOpenWorkflow("matching")} variant="outline" className="w-full mt-3 gap-2 h-9 text-sm">
                  Ga verder
                  <ArrowRight size={14} />
                </Button>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 mt-3">
                  <Check size={14} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-xs text-emerald-400 font-medium">Matching afgerond</span>
                </div>
              )}
            </div>
          </div>

          {/* AANBIEDER / PLAATSING */}
          <div className={`rounded-xl border p-5 ${["intake", "matching"].includes(workflowCase.phase) ? "bg-muted/30 border-border/50" : "bg-card"}`}>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4">Aanbieder / Plaatsing</h3>
            {workflowCase.phase === "intake" ? (
              <div className="flex items-start gap-3 rounded-lg border border-slate-500/25 bg-slate-500/8 px-3 py-2.5">
                <Lock size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-slate-400 font-semibold">Wacht op matching</p>
                  <p className="text-slate-300/80 mt-0.5">Doorloop matching om een aanbieder te kiezen.</p>
                </div>
              </div>
            ) : workflowCase.phase === "matching" ? (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5">
                <Lock size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-amber-400 font-semibold">Selecteer een aanbieder</p>
                  <p className="text-amber-300/80 mt-0.5">Na providerselectie wordt het verzoek naar de aanbieder gestuurd.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-semibold text-foreground">{workflowCase.placementStatusLabel}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-semibold text-foreground text-right">{workflowCase.recommendedProviderName ?? "—"}</span>
                </div>
                {workflowCase.phase === "plaatsing" && (
                  <Button onClick={() => onOpenWorkflow("plaatsingen")} variant="outline" className="w-full mt-3 gap-2 h-9 text-sm">
                    Ga verder
                    <ArrowRight size={14} />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - Context (1/3 width) */}
        <div className="space-y-6">
          {/* CASUS SUMMARY */}
          <section className="rounded-xl border bg-card p-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground mb-3">Casus summary</h3>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Cliënt</p>
                <p className="font-semibold text-foreground">{workflowCase.clientLabel}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Leeftijd</p>
                <p className="font-semibold text-foreground">{workflowCase.clientAge} jaar</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Regio</p>
                <p className="font-semibold text-foreground">{workflowCase.region}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">In fase sinds</p>
                <p className="font-semibold text-foreground">{workflowCase.daysInCurrentPhase} dagen</p>
              </div>
              {workflowCase.tags.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-1">
                  {workflowCase.tags.map((tag) => (
                    <span key={tag} className="rounded px-2 py-0.5 text-xs bg-muted/50 text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* SYSTEM SIGNALS */}
          <section className="rounded-xl border bg-card p-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground mb-3">System signals</h3>
            <div className="space-y-2">
              {workflowCase.workflowState.signals.length === 0 ? (
                <p className="text-xs text-muted-foreground">Geen actieve signalen</p>
              ) : (
                workflowCase.workflowState.signals.map((signal) => (
                  <div key={signal.id} className="rounded-lg border border-border bg-muted/20 p-2">
                    <div className="flex gap-2">
                      <ShieldAlert
                        size={12}
                        className={`flex-shrink-0 mt-0.5 ${
                          signal.severity === "critical"
                            ? "text-red-400"
                            : signal.severity === "warning"
                            ? "text-amber-400"
                            : "text-blue-400"
                        }`}
                      />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{signal.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{signal.description}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* TIMELINE */}
          <section className="rounded-xl border bg-card p-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground mb-3">Timeline</h3>
            <div className="space-y-2">
              {workflowCase.workflowState.timelineEvents.slice(0, 4).map((event) => (
                <div key={event.id} className="flex gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary/70 mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{event.label}</p>
                    <p className="text-xs text-muted-foreground">{event.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* METADATA */}
          <section className="rounded-xl border bg-muted/30 p-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground mb-3">Info</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <MapPin size={12} className="text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Capaciteit en aanbieders regionaal meegewogen</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 size={12} className="text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">{workflowCase.recommendedProvidersCount} opties beschikbaar</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
