import { AlertTriangle, ArrowRight, Building2, MapPin } from "lucide-react";
import { Button } from "../../ui/button";
import type { WorkflowCaseView } from "../../../lib/workflowUi";
import { DecisionBadge } from "./DecisionBadge";
import { getShortActionLabel, getShortReasonLabel, getShortStatusLabel } from "../../../lib/uxCopy";

interface WorkflowCaseCardProps {
  item: WorkflowCaseView;
  onOpen: (caseId: string) => void;
}

function placementPressureBadgeClasses(band: WorkflowCaseView["placementPressureBand"]) {
  switch (band) {
    case "critical":
      return "border-care-urgent-border bg-care-urgent-bg text-care-urgent-text";
    case "high":
      return "border-care-warning-border bg-care-warning-bg text-care-warning-text";
    case "normal":
      return "border-blue-500/35 bg-blue-500/10 text-blue-300";
    case "low":
      return "border-care-success-border bg-care-success-bg text-care-success-text";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

export function WorkflowCaseCard({ item, onOpen }: WorkflowCaseCardProps) {
  return (
    <article
      className={`w-full rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
        item.isBlocked ? "border-care-urgent-border bg-care-urgent-bg" : "border-border bg-card"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        className="group w-full rounded-[1.15rem] text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Open casus ${item.clientLabel}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{item.id}</p>
            <p className="mt-1 text-sm text-foreground/85">{item.clientLabel}</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${placementPressureBadgeClasses(item.placementPressureBand)}`}>
            {item.placementPressureLabel ?? item.urgencyLabel}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={12} aria-hidden="true" />
            {item.region}
          </span>
          <span>{item.clientAge} jaar</span>
          <span>{item.daysInCurrentPhase} dagen in stap</span>
        </div>

        <p className="mt-4 text-sm leading-6 text-foreground/85">{getShortReasonLabel(item.summarySnippet, 72)}</p>

        {item.placementPressureReason ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {getShortReasonLabel(item.placementPressureReason, 100)}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-muted/20 p-3 text-xs">
          <div>
            <p className="text-muted-foreground">Stap</p>
            <p className="mt-1 text-sm font-medium text-foreground">{getShortStatusLabel(item.currentPhaseLabel)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Eigenaar</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Building2 size={12} aria-hidden="true" />
              {item.responsibleParty}
            </p>
          </div>
        </div>
      </button>

      <details className="mt-4 rounded-2xl border border-border/80 bg-background/60 px-3 py-3 text-xs leading-5 text-muted-foreground">
        <summary className="cursor-pointer list-none font-medium text-foreground">Meer details</summary>
        <p className="mt-2 text-muted-foreground">{getShortReasonLabel(item.whyInThisStep, 120)}</p>
        {item.blockReason && <p className="mt-2 text-care-urgent-text">Blokkade: {getShortReasonLabel(item.blockReason, 80)}</p>}
      </details>

      {item.decisionBadges.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.decisionBadges.map((badge) => (
            <DecisionBadge key={`${item.id}-${badge.label}`} label={badge.label} tone={badge.tone} />
          ))}
        </div>
      )}

      {(item.matchConfidenceLabel || item.providerStatusLabel) && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div>
            <p>Match</p>
            <p className="mt-1 text-sm font-medium text-foreground">{item.matchConfidenceLabel ?? "Nog geen matchadvies"}</p>
            {item.matchAdvisoryHint ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{item.matchAdvisoryHint}</p>
            ) : null}
          </div>
          <div>
            <p>Aanbiederstatus</p>
            <p className="mt-1 text-sm font-medium text-foreground">{item.providerStatusLabel ?? "Nog niet van toepassing"}</p>
          </div>
        </div>
      )}

      {item.blockReason && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-care-urgent-border bg-care-urgent-bg px-3 py-3 text-xs text-care-urgent-text">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-care-urgent-text" />
          <div>
            <p className="font-semibold text-care-urgent-text">Blokkade</p>
            <p className="mt-1 text-care-urgent-text">{item.blockReason}</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <span key={`${item.id}-${tag}`} className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Actie</p>
          <p className="mt-1 text-sm font-medium text-foreground">{item.primaryActionLabel}</p>
        </div>
        <Button
          size="sm"
          variant={item.primaryActionEnabled ? "default" : "outline"}
          disabled={!item.primaryActionEnabled}
          onClick={() => onOpen(item.id)}
          className="gap-2"
          title={item.primaryActionReason ?? undefined}
        >
          {getShortActionLabel(item.primaryActionLabel)}
          <ArrowRight size={14} />
        </Button>
      </div>
    </article>
  );
}
