/**
 * CasusControlCenter — Phase-Driven Execution Engine
 *
 * Quarantine: this module is not imported from the live SPA route tree (`FEATURE_INVENTORY.md`).
 * Keep it out of production navigation unless explicitly wired and signed off.
 *
 * Single page, single layout, seven phases.
 * ALL rendering is driven by computeCaseState() — the UI never guesses.
 *
 * Layout:
 *  [1] Decision Strip  — what to do NOW (computed, color-coded, dominant)
 *  [2] Phase Bar       — where in the workflow
 *  [3] Three columns:
 *       Left   — stable context panel
 *       Center — renderCasePhase(phase, status, role) — changes per phase
 *       Right  — intelligence: signals, progress steps, timeline
 */

import { useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Siren,
  ChevronRight,
  Phone,
  Star,
  Building2,
  FileText,
  ShieldAlert,
  Zap,
  CircleDot,
  Circle,
  ArrowRight,
  MessageSquare,
  Info,
  RefreshCw,
  Maximize2,
  ClipboardCheck,
  Archive,
  Eye,
  UserCheck,
  CalendarPlus,
  Play,
  Flag,
  RotateCcw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import type { Provider } from "../../lib/casesData";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { toLegacyProvider, toPhaseCasus } from "../../lib/careLegacyAdapters";
import {
  computeCaseState,
  ALL_PHASES,
  statusToPhase,
  type Casus,
  type CasusPhase,
  type CasusAction,
  type CasusSignal,
  type CasusTimelineEvent,
  type ComputedCaseState,
  type UserRole,
  type ActionType,
  type MatchResult,
} from "../../lib/phaseEngine";
import { tokens } from "../../design/tokens";

// ─── Decision strip colors ────────────────────────────────────────────────────

const STRIP_COLORS = {
  critical: {
    wrap: "bg-gradient-to-r from-red-700 via-red-600 to-red-500",
    badge: "bg-red-900/50 text-red-100",
    btn: "bg-white text-red-700 hover:bg-red-50 font-semibold shadow-md",
    detail: "text-red-100",
  },
  warning: {
    wrap: "bg-gradient-to-r from-amber-600 to-amber-500",
    badge: "bg-amber-800/50 text-amber-100",
    btn: "bg-white text-amber-700 hover:bg-amber-50 font-semibold shadow-md",
    detail: "text-amber-100",
  },
  action: {
    wrap: "bg-gradient-to-r from-primary to-primary/80",
    badge: "bg-primary-foreground/20 text-white",
    btn: "bg-white text-primary hover:bg-muted/35 font-semibold shadow-md",
    detail: "text-white/80",
  },
  good: {
    wrap: "bg-gradient-to-r from-emerald-700 to-emerald-500",
    badge: "bg-emerald-900/40 text-emerald-100",
    btn: "bg-white text-emerald-700 hover:bg-emerald-50 font-semibold shadow-md",
    detail: "text-emerald-100",
  },
  info: {
    wrap: "bg-gradient-to-r from-blue-700 to-blue-500",
    badge: "bg-blue-900/40 text-blue-100",
    btn: "bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-md",
    detail: "text-blue-100",
  },
} as const;

const STRIP_ICONS: Record<ComputedCaseState["decisionType"], React.ComponentType<{ size?: number; className?: string }>> = {
  critical: Siren,
  warning: AlertTriangle,
  action: Zap,
  good: CheckCircle2,
  info: Info,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface CasusControlCenterProps {
  caseId: string;
  role?: UserRole;
  onBack: () => void;
  onStartMatching?: (caseId: string) => void;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string | number;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <span className="font-semibold text-sm">{title}</span>
      {badge !== undefined && (
        <span className="ml-auto text-xs bg-muted/35 text-foreground px-2 py-0.5 rounded-full border border-border/70 font-medium">
          {badge}
        </span>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center p-3 bg-muted/40 rounded-lg text-center">
      <span className="font-semibold text-sm">{value}</span>
      <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
}

function CheckItem({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-3 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer group"}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
          checked
            ? "bg-emerald-500 border-emerald-500"
            : "border-border group-hover:border-border/80"
        }`}
      >
        {checked && <CheckCircle2 size={11} className="text-white" />}
      </button>
      <span className={`text-sm ${checked ? "line-through text-muted-foreground" : ""}`}>{label}</span>
    </label>
  );
}

// ─── Action button renderer ───────────────────────────────────────────────────

const ACTION_ICONS: Partial<Record<ActionType, React.ComponentType<{ size?: number; className?: string }>>> = {
  start_beoordeling:      Zap,
  complete_beoordeling:   ClipboardCheck,
  save_concept:           FileText,
  request_more_info:      MessageSquare,
  upload_document:        FileText,
  select_provider:        UserCheck,
  confirm_placement:      CheckCircle2,
  cancel_placement:       XCircle,
  return_to_matching:     RotateCcw,
  rerun_matching:         RefreshCw,
  expand_radius:          Maximize2,
  escalate_case:          Siren,
  follow_up_provider:     Phone,
  view_handover:          Eye,
  accept_case:            CheckCircle2,
  reject_case:            XCircle,
  plan_intake:            CalendarPlus,
  mark_intake_started:    Play,
  mark_intake_completed:  Flag,
  archive_case:           Archive,
  review_outcome:         Eye,
  request_manual_review:  AlertCircle,
  return_to_previous_phase: RotateCcw,
  reopen_case:            RefreshCw,
};

function ActionButton({
  action,
  onClick,
  fullWidth,
}: {
  action: CasusAction;
  onClick: () => void;
  fullWidth?: boolean;
}) {
  const Icon = ACTION_ICONS[action.type];
  const classes = {
    primary:     "bg-primary hover:bg-primary/90 text-primary-foreground",
    secondary:   "border border-border hover:bg-muted/60 bg-transparent text-foreground",
    destructive: "bg-red-500 hover:bg-red-600 text-white",
  }[action.priority];

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${classes} ${fullWidth ? "w-full" : ""}`}
    >
      {Icon && <Icon size={15} />}
      {action.label}
    </button>
  );
}

// ─── 1. Decision Strip ────────────────────────────────────────────────────────

function DecisionStrip({
  state,
  casus,
  primaryAction,
  onAction,
}: {
  state: ComputedCaseState;
  casus: Casus;
  primaryAction: CasusAction | null;
  onAction: (type: ActionType) => void;
}) {
  const colors = STRIP_COLORS[state.decisionType];
  const Icon = STRIP_ICONS[state.decisionType];

  return (
    <div className={`${colors.wrap} rounded-xl px-6 py-5 shadow-lg`}>
      <div className="flex items-center gap-4">
        <div className="shrink-0 hidden sm:flex">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Icon size={22} className="text-white" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge} uppercase tracking-wider`}>
              {state.decisionType === "good" ? "Afgerond" : "Actie vereist"}
            </span>
            <span className="text-white/60 text-xs font-mono">{casus.id}</span>
          </div>
          <h2 className="text-white font-bold text-lg leading-tight">{state.nextAction}</h2>
          <p className={`${colors.detail} text-sm mt-0.5 leading-snug`}>{state.nextActionDetail}</p>
        </div>

        {primaryAction && (
          <div className="shrink-0">
            <button
              onClick={() => onAction(primaryAction.type)}
              className={`${colors.btn} inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm`}
            >
              {primaryAction.label}
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 2. Phase Bar ─────────────────────────────────────────────────────────────

function PhaseBar({ currentPhase }: { currentPhase: CasusPhase }) {
  const visiblePhases = ALL_PHASES.filter(p => p.id !== "geblokkeerd" && p.id !== "intake_initial");
  const fullPhases = [{ id: "intake_initial", label: "Intake", shortLabel: "Intake" } as (typeof ALL_PHASES)[0], ...visiblePhases];

  const currentIndex = fullPhases.findIndex(p => p.id === currentPhase);
  const isBlocked = currentPhase === "geblokkeerd";

  return (
    <div className="panel-surface px-4 py-3">
      <div className="flex items-center">
        {fullPhases.map((phase, idx) => {
          const isCompleted = !isBlocked && idx < currentIndex;
          const isCurrent   = !isBlocked && idx === currentIndex;

          return (
            <div key={phase.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all shrink-0 ${
                  isCurrent
                    ? "bg-primary border-primary text-white ring-2 ring-primary/25"
                    : isCompleted
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : isBlocked && idx === currentIndex
                    ? "bg-red-500 border-red-500 text-white"
                    : "bg-muted border-border text-muted-foreground"
                }`}>
                  {isCompleted ? <CheckCircle2 size={13} /> : <span>{idx + 1}</span>}
                </div>
                <span className={`text-xs font-medium text-center leading-tight hidden lg:block ${
                  isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                }`}>
                  {phase.shortLabel}
                </span>
              </div>
              {idx < fullPhases.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 mb-5 ${isCompleted ? "bg-primary/30" : "bg-border"}`} />
              )}
            </div>
          );
        })}

        {isBlocked && (
          <div className="ml-3 flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg">
            <Siren size={14} className="text-red-500" />
            <span className="text-xs font-semibold text-red-500">Geblokkeerd</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 3a. Left: Context Panel ──────────────────────────────────────────────────

function ContextPanel({ casus }: { casus: Casus }) {
  const urgencyColors: Record<string, string> = {
    critical: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
    high:     "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    medium:   "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    low:      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  };
  const urgencyLabel: Record<string, string> = {
    critical: "Kritiek", high: "Hoog", medium: "Gemiddeld", low: "Laag",
  };

  return (
    <div className="space-y-3">
      {/* Jeugdige */}
      <div className="panel-surface p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Jeugdige</p>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
            <User size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">{casus.clientName}</p>
            <p className="text-xs text-muted-foreground">{casus.clientAge} jaar</p>
          </div>
        </div>
        <div className="space-y-3">
          <Row label="Casus ID" value={<span className="font-mono text-xs">{casus.id}</span>} />
          <Row label="Regio" value={<span className="flex items-center gap-1"><MapPin size={12} />{casus.region}</span>} />
          <Row label="Type zorg" value={casus.careType} />
          <Row label="Wachttijd" value={
            <span className={`flex items-center gap-1 ${casus.waitingDays > 7 ? "text-red-500 font-semibold" : ""}`}>
              <Clock size={12} />{casus.waitingDays} dagen
            </span>
          } />
          <Row label="Toegewezen" value={casus.assignedTo} />
        </div>
      </div>

      {/* Status */}
      <div className="panel-surface p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Status</p>
        <div className="space-y-2">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${urgencyColors[casus.urgency]}`}>
            <AlertCircle size={11} />
            Urgentie: {urgencyLabel[casus.urgency]}
          </div>
          <div className="text-sm text-muted-foreground mt-2 font-mono">{casus.status}</div>
        </div>
      </div>

      {/* Assessment mini-summary */}
      {casus.assessment.notes && (
        <div className="panel-surface p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Samenvatting</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {casus.assessment.notes.length > 110 ? `${casus.assessment.notes.slice(0, 107).trim()}…` : casus.assessment.notes}
          </p>
          <details className="mt-3 rounded-lg border border-border/80 bg-background/60 px-3 py-2 text-sm">
            <summary className="cursor-pointer list-none font-medium text-foreground">Details</summary>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{casus.assessment.notes}</p>
          </details>
        </div>
      )}
    </div>
  );
}

