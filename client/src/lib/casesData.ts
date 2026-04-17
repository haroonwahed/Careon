// CareOn - Zorgregie Platform
// Mock data for healthcare cases

export type CaseStatus = 
  | "intake"           // New case, intake phase
  | "assessment"       // Assessment in progress
  | "matching"         // Looking for providers
  | "placement"        // Placement being processed
  | "active"           // Active care
  | "completed"        // Case closed
  | "blocked";         // Blocked/stuck

export type UrgencyLevel = "critical" | "high" | "medium" | "low";
export type RiskLevel = "high" | "medium" | "low" | "none";

export interface Case {
  id: string;
  clientName: string;          // Anonymized
  clientAge: number;
  region: string;               // Gemeente
  status: CaseStatus;
  urgency: UrgencyLevel;
  risk: RiskLevel;
  waitingDays: number;
  lastActivity: string;
  assignedTo: string;
  caseType: string;             // Type jeugdzorg
  signal: string;               // Main alert/issue
  recommendedAction: string;
}

export interface Assessment {
  id: string;
  caseId: string;
  status: "pending" | "in_progress" | "completed" | "overdue";
  assessor: string;
  scheduledDate?: string;
  completedDate?: string;
  daysOverdue?: number;
}

export interface Provider {
  id: string;
  name: string;
  type: string;
  region: string;
  capacity: number;
  availableSpots: number;
  specializations: string[];
  rating: number;
  responseTime: number;  // hours
}

export interface Placement {
  id: string;
  caseId: string;
  providerId: string;
  status: "proposed" | "pending" | "confirmed" | "rejected";
  proposedDate: string;
  confirmedDate?: string;
}

// Mock Cases
export const mockCases: Case[] = [
  {
    id: "C-2026-0847",
    clientName: "Cliënt A.M.",
    clientAge: 14,
    region: "Amsterdam",
    status: "blocked",
    urgency: "critical",
    risk: "high",
    waitingDays: 12,
    lastActivity: "12 dagen geleden",
    assignedTo: "Sophie van Dijk",
    caseType: "Intensieve jeugdhulp",
    signal: "Geen geschikte aanbieder gevonden",
    recommendedAction: "Escaleer naar capaciteitsmanager"
  },
  {
    id: "C-2026-0891",
    clientName: "Cliënt J.P.",
    clientAge: 16,
    region: "Utrecht",
    status: "assessment",
    urgency: "high",
    risk: "medium",
    waitingDays: 8,
    lastActivity: "2 dagen geleden",
    assignedTo: "Mark de Vries",
    caseType: "Ambulante begeleiding",
    signal: "Beoordeling 5 dagen vertraagd",
    recommendedAction: "Plan spoedoverleg met beoordelaar"
  },
  {
    id: "C-2026-0923",
    clientName: "Cliënt L.B.",
    clientAge: 12,
    region: "Rotterdam",
    status: "matching",
    urgency: "high",
    risk: "high",
    waitingDays: 6,
    lastActivity: "1 dag geleden",
    assignedTo: "Emma Janssen",
    caseType: "Residentiële zorg",
    signal: "Matching loopt langer dan gemiddeld",
    recommendedAction: "Bekijk alternatieve aanbieders"
  },
  {
    id: "C-2026-0945",
    clientName: "Cliënt S.K.",
    clientAge: 15,
    region: "Den Haag",
    status: "placement",
    urgency: "medium",
    risk: "low",
    waitingDays: 3,
    lastActivity: "Vandaag",
    assignedTo: "Thomas Berg",
    caseType: "Dagbehandeling",
    signal: "Wacht op bevestiging aanbieder",
    recommendedAction: "Volg op met aanbieder"
  },
  {
    id: "C-2026-0912",
    clientName: "Cliënt M.T.",
    clientAge: 13,
    region: "Amsterdam",
    status: "assessment",
    urgency: "medium",
    risk: "medium",
    waitingDays: 5,
    lastActivity: "3 dagen geleden",
    assignedTo: "Lisa Vermeer",
    caseType: "Thuisbegeleiding",
    signal: "Beoordeling bijna verlopen",
    recommendedAction: "Herinner beoordelaar"
  },
  {
    id: "C-2026-0956",
    clientName: "Cliënt R.W.",
    clientAge: 17,
    region: "Eindhoven",
    status: "intake",
    urgency: "low",
    risk: "low",
    waitingDays: 2,
    lastActivity: "Vandaag",
    assignedTo: "Sophie van Dijk",
    caseType: "Lichte ondersteuning",
    signal: "Nieuw binnengekomen",
    recommendedAction: "Plan intake gesprek"
  },
  {
    id: "C-2026-0873",
    clientName: "Cliënt N.H.",
    clientAge: 14,
    region: "Utrecht",
    status: "matching",
    urgency: "medium",
    risk: "medium",
    waitingDays: 4,
    lastActivity: "1 dag geleden",
    assignedTo: "Mark de Vries",
    caseType: "Gezinsbehandeling",
    signal: "3 aanbieders benaderd, 0 reacties",
    recommendedAction: "Verbreed zoekgebied"
  },
  {
    id: "C-2026-0834",
    clientName: "Cliënt D.F.",
    clientAge: 11,
    region: "Rotterdam",
    status: "blocked",
    urgency: "critical",
    risk: "high",
    waitingDays: 18,
    lastActivity: "18 dagen geleden",
    assignedTo: "Emma Janssen",
    caseType: "Crisisopvang",
    signal: "Capaciteit volledig bezet",
    recommendedAction: "Directe escalatie vereist"
  }
];

