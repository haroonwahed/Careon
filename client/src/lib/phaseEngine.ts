/**
 * Careon Phase Engine
 *
 * Single source of truth for:
 *  - Phase definitions and transitions
 *  - next_action computation
 *  - Signal computation
 *  - Allowed actions per phase + role
 *
 * UI never guesses what to show. It calls computeCaseState(casus, role)
 * and renders what it receives.
 */

// ─── Phase & Status types ─────────────────────────────────────────────────────

export type CasusPhase =
  | "intake_initial"
  | "beoordeling"
  | "matching"
  | "plaatsing"
  | "intake_provider"
  | "afgerond"
  | "geblokkeerd";

export type CasusStatus =
  | "nieuw"
  | "in_beoordeling"
  | "beoordeling_afgerond"
  | "matching_bezig"
  | "match_gevonden"
  | "plaatsing_te_bevestigen"
  | "plaatsing_bevestigd"
  | "intake_gepland"
  | "intake_gestart"
  | "zorg_gestart"
  | "afgewezen"
  | "gesloten"
  | "geblokkeerd";

export type UrgencyLevel = "critical" | "high" | "medium" | "low";
export type RiskLevel    = "high" | "medium" | "low" | "none";
export type UserRole     = "gemeente" | "zorgaanbieder" | "admin";

export type ActionType =
  | "start_beoordeling"
  | "edit_basisgegevens"
  | "upload_document"
  | "save_concept"
  | "complete_beoordeling"
  | "request_more_info"
  | "rerun_matching"
  | "view_provider_profile"
  | "select_provider"
  | "expand_radius"
  | "escalate_case"
  | "confirm_placement"
  | "cancel_placement"
  | "return_to_matching"
  | "follow_up_provider"
  | "view_handover"
  | "accept_case"
  | "reject_case"
  | "plan_intake"
  | "mark_intake_started"
  | "mark_intake_completed"
  | "archive_case"
  | "review_outcome"
  | "reopen_case"
  | "request_manual_review"
  | "return_to_previous_phase";

// ─── Data models ──────────────────────────────────────────────────────────────

export interface CasusAssessment {
  isComplete: boolean;
  urgency: UrgencyLevel | null;
  complexity: "high" | "medium" | "low" | null;
  careType: string | null;
  notes: string;
  assessor: string;
  scheduledDate: string | null;
  completedAt: string | null;
  daysOverdue: number;
  missingFields: string[];
}

export interface MatchResult {
  providerId: string;
  providerName: string;
  providerType: string;
  region: string;
  score: number;
  recommendationType: "perfect" | "good" | "alternative";
  explanation: string;
  availableSpots: number;
  rating: number;
  responseTimeHours: number;
  specializations: string[];
}

export interface CasusPlacement {
  providerId: string | null;
  providerName: string | null;
  status: "proposed" | "pending" | "confirmed" | "rejected" | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  validations: {
    assessmentComplete: boolean;
    providerSelected: boolean;
    dossierComplete: boolean;
    guardianConsent: boolean;
  };
}

export interface CasusIntake {
  providerId: string | null;
  status: "not_planned" | "planned" | "started" | "completed" | "rejected" | null;
  plannedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  rejectedReason: string | null;
  providerResponseDays: number;
}

export interface CasusSignal {
  id: string;
  type: "wachttijd" | "beoordeling" | "matching" | "capaciteit" | "intake" | "risico";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  isResolved: boolean;
}

