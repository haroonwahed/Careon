/**
 * CasusControlCenter — Phase-Driven Execution Engine
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
  Calendar,
  FileText,
  ShieldAlert,
  Zap,
  CircleDot,
  Circle,
  ArrowRight,
  MessageSquare,
  Info,
} from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Case, mockCases, mockProviders, Provider } from "../../lib/casesData";
import { CaseStatusBadge } from "./CaseStatusBadge";
import { UrgencyBadge } from "./UrgencyBadge";
import { RiskBadge } from "./RiskBadge";

// ─── Types ───────────────────────────────────────────────────────────────────

type DecisionType = "critical" | "warning" | "action" | "good";

interface Decision {
  type: DecisionType;
  issue: string;
  reason: string;
  action: string;
  ctaLabel: string;
}

interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  type: "completed" | "warning" | "pending" | "active";
}

// ─── Decision logic ───────────────────────────────────────────────────────────

function getDecision(c: Case): Decision {
  if (c.status === "blocked") {
    return {
      type: "critical",
      issue: "Geen geschikte aanbieder gevonden",
      reason: `Casus staat ${c.waitingDays} dagen open. Zonder escalatie loopt dit verder op.`,
      action: "Escaleer nu naar capaciteitsmanager",
      ctaLabel: "Escaleer nu",
    };
  }
  if (c.status === "assessment") {
    return {
      type: "warning",
      issue: "Beoordeling ontbreekt of loopt vertraging op",
      reason: "Casus kan niet door naar matching zolang de beoordeling niet is afgerond.",
      action: "Neem contact op met beoordelaar",
      ctaLabel: "Contact beoordelaar",
    };
  }
  if (c.status === "matching") {
    return {
      type: "action",
      issue: "Klaar voor matching — actie vereist",
      reason: "Beoordeling is gereed. Selecteer een aanbieder om de plaatsing in gang te zetten.",
      action: "Bekijk en selecteer een aanbieder",
      ctaLabel: "Selecteer aanbieder",
    };
  }
  if (c.status === "placement") {
    return {
      type: "warning",
      issue: "Wacht op bevestiging aanbieder",
      reason: "Plaatsing is voorgesteld maar nog niet bevestigd door de aanbieder.",
      action: "Volg op bij aanbieder",
      ctaLabel: "Volg op",
    };
  }
  if (c.status === "intake") {
    return {
      type: "action",
      issue: "Nieuwe casus — intake te verwerken",
      reason: "Start de beoordeling om de casus in de workflow te brengen.",
      action: "Start beoordeling",
      ctaLabel: "Start beoordeling",
    };
  }
  return {
    type: "good",
    issue: "Casus verloopt normaal",
    reason: "Geen directe actie vereist op dit moment.",
    action: "Volg standaard procedure",
    ctaLabel: "Bekijk status",
  };
}

// ─── Phase config ─────────────────────────────────────────────────────────────

const ALL_PHASES = [
  { id: "intake", label: "Intake" },
  { id: "assessment", label: "Beoordeling" },
  { id: "matching", label: "Matching" },
  { id: "placement", label: "Plaatsing" },
  { id: "provider-intake", label: "Intake aanbieder" },
  { id: "completed", label: "Afgerond" },
] as const;

type PhaseId = typeof ALL_PHASES[number]["id"];

function statusToPhase(status: Case["status"]): PhaseId {
  const map: Record<Case["status"], PhaseId> = {
    intake: "intake",
    assessment: "assessment",
    matching: "matching",
    blocked: "matching",
    placement: "placement",
    active: "provider-intake",
    completed: "completed",
  };
  return map[status];
}

// ─── Timeline mock ─────────────────────────────────────────────────────────────

function buildTimeline(c: Case): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      date: "5 april 2026",
      title: "Casus aangemaakt",
      description: "Initieel contact via gemeente loket",
      type: "completed",
    },
    {
      date: "6 april 2026",
      title: "Intake afgerond",
      description: `Toegewezen aan ${c.assignedTo}`,
      type: "completed",
    },
  ];

  if (["assessment", "matching", "blocked", "placement", "active", "completed"].includes(c.status)) {
    events.push({
      date: "8 april 2026",
      title: "Beoordeling gestart",
      description: "Toegewezen aan Dr. P. Bakker",
      type: c.status === "assessment" ? "active" : "completed",
    });
  }

  if (c.status === "assessment" && c.waitingDays > 5) {
    events.push({
      date: `${c.waitingDays - 3} apr. 2026`,
      title: "Deadline beoordeling verstreken",
      description: `${c.waitingDays - 3} dagen over deadline`,
      type: "warning",
    });
  }

  if (["matching", "blocked", "placement", "active", "completed"].includes(c.status)) {
    events.push({
      date: "12 april 2026",
      title: "Beoordeling afgerond",
      description: "Klaar voor matching",
      type: "completed",
    });
  }

  if (c.status === "blocked") {
    events.push({
      date: "13 april 2026",
      title: "Matching gestart — geen resultaat",
      description: "3 aanbieders benaderd, 0 reacties",
      type: "warning",
    });
  }

  if (c.status === "placement") {
    events.push({
      date: "13 april 2026",
      title: "Aanbieder geselecteerd",
      description: "Plaatsing voorgesteld bij Jeugdzorg Amsterdam Noord",
      type: "active",
    });
  }

  events.push({
    date: "Volgende stap",
    title: "Wacht op actie",
    description: getDecision(c).ctaLabel,
    type: "pending",
  });

  return events;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const decisionColors: Record<DecisionType, {
  strip: string;
  icon: string;
  btn: string;
  badge: string;
}> = {
  critical: {
    strip: "bg-gradient-to-r from-red-600 to-red-500",
    icon: "text-white",
    btn: "bg-white text-red-600 hover:bg-red-50 font-semibold",
    badge: "bg-red-700/40 text-white",
  },
  warning: {
    strip: "bg-gradient-to-r from-amber-500 to-amber-400",
    icon: "text-white",
    btn: "bg-white text-amber-600 hover:bg-amber-50 font-semibold",
    badge: "bg-amber-600/40 text-white",
  },
  action: {
    strip: "bg-gradient-to-r from-primary to-primary/80",
    icon: "text-white",
    btn: "bg-white text-primary hover:bg-primary/10 font-semibold",
    badge: "bg-primary/30 text-white",
  },
  good: {
    strip: "bg-gradient-to-r from-emerald-600 to-emerald-500",
    icon: "text-white",
    btn: "bg-white text-emerald-600 hover:bg-emerald-50 font-semibold",
    badge: "bg-emerald-700/40 text-white",
  },
};

const DecisionIcons: Record<DecisionType, React.ComponentType<{ size?: number; className?: string }>> = {
  critical: Siren,
  warning: AlertTriangle,
  action: Zap,
  good: CheckCircle2,
};

// ─── Sub-components ────────────────────────────────────────────────────────────

// 1. Decision Strip
function DecisionStrip({
  decision,
  caseData,
  onPrimaryAction,
}: {
  decision: Decision;
  caseData: Case;
  onPrimaryAction: () => void;
}) {
  const colors = decisionColors[decision.type];
  const Icon = DecisionIcons[decision.type];

  return (
    <div className={`${colors.strip} rounded-xl px-6 py-5 shadow-lg`}>
      <div className="flex items-center gap-5">
        {/* Icon */}
        <div className="shrink-0 hidden sm:flex">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Icon size={24} className={colors.icon} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge} uppercase tracking-wider`}>
              Actie vereist
            </span>
            <span className="text-white/70 text-xs">{caseData.id}</span>
          </div>
          <h2 className="text-white font-bold text-lg leading-tight mb-0.5">
            {decision.issue}
          </h2>
          <p className="text-white/80 text-sm leading-snug">
            {decision.reason}
          </p>
        </div>

        {/* CTA */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <Button
            className={`${colors.btn} px-5 py-2 h-auto text-sm shadow-md`}
            onClick={onPrimaryAction}
          >
            {decision.ctaLabel}
            <ArrowRight size={14} className="ml-1.5" />
          </Button>
          <span className="text-white/60 text-xs">{decision.action}</span>
        </div>
      </div>
    </div>
  );
}

// 2. Phase Progress Bar
function PhaseBar({ currentPhase }: { currentPhase: PhaseId }) {
  const currentIndex = ALL_PHASES.findIndex(p => p.id === currentPhase);

  return (
    <div className="premium-card px-5 py-4">
      <div className="flex items-center">
        {ALL_PHASES.map((phase, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isPending = idx > currentIndex;

          return (
            <div key={phase.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all shrink-0 ${
                    isCurrent
                      ? "bg-primary border-primary text-white ring-2 ring-primary/30"
                      : isCompleted
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <span
                  className={`text-xs font-medium text-center leading-tight hidden md:block ${
                    isCurrent
                      ? "text-primary"
                      : isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {phase.label}
                </span>
              </div>
              {idx < ALL_PHASES.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 mb-5 ${
                    isCompleted ? "bg-primary/40" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 3a. Left — Context Panel
function ContextPanel({ caseData }: { caseData: Case }) {
  return (
    <div className="space-y-4">
      {/* Client Card */}
      <div className="premium-card p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Cliënt
        </h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User size={18} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">{caseData.clientName}</p>
              <p className="text-xs text-muted-foreground">{caseData.clientAge} jaar</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <InfoRow label="Casus ID" value={caseData.id} />
            <InfoRow
              label="Regio"
              value={
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {caseData.region}
                </span>
              }
            />
            <InfoRow label="Type zorg" value={caseData.caseType} />
            <InfoRow
              label="Wachttijd"
              value={
                <span
                  className={`flex items-center gap-1 ${
                    caseData.waitingDays > 7 ? "text-red-500 font-semibold" : ""
                  }`}
                >
                  <Clock size={12} />
                  {caseData.waitingDays} dagen
                </span>
              }
            />
            <InfoRow label="Toegewezen" value={caseData.assignedTo} />
          </div>
        </div>
      </div>

      {/* Status Card */}
      <div className="premium-card p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Status
        </h3>
        <div className="space-y-2">
          <CaseStatusBadge status={caseData.status} />
          <div className="flex gap-1.5 mt-2">
            <UrgencyBadge urgency={caseData.urgency} />
            <RiskBadge risk={caseData.risk} />
          </div>
        </div>
      </div>

      {/* Intake Summary */}
      <div className="premium-card p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Intake samenvatting
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Cliënt heeft ondersteuning nodig bij dagelijkse structuur en sociaal-emotionele
          ontwikkeling. Eerder ambulant traject afgerond. Huidige situatie vereist intensievere
          begeleiding.
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

// 3b. Center — Execution Area (phase-specific)

function ExecutionArea({
  caseData,
  onPrimaryAction,
}: {
  caseData: Case;
  onPrimaryAction: () => void;
}) {
  return (
    <div className="space-y-4">
      {caseData.status === "intake" && (
        <IntakeExecution caseData={caseData} onAction={onPrimaryAction} />
      )}
      {caseData.status === "assessment" && (
        <BeoordelingExecution caseData={caseData} onAction={onPrimaryAction} />
      )}
      {(caseData.status === "matching" || caseData.status === "blocked") && (
        <MatchingExecution caseData={caseData} onAction={onPrimaryAction} />
      )}
      {caseData.status === "placement" && (
        <PlaatsingExecution caseData={caseData} onAction={onPrimaryAction} />
      )}
      {caseData.status === "completed" && (
        <AfgerondExecution caseData={caseData} />
      )}
    </div>
  );
}

// Intake phase
function IntakeExecution({ caseData, onAction }: { caseData: Case; onAction: () => void }) {
  return (
    <div className="premium-card p-5 space-y-5">
      <SectionHeader icon={<FileText size={16} className="text-primary" />} title="Intake details" />

      <div className="space-y-3 text-sm">
        <InfoBlock label="Type zorg" value={caseData.caseType} />
        <InfoBlock label="Regio" value={caseData.region} />
        <InfoBlock label="Aanvrager" value="Gemeente Utrecht — Jeugdteam" />
        <InfoBlock label="Datum aanvraag" value="5 april 2026" />
      </div>

      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg text-sm">
        <p className="font-medium mb-1">Volgende stap</p>
        <p className="text-muted-foreground">
          Start de beoordeling door een beoordelaar toe te wijzen. De beoordeling bepaalt
          welk type zorg passend is.
        </p>
      </div>

      <Button className="w-full" onClick={onAction}>
        Start beoordeling
        <ArrowRight size={15} className="ml-2" />
      </Button>
    </div>
  );
}

// Beoordeling phase
function BeoordelingExecution({ caseData, onAction }: { caseData: Case; onAction: () => void }) {
  const [note, setNote] = useState("");

  const isOverdue = caseData.waitingDays > 5;

  return (
    <div className="space-y-4">
      <div className="premium-card p-5 space-y-4">
        <SectionHeader icon={<Clock size={16} className="text-amber-500" />} title="Beoordeling" />

        {isOverdue && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
            <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">
                {caseData.waitingDays - 3} dagen over deadline
              </p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Norm is 7 dagen. Directe actie vereist.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3 text-sm">
          <InfoBlock label="Beoordelaar" value="Dr. P. Bakker" />
          <InfoBlock label="Gepland" value="8 april 2026" />
          <InfoBlock label="Deadline" value="15 april 2026" />
          <InfoBlock label="Status" value={
            <span className="text-amber-500 font-semibold">In behandeling</span>
          } />
        </div>
      </div>

      <div className="premium-card p-5 space-y-4">
        <SectionHeader icon={<MessageSquare size={16} className="text-muted-foreground" />} title="Opvolging" />

        <div className="space-y-3">
          <label className="text-sm font-medium">Notitie voor beoordelaar</label>
          <Textarea
            placeholder="Bijv. urgentie vermelden, context toevoegen..."
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Phone size={14} />
            Bel beoordelaar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <MessageSquare size={14} />
            Stuur notitie
          </Button>
        </div>

        <Button className="w-full" onClick={onAction}>
          Afronden beoordeling
          <CheckCircle2 size={15} className="ml-2" />
        </Button>
      </div>
    </div>
  );
}

// Matching phase
function MatchingExecution({ caseData, onAction }: { caseData: Case; onAction: () => void }) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const providers = mockProviders.slice(0, 3).map((p, i) => ({
    ...p,
    matchScore: [94, 87, 79][i],
    matchReason: [
      "Perfecte specialisatie match · Beschikbare plek",
      "Goede regio match · Snelle reactietijd",
      "Alternatieve regio · Ruime capaciteit",
    ][i],
    isBlocked: caseData.status === "blocked" && i > 0,
  }));

  return (
    <div className="space-y-4">
      {caseData.status === "blocked" && (
        <div className="premium-card p-5">
          <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
            <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-red-600 dark:text-red-400">Matching geblokkeerd</p>
              <p className="text-muted-foreground text-xs mt-0.5">{caseData.signal}</p>
            </div>
          </div>

          <SectionHeader icon={<ShieldAlert size={16} className="text-red-500" />} title="Escalatie" />
          <div className="mt-3 space-y-3">
            <Textarea
              placeholder="Reden voor escalatie, betrokken partijen, laatste acties..."
              rows={3}
              className="text-sm"
            />
            <Button className="w-full bg-red-500 hover:bg-red-600" onClick={onAction}>
              <Siren size={15} className="mr-2" />
              Escaleer naar capaciteitsmanager
            </Button>
          </div>
        </div>
      )}

      <div className="premium-card p-5 space-y-4">
        <SectionHeader icon={<TrendingUp size={16} className="text-primary" />} title="Aanbieders" badge={`${providers.length} gevonden`} />

        <div className="space-y-3">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              matchScore={p.matchScore}
              matchReason={p.matchReason}
              isSelected={selectedProvider === p.id}
              isDisabled={p.isBlocked}
              onSelect={() => setSelectedProvider(p.id)}
            />
          ))}
        </div>

        {caseData.status === "matching" && (
          <Button
            className="w-full"
            disabled={!selectedProvider}
            onClick={onAction}
          >
            Bevestig selectie
            <ArrowRight size={15} className="ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Provider Card
function ProviderCard({
  provider,
  matchScore,
  matchReason,
  isSelected,
  isDisabled,
  onSelect,
}: {
  provider: Provider;
  matchScore: number;
  matchReason: string;
  isSelected: boolean;
  isDisabled: boolean;
  onSelect: () => void;
}) {
  const scoreColor =
    matchScore >= 90
      ? "text-emerald-500"
      : matchScore >= 80
      ? "text-amber-500"
      : "text-muted-foreground";

  return (
    <button
      onClick={onSelect}
      disabled={isDisabled}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isDisabled
          ? "opacity-50 cursor-not-allowed bg-muted/30 border-border"
          : isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{provider.name}</p>
            <p className="text-xs text-muted-foreground">{provider.type} · {provider.region}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{matchReason}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-xl font-bold ${scoreColor}`}>{matchScore}%</p>
          <div className="flex items-center justify-end gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={10}
                className={
                  s <= Math.round(provider.rating)
                    ? "text-amber-400 fill-amber-400"
                    : "text-muted"
                }
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {provider.availableSpots} pl.
          </p>
        </div>
      </div>
    </button>
  );
}

// Plaatsing phase
function PlaatsingExecution({ caseData, onAction }: { caseData: Case; onAction: () => void }) {
  const provider = mockProviders[0];
  const matchScore = 94;
  const [checklist, setChecklist] = useState({
    intakePlanned: false,
    contractSent: false,
    guardianConsent: false,
  });

  const allChecked = Object.values(checklist).every(Boolean);

  return (
    <div className="space-y-4">
      {/* Selected Provider */}
      <div className="premium-card p-5 space-y-4">
        <SectionHeader icon={<Building2 size={16} className="text-primary" />} title="Geselecteerde aanbieder" />

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 size={20} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">{provider.name}</p>
            <p className="text-sm text-muted-foreground">{provider.type} · {provider.region}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-emerald-500">{matchScore}%</p>
            <p className="text-xs text-muted-foreground">match score</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <StatBlock label="Beschikbaar" value={`${provider.availableSpots} pl.`} />
          <StatBlock label="Reactietijd" value={`${provider.responseTime}u`} />
          <StatBlock label="Beoordeling" value={`${provider.rating}/5`} />
        </div>
      </div>

      {/* Checklist */}
      <div className="premium-card p-5 space-y-4">
        <SectionHeader icon={<CheckCircle2 size={16} className="text-emerald-500" />} title="Plaatsing checklist" />

        <div className="space-y-3">
          <ChecklistItem
            label="Intake gepland bij aanbieder"
            checked={checklist.intakePlanned}
            onChange={(v) => setChecklist(p => ({ ...p, intakePlanned: v }))}
          />
          <ChecklistItem
            label="Zorgcontract verstuurd"
            checked={checklist.contractSent}
            onChange={(v) => setChecklist(p => ({ ...p, contractSent: v }))}
          />
          <ChecklistItem
            label="Toestemming voogd / ouders verkregen"
            checked={checklist.guardianConsent}
            onChange={(v) => setChecklist(p => ({ ...p, guardianConsent: v }))}
          />
        </div>

        <Button
          className="w-full"
          disabled={!allChecked}
          onClick={onAction}
        >
          Bevestig plaatsing
          <CheckCircle2 size={15} className="ml-2" />
        </Button>
        {!allChecked && (
          <p className="text-xs text-muted-foreground text-center">
            Voltooi alle stappen voor de bevestiging
          </p>
        )}
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-muted/40 rounded-lg text-center">
      <p className="font-semibold text-sm">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ChecklistItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
          checked
            ? "bg-emerald-500 border-emerald-500"
            : "border-border group-hover:border-primary"
        }`}
      >
        {checked && <CheckCircle2 size={12} className="text-white" />}
      </button>
      <span className={`text-sm ${checked ? "line-through text-muted-foreground" : ""}`}>
        {label}
      </span>
    </label>
  );
}

// Afgerond
function AfgerondExecution({ caseData }: { caseData: Case }) {
  return (
    <div className="premium-card p-5 space-y-4">
      <div className="flex flex-col items-center py-6 text-center gap-3">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-emerald-500" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Casus afgerond</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {caseData.clientName} is succesvol geplaatst.
          </p>
        </div>
      </div>
      <Button variant="outline" className="w-full">
        Bekijk casus archief
      </Button>
    </div>
  );
}

// 3c. Right — Intelligence Panel

function IntelligencePanel({
  caseData,
  currentPhase,
  timeline,
}: {
  caseData: Case;
  currentPhase: PhaseId;
  timeline: TimelineEvent[];
}) {
  return (
    <div className="space-y-4">
      {/* Progress Steps */}
      <div className="premium-card p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Voortgang
        </h3>
        <div className="space-y-0">
          {ALL_PHASES.map((phase, idx) => {
            const phaseIndex = ALL_PHASES.findIndex(p => p.id === currentPhase);
            const isCompleted = idx < phaseIndex;
            const isCurrent = idx === phaseIndex;
            const isPending = idx > phaseIndex;

            return (
              <div key={phase.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 z-10 ${
                      isCurrent
                        ? "bg-primary border-primary"
                        : isCompleted
                        ? "bg-primary/20 border-primary/40"
                        : "bg-background border-border"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={12} className="text-primary" />
                    ) : isCurrent ? (
                      <CircleDot size={12} className="text-white" />
                    ) : (
                      <Circle size={12} className="text-muted-foreground" />
                    )}
                  </div>
                  {idx < ALL_PHASES.length - 1 && (
                    <div
                      className={`w-px h-6 ${
                        isCompleted ? "bg-primary/30" : "bg-border"
                      }`}
                    />
                  )}
                </div>
                <div className="flex-1 pb-1 pt-0.5">
                  <p
                    className={`text-sm font-medium leading-tight ${
                      isCurrent
                        ? "text-primary"
                        : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {phase.label}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-primary/70 mt-0.5">Huidige fase</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Signals */}
      <div className="premium-card p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Signalen
        </h3>
        <div className="space-y-2">
          <SignalItem
            type={caseData.status === "blocked" ? "critical" : "warning"}
            title={caseData.signal}
            description={`${caseData.waitingDays} dagen wachttijd`}
          />
          {caseData.risk === "high" && (
            <SignalItem
              type="warning"
              title="Hoog risico profiel"
              description="Prioriteit escalatie bij vertraging"
            />
          )}
          {caseData.waitingDays > 7 && (
            <SignalItem
              type="info"
              title="Norm overschreden"
              description="Wachttijd overschrijdt 7-dagen norm"
            />
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="premium-card p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Tijdlijn
        </h3>
        <div className="space-y-0">
          {timeline.map((event, idx) => (
            <TimelineItem key={idx} event={event} isLast={idx === timeline.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SignalItem({
  type,
  title,
  description,
}: {
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
}) {
  const colors = {
    critical: "bg-red-500/10 border-red-500/30 text-red-500",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-500",
    info: "bg-blue-500/10 border-blue-500/30 text-blue-500",
  };
  const Icon = { critical: Siren, warning: AlertTriangle, info: Info }[type];

  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${colors[type]}`}>
      <Icon size={14} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-medium leading-tight">{title}</p>
        <p className="text-xs opacity-70 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function TimelineItem({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const dotColors = {
    completed: "bg-emerald-500",
    active: "bg-primary ring-2 ring-primary/30",
    warning: "bg-amber-500",
    pending: "bg-muted-foreground/30",
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${dotColors[event.type]}`} />
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>
      <div className="flex-1 pb-4">
        <p className="text-xs text-muted-foreground">{event.date}</p>
        <p className="text-sm font-medium leading-tight mt-0.5">{event.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="font-semibold text-sm">{title}</span>
      {badge && (
        <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
          {badge}
        </span>
      )}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CasusControlCenterProps {
  caseId: string;
  onBack: () => void;
  onStartMatching?: (caseId: string) => void;
}

export function CasusControlCenter({
  caseId,
  onBack,
  onStartMatching,
}: CasusControlCenterProps) {
  const caseData = mockCases.find(c => c.id === caseId);

  if (!caseData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Casus niet gevonden: {caseId}</p>
          <Button variant="outline" onClick={onBack}>
            Terug naar Regiekamer
          </Button>
        </div>
      </div>
    );
  }

  const decision = getDecision(caseData);
  const currentPhase = statusToPhase(caseData.status);
  const timeline = buildTimeline(caseData);

  const handlePrimaryAction = () => {
    if (caseData.status === "matching" && onStartMatching) {
      onStartMatching(caseId);
    }
    // Other actions handled in-panel
  };

  return (
    <div className="space-y-5 pb-8">
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
        <span className="text-muted-foreground">Urgente casussen</span>
        <ChevronRight size={14} />
        <span className="text-foreground font-medium">{caseData.id}</span>
      </nav>

      {/* ① Decision Strip — visually dominant */}
      <DecisionStrip
        decision={decision}
        caseData={caseData}
        onPrimaryAction={handlePrimaryAction}
      />

      {/* ② Phase Progress Bar */}
      <PhaseBar currentPhase={currentPhase} />

      {/* ③ Three-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_300px] gap-5">
        {/* Left: Stable context */}
        <div className="xl:sticky xl:top-6 xl:self-start">
          <ContextPanel caseData={caseData} />
        </div>

        {/* Center: Execution area */}
        <div>
          <ExecutionArea
            caseData={caseData}
            onPrimaryAction={handlePrimaryAction}
          />
        </div>

        {/* Right: Intelligence */}
        <div className="xl:sticky xl:top-6 xl:self-start">
          <IntelligencePanel
            caseData={caseData}
            currentPhase={currentPhase}
            timeline={timeline}
          />
        </div>
      </div>
    </div>
  );
}