// Mock Assessments
export const mockAssessments: Assessment[] = [
  {
    id: "A-2026-0421",
    caseId: "C-2026-0891",
    status: "overdue",
    assessor: "Dr. P. Bakker",
    scheduledDate: "2026-04-08",
    daysOverdue: 5
  },
  {
    id: "A-2026-0445",
    caseId: "C-2026-0912",
    status: "in_progress",
    assessor: "Dr. M. Koster",
    scheduledDate: "2026-04-14"
  }
];

// Mock Providers
export const mockProviders: Provider[] = [
  {
    id: "P-001",
    name: "Jeugdzorg Amsterdam Noord",
    type: "Residentiële zorg",
    region: "Amsterdam",
    capacity: 24,
    availableSpots: 2,
    specializations: ["Intensieve begeleiding", "Trauma", "Autisme"],
    rating: 4.8,
    responseTime: 4
  },
  {
    id: "P-002",
    name: "De Brug - Jeugdhulp",
    type: "Ambulante begeleiding",
    region: "Amsterdam",
    capacity: 45,
    availableSpots: 8,
    specializations: ["Lichte ondersteuning", "Gezinstherapie"],
    rating: 4.6,
    responseTime: 8
  },
  {
    id: "P-003",
    name: "Horizon Youth Care",
    type: "Residentiële zorg",
    region: "Amsterdam",
    capacity: 18,
    availableSpots: 0,
    specializations: ["Crisis", "Gedragsproblematiek", "Autisme"],
    rating: 4.9,
    responseTime: 2
  },
  {
    id: "P-004",
    name: "Samen Verder",
    type: "Dagbehandeling",
    region: "Utrecht",
    capacity: 30,
    availableSpots: 5,
    specializations: ["Dagbesteding", "Sociale ontwikkeling"],
    rating: 4.4,
    responseTime: 12
  },
  {
    id: "P-005",
    name: "Youth Support Rotterdam",
    type: "Thuisbegeleiding",
    region: "Rotterdam",
    capacity: 60,
    availableSpots: 12,
    specializations: ["Thuisondersteuning", "Ouderbegeleiding"],
    rating: 4.7,
    responseTime: 6
  }
];

// System alerts/signals
export interface SystemSignal {
  id: string;
  type: "capacity" | "delay" | "risk" | "quality";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  affectedCases: number;
  region?: string;
}

export const mockSignals: SystemSignal[] = [
  {
    id: "S-001",
    type: "capacity",
    severity: "critical",
    title: "Capaciteitstekort crisisopvang Amsterdam",
    description: "Alle crisisplaatsen bezet. 3 urgente casussen in wachtlijst.",
    affectedCases: 3,
    region: "Amsterdam"
  },
  {
    id: "S-002",
    type: "delay",
    severity: "warning",
    title: "Beoordelingen lopen achter",
    description: "5 beoordelingen overschrijden de 7-dagen norm.",
    affectedCases: 5
  },
  {
    id: "S-003",
    type: "risk",
    severity: "critical",
    title: "Hoog-risico casussen zonder match",
    description: "2 casussen met hoog risico nog geen aanbieder gevonden.",
    affectedCases: 2
  },
  {
    id: "S-004",
    type: "capacity",
    severity: "warning",
    title: "Beperkte capaciteit residentiële zorg Utrecht",
    description: "Nog 2 plekken beschikbaar voor residentiële zorg.",
    affectedCases: 0,
    region: "Utrecht"
  }
];

