import type { Case, CaseStatus, Provider } from "./casesData";
import type { Casus, CasusStatus, MatchResult, UrgencyLevel as CasusUrgencyLevel } from "./phaseEngine";
import type { SpaCase } from "../hooks/useCases";
import type { SpaProvider } from "../hooks/useProviders";

function mapCaseStatus(status: SpaCase["status"]): CaseStatus {
  switch (status) {
    case "provider_beoordeling":
      return "placement";
    case "plaatsing":
      return "placement";
    case "afgerond":
      return "completed";
    default:
      return status;
  }
}

function mapUrgency(urgency: SpaCase["urgency"]): Case["urgency"] {
  switch (urgency) {
    case "critical":
      return "critical";
    case "warning":
      return "high";
    case "normal":
      return "medium";
    default:
      return "low";
  }
}

function mapRisk(urgency: Case["urgency"]): Case["risk"] {
  switch (urgency) {
    case "critical":
      return "high";
    case "high":
      return "medium";
    case "medium":
      return "low";
    default:
      return "none";
  }
}

export function toLegacyCase(spaCase: SpaCase): Case {
  const urgency = mapUrgency(spaCase.urgency);
  const status = mapCaseStatus(spaCase.status);
  return {
    id: spaCase.id,
    clientName: spaCase.title || "Casus onbekend",
    clientAge: 14,
    region: spaCase.regio || "Onbekend",
    status,
    urgency,
    risk: mapRisk(urgency),
    waitingDays: spaCase.wachttijd,
    lastActivity: spaCase.wachttijd === 0 ? "Vandaag" : `${spaCase.wachttijd} dagen geleden`,
    assignedTo: "Nog niet toegewezen",
    caseType: spaCase.zorgtype || "Onbekend",
    signal: spaCase.problems[0]?.label || spaCase.systemInsight || "Geen bijzonderheden",
    recommendedAction: spaCase.recommendedAction || "Volg standaardproces",
  };
}

export function toLegacyProvider(spaProvider: SpaProvider): Provider {
  const capacity = Math.max(spaProvider.maxCapacity ?? 0, spaProvider.currentCapacity ?? 0, spaProvider.availableSpots ?? 0);
  const waitingList = spaProvider.waitingListLength ?? 0;
  const rating = Math.max(3.5, Math.min(5, 5 - waitingList / 30));

  return {
    id: spaProvider.id,
    name: spaProvider.name,
    type: spaProvider.type || "Onbekend",
    region: spaProvider.region || spaProvider.city || "Onbekend",
    capacity,
    availableSpots: spaProvider.availableSpots ?? 0,
    specializations: spaProvider.specializations ?? [],
    rating: Number(rating.toFixed(1)),
    responseTime: Math.max(1, Math.round((spaProvider.averageWaitDays ?? 1) * 24)),
    latitude: spaProvider.latitude ?? null,
    longitude: spaProvider.longitude ?? null,
    hasCoordinates: Boolean(spaProvider.hasCoordinates && spaProvider.latitude != null && spaProvider.longitude != null),
  };
}

function toCasusUrgency(urgency: Case["urgency"]): CasusUrgencyLevel {
  switch (urgency) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    default:
      return "low";
  }
}

function toCasusStatus(spaStatus: SpaCase["status"]): CasusStatus {
  switch (spaStatus) {
    case "intake":
      return "klaar_voor_matching";
    case "matching":
      return "matching_bezig";
    case "provider_beoordeling":
      return "aanbieder_geselecteerd";
    case "plaatsing":
      return "geaccepteerd_voor_intake";
    case "afgerond":
      return "gesloten";
    default:
      return "klaar_voor_matching";
  }
}

function buildMatchResults(spaCase: SpaCase, providers: SpaProvider[]): MatchResult[] {
  const regional = providers.filter((p) => (p.region || p.city) === spaCase.regio);
  const fallback = regional.length > 0 ? regional : providers;

  return fallback.slice(0, 3).map((p, index) => {
    const legacy = toLegacyProvider(p);
    const score = Math.max(55, Math.min(98, 88 - index * 12 + Math.min(legacy.availableSpots, 6)));
    return {
      providerId: legacy.id,
      providerName: legacy.name,
      providerType: legacy.type,
      region: legacy.region,
      score,
      recommendationType: index === 0 ? "perfect" : index === 1 ? "good" : "alternative",
      explanation: index === 0
        ? "Beste balans tussen capaciteit, regio en reactietijd"
        : index === 1
          ? "Sterke alternatieve match"
          : "Bruikbare fallback-optie",
      availableSpots: legacy.availableSpots,
      rating: legacy.rating,
      responseTimeHours: legacy.responseTime,
      specializations: legacy.specializations,
    };
  });
}

export function toPhaseCasus(spaCase: SpaCase, providers: SpaProvider[]): Casus {
  const legacy = toLegacyCase(spaCase);
  const matchResults = buildMatchResults(spaCase, providers);
  const status = toCasusStatus(spaCase.status);
  const selectedProviderId = status === "aanbieder_geselecteerd" || status === "geaccepteerd_voor_intake"
    ? (matchResults[0]?.providerId ?? null)
    : null;

  return {
    id: legacy.id,
    clientName: legacy.clientName,
    clientAge: legacy.clientAge,
    region: legacy.region,
    careType: legacy.caseType,
    urgency: toCasusUrgency(legacy.urgency),
    complexity: legacy.risk === "high" ? "high" : legacy.risk === "medium" ? "medium" : "low",
    phase: status === "nieuw" || status === "klaar_voor_matching"
      ? "intake_initial"
      : status === "matching_bezig"
          ? "matching"
          : status === "aanbieder_geselecteerd"
            ? "provider_beoordeling"
            : status === "geaccepteerd_voor_intake"
              ? "intake_provider"
            : "afgerond",
    status,
    assignedTo: legacy.assignedTo,
    createdAt: new Date(Date.now() - legacy.waitingDays * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    waitingDays: legacy.waitingDays,
    assessment: {
      isComplete: true,
      urgency: toCasusUrgency(legacy.urgency),
      complexity: legacy.risk === "high" ? "high" : legacy.risk === "medium" ? "medium" : "low",
      careType: legacy.caseType,
      notes: legacy.signal,
      assessor: "Onbekend",
      scheduledDate: null,
      completedAt: new Date().toISOString(),
      daysOverdue: 0,
      missingFields: [],
    },
    matchResults,
    selectedProviderId,
    placement: {
      providerId: selectedProviderId,
      providerName: matchResults[0]?.providerName ?? null,
      status: spaCase.status === "provider_beoordeling"
        ? "pending"
        : spaCase.status === "plaatsing"
          ? "confirmed"
          : selectedProviderId
            ? "proposed"
            : null,
      confirmedAt: spaCase.status === "plaatsing" ? new Date().toISOString() : null,
      confirmedBy: null,
      validations: {
        assessmentComplete: true,
        providerSelected: Boolean(selectedProviderId),
        dossierComplete: true,
        guardianConsent: true,
      },
    },
    intake: {
      providerId: selectedProviderId,
      status: spaCase.status === "plaatsing" ? "planned" : null,
      plannedAt: null,
      startedAt: null,
      completedAt: null,
      rejectedReason: null,
      providerResponseDays: spaCase.status === "provider_beoordeling" ? legacy.waitingDays : 0,
    },
  };
}
