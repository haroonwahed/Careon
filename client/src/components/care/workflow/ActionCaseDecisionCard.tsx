import { AlertTriangle, ArrowRight, Building2, CalendarClock, Clock3, FileText, History, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "../../ui/button";
import { cn } from "../../ui/utils";
import type { CaseDecisionRole, CaseDecisionState, WorkflowCaseView } from "../../../lib/workflowUi";
import { getShortActionLabel, getShortReasonLabel } from "../../../lib/uxCopy";

interface ActionCaseDecisionCardProps {
  item: WorkflowCaseView;
  decision: CaseDecisionState;
  role: CaseDecisionRole;
  onOpen: (caseId: string) => void;
  onNavigate: (route: "casussen" | "beoordelingen" | "matching" | "plaatsingen" | "intake") => void;
}

function urgencyBadgeClasses(urgency: WorkflowCaseView["urgency"]): string {
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

function severityChipClasses(severity: CaseDecisionState["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-red-500/35 bg-red-500/10 text-red-300";
    case "warning":
      return "border-amber-500/35 bg-amber-500/10 text-amber-300";
    case "good":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-300";
    case "info":
      return "border-cyan-500/35 bg-cyan-500/10 text-cyan-300";
    default:
      return "border-border bg-muted/30 text-muted-foreground";
  }
}

function responsiblePartyClasses(party: CaseDecisionState["responsibleParty"]): string {
  if (party === "Gemeente") {
    return "border-blue-500/35 bg-blue-500/10 text-blue-300";
  }

  if (party === "Zorgaanbieder") {
    return "border-cyan-500/35 bg-cyan-500/10 text-cyan-300";
  }

  return "border-border bg-muted/30 text-muted-foreground";
}

export function ActionCaseDecisionCard({ item, decision, role, onOpen, onNavigate }: ActionCaseDecisionCardProps) {
  const handleRouteAction = (route: "casussen" | "beoordelingen" | "matching" | "plaatsingen" | "intake") => {
    if (route === "casussen") {
      onOpen(item.id);
      return;
    }

    onNavigate(route);
  };

  const handlePrimaryAction = () => {
    handleRouteAction(decision.nextActionRoute);
  };

  return (
    <article
      className={cn(
        "rounded-[28px] border p-5 shadow-sm transition-all duration-200",
        item.isBlocked
          ? "border-red-500/30 bg-gradient-to-br from-red-500/8 via-card/80 to-card"
          : "border-border bg-card/75 hover:border-primary/30 hover:shadow-md",
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-background/65 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{item.id}</span>
            <span className="rounded-full border border-border bg-background/65 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{item.phaseLabel}</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground">{item.clientLabel}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${urgencyBadgeClasses(item.urgency)}`}>{item.urgencyLabel}</span>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${severityChipClasses(decision.severity)}`}>{decision.statusLabel}</span>
          <span className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <Clock3 size={12} className="mr-1 inline" />
            {item.daysInCurrentPhase} dagen in stap
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${responsiblePartyClasses(decision.responsibleParty)}`}>
            <Building2 size={12} className="mr-1 inline" />
            {decision.responsibleParty}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground lg:grid-cols-5">
        <div>
          <p>Leeftijd</p>
          <p className="mt-1 text-sm font-medium text-foreground">{item.clientAge} jaar</p>
        </div>
        <div>
          <p>Regio</p>
          <p className="mt-1 text-sm font-medium text-foreground"><MapPin size={12} className="mr-1 inline" />{item.region}</p>
        </div>
        <div>
          <p>Zorgvraag</p>
          <p className="mt-1 text-sm font-medium text-foreground">{item.careType}</p>
        </div>
        <div>
          <p>Geselecteerde aanbieder</p>
          <p className="mt-1 text-sm font-medium text-foreground">{item.recommendedProviderName ?? "Nog niet gekozen"}</p>
        </div>
        <div>
          <p>Laatst bijgewerkt</p>
          <p className="mt-1 text-sm font-medium text-foreground"><CalendarClock size={12} className="mr-1 inline" />{item.lastUpdatedLabel}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/70 bg-background/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Reden</p>
          <p className="mt-2 text-sm text-foreground/90">{getShortReasonLabel(decision.whyHere, 90)}</p>
        </section>
        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Actie</p>
          <p className="mt-2 text-sm font-medium text-foreground">{getShortActionLabel(decision.nextActionLabel)}</p>
          {decision.blockedReason && (
            <p className="mt-2 text-xs text-red-200/90">Blokkade: {getShortReasonLabel(decision.blockedReason, 70)}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={handlePrimaryAction} disabled={!decision.primaryActionEnabled} className="gap-2" size="sm">
              {getShortActionLabel(decision.nextActionLabel)}
              <ArrowRight size={14} />
            </Button>
            {decision.nextActionRoute !== "casussen" && (
              <Button variant="outline" size="sm" onClick={() => handleRouteAction(decision.nextActionRoute)}>
                Open
              </Button>
            )}
          </div>
        </section>
      </div>

      {role === "zorgaanbieder" && decision.providerReviewActions.length > 0 && (
        <div className="mt-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cyan-200">Beoordeling acties</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-cyan-100">
            {decision.providerReviewActions.map((action) => (
              <span key={`${item.id}-${action}`} className="rounded-full border border-cyan-500/35 px-2.5 py-1">{action}</span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {decision.secondaryActions.map((action) => {
          const lowerLabel = action.label.toLowerCase();
          const Icon = lowerLabel.includes("historie") ? History : lowerLabel.includes("document") ? FileText : ShieldCheck;

          return (
            <Button key={`${item.id}-${action.label}`} variant="ghost" size="sm" className="gap-1.5" onClick={() => handleRouteAction(action.route)}>
              <Icon size={14} />
              {action.label}
            </Button>
          );
        })}
      </div>

      {item.isBlocked && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-300" />
          <p>{item.blockReason ?? "Casus vereist directe opvolging."}</p>
        </div>
      )}
    </article>
  );
}