// Priority actions
export interface PriorityAction {
  id: string;
  caseId: string;
  clientName: string;
  action: string;
  deadline: string;
  priority: "urgent" | "high" | "medium";
}

export const mockPriorityActions: PriorityAction[] = [
  {
    id: "PA-001",
    caseId: "C-2026-0834",
    clientName: "Cliënt D.F.",
    action: "Escaleer naar capaciteitsmanager - Crisisopvang",
    deadline: "Vandaag",
    priority: "urgent"
  },
  {
    id: "PA-002",
    caseId: "C-2026-0847",
    clientName: "Cliënt A.M.",
    action: "Zoek alternatieve regio's voor plaatsing",
    deadline: "Vandaag",
    priority: "urgent"
  },
  {
    id: "PA-003",
    caseId: "C-2026-0891",
    clientName: "Cliënt J.P.",
    action: "Bel beoordelaar voor statusupdate",
    deadline: "Morgen",
    priority: "high"
  },
  {
    id: "PA-004",
    caseId: "C-2026-0923",
    clientName: "Cliënt L.B.",
    action: "Heroverweeg matching criteria",
    deadline: "Deze week",
    priority: "high"
  }
];

// ─── Rich Casus objects (phase engine) ───────────────────────────────────────
// These are the canonical data structures used by CasusControlCenter.
// They co-exist with the legacy Case[] above until full migration.

import type { Casus } from "./phaseEngine";

const MATCH_RESULTS_AMSTERDAM = [
  {
    providerId: "P-001",
    providerName: "Jeugdzorg Amsterdam Noord",
    providerType: "Residentiële zorg",
    region: "Amsterdam",
    score: 94,
    recommendationType: "perfect" as const,
    explanation: "Perfecte specialisatie match · Beschikbare plek · Snelle reactietijd",
    availableSpots: 2,
    rating: 4.8,
    responseTimeHours: 4,
    specializations: ["Intensieve begeleiding", "Trauma", "Autisme"],
  },
  {
    providerId: "P-002",
    providerName: "De Brug - Jeugdhulp",
    providerType: "Ambulante begeleiding",
    region: "Amsterdam",
    score: 82,
    recommendationType: "good" as const,
    explanation: "Goede regio match · Ruime capaciteit · Gezinstherapie beschikbaar",
    availableSpots: 8,
    rating: 4.6,
    responseTimeHours: 8,
    specializations: ["Lichte ondersteuning", "Gezinstherapie"],
  },
  {
    providerId: "P-005",
    providerName: "Youth Support Rotterdam",
    providerType: "Thuisbegeleiding",
    region: "Rotterdam",
    score: 71,
    recommendationType: "alternative" as const,
    explanation: "Alternatieve regio · Ruime capaciteit · Minder specialistische match",
    availableSpots: 12,
    rating: 4.7,
    responseTimeHours: 6,
    specializations: ["Thuisondersteuning", "Ouderbegeleiding"],
  },
];