export interface CasusTimelineEvent {
  id: string;
  type: "created" | "phase_change" | "action" | "signal" | "note" | "system";
  label: string;
  actorName: string;
  actorRole: UserRole | "system";
  date: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface CasusAction {
  id: string;
  type: ActionType;
  label: string;
  priority: "primary" | "secondary" | "destructive";
  assignedTo: string | null;
  dueAt: string | null;
}

// ─── Full Casus model ─────────────────────────────────────────────────────────

export interface Casus {
  id: string;
  clientName: string;
  clientAge: number;
  region: string;
  careType: string;
  urgency: UrgencyLevel;
  complexity: "high" | "medium" | "low";
  phase: CasusPhase;
  status: CasusStatus;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  waitingDays: number;
  assessment: CasusAssessment;
  matchResults: MatchResult[];
  selectedProviderId: string | null;
  placement: CasusPlacement;
  intake: CasusIntake;
}

// ─── Computed state (output of engine) ───────────────────────────────────────

export interface ComputedCaseState {
  nextAction: string;
  nextActionDetail: string;
  decisionType: "critical" | "warning" | "action" | "good" | "info";
  signals: CasusSignal[];
  allowedActions: CasusAction[];
  timelineEvents: CasusTimelineEvent[];
  blockerReason: string | null;
  isReadOnly: boolean;
}

// ─── Phase transition map ─────────────────────────────────────────────────────

export const PHASE_TRANSITIONS: Record<CasusStatus, CasusStatus[]> = {
  nieuw:                   ["in_beoordeling"],
  in_beoordeling:          ["beoordeling_afgerond", "geblokkeerd"],
  beoordeling_afgerond:    ["matching_bezig"],
  matching_bezig:          ["match_gevonden", "geblokkeerd"],
  match_gevonden:          ["plaatsing_te_bevestigen"],
  plaatsing_te_bevestigen: ["plaatsing_bevestigd", "matching_bezig"],
  plaatsing_bevestigd:     ["intake_gepland", "afgewezen"],
  intake_gepland:          ["intake_gestart"],
  intake_gestart:          ["zorg_gestart"],
  zorg_gestart:            ["gesloten"],
  afgewezen:               ["matching_bezig", "geblokkeerd"],
  gesloten:                [],
  geblokkeerd:             ["in_beoordeling", "matching_bezig", "intake_gepland"],
};

export function statusToPhase(status: CasusStatus): CasusPhase {
  const map: Record<CasusStatus, CasusPhase> = {
    nieuw:                   "intake_initial",
    in_beoordeling:          "beoordeling",
    beoordeling_afgerond:    "beoordeling",
    matching_bezig:          "matching",
    match_gevonden:          "matching",
    plaatsing_te_bevestigen: "plaatsing",
    plaatsing_bevestigd:     "intake_provider",
    intake_gepland:          "intake_provider",
    intake_gestart:          "intake_provider",
    zorg_gestart:            "afgerond",
    afgewezen:               "geblokkeerd",
    gesloten:                "afgerond",
    geblokkeerd:             "geblokkeerd",
  };
  return map[status];
}

export const ALL_PHASES: { id: CasusPhase; label: string; shortLabel: string }[] = [
  { id: "intake_initial",  label: "Intake",           shortLabel: "Intake"     },
  { id: "beoordeling",     label: "Beoordeling",      shortLabel: "Beoordeling"},
  { id: "matching",        label: "Matching",          shortLabel: "Matching"   },
  { id: "plaatsing",       label: "Plaatsing",         shortLabel: "Plaatsing"  },
  { id: "intake_provider", label: "Intake aanbieder",  shortLabel: "Aanbieder"  },
  { id: "afgerond",        label: "Afgerond",          shortLabel: "Afgerond"   },
];

// ─── next_action computation ──────────────────────────────────────────────────

function computeNextAction(casus: Casus): { label: string; detail: string; type: ComputedCaseState["decisionType"] } {
  const { phase, assessment, matchResults, placement, intake, waitingDays } = casus;

  switch (phase) {
    case "intake_initial":
      return {
        label:  "Start beoordeling",
        detail: "Casus kan niet door naar matching zonder eerste beoordeling.",
        type:   "action",
      };

    case "beoordeling": {
      if (assessment.missingFields.length > 0) {
        return {
          label:  `Vul ${assessment.missingFields.length} ontbrekend${assessment.missingFields.length === 1 ? " veld" : "e velden"} in`,
          detail: `Ontbreekt: ${assessment.missingFields.join(", ")}. Beoordeling kan niet worden afgerond.`,
          type:   "warning",
        };
      }
      if (assessment.daysOverdue > 0) {
        return {
          label:  "Beoordeling afronden — vertraagd",
          detail: `Beoordeling is ${assessment.daysOverdue} ${assessment.daysOverdue === 1 ? "dag" : "dagen"} over de deadline.`,
          type:   "warning",
        };
      }
      return {
        label:  "Rond beoordeling af",
        detail: "Alle benodigde informatie is aanwezig. Beoordeling kan worden afgerond.",
        type:   "action",
      };
    }

    case "matching": {
      if (matchResults.length === 0) {
        return {
          label:  "Vergroot zoekgebied of escaleer",
          detail: "Geen geschikte aanbieder gevonden in de huidige regio.",
          type:   "critical",
        };
      }
      if (casus.selectedProviderId) {
        return {
          label:  "Bevestig plaatsing",
          detail: "Aanbieder is geselecteerd. Ga door naar plaatsing.",
          type:   "action",
        };
      }
      return {
        label:  "Kies aanbieder",
        detail: `${matchResults.length} passende aanbieder${matchResults.length === 1 ? "" : "s"} gevonden. Selecteer de beste optie.`,
        type:   "action",
      };
    }

    case "plaatsing": {
      const v = placement.validations;
      const failedCount = [v.assessmentComplete, v.providerSelected, v.dossierComplete, v.guardianConsent].filter(b => !b).length;
      if (failedCount > 0) {
        return {
          label:  `${failedCount} validatie${failedCount === 1 ? "" : "s"} nog openstaand`,
          detail: "Voltooi alle vereiste stappen voordat de plaatsing bevestigd kan worden.",
          type:   "warning",
        };
      }
      return {
        label:  "Bevestig plaatsing",
        detail: "Aanbieder is geselecteerd en alle validaties zijn geslaagd.",
        type:   "action",
      };
    }

    case "intake_provider": {
      if (!intake.plannedAt) {
        return {
          label:  "Plan intake",
          detail: "Plaatsing is bevestigd. De aanbieder moet een intake inplannen.",
          type:   "warning",
        };
      }
      if (intake.providerResponseDays > 3) {
        return {
          label:  "Volg op bij aanbieder",
          detail: `Aanbieder heeft ${intake.providerResponseDays} dagen niet gereageerd op de intake planning.`,
          type:   "warning",
        };
      }
      if (intake.status === "planned") {
        return {
          label:  "Wacht op intake",
          detail: `Intake is gepland op ${intake.plannedAt}. Aanbieder voert de intake uit.`,
          type:   "info",
        };
      }
      if (intake.status === "started") {
        return {
          label:  "Intake bezig — markeer als afgerond",
          detail: "Aanbieder is begonnen met de intake. Zorgverlening start binnenkort.",
          type:   "action",
        };
      }
      return {
        label:  "Intake afronden",
        detail: "Alle stappen zijn gereed. Markeer de intake als voltooid.",
        type:   "action",
      };
    }

    case "afgerond":
      return {
        label:  "Casus succesvol overgedragen",
        detail: "Zorgverlening is gestart. De casus is overgedragen aan de aanbieder.",
        type:   "good",
      };

    case "geblokkeerd":
      if (waitingDays > 14) {
        return {
          label:  "Directe escalatie vereist",
          detail: `Casus staat al ${waitingDays} dagen open zonder voortgang. Handmatige interventie noodzakelijk.`,
          type:   "critical",
        };
      }
      return {
        label:  "Handmatige actie vereist",
        detail: "Het systeem kan niet automatisch doorgaan. Bekijk de blokkades en kies een actie.",
        type:   "critical",
      };
  }
}

// ─── Signal computation ───────────────────────────────────────────────────────

function computeSignals(casus: Casus): CasusSignal[] {
  const signals: CasusSignal[] = [];
  const { phase, assessment, matchResults, placement, intake, waitingDays, urgency } = casus;

  if (waitingDays > 7) {
    signals.push({
      id: "sig-wachttijd",
      type: "wachttijd",
      severity: waitingDays > 14 ? "critical" : "warning",
      title: "Wachttijd overschreden",
      description: `${waitingDays} dagen — norm is 7 dagen.`,
      isResolved: false,
    });
  }

  if (urgency === "critical" || urgency === "high") {
    signals.push({
      id: "sig-urgentie",
      type: "risico",
      severity: urgency === "critical" ? "critical" : "warning",
      title: urgency === "critical" ? "Kritieke urgentie" : "Hoge urgentie",
      description: "Dit geval vereist voorrangsbehandeling.",
      isResolved: false,
    });
  }

  if (phase === "beoordeling" && assessment.missingFields.length > 0) {
    signals.push({
      id: "sig-beoordeling-ontbreekt",
      type: "beoordeling",
      severity: "warning",
      title: "Beoordeling onvolledig",
      description: `Ontbrekende velden: ${assessment.missingFields.join(", ")}.`,
      isResolved: false,
    });
  }

  if (phase === "beoordeling" && assessment.daysOverdue > 0) {
    signals.push({
      id: "sig-beoordeling-vertraagd",
      type: "beoordeling",
      severity: assessment.daysOverdue > 3 ? "critical" : "warning",
      title: "Beoordeling vertraagd",
      description: `${assessment.daysOverdue} ${assessment.daysOverdue === 1 ? "dag" : "dagen"} over deadline.`,
      isResolved: false,
    });
  }

  if (phase === "matching" && matchResults.length === 0) {
    signals.push({
      id: "sig-geen-aanbieder",
      type: "matching",
      severity: "critical",
      title: "Geen aanbieder beschikbaar",
      description: "Geen passende aanbieder gevonden in de huidige regio.",
      isResolved: false,
    });
  }

  if (phase === "matching" && matchResults.length > 0 && matchResults[0].availableSpots <= 1) {
    signals.push({
      id: "sig-capaciteit",
      type: "capaciteit",
      severity: "warning",
      title: "Beperkte capaciteit",
      description: "Slechts 1 beschikbare plek bij de best passende aanbieder.",
      isResolved: false,
    });
  }

  if (phase === "intake_provider" && !intake.plannedAt && intake.providerResponseDays > 3) {
    signals.push({
      id: "sig-intake-niet-gepland",
      type: "intake",
      severity: "warning",
      title: "Intake niet gepland",
      description: `Aanbieder heeft ${intake.providerResponseDays} werkdagen niet gereageerd.`,
      isResolved: false,
    });
  }

  const placementFailed = placement.validations &&
    !placement.validations.dossierComplete;
  if (phase === "plaatsing" && placementFailed) {
    signals.push({
      id: "sig-dossier-onvolledig",
      type: "beoordeling",
      severity: "warning",
      title: "Dossier onvolledig",
      description: "Niet alle vereiste documenten zijn aanwezig voor de plaatsing.",
      isResolved: false,
    });
  }

  return signals;
}

// ─── Allowed actions computation ─────────────────────────────────────────────

function computeAllowedActions(casus: Casus, role: UserRole): CasusAction[] {
  const { phase, assessment, matchResults, selectedProviderId } = casus;
  const actions: CasusAction[] = [];

  const add = (
    type: ActionType,
    label: string,
    priority: CasusAction["priority"],
    extra?: Partial<CasusAction>
  ) => actions.push({ id: `act-${type}`, type, label, priority, assignedTo: null, dueAt: null, ...extra });

  switch (phase) {
    case "intake_initial":
      if (role !== "zorgaanbieder") {
        add("start_beoordeling",  "Start beoordeling",   "primary");
        add("edit_basisgegevens", "Bewerk basisgegevens", "secondary");
        add("upload_document",    "Upload document",      "secondary");
      }
      break;

    case "beoordeling":
      if (role !== "zorgaanbieder") {
        if (assessment.isComplete) {
          add("complete_beoordeling", "Beoordeling afronden", "primary");
        } else {
          add("save_concept",         "Concept opslaan",       "secondary");
          add("complete_beoordeling", "Beoordeling afronden",  "primary");
        }
        add("request_more_info", "Aanvullende info opvragen", "secondary");
        add("upload_document",   "Upload document",           "secondary");
      }
      break;

    case "matching":
      if (role !== "zorgaanbieder") {
        if (selectedProviderId) {
          add("select_provider",  "Bevestig selectie",       "primary");
          add("return_to_matching", "Andere aanbieder kiezen", "secondary");
        } else {
          add("select_provider",  "Selecteer aanbieder",    "primary");
        }
        add("rerun_matching",     "Herstart matching",      "secondary");
        add("expand_radius",      "Vergroot zoekgebied",    "secondary");
        add("escalate_case",      "Escaleer casus",         "destructive");
      }
      break;

    case "plaatsing":
      if (role !== "zorgaanbieder") {
        add("confirm_placement",   "Bevestig plaatsing",   "primary");
        add("return_to_matching",  "Terug naar matching",  "secondary");
        add("cancel_placement",    "Annuleer plaatsing",   "destructive");
      }
      break;

    case "intake_provider":
      if (role === "gemeente" || role === "admin") {
        add("follow_up_provider", "Volg op bij aanbieder", "primary");
        add("view_handover",      "Bekijk overdracht",     "secondary");
        add("escalate_case",      "Escaleer casus",        "destructive");
      }
      if (role === "zorgaanbieder" || role === "admin") {
        add("accept_case",           "Accepteer casus",      "primary");
        add("plan_intake",           "Plan intake",          "primary");
        add("mark_intake_started",   "Intake gestart",       "secondary");
        add("mark_intake_completed", "Intake afgerond",      "secondary");
        add("reject_case",           "Wijs af",              "destructive");
      }
      break;

    case "afgerond":
      add("archive_case",    "Archiveer casus",   "secondary");
      add("review_outcome",  "Bekijk uitkomst",   "secondary");
      if (role === "admin") {
        add("reopen_case", "Heropen casus", "destructive");
      }
      break;

    case "geblokkeerd":
      if (role !== "zorgaanbieder") {
        add("escalate_case",           "Escaleer casus",          "primary");
        add("request_manual_review",   "Vraag handmatige review", "secondary");
        add("return_to_previous_phase","Terug naar vorige fase",   "secondary");
      }
      break;
  }

  return actions;
}

// ─── Timeline events computation ─────────────────────────────────────────────

function computeTimeline(casus: Casus): CasusTimelineEvent[] {
  const { phase, assessment, placement, intake, waitingDays } = casus;
  const events: CasusTimelineEvent[] = [];

  events.push({
    id: "tl-created",
    type: "created",
    label: "Casus aangemaakt",
    actorName: casus.assignedTo,
    actorRole: "gemeente",
    date: casus.createdAt,
  });

  if (["beoordeling", "matching", "plaatsing", "intake_provider", "afgerond", "geblokkeerd"].includes(phase)) {
    events.push({
      id: "tl-intake-done",
      type: "phase_change",
      label: "Intake afgerond",
      actorName: casus.assignedTo,
      actorRole: "gemeente",
      date: "2026-04-06",
    });
  }

  if (["matching", "plaatsing", "intake_provider", "afgerond"].includes(phase)) {
    events.push({
      id: "tl-beoordeling-started",
      type: "phase_change",
      label: "Beoordeling gestart",
      actorName: assessment.assessor,
      actorRole: "gemeente",
      date: assessment.scheduledDate ?? "2026-04-08",
    });

    if (assessment.completedAt) {
      events.push({
        id: "tl-beoordeling-done",
        type: "phase_change",
        label: "Beoordeling afgerond",
        actorName: assessment.assessor,
        actorRole: "gemeente",
        date: assessment.completedAt,
      });
    }
  }

  if (phase === "beoordeling" && assessment.daysOverdue > 0) {
    events.push({
      id: "tl-beoordeling-overdue",
      type: "signal",
      label: `Beoordeling ${assessment.daysOverdue} dagen over deadline`,
      actorName: "Systeem",
      actorRole: "system",
      date: "2026-04-15",
    });
  }

  if (["plaatsing", "intake_provider", "afgerond"].includes(phase) && placement.providerId) {
    events.push({
      id: "tl-provider-selected",
      type: "action",
      label: `Aanbieder geselecteerd: ${placement.providerName}`,
      actorName: casus.assignedTo,
      actorRole: "gemeente",
      date: "2026-04-12",
    });
  }

  if (["intake_provider", "afgerond"].includes(phase) && placement.confirmedAt) {
    events.push({
      id: "tl-placement-confirmed",
      type: "phase_change",
      label: "Plaatsing bevestigd",
      actorName: placement.confirmedBy ?? casus.assignedTo,
      actorRole: "gemeente",
      date: placement.confirmedAt,
    });
  }

  if (phase === "intake_provider" && intake.plannedAt) {
    events.push({
      id: "tl-intake-planned",
      type: "action",
      label: "Intake gepland",
      actorName: "Aanbieder",
      actorRole: "zorgaanbieder",
      date: intake.plannedAt,
    });
  }

  if (phase === "afgerond") {
    events.push({
      id: "tl-zorg-started",
      type: "phase_change",
      label: "Zorgverlening gestart",
      actorName: "Aanbieder",
      actorRole: "zorgaanbieder",
      date: intake.completedAt ?? "2026-04-17",
    });
  }

  // Pending next step
  events.push({
    id: "tl-next",
    type: "system",
    label: "Volgende stap",
    actorName: "Systeem",
    actorRole: "system",
    date: "Nu",
  });

  return events.sort((a, b) => {
    if (a.id === "tl-next") return 1;
    if (b.id === "tl-next") return -1;
    return 0;
  });
}

// ─── Main engine function ─────────────────────────────────────────────────────

export function computeCaseState(casus: Casus, role: UserRole): ComputedCaseState {
  const na = computeNextAction(casus);

  return {
    nextAction:       na.label,
    nextActionDetail: na.detail,
    decisionType:     na.type,
    signals:          computeSignals(casus),
    allowedActions:   computeAllowedActions(casus, role),
    timelineEvents:   computeTimeline(casus),
    blockerReason:    casus.phase === "geblokkeerd" ? casus.intake.rejectedReason ?? "Matching mislukt" : null,
    isReadOnly:       casus.phase === "afgerond",
  };
}
