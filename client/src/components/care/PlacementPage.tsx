import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, X, AlertTriangle, PartyPopper, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { PlacementValidationChecklist } from "./PlacementValidationChecklist";
import { SelectedProviderCard } from "./SelectedProviderCard";
import { HandoverInfoPanel } from "./HandoverInfoPanel";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { apiClient } from "../../lib/apiClient";
import { toLegacyCase, toLegacyProvider } from "../../lib/careLegacyAdapters";

interface PlacementPageProps {
  caseId: string;
  providerId: string;
  onBack: () => void;
  onCancel: () => void;
}

interface PlacementDetailPayload {
  caseId: string;
  placement: {
    id: string;
    status: string;
    providerResponseStatus: string;
    providerResponseReasonCode: string;
    proposedProviderId: string;
    selectedProviderId: string;
    careForm: string;
    decisionNotes: string;
  };
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function PlacementPage({
  caseId,
  providerId,
  onBack,
  onCancel
}: PlacementPageProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [placementDetail, setPlacementDetail] = useState<PlacementDetailPayload | null>(null);
  const [placementDetailLoading, setPlacementDetailLoading] = useState(true);
  const [placementDetailError, setPlacementDetailError] = useState<string | null>(null);
  const [placementConfirmError, setPlacementConfirmError] = useState<string | null>(null);

  const { cases, loading: casesLoading, error: casesError } = useCases({ q: "" });
  const { providers, loading: providersLoading, error: providersError } = useProviders({ q: "" });
  const legacyCases = cases.map(toLegacyCase);
  const legacyProviders = providers.map(toLegacyProvider);

  const caseData = legacyCases.find(c => c.id === caseId);
  const provider = legacyProviders.find(p => p.id === providerId) ?? legacyProviders[0];

  useEffect(() => {
    let cancelled = false;
    setPlacementDetailLoading(true);
    setPlacementDetailError(null);

    apiClient
      .get<PlacementDetailPayload>(`/care/api/cases/${caseId}/placement-detail/`)
      .then((payload) => {
        if (!cancelled) {
          setPlacementDetail(payload);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setPlacementDetailError(error.message ?? "Kon plaatsingsgegevens niet laden.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPlacementDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (casesLoading || providersLoading || placementDetailLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-muted-foreground gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span>Plaatsing laden...</span>
      </div>
    );
  }

  if (casesError || providersError || placementDetailError) {
    return (
      <div className="premium-card p-6 text-center text-destructive">
        Kon plaatsingsgegevens niet laden: {casesError ?? providersError ?? placementDetailError}
      </div>
    );
  }

  if (!caseData || !provider) {
    return (
      <div className="premium-card p-6 text-center text-muted-foreground">
        Casus of aanbieder niet gevonden.
      </div>
    );
  }

  const providerAccepted = placementDetail?.placement?.providerResponseStatus === "ACCEPTED";

  // Validation items
  const validationItems = [
    {
      id: "provider-response",
      label: providerAccepted ? "Aanbieder akkoord ontvangen" : "Wacht op aanbiederbeoordeling",
      status: providerAccepted ? "complete" as const : "error" as const,
      description: providerAccepted
        ? "De aanbieder heeft de casus bevestigd."
        : "Plaatsing kan pas worden bevestigd nadat de aanbieder heeft geaccepteerd."
    },
    {
      id: "data",
      label: "Overdrachtsgegevens compleet",
      status: "complete" as const
    },
    {
      id: "capacity",
      label: "Capaciteit en intakevoorwaarden bevestigd",
      status: provider.availableSpots > 0 ? "complete" as const : "warning" as const
    },
    {
      id: "intake",
      label: "Intake kan gestart worden",
      status: providerAccepted ? "complete" as const : "incomplete" as const,
      description: providerAccepted
        ? "De intakeplanning kan direct worden opgepakt."
        : "Intake volgt pas nadat plaatsing is bevestigd."
    }
  ];

  const allValid = providerAccepted && validationItems.every(item =>
    item.status === "complete" || item.status === "warning"
  );
  const hasErrors = validationItems.some(item => item.status === "error");

  // Risk signals
  const riskSignals = [
    ...(provider.availableSpots === 0 
      ? [{ severity: "medium" as const, message: "Geen directe startplek - plan intake met korte wachttijd" }]
      : []),
    ...(provider.responseTime > 8 
      ? [{ severity: "low" as const, message: `Reactietijd ${provider.responseTime}u - bewaak de intakeplanning` }]
      : [])
  ];

  const handleConfirmClick = () => {
    if (!providerAccepted) {
      return;
    }
    setPlacementConfirmError(null);
    setShowConfirmationModal(true);
  };

  const handleFinalConfirm = async () => {
    setIsConfirming(true);
    setPlacementConfirmError(null);
    try {
      const formData = new FormData();
      formData.append("status", "APPROVED");
      formData.append("note", "Plaatsing bevestigd vanuit plaatsingsoverzicht.");
      formData.append("next", window.location.pathname);

      const response = await fetch(`/care/casussen/${caseId}/placement/action/`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "X-CSRFToken": getCsrfToken(),
        },
        body: formData,
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || "Plaatsing kon niet worden bevestigd.");
      }
      setShowConfirmationModal(false);
      setIsConfirmed(true);
    } catch (error) {
      setPlacementConfirmError(error instanceof Error ? error.message : "Plaatsing kon niet worden bevestigd.");
    } finally {
      setIsConfirming(false);
    }
  };

  // Success state
  if (isConfirmed) {
    return (
      <div className="space-y-6">
      <div className="premium-card p-12 text-center">
        <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center border-2 careon-alert-success">
          <PartyPopper size={48} className="text-green-base" />
        </div>

          <h1 className="text-3xl font-bold text-foreground mb-3">
            Plaatsing bevestigd
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            De casus van <strong className="text-foreground">{caseData.clientName}</strong> is 
            door <strong className="text-foreground">{provider.name}</strong> geaccepteerd.
            De intake kan nu worden ingepland vanuit de plaatsingsstap.
          </p>

          <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
            <div className="p-6 rounded-xl bg-muted/30 border border-muted-foreground/20">
              <p className="text-sm text-muted-foreground mb-2">Casus-ID</p>
              <p className="text-xl font-bold text-foreground">{caseData.id}</p>
            </div>
            <div className="p-6 rounded-xl bg-muted/30 border border-muted-foreground/20">
              <p className="text-sm text-muted-foreground mb-2">Aanbieder</p>
              <p className="text-lg font-bold text-foreground">{provider.name}</p>
            </div>
            <div className="p-6 rounded-xl bg-muted/30 border border-muted-foreground/20">
              <p className="text-sm text-muted-foreground mb-2">Status</p>
              <p className="text-lg font-bold text-green-base">Plaatsing bevestigd</p>
            </div>
          </div>

          <div className="p-6 rounded-xl border careon-alert-info mb-8 max-w-2xl mx-auto">
            <h3 className="text-base font-semibold text-foreground mb-3">
              Volgende stappen
            </h3>
            <div className="space-y-2 text-sm text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-green-base flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Gemeente en aanbieder</strong> werken nu vanuit dezelfde plaatsing en intakeplanning
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-green-base flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Dossier</strong> blijft beschikbaar voor intakevoorbereiding en overdracht
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-green-base flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Intake</strong> wordt nu gepland met de aanbieder
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <Button
              onClick={onBack}
              className="bg-primary hover:bg-primary/90"
            >
              Terug naar plaatsingen
            </Button>
            <Button
              onClick={onBack}
              variant="outline"
            >
              Terug naar overzicht
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={20} />
        <span className="text-sm font-medium">Terug naar matching</span>
      </button>

      {/* TOP DECISION HEADER */}
      <div className="premium-card p-6 border-2 border-primary/40">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                {providerAccepted ? "Aanbieder akkoord ontvangen" : "Wacht op aanbiederbeoordeling"}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">
              {caseData.clientName} · {caseData.caseType}
            </h1>

            <p className="text-sm text-muted-foreground mb-4 leading-relaxed break-words">
              {providerAccepted ? (
                <>
                  Match geaccepteerd door <strong className="text-foreground">{provider.name}</strong> · Score: <strong className="text-green-base">94%</strong>
                </>
              ) : (
                <>
                  Wacht op aanbiederbeoordeling voor <strong className="text-foreground">{provider.name}</strong>
                </>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                {providerAccepted ? (
                  <CheckCircle2 size={16} className="text-green-base" />
                ) : (
                  <AlertTriangle size={16} className="text-yellow-base" />
                )}
                <span className="text-muted-foreground">
                  {providerAccepted ? "Aanbieder heeft geaccepteerd" : "Wacht op aanbiederbeoordeling"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-base" />
                <span className="text-muted-foreground">Capaciteit afgestemd</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-base" />
                <span className="text-muted-foreground">Klaar voor intakeplanning</span>
              </div>
            </div>
          </div>

          {/* Urgency Indicator */}
          <div>
            <span className={`
              inline-block px-4 py-2 rounded-lg text-sm font-semibold border-2
              ${caseData.urgency === "high" ? "careon-alert-error" : ""}
              ${caseData.urgency === "medium" ? "careon-alert-warning" : ""}
              ${caseData.urgency === "low" ? "careon-alert-success" : ""}
            `}>
              {caseData.urgency === "high" ? "Hoge urgentie" : 
               caseData.urgency === "medium" ? "Gemiddelde urgentie" : 
               "Lage urgentie"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Layout: 3 Panels */}
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT PANEL: Case Summary */}
        <div className="col-span-3">
          <div className="premium-card p-4 sticky top-24">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Casus samenvatting
            </h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Case ID</p>
                <p className="font-medium text-foreground">{caseData.id}</p>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Cliënt</p>
                <p className="font-medium text-foreground">{caseData.clientName}</p>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Leeftijd</p>
                <p className="font-medium text-foreground">{caseData.clientAge} jaar</p>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Regio</p>
                <p className="font-medium text-foreground">{caseData.region}</p>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Zorgtype</p>
                <p className="font-medium text-foreground">{caseData.caseType}</p>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Urgentie</p>
                <span className={`
                  inline-block px-2 py-1 rounded-md text-xs font-semibold
                  ${caseData.urgency === "high" ? "careon-alert-error border" : ""}
                  ${caseData.urgency === "medium" ? "careon-alert-warning border" : ""}
                  ${caseData.urgency === "low" ? "careon-alert-success border" : ""}
                `}>
                  {caseData.urgency === "high" ? "Hoog" : 
                   caseData.urgency === "medium" ? "Gemiddeld" : 
                   "Laag"}
                </span>
              </div>

              <div className="pt-3 border-t border-muted-foreground/20">
                <p className="text-muted-foreground text-xs mb-2">Belangrijke notities</p>
                <p className="text-xs text-foreground leading-relaxed">
                  Complexe gedragsproblematiek. Ervaring met trauma-geïnformeerde zorg vereist.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER PANEL: Selected Provider + Validation */}
        <div className="col-span-6 space-y-6">
          {/* Selected Provider Card */}
          <SelectedProviderCard
            provider={provider}
            matchScore={94}
            reasons={[
              { text: "Specialisatie match", positive: true },
              { text: "3 plekken beschikbaar", positive: true },
              { text: "Reactie binnen 4u", positive: true }
            ]}
            tradeOffs={{
              pros: [
                "Ervaring met traumazorg",
                "Multidisciplinair team"
              ],
              cons: [
                "15km reisafstand",
                "Groepstherapie wachtlijst (2-3w)"
              ]
            }}
          />

          {/* Validation Checklist */}
          <PlacementValidationChecklist items={validationItems} />
        </div>

        {/* RIGHT PANEL: Handover Info */}
        <div className="col-span-3">
          <div className="sticky top-24">
            <HandoverInfoPanel riskSignals={riskSignals} />
          </div>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm z-50 ml-[240px]">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {providerAccepted && allValid && !hasErrors ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-green-base" />
                  <span className="text-sm font-medium text-green-base">
                    Klaar om plaatsing te bevestigen
                  </span>
                </div>
              ) : !providerAccepted ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={20} className="text-yellow-base" />
                  <span className="text-sm font-medium text-yellow-base">
                    Plaatsing kan pas worden bevestigd nadat de aanbieder heeft geaccepteerd
                  </span>
                </div>
              ) : hasErrors ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={20} className="text-red-base" />
                  <span className="text-sm font-medium text-red-base">
                    Los eerst blokkerende problemen op
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={20} className="text-yellow-base" />
                  <span className="text-sm font-medium text-yellow-base">
                    Controleer alle validaties
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={onCancel}
                variant="outline"
              >
                Annuleren
              </Button>
              <Button
                onClick={handleConfirmClick}
                disabled={!providerAccepted || !allValid || hasErrors}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 size={16} className="mr-2" />
                Bevestig plaatsing
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="premium-card p-8 max-w-2xl w-full mx-4">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Bevestig plaatsing
                </h2>
                <p className="text-sm text-muted-foreground">
                  Controleer de details voordat je de plaatsing vastzet
                </p>
              </div>
              <button
                onClick={() => setShowConfirmationModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4 mb-8">
              {placementConfirmError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {placementConfirmError}
                </div>
              )}
              <div className="p-4 rounded-lg bg-muted/30 border border-muted-foreground/20">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Casus</p>
                    <p className="font-semibold text-foreground">{caseData.clientName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Aanbieder</p>
                    <p className="font-semibold text-foreground">{provider.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Matchscore</p>
                    <p className="font-semibold text-green-base">94%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Urgentie</p>
                    <p className="font-semibold text-foreground capitalize">{caseData.urgency}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border careon-alert-info">
                <p className="text-sm text-blue-base leading-relaxed">
                  De aanbieder heeft deze match al geaccepteerd. Met deze stap bevestig je
                  dat de casus door gaat naar plaatsing en daarna naar intake. Je volgt de voortgang
                  daarna vanuit het plaatsingenoverzicht.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowConfirmationModal(false)}
                variant="outline"
                className="flex-1"
                disabled={isConfirming}
              >
                Terug
              </Button>
              <Button
                onClick={handleFinalConfirm}
                className="flex-1 bg-green-base hover:bg-green-base/90"
                disabled={isConfirming || !providerAccepted}
              >
                {isConfirming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Plaatsing bevestigen...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} className="mr-2" />
                    Bevestig plaatsing
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