export const mockCasusList: Casus[] = [
  // ① geblokkeerd — critical, 12 days waiting, no provider
  {
    id: "C-2026-0847",
    clientName: "Cliënt A.M.",
    clientAge: 14,
    region: "Amsterdam",
    careType: "Intensieve jeugdhulp",
    urgency: "critical",
    complexity: "high",
    phase: "geblokkeerd",
    status: "geblokkeerd",
    assignedTo: "Sophie van Dijk",
    createdAt: "2026-04-05",
    updatedAt: "2026-04-17",
    waitingDays: 12,
    assessment: {
      isComplete: true,
      urgency: "critical",
      complexity: "high",
      careType: "Intensieve jeugdhulp",
      notes: "Eerdere ambulante trajecten niet succesvol. Intensieve residentie-zorg vereist.",
      assessor: "Dr. P. Bakker",
      scheduledDate: "2026-04-08",
      completedAt: "2026-04-10",
      daysOverdue: 0,
      missingFields: [],
    },
    matchResults: [],
    selectedProviderId: null,
    placement: {
      providerId: null,
      providerName: null,
      status: null,
      confirmedAt: null,
      confirmedBy: null,
      validations: {
        assessmentComplete: true,
        providerSelected: false,
        dossierComplete: true,
        guardianConsent: true,
      },
    },
    intake: {
      providerId: null,
      status: null,
      plannedAt: null,
      startedAt: null,
      completedAt: null,
      rejectedReason: "Geen capaciteit beschikbaar in regio Amsterdam",
      providerResponseDays: 0,
    },
  },

  // ② beoordeling — overdue assessment
  {
    id: "C-2026-0891",
    clientName: "Cliënt J.P.",
    clientAge: 16,
    region: "Utrecht",
    careType: "Ambulante begeleiding",
    urgency: "high",
    complexity: "medium",
    phase: "beoordeling",
    status: "in_beoordeling",
    assignedTo: "Mark de Vries",
    createdAt: "2026-04-03",
    updatedAt: "2026-04-15",
    waitingDays: 8,
    assessment: {
      isComplete: false,
      urgency: "high",
      complexity: null,
      careType: null,
      notes: "",
      assessor: "Dr. P. Bakker",
      scheduledDate: "2026-04-08",
      completedAt: null,
      daysOverdue: 5,
      missingFields: ["complexiteit", "type zorg", "behandelplan"],
    },
    matchResults: [],
    selectedProviderId: null,
    placement: {
      providerId: null,
      providerName: null,
      status: null,
      confirmedAt: null,
      confirmedBy: null,
      validations: {
        assessmentComplete: false,
        providerSelected: false,
        dossierComplete: false,
        guardianConsent: false,
      },
    },
    intake: {
      providerId: null,
      status: null,
      plannedAt: null,
      startedAt: null,
      completedAt: null,
      rejectedReason: null,
      providerResponseDays: 0,
    },
  },

  // ③ matching — 3 providers available
  {
    id: "C-2026-0923",
    clientName: "Cliënt L.B.",
    clientAge: 12,
    region: "Rotterdam",
    careType: "Residentiële zorg",
    urgency: "high",
    complexity: "high",
    phase: "matching",
    status: "matching_bezig",
    assignedTo: "Emma Janssen",
    createdAt: "2026-04-05",
    updatedAt: "2026-04-16",
    waitingDays: 6,
    assessment: {
      isComplete: true,
      urgency: "high",
      complexity: "high",
      careType: "Residentiële zorg",
      notes: "Complexe thuissituatie. Residentiële zorg geïndiceerd.",
      assessor: "Dr. M. Koster",
      scheduledDate: "2026-04-07",
      completedAt: "2026-04-09",
      daysOverdue: 0,
      missingFields: [],
    },
    matchResults: MATCH_RESULTS_AMSTERDAM,
    selectedProviderId: null,
    placement: {
      providerId: null,
      providerName: null,
      status: null,
      confirmedAt: null,
      confirmedBy: null,
      validations: {
        assessmentComplete: true,
        providerSelected: false,
        dossierComplete: true,
        guardianConsent: false,
      },
    },
    intake: {
      providerId: null,
      status: null,
      plannedAt: null,
      startedAt: null,
      completedAt: null,
      rejectedReason: null,
      providerResponseDays: 0,
    },
  },

  // ④ plaatsing — all validations pass
  {
    id: "C-2026-0945",
    clientName: "Cliënt S.K.",
    clientAge: 15,
    region: "Den Haag",
    careType: "Dagbehandeling",
    urgency: "medium",
    complexity: "medium",
    phase: "plaatsing",
    status: "plaatsing_te_bevestigen",
    assignedTo: "Thomas Berg",
    createdAt: "2026-04-07",
    updatedAt: "2026-04-17",
    waitingDays: 3,
    assessment: {
      isComplete: true,
      urgency: "medium",
      complexity: "medium",
      careType: "Dagbehandeling",
      notes: "Dagbehandeling geïndiceerd. Stabiele thuissituatie.",
      assessor: "Dr. A. Smit",
      scheduledDate: "2026-04-09",
      completedAt: "2026-04-11",
      daysOverdue: 0,
      missingFields: [],
    },
    matchResults: MATCH_RESULTS_AMSTERDAM,
    selectedProviderId: "P-001",
    placement: {
      providerId: "P-001",
      providerName: "Jeugdzorg Amsterdam Noord",
      status: "proposed",
      confirmedAt: null,
      confirmedBy: null,
      validations: {
        assessmentComplete: true,
        providerSelected: true,
        dossierComplete: true,
        guardianConsent: true,
      },
    },
    intake: {
      providerId: null,
      status: null,
      plannedAt: null,
      startedAt: null,
      completedAt: null,
      rejectedReason: null,
      providerResponseDays: 0,
    },
  },

  // ⑤ intake_initial — brand new
  {
    id: "C-2026-0956",
    clientName: "Cliënt R.W.",
    clientAge: 17,
    region: "Eindhoven",
    careType: "Lichte ondersteuning",
    urgency: "low",
    complexity: "low",
    phase: "intake_initial",
    status: "nieuw",
    assignedTo: "Sophie van Dijk",
    createdAt: "2026-04-17",
    updatedAt: "2026-04-17",
    waitingDays: 0,
    assessment: {
      isComplete: false,
      urgency: null,
      complexity: null,
      careType: null,
      notes: "",
      assessor: "",
      scheduledDate: null,
      completedAt: null,
      daysOverdue: 0,
      missingFields: ["urgentie", "complexiteit", "type zorg", "beoordelaar"],
    },
    matchResults: [],
    selectedProviderId: null,
    placement: {
      providerId: null,
      providerName: null,
      status: null,
      confirmedAt: null,
      confirmedBy: null,
      validations: {
        assessmentComplete: false,
        providerSelected: false,
        dossierComplete: false,
        guardianConsent: false,
      },
    },
    intake: {
      providerId: null,
      status: null,
      plannedAt: null,
      startedAt: null,
      completedAt: null,
      rejectedReason: null,
      providerResponseDays: 0,
    },
  },

  // ⑥ intake_provider — waiting for provider to plan intake
  {
    id: "C-2026-0873",
    clientName: "Cliënt N.H.",
    clientAge: 14,
    region: "Utrecht",
    careType: "Gezinsbehandeling",
    urgency: "medium",
    complexity: "medium",
    phase: "intake_provider",
    status: "plaatsing_bevestigd",
    assignedTo: "Mark de Vries",
    createdAt: "2026-04-04",
    updatedAt: "2026-04-14",
    waitingDays: 4,
    assessment: {
      isComplete: true,
      urgency: "medium",
      complexity: "medium",
      careType: "Gezinsbehandeling",
      notes: "Gezinsinterventie vereist. Beide ouders betrokken.",
      assessor: "Dr. P. Bakker",
      scheduledDate: "2026-04-06",
      completedAt: "2026-04-08",
      daysOverdue: 0,
      missingFields: [],
    },
    matchResults: MATCH_RESULTS_AMSTERDAM,
    selectedProviderId: "P-004",
    placement: {
      providerId: "P-004",
      providerName: "Samen Verder",
      status: "confirmed",
      confirmedAt: "2026-04-11",
      confirmedBy: "Mark de Vries",
      validations: {
        assessmentComplete: true,
        providerSelected: true,
        dossierComplete: true,
        guardianConsent: true,
      },
    },
    intake: {
      providerId: "P-004",
      status: "not_planned",
      plannedAt: null,
      startedAt: null,
      completedAt: null,
      rejectedReason: null,
      providerResponseDays: 4,
    },
  },

  // ⑦ afgerond
  {
    id: "C-2026-0834",
    clientName: "Cliënt D.F.",
    clientAge: 11,
    region: "Rotterdam",
    careType: "Crisisopvang",
    urgency: "critical",
    complexity: "high",
    phase: "afgerond",
    status: "zorg_gestart",
    assignedTo: "Emma Janssen",
    createdAt: "2026-03-30",
    updatedAt: "2026-04-16",
    waitingDays: 18,
    assessment: {
      isComplete: true,
      urgency: "critical",
      complexity: "high",
      careType: "Crisisopvang",
      notes: "Acute crisissituatie. Onmiddellijke plaatsing vereist.",
      assessor: "Dr. P. Bakker",
      scheduledDate: "2026-03-31",
      completedAt: "2026-04-01",
      daysOverdue: 0,
      missingFields: [],
    },
    matchResults: MATCH_RESULTS_AMSTERDAM,
    selectedProviderId: "P-001",
    placement: {
      providerId: "P-001",
      providerName: "Jeugdzorg Amsterdam Noord",
      status: "confirmed",
      confirmedAt: "2026-04-05",
      confirmedBy: "Emma Janssen",
      validations: {
        assessmentComplete: true,
        providerSelected: true,
        dossierComplete: true,
        guardianConsent: true,
      },
    },
    intake: {
      providerId: "P-001",
      status: "completed",
      plannedAt: "2026-04-07",
      startedAt: "2026-04-10",
      completedAt: "2026-04-14",
      rejectedReason: null,
      providerResponseDays: 0,
    },
  },
];
