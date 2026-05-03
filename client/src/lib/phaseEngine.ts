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
 *
 * NEW FLOW (v2):
 *   Casus → Matching → Aanbieder selecteren → Aanbiederbeoordeling → Intake → Afgerond
 *
 *   Gemeente:   casus aanmaken → matching uitvoeren → aanbieder kiezen → verzoek versturen
 *   Aanbieder:  verzoek ontvangen → beoordelen → accepteren/afwijzen/wachtlijst → intake plannen
 *   Municipality-side provider review is REMOVED as a workflow gate.
 */

// ─── Phase & Status types ─────────────────────────────────────────────────────

export type CasusPhase =
  | "casus"               // Case created, ready for matching
  | "matching"            // Gemeente runs matching & selects provider
  | "aanbieder_selectie"  // Provider selected, sending placement request
  | "provider_beoordeling" // Provider is reviewing the request
  | "intake_provider"     // Provider accepted, planning/executing intake
  | "afgerond"
  | "geblokkeerd";

export type CasusStatus =
  | "nieuw"
  | "klaar_voor_matching"          // Case created, ready for matching
  | "in_matching"                  // Matching in progress
  | "match_gevonden"               // Provider selected by gemeente
  | "voorgesteld_aan_aanbieder"    // Placement request sent to provider
  | "provider_beoordeelt"          // Provider is actively reviewing
  | "geaccepteerd_voor_intake"     // Provider accepted the case
  | "afgewezen_door_aanbieder"     // Provider rejected
  | "op_wachtlijst"                // Provider placed on waitlist
  | "meer_info_nodig"              // Provider needs more information
  | "intake_gepland"
  | "intake_gestart"
  | "zorg_gestart"
  | "gesloten"
  | "geblokkeerd";

export type UrgencyLevel = "critical" | "high" | "medium" | "low";
export type RiskLevel    = "high" | "medium" | "low" | "none";
export type UserRole     = "gemeente" | "zorgaanbieder" | "admin";

export type ActionType =
  | "start_matching"
  | "edit_basisgegevens"
  | "upload_document"
  | "rerun_matching"
  | "view_provider_profile"
  | "select_provider"
  | "stuur_naar_aanbieder"
  | "verstuur_plaatsingsverzoek"
  | "expand_radius"
  | "escalate_case"
  | "return_to_matching"
  | "follow_up_provider"
  | "view_handover"
  | "provider_accept_case"
  | "provider_reject_case"
  | "provider_request_info"
  | "provider_waitlist_case"
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
  type: "wachttijd" | "matching" | "capaciteit" | "intake" | "risico" | "aanbieder";
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
  nieuw:                       ["klaar_voor_matching"],
  klaar_voor_matching:         ["in_matching"],
  in_matching:                 ["match_gevonden", "geblokkeerd"],
  match_gevonden:              ["voorgesteld_aan_aanbieder", "in_matching"],
  voorgesteld_aan_aanbieder:   ["provider_beoordeelt"],
  provider_beoordeelt:         ["geaccepteerd_voor_intake", "afgewezen_door_aanbieder", "op_wachtlijst", "meer_info_nodig"],
  geaccepteerd_voor_intake:    ["intake_gepland"],
  afgewezen_door_aanbieder:    ["in_matching", "geblokkeerd"],
  op_wachtlijst:               ["in_matching", "geaccepteerd_voor_intake"],
  meer_info_nodig:             ["provider_beoordeelt", "in_matching"],
  intake_gepland:              ["intake_gestart"],
  intake_gestart:              ["zorg_gestart"],
  zorg_gestart:                ["gesloten"],
  gesloten:                    [],
  geblokkeerd:                 ["in_matching", "intake_gepland"],
};

export function statusToPhase(status: CasusStatus): CasusPhase {
  const map: Record<CasusStatus, CasusPhase> = {
    nieuw:                     "casus",
    klaar_voor_matching:       "casus",
    in_matching:               "matching",
    match_gevonden:            "aanbieder_selectie",
    voorgesteld_aan_aanbieder: "provider_beoordeling",
    provider_beoordeelt:       "provider_beoordeling",
    geaccepteerd_voor_intake:  "intake_provider",
    afgewezen_door_aanbieder:  "geblokkeerd",
    op_wachtlijst:             "geblokkeerd",
    meer_info_nodig:           "provider_beoordeling",
    intake_gepland:            "intake_provider",
    intake_gestart:            "intake_provider",
    zorg_gestart:              "afgerond",
    gesloten:                  "afgerond",
    geblokkeerd:               "geblokkeerd",
  };
  return map[status];
}

export const ALL_PHASES: { id: CasusPhase; label: string; shortLabel: string }[] = [
  { id: "casus",               label: "Casus",                 shortLabel: "Casus"      },
  { id: "matching",            label: "Matching",              shortLabel: "Matching"   },
  { id: "aanbieder_selectie",  label: "Aanbieder selecteren",  shortLabel: "Selectie"   },
  { id: "provider_beoordeling", label: "Aanbieder beoordeling", shortLabel: "Aanbieder beoordeling" },
  { id: "intake_provider",     label: "Intake aanbieder",      shortLabel: "Intake"     },
  { id: "afgerond",            label: "Afgerond",              shortLabel: "Afgerond"   },
];