// ─── 3b. Center: Phase execution panels ───────────────────────────────────────

function renderCasePhase(
  casus: Casus,
  state: ComputedCaseState,
  role: UserRole,
  providers: Provider[],
  onAction: (type: ActionType) => void
) {
  switch (casus.phase) {
    case "intake_initial":
      return <IntakeInitialPanel casus={casus} state={state} onAction={onAction} />;
    case "beoordeling":
      return <AanbiederBeoordelingPanel casus={casus} state={state} onAction={onAction} />;
    case "matching":
      return <MatchingPanel casus={casus} state={state} role={role} onAction={onAction} />;
    case "plaatsing":
      return <PlaatsingPanel casus={casus} state={state} providers={providers} onAction={onAction} />;
    case "intake_provider":
      return <IntakeProviderPanel casus={casus} state={state} role={role} onAction={onAction} />;
    case "afgerond":
      return <AfgerondPanel casus={casus} />;
    case "geblokkeerd":
      return <GeblokkerdPanel casus={casus} state={state} onAction={onAction} />;
  }
}

// ── Phase: intake_initial ─────────────────────────────────────────────────────

function IntakeInitialPanel({
  casus,
  state,
  onAction,
}: {
  casus: Casus;
  state: ComputedCaseState;
  onAction: (t: ActionType) => void;
}) {
  const primaryAction = state.allowedActions.find(a => a.priority === "primary");

  return (
    <div className="space-y-3">
      <div className="panel-surface p-4">
        <SectionHeader icon={<FileText size={16} className="text-primary" />} title="Intake" />
        <div className="space-y-3">
          <Row label="Type zorg" value={casus.careType} />
          <Row label="Regio" value={casus.region} />
          <Row label="Aanvrager" value="Gemeente — Jeugdteam" />
          <Row label="Aanvraagdatum" value={new Date(casus.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })} />
        </div>
      </div>

      <div className="panel-surface p-4">
        <SectionHeader icon={<Zap size={16} className="text-primary" />} title="Volgende stap" />
        <p className="text-sm text-muted-foreground mb-4">Beoordeling nodig voor matching.</p>
        <details className="mb-4 rounded-lg border border-border/80 bg-background/60 px-3 py-2 text-sm">
          <summary className="cursor-pointer list-none font-medium text-foreground">Details</summary>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            Wijs een beoordelaar toe en bepaal urgentie, complexiteit en zorgtype.
          </p>
        </details>
        {primaryAction && (
          <ActionButton action={primaryAction} onClick={() => onAction(primaryAction.type)} fullWidth />
        )}
      </div>

      <div className="panel-surface p-4">
        <SectionHeader icon={<FileText size={16} className="text-muted-foreground" />} title="Overige acties" />
        <div className="space-y-2">
          {state.allowedActions.filter(a => a.priority !== "primary").map(a => (
            <ActionButton key={a.id} action={a} onClick={() => onAction(a.type)} fullWidth />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Phase: beoordeling ────────────────────────────────────────────────────────

function AanbiederBeoordelingPanel({
  casus,
  state,
  onAction,
}: {
  casus: Casus;
  state: ComputedCaseState;
  onAction: (t: ActionType) => void;
}) {
  const { assessment } = casus;
  const [note, setNote] = useState(assessment.notes);
  const [urgency, setUrgency] = useState(assessment.urgency ?? "");
  const [complexity, setComplexity] = useState(assessment.complexity ?? "");
  const [careType, setCareType] = useState(assessment.careType ?? "");

  const isOverdue = assessment.daysOverdue > 0;
  const allFilled = urgency && complexity && careType;
  const primaryAction = state.allowedActions.find(a => a.priority === "primary");
  const secondaryActions = state.allowedActions.filter(a => a.priority !== "primary");

  return (
    <div className="space-y-3">
      {isOverdue && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-400">
              Beoordeling {assessment.daysOverdue} {assessment.daysOverdue === 1 ? "dag" : "dagen"} over deadline
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Beoordelaar: {assessment.assessor} · Gepland: {assessment.scheduledDate}
            </p>
          </div>
        </div>
      )}

      <div className="panel-surface p-4">
        <SectionHeader icon={<ClipboardCheck size={16} className="text-primary" />} title="Beoordeling" />

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Urgentie *</label>
            <select
              value={urgency}
              onChange={e => setUrgency(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Kies urgentie</option>
              <option value="critical">Kritiek</option>
              <option value="high">Hoog</option>
              <option value="medium">Gemiddeld</option>
              <option value="low">Laag</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Complexiteit *</label>
            <select
              value={complexity}
              onChange={e => setComplexity(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Kies complexiteit</option>
              <option value="high">Hoog</option>
              <option value="medium">Gemiddeld</option>
              <option value="low">Laag</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Type zorg *</label>
            <Input
              value={careType}
              onChange={e => setCareType(e.target.value)}
              placeholder="Bijv. Residentieel, ambulant..."
              className="text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Notities</label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Korte toelichting..."
              rows={4}
              className="text-sm"
            />
          </div>

          {assessment.missingFields.length > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1.5">Ontbreekt:</p>
              <div className="flex flex-wrap gap-1.5">
                {assessment.missingFields.map(f => (
                  <span key={f} className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {primaryAction && (
          <ActionButton
            action={{ ...primaryAction, label: allFilled ? "Afronden" : "Concept opslaan" }}
            onClick={() => onAction(allFilled ? "complete_beoordeling" : "save_concept")}
            fullWidth
          />
        )}
        {secondaryActions.filter(a => a.type !== "save_concept").map(a => (
          <ActionButton key={a.id} action={a} onClick={() => onAction(a.type)} fullWidth />
        ))}
      </div>
    </div>
  );
}

// ── Phase: matching ───────────────────────────────────────────────────────────

function MatchingPanel({
  casus,
  state,
  role,
  onAction,
}: {
  casus: Casus;
  state: ComputedCaseState;
  role: UserRole;
  onAction: (t: ActionType) => void;
}) {
  const [selected, setSelected] = useState<string | null>(casus.selectedProviderId);
  const { matchResults } = casus;
  const noProviders = matchResults.length === 0;

  return (
    <div className="space-y-3">
      {noProviders ? (
        <div className="panel-surface p-4">
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
            <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-red-600 dark:text-red-400">Geen aanbieder</p>
              <p className="text-muted-foreground text-xs mt-0.5">Geen match binnen de huidige criteria.</p>
            </div>
          </div>
          <div className="space-y-2">
            <ActionButton
              action={{ id: "act-expand", type: "expand_radius", label: "Vergroot zoekgebied", priority: "primary", assignedTo: null, dueAt: null }}
              onClick={() => onAction("expand_radius")}
              fullWidth
            />
            <ActionButton
              action={{ id: "act-escalate", type: "escalate_case", label: "Escaleer casus", priority: "destructive", assignedTo: null, dueAt: null }}
              onClick={() => onAction("escalate_case")}
              fullWidth
            />
          </div>
        </div>
      ) : (
        <div className="panel-surface p-4">
          <SectionHeader
            icon={<TrendingUp size={16} className="text-primary" />}
            title="Aanbieders"
            badge={`${matchResults.length} gevonden`}
          />

          <div className="space-y-3 mb-4">
            {matchResults.map(r => (
              <ProviderCard
                key={r.providerId}
                result={r}
                isSelected={selected === r.providerId}
                onSelect={() => setSelected(r.providerId)}
              />
            ))}
          </div>

          <div className="space-y-2">
            <Button
              className="w-full"
              disabled={!selected}
              onClick={() => onAction("select_provider")}
            >
              <UserCheck size={15} className="mr-2" />
              {selected ? "Bevestig" : "Selecteer"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                action={{ id: "act-rerun", type: "rerun_matching", label: "Herstart", priority: "secondary", assignedTo: null, dueAt: null }}
                onClick={() => onAction("rerun_matching")}
              />
              <ActionButton
                action={{ id: "act-expand", type: "expand_radius", label: "Vergroot", priority: "secondary", assignedTo: null, dueAt: null }}
                onClick={() => onAction("expand_radius")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderCard({
  result,
  isSelected,
  onSelect,
}: {
  result: MatchResult;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const scoreColor =
    result.score >= 90 ? "text-emerald-500" :
    result.score >= 80 ? "text-amber-500" :
    "text-muted-foreground";

  const badgeColor =
    result.recommendationType === "perfect" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
    result.recommendationType === "good"    ? "bg-blue-500/10 text-blue-300 border-blue-500/25" :
                                              "bg-muted text-muted-foreground border-border";

  const badgeLabel =
    result.recommendationType === "perfect" ? "Beste match" :
    result.recommendationType === "good"    ? "Goede match" :
                                              "Alternatief";

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 mt-0.5">
          <Building2 size={16} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm leading-tight">{result.providerName}</p>
              <p className="text-xs text-muted-foreground">{result.providerType} · {result.region}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-2xl font-bold leading-none ${scoreColor}`}>{result.score}%</p>
              <div className="flex items-center justify-end gap-0.5 mt-1">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={9} className={s <= Math.round(result.rating) ? "text-amber-400 fill-amber-400" : "text-muted"} />
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{result.explanation}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badgeColor}`}>{badgeLabel}</span>
            <span className="text-xs text-muted-foreground">{result.availableSpots} pl. beschikbaar</span>
            <span className="text-xs text-muted-foreground">Reactie ~{result.responseTimeHours}u</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Phase: plaatsing ──────────────────────────────────────────────────────────

function PlaatsingPanel({
  casus,
  state,
  providers,
  onAction,
}: {
  casus: Casus;
  state: ComputedCaseState;
  providers: Provider[];
  onAction: (t: ActionType) => void;
}) {
  const { placement } = casus;
  const [checklist, setChecklist] = useState({ ...placement.validations });
  const allPassed = Object.values(checklist).every(Boolean);

  const provider = providers.find(p => p.id === placement.providerId);
  const matchResult = casus.matchResults.find(r => r.providerId === placement.providerId);
  const score = matchResult?.score ?? 0;

  return (
    <div className="space-y-3">
      {/* Selected provider */}
      <div className="panel-surface p-4">
        <SectionHeader icon={<Building2 size={16} className="text-muted-foreground" />} title="Geselecteerde aanbieder" />
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{placement.providerName}</p>
            <p className="text-sm text-muted-foreground">{provider?.type} · {provider?.region}</p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-3xl font-bold ${score >= 90 ? "text-emerald-500" : score >= 80 ? "text-amber-500" : "text-muted-foreground"}`}>{score}%</p>
            <p className="text-xs text-muted-foreground">Matchscore</p>
          </div>
        </div>
        {provider && (
          <div className="grid grid-cols-3 gap-2">
            <StatBlock label="Plekken" value={provider.availableSpots} />
            <StatBlock label="Reactietijd" value={`${provider.responseTime}u`} />
            <StatBlock label="Score" value={`${provider.rating}/5`} />
          </div>
        )}
      </div>

      {/* Validation checklist */}
      <div className="panel-surface p-4">
        <SectionHeader icon={<ClipboardCheck size={16} className="text-emerald-500" />} title="Checklist" />
        <div className="space-y-3 mb-4">
          <CheckItem
            label="Beoordeling afgerond"
            checked={checklist.assessmentComplete}
            onChange={v => setChecklist(p => ({ ...p, assessmentComplete: v }))}
            disabled={!checklist.assessmentComplete}
          />
          <CheckItem
            label="Aanbieder geselecteerd"
            checked={checklist.providerSelected}
            onChange={v => setChecklist(p => ({ ...p, providerSelected: v }))}
            disabled={!checklist.providerSelected}
          />
          <CheckItem
            label="Dossier volledig"
            checked={checklist.dossierComplete}
            onChange={v => setChecklist(p => ({ ...p, dossierComplete: v }))}
          />
          <CheckItem
            label="Toestemming voogd/ouders"
            checked={checklist.guardianConsent}
            onChange={v => setChecklist(p => ({ ...p, guardianConsent: v }))}
          />
        </div>

        <Button className="w-full" disabled={!allPassed} onClick={() => onAction("confirm_placement")}>
          <CheckCircle2 size={15} className="mr-2" />
          Bevestig plaatsing
        </Button>
        {!allPassed && (
          <details className="mt-2 rounded-lg border border-border/80 bg-background/60 px-3 py-2 text-sm">
            <summary className="cursor-pointer list-none text-center text-xs font-medium text-muted-foreground">Details</summary>
            <p className="mt-2 text-xs text-muted-foreground text-center">Voltooi alle stappen om te bevestigen.</p>
          </details>
        )}
      </div>

      <div className="space-y-2">
        <ActionButton
          action={{ id: "act-back", type: "return_to_matching", label: "Terug naar matching", priority: "secondary", assignedTo: null, dueAt: null }}
          onClick={() => onAction("return_to_matching")}
          fullWidth
        />
        <ActionButton
          action={{ id: "act-cancel", type: "cancel_placement", label: "Annuleer plaatsing", priority: "destructive", assignedTo: null, dueAt: null }}
          onClick={() => onAction("cancel_placement")}
          fullWidth
        />
      </div>
    </div>
  );
}

// ── Phase: intake_provider ────────────────────────────────────────────────────

function IntakeProviderPanel({
  casus,
  state,
  role,
  onAction,
}: {
  casus: Casus;
  state: ComputedCaseState;
  role: UserRole;
  onAction: (t: ActionType) => void;
}) {
  const { placement, intake } = casus;
  const [intakeDate, setIntakeDate] = useState(intake.plannedAt ?? "");

  const isUnresponsive = intake.providerResponseDays > 3;
  const gemeenteActions = state.allowedActions.filter(a =>
    ["follow_up_provider", "view_handover", "escalate_case"].includes(a.type)
  );
  const providerActions = state.allowedActions.filter(a =>
    ["accept_case", "plan_intake", "mark_intake_started", "mark_intake_completed", "reject_case"].includes(a.type)
  );

  return (
    <div className="space-y-3">
      {/* Handover summary */}
      <div className="panel-surface p-4">
        <SectionHeader icon={<Building2 size={16} className="text-muted-foreground" />} title="Overdracht" />
        <div className="space-y-3 text-sm mb-4">
          <Row label="Aanbieder" value={placement.providerName ?? "—"} />
          <Row label="Bevestigd op" value={placement.confirmedAt ? new Date(placement.confirmedAt).toLocaleDateString("nl-NL") : "—"} />
          <Row label="Bevestigd door" value={placement.confirmedBy ?? "—"} />
          <Row label="Intake status" value={
            <span className={`font-semibold ${!intake.plannedAt ? "text-amber-500" : "text-emerald-500"}`}>
              {!intake.plannedAt ? "Nog niet gepland" : intake.status === "planned" ? "Gepland" : intake.status === "started" ? "Bezig" : "Afgerond"}
            </span>
          } />
        </div>

        {isUnresponsive && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm mb-4">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-amber-700 dark:text-amber-400">Aanbieder reageert al {intake.providerResponseDays} werkdagen niet.</p>
          </div>
        )}
      </div>

      {/* Gemeente actions */}
      {(role === "gemeente" || role === "admin") && (
        <div className="panel-surface p-4">
          <SectionHeader icon={<Phone size={16} className="text-primary" />} title="Gemeente" />
          <div className="space-y-2">
            {gemeenteActions.map(a => (
              <ActionButton key={a.id} action={a} onClick={() => onAction(a.type)} fullWidth />
            ))}
          </div>
        </div>
      )}

      {/* Provider actions */}
      {(role === "zorgaanbieder" || role === "admin") && (
        <div className="panel-surface p-4">
          <SectionHeader icon={<CalendarPlus size={16} className="text-primary" />} title="Aanbieder" />
          <div className="space-y-3">
            {!intake.plannedAt && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Datum</label>
                <Input
                  type="date"
                  value={intakeDate}
                  onChange={e => setIntakeDate(e.target.value)}
                  className="text-sm mb-2"
                />
              </div>
            )}
            <div className="space-y-2">
              {providerActions.map(a => (
                <ActionButton key={a.id} action={a} onClick={() => onAction(a.type)} fullWidth />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Phase: afgerond ───────────────────────────────────────────────────────────

function AfgerondPanel({ casus }: { casus: Casus }) {
  return (
    <div className="space-y-3">
      <div className="panel-surface p-4">
        <div className="flex flex-col items-center py-6 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 size={28} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Casus succesvol overgedragen</h3>
            <p className="text-muted-foreground text-sm mt-1">
              {casus.clientName} is geplaatst bij {casus.placement.providerName}.
            </p>
          </div>
        </div>
        <div className="space-y-3 text-sm border-t border-border pt-4">
          <Row label="Aanbieder" value={casus.placement.providerName ?? "—"} />
          <Row label="Intake afgerond" value={casus.intake.completedAt ? new Date(casus.intake.completedAt).toLocaleDateString("nl-NL") : "—"} />
          <Row label="Zorg gestart" value={casus.intake.startedAt ? new Date(casus.intake.startedAt).toLocaleDateString("nl-NL") : "—"} />
          <Row label="Wachttijd totaal" value={`${casus.waitingDays} dagen`} />
        </div>
      </div>

      <p className="border-t border-border pt-4 text-center text-xs text-muted-foreground" role="status">
        Na afronding volgen archief en officiële rapportages het zaaksysteem van uw organisatie — niet vanuit dit werkoverzicht.
      </p>
    </div>
  );
}

// ── Phase: geblokkeerd ────────────────────────────────────────────────────────

function GeblokkerdPanel({
  casus,
  state,
  onAction,
}: {
  casus: Casus;
  state: ComputedCaseState;
  onAction: (t: ActionType) => void;
}) {
  const [escalationNote, setEscalationNote] = useState("");
  const primaryAction = state.allowedActions.find(a => a.priority === "primary");
  const secondaryActions = state.allowedActions.filter(a => a.priority !== "primary");

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm">
        <Siren size={16} className="text-red-500 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-red-600 dark:text-red-400">Blokkade</p>
          <p className="text-muted-foreground mt-0.5">{state.blockerReason}</p>
          {casus.waitingDays > 7 && (
            <p className="text-red-500 font-semibold mt-1 text-xs">
              {casus.waitingDays} dagen wachttijd overschreden
            </p>
          )}
        </div>
      </div>

      <div className="panel-surface p-4">
        <SectionHeader icon={<ShieldAlert size={16} className="text-red-500" />} title="Escalatie" />
        <div className="space-y-3">
          <label className="text-sm font-medium mb-1 block">Notitie</label>
          <Textarea
            value={escalationNote}
            onChange={e => setEscalationNote(e.target.value)}
            placeholder="Korte toelichting..."
            rows={4}
            className="text-sm"
          />
          {primaryAction && (
            <ActionButton action={primaryAction} onClick={() => onAction(primaryAction.type)} fullWidth />
          )}
        </div>
      </div>

      <div className="space-y-2">
        {secondaryActions.map(a => (
          <ActionButton key={a.id} action={a} onClick={() => onAction(a.type)} fullWidth />
        ))}
      </div>
    </div>
  );
}

// ─── 3c. Right: Intelligence Panel ───────────────────────────────────────────

function IntelligencePanel({
  casus,
  state,
  currentPhase,
}: {
  casus: Casus;
  state: ComputedCaseState;
  currentPhase: CasusPhase;
}) {
  const visiblePhases = [
    { id: "intake_initial", label: "Intake", shortLabel: "Intake" } as (typeof ALL_PHASES)[0],
    ...ALL_PHASES.filter(p => p.id !== "geblokkeerd" && p.id !== "intake_initial"),
  ];
  const currentIndex = visiblePhases.findIndex(p => p.id === currentPhase);
  const isBlocked = currentPhase === "geblokkeerd";

  return (
    <div className="space-y-3">
      {/* Progress */}
      <div className="panel-surface p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Fase</p>
        <div className="space-y-0">
          {visiblePhases.map((phase, idx) => {
            const isCompleted = !isBlocked && idx < currentIndex;
            const isCurrent   = !isBlocked && idx === currentIndex;

            return (
              <div key={phase.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 z-10 ${
                    isCurrent   ? "bg-primary border-primary" :
                    isCompleted ? "bg-primary/15 border-primary/40" :
                                  "bg-background border-border"
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 size={12} className="text-primary" />
                    ) : isCurrent ? (
                      <CircleDot size={12} className="text-white" />
                    ) : (
                      <Circle size={12} className="text-muted-foreground" />
                    )}
                  </div>
                  {idx < visiblePhases.length - 1 && (
                    <div className={`w-px h-5 ${isCompleted ? "bg-primary/30" : "bg-border"}`} />
                  )}
                </div>
                <div className="flex-1 pb-0.5 pt-0.5 min-w-0">
                  <p className={`text-sm font-medium leading-tight ${
                    isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {phase.label}
                  </p>
                  {isCurrent && !isBlocked && (
                    <p className="text-xs text-muted-foreground mt-0.5">Nu</p>
                  )}
                </div>
              </div>
            );
          })}

          {isBlocked && (
            <div className="flex items-center gap-2 mt-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
              <Siren size={14} className="text-red-500" />
              <span className="text-sm font-semibold text-red-500">Geblokkeerd</span>
            </div>
          )}
        </div>
      </div>

      {/* Signals */}
      <div className="panel-surface p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Signalen {state.signals.length > 0 && (
            <span className="ml-2 text-xs bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-full">
              {state.signals.length}
            </span>
          )}
        </p>
        {state.signals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen signalen</p>
        ) : (
          <div className="space-y-2">
            {state.signals.map(sig => (
              <SignalItem key={sig.id} signal={sig} />
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="panel-surface p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Tijdlijn</p>
        <div className="space-y-0">
          {state.timelineEvents.map((event, idx) => (
            <TimelineItem
              key={event.id}
              event={event}
              isLast={idx === state.timelineEvents.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SignalItem({ signal }: { signal: CasusSignal }) {
  const cls = {
    critical: "bg-red-500/10 border-red-500/30 text-red-500",
    warning:  "bg-amber-500/10 border-amber-500/30 text-amber-500",
    info:     "bg-blue-500/10 border-blue-500/30 text-blue-500",
  }[signal.severity];

  const Icon = signal.severity === "critical" ? Siren : signal.severity === "warning" ? AlertTriangle : Info;

  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${cls}`}>
      <Icon size={13} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-medium leading-tight">{signal.title}</p>
        <p className="text-xs opacity-70 mt-0.5">{signal.description}</p>
      </div>
    </div>
  );
}

function TimelineItem({ event, isLast }: { event: CasusTimelineEvent; isLast: boolean }) {
  const dotCls = {
    created:      "bg-primary",
    phase_change: "bg-emerald-500",
    action:       "bg-blue-500",
    signal:       "bg-amber-500",
    note:         "bg-muted-foreground",
    system:       "bg-muted-foreground/40",
  }[event.type];

  const isNext = event.id === "tl-next";

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${dotCls} ${isNext ? "ring-2 ring-muted-foreground/20" : ""}`} />
        {!isLast && <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />}
      </div>
      <div className="flex-1 pb-3.5">
        <p className={`text-xs ${isNext ? "text-primary font-semibold" : "text-muted-foreground"}`}>{event.date}</p>
        <p className={`text-sm font-medium leading-tight mt-0.5 ${isNext ? "text-primary" : ""}`}>{event.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{event.actorName}</p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CasusControlCenter({
  caseId,
  role = "gemeente",
  onBack,
  onStartMatching,
}: CasusControlCenterProps) {
  const { cases, loading: casesLoading, error: casesError } = useCases({ q: "" });
  const { providers, loading: providersLoading, error: providersError } = useProviders({ q: "" });
  const legacyProviders = providers.map(toLegacyProvider);
  const casusList = cases.map((spaCase) => toPhaseCasus(spaCase, legacyProviders));
  const casus = casusList.find(c => c.id === caseId);

  if (casesLoading || providersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-muted-foreground gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span>Casus laden...</span>
      </div>
    );
  }

  if (casesError || providersError) {
    return (
      <div className="panel-surface p-4 text-center text-destructive">
        Kon casusgegevens niet laden: {casesError ?? providersError}
      </div>
    );
  }

  if (!casus) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Casus niet gevonden: {caseId}</p>
          <Button variant="outline" onClick={onBack}>Terug naar Regiekamer</Button>
        </div>
      </div>
    );
  }

  const state = computeCaseState(casus, role);
  const currentPhase = statusToPhase(casus.status);
  const primaryAction = state.allowedActions.find(a => a.priority === "primary") ?? null;

  const handleAction = (type: ActionType) => {
    if (type === "select_provider" || type === "rerun_matching") {
      onStartMatching?.(caseId);
    }
  };

  return (
    <div className="space-y-3 pb-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Regiekamer
        </button>
        <ChevronRight size={14} />
        <span>Urgente casussen</span>
        <ChevronRight size={14} />
        <span className="text-foreground font-medium font-mono">{casus.id}</span>
      </nav>

      {/* ① Decision Strip */}
      <DecisionStrip
        state={state}
        casus={casus}
        primaryAction={primaryAction}
        onAction={handleAction}
      />

      {/* ② Phase Bar */}
      <PhaseBar currentPhase={currentPhase} />

      {/* ③ Three-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_280px] gap-4">
        {/* Left: Stable context */}
        <div className="xl:sticky xl:self-start" style={{ top: tokens.layout.edgeZero }}>
          <ContextPanel casus={casus} />
        </div>

        {/* Center: Phase execution */}
        <div>
          {renderCasePhase(casus, state, role, legacyProviders, handleAction)}
        </div>

        {/* Right: Intelligence */}
        <div className="xl:sticky xl:self-start" style={{ top: tokens.layout.edgeZero }}>
          <IntelligencePanel
            casus={casus}
            state={state}
            currentPhase={currentPhase}
          />
        </div>
      </div>
    </div>
  );
}