// ─── next_action computation ──────────────────────────────────────────────────

function computeNextAction(casus: Casus): { label: string; detail: string; type: ComputedCaseState["decisionType"] } {
  const { phase, matchResults, placement, intake, waitingDays } = casus;

  switch (phase) {
    case "intake_initial":
    case "beoordeling":
    case "casus":
      return {
        label:  "Start matching",
        detail: "Casus is klaar. Voer matching uit om een geschikte aanbieder te vinden.",
        type:   "action",
      };

    case "matching": {
      if (matchResults.length === 0) {
        return {
          label:  "Vergroot zoekgebied of escaleer",
          detail: "Geen geschikte aanbieder gevonden in de huidige regio.",
          type:   "critical",
        };
      }
      return {
        label:  "Kies aanbieder",
        detail: `${matchResults.length} passende aanbieder${matchResults.length === 1 ? "" : "s"} gevonden. Selecteer de beste optie.`,
        type:   "action",
      };
    }

    case "aanbieder_selectie": {
      if (casus.selectedProviderId) {
        return {
          label:  "Verstuur plaatsingsverzoek",
          detail: `Aanbieder geselecteerd: ${placement.providerName ?? "onbekend"}. Stuur het verzoek naar de aanbieder.`,
          type:   "action",
        };
      }
      return {
        label:  "Selecteer aanbieder",
        detail: "Kies een aanbieder uit de matchresultaten om door te gaan.",
        type:   "action",
      };
    }

    case "provider_beoordeling": {
      if (placement.status === "rejected") {
        return {
          label:  "Aanbieder afgewezen — herstart matching",
          detail: "Aanbieder heeft het verzoek afgewezen. Kies een andere aanbieder.",
          type:   "critical",
        };
      }
      if (intake.status === "rejected") {
        return {
          label:  "Verzoek afgewezen — actie vereist",
          detail: "Aanbieder heeft het plaatsingsverzoek afgewezen. Re-routeer de casus.",
          type:   "critical",
        };
      }
      return {
        label:  "Aanbieder beoordeling",
        detail: "Wacht op aanbiedersreactie — plaatsingsverzoek is verstuurd; de aanbieder beoordeelt de casus.",
        type:   "info",
      };
    }

    case "intake_provider": {
      if (!intake.plannedAt) {
        return {
          label:  "Plan intake",
          detail: "Aanbieder heeft geaccepteerd. De aanbieder moet een intake inplannen.",
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

    default:
      return {
        label: "Bekijk casusstatus",
        detail: "De casus bevindt zich in een onbekende fase. Open de casus om de volgende stap te bepalen.",
        type: "info",
      };
  }
}

// ─── Signal computation ───────────────────────────────────────────────────────

function computeSignals(casus: Casus): CasusSignal[] {
  const signals: CasusSignal[] = [];
  const { phase, matchResults, placement, intake, waitingDays, urgency } = casus;

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

  if ((phase === "matching" || phase === "aanbieder_selectie") && matchResults.length === 0) {
    signals.push({
      id: "sig-geen-aanbieder",
      type: "matching",
      severity: "critical",
      title: "Geen aanbieder beschikbaar",
      description: "Geen passende aanbieder gevonden in de huidige regio.",
      isResolved: false,
    });
  }

  if ((phase === "matching" || phase === "aanbieder_selectie") && matchResults.length > 0 && matchResults[0].availableSpots <= 1) {
    signals.push({
      id: "sig-capaciteit",
      type: "capaciteit",
      severity: "warning",
      title: "Beperkte capaciteit",
      description: "Slechts 1 beschikbare plek bij de best passende aanbieder.",
      isResolved: false,
    });
  }

  if (phase === "provider_beoordeling" && placement.status === "rejected") {
    signals.push({
      id: "sig-aanbieder-afgewezen",
      type: "matching",
      severity: "critical",
      title: "Aanbieder heeft afgewezen",
      description: "De aanbieder heeft het plaatsingsverzoek afgewezen. Herstart matching.",
      isResolved: false,
    });
  }

  if (phase === "provider_beoordeling" && intake.providerResponseDays > 3) {
    signals.push({
      id: "sig-aanbieder-geen-reactie",
      type: "intake",
      severity: "warning",
      title: "Aanbieder reageert niet",
      description: `Aanbieder heeft ${intake.providerResponseDays} werkdagen niet gereageerd op het verzoek.`,
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

  if (!placement.validations?.dossierComplete && (phase === "aanbieder_selectie" || phase === "provider_beoordeling")) {
    signals.push({
      id: "sig-dossier-onvolledig",
      type: "matching",
      severity: "warning",
      title: "Dossier onvolledig",
      description: "Niet alle vereiste documenten zijn aanwezig voor het plaatsingsverzoek.",
      isResolved: false,
    });
  }

  return signals;
}

// ─── Allowed actions computation ─────────────────────────────────────────────

function computeAllowedActions(casus: Casus, role: UserRole): CasusAction[] {
  const { phase, matchResults, selectedProviderId } = casus;
  const actions: CasusAction[] = [];

  const add = (
    type: ActionType,
    label: string,
    priority: CasusAction["priority"],
    extra?: Partial<CasusAction>
  ) => actions.push({ id: `act-${type}`, type, label, priority, assignedTo: null, dueAt: null, ...extra });

  switch (phase) {
    case "casus":
      if (role !== "zorgaanbieder") {
        add("start_matching",     "Start matching",      "primary");
        add("edit_basisgegevens", "Bewerk basisgegevens", "secondary");
        add("upload_document",    "Upload document",      "secondary");
      }
      break;

    case "matching":
      if (role !== "zorgaanbieder") {
        add("select_provider",  "Selecteer aanbieder",    "primary");
        add("rerun_matching",   "Herstart matching",      "secondary");
        add("expand_radius",    "Vergroot zoekgebied",    "secondary");
        add("escalate_case",    "Escaleer casus",         "destructive");
      }
      break;

    case "aanbieder_selectie":
      if (role !== "zorgaanbieder") {
        if (selectedProviderId) {
          add("verstuur_plaatsingsverzoek", "Verstuur plaatsingsverzoek",  "primary");
          add("stuur_naar_aanbieder",       "Stuur naar aanbieder",        "primary");
          add("return_to_matching",         "Andere aanbieder kiezen",     "secondary");
        } else {
          add("select_provider",  "Aanbieder selecteren",   "primary");
        }
        add("escalate_case",      "Escaleer casus",         "destructive");
      }
      break;

    case "provider_beoordeling":
      if (role === "gemeente" || role === "admin") {
        add("follow_up_provider", "Volg op bij aanbieder", "primary");
        add("view_handover",      "Bekijk overdracht",     "secondary");
        add("return_to_matching", "Herstart matching",     "secondary");
        add("escalate_case",      "Escaleer casus",        "destructive");
      }
      if (role === "zorgaanbieder" || role === "admin") {
        add("provider_accept_case",    "Accepteren",                "primary");
        add("provider_reject_case",    "Afwijzen",                  "destructive");
        add("provider_waitlist_case",  "Op wachtlijst plaatsen",    "secondary");
        add("provider_request_info",   "Meer informatie nodig",     "secondary");
      }
      break;

    case "intake_provider":
      if (role === "gemeente" || role === "admin") {
        add("follow_up_provider", "Volg op bij aanbieder", "primary");
        add("view_handover",      "Bekijk overdracht",     "secondary");
        add("escalate_case",      "Escaleer casus",        "destructive");
      }
      if (role === "zorgaanbieder" || role === "admin") {
        add("plan_intake",           "Plan intake",          "primary");
        add("mark_intake_started",   "Intake gestart",       "secondary");
        add("mark_intake_completed", "Intake afgerond",      "secondary");
        add("provider_reject_case",  "Alsnog afwijzen",      "destructive");
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
  const { phase, placement, intake } = casus;
  const events: CasusTimelineEvent[] = [];

  events.push({
    id: "tl-created",
    type: "created",
    label: "Casus aangemaakt",
    actorName: casus.assignedTo,
    actorRole: "gemeente",
    date: casus.createdAt,
  });

  if (["matching", "aanbieder_selectie", "provider_beoordeling", "intake_provider", "afgerond", "geblokkeerd"].includes(phase)) {
    events.push({
      id: "tl-matching-started",
      type: "phase_change",
      label: "Matching gestart",
      actorName: casus.assignedTo,
      actorRole: "gemeente",
      date: "2026-04-06",
    });
  }

  if (["aanbieder_selectie", "provider_beoordeling", "intake_provider", "afgerond"].includes(phase) && placement.providerId) {
    events.push({
      id: "tl-provider-selected",
      type: "action",
      label: `Aanbieder geselecteerd: ${placement.providerName}`,
      actorName: casus.assignedTo,
      actorRole: "gemeente",
      date: "2026-04-12",
    });
  }

  if (["provider_beoordeling", "intake_provider", "afgerond"].includes(phase)) {
    events.push({
      id: "tl-verzoek-verstuurd",
      type: "phase_change",
      label: "Plaatsingsverzoek verstuurd naar aanbieder",
      actorName: casus.assignedTo,
      actorRole: "gemeente",
      date: placement.confirmedAt ?? "2026-04-13",
    });
  }

  if (["intake_provider", "afgerond"].includes(phase) && placement.confirmedAt) {
    events.push({
      id: "tl-aanbieder-accepted",
      type: "phase_change",
      label: "Aanbieder heeft verzoek geaccepteerd",
      actorName: placement.confirmedBy ?? "Aanbieder",
      actorRole: "zorgaanbieder",
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
