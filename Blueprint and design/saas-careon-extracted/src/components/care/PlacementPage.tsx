import { useState } from "react";
import { ArrowLeft, CheckCircle2, X, AlertTriangle, PartyPopper, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { PlacementValidationChecklist } from "./PlacementValidationChecklist";
import { SelectedProviderCard } from "./SelectedProviderCard";
import { HandoverInfoPanel } from "./HandoverInfoPanel";
import { mockCases, mockProviders } from "../../lib/casesData";

interface PlacementPageProps {
  caseId: string;
  providerId: string;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function PlacementPage({
  caseId,
  providerId,
  onBack,
  onCancel,
  onConfirm
}: PlacementPageProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  const caseData = mockCases.find(c => c.id === caseId);
  const provider = mockProviders.find(p => p.id === providerId);

  if (!caseData || !provider) {
    return null;
  }

  // Validation items
  const validationItems = [
    {
      id: "assessment",
      label: "Beoordeling compleet",
      status: "complete" as const
    },
    {
      id: "data",
      label: "Gegevens aanwezig",
      status: "complete" as const
    },
    {
      id: "risks",
      label: "Risico's bekend",
      status: provider.availableSpots > 0 ? "complete" as const : "warning" as const
    },
    {
      id: "matching",
      label: "Match bevestigd (94%)",
      status: "complete" as const
    }
  ];

  const allValid = validationItems.every(item => 
    item.status === "complete" || item.status === "warning"
  );
  const hasErrors = validationItems.some(item => item.status === "error");

  // Risk signals
  const riskSignals = [
    ...(provider.availableSpots === 0 
      ? [{ severity: "medium" as const, message: "Geen directe capaciteit - kleine wachttijd mogelijk" }]
      : []),
    ...(provider.responseTime > 8 
      ? [{ severity: "low" as const, message: `Reactietijd ${provider.responseTime}u - monitor voortgang` }]
      : [])
  ];

  const handleConfirmClick = () => {
    setShowConfirmationModal(true);
  };

  const handleFinalConfirm = async () => {
    setIsConfirming(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsConfirming(false);
    setShowConfirmationModal(false);
    setIsConfirmed(true);
  };

  // Success state
  if (isConfirmed) {
    return (
      <div className="space-y-6">
        <div className="premium-card p-12 text-center">
          <div 
            className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.05) 100%)",
              border: "3px solid rgba(34, 197, 94, 0.4)"
            }}
          >
            <PartyPopper size={48} className="text-green-400" />
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-3">
            Plaatsing succesvol! 🎯
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            De casus van <strong className="text-foreground">{caseData.clientName}</strong> is 
            toegewezen aan <strong className="text-foreground">{provider.name}</strong>. 
            Alle betrokken partijen zijn geïnformeerd.
          </p>

          <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
            <div className="p-6 rounded-xl bg-muted/30 border border-muted-foreground/20">
              <p className="text-sm text-muted-foreground mb-2">Casus ID</p>
              <p className="text-xl font-bold text-foreground">{caseData.id}</p>
            </div>
            <div className="p-6 rounded-xl bg-muted/30 border border-muted-foreground/20">
              <p className="text-sm text-muted-foreground mb-2">Aanbieder</p>
              <p className="text-lg font-bold text-foreground">{provider.name}</p>
            </div>
            <div className="p-6 rounded-xl bg-muted/30 border border-muted-foreground/20">
              <p className="text-sm text-muted-foreground mb-2">Status</p>
              <p className="text-lg font-bold text-green-400">Geplaatst</p>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-8 max-w-2xl mx-auto">
            <h3 className="text-base font-semibold text-foreground mb-3">
              Volgende stappen
            </h3>
            <div className="space-y-2 text-sm text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Aanbieder</strong> ontvangt binnen 15 minuten een notificatie
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Dossier</strong> wordt automatisch gedeeld met provider
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Intake</strong> wordt binnen 3 werkdagen ingepland
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => window.location.reload()} // Or navigate to case tracking
              className="bg-primary hover:bg-primary/90"
            >
              Bekijk plaatsing
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
                Klaar voor plaatsing
              </span>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">
              {caseData.clientName} · {caseData.caseType}
            </h1>

            <p className="text-sm text-muted-foreground mb-4 leading-relaxed break-words">
              Match: <strong className="text-foreground">{provider.name}</strong> · Score: <strong className="text-green-400">94%</strong>
            </p>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-400" />
                <span className="text-muted-foreground">Beste match score</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-400" />
                <span className="text-muted-foreground">Directe capaciteit</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-400" />
                <span className="text-muted-foreground">Snelle reactietijd</span>
              </div>
            </div>
          </div>

          {/* Urgency Indicator */}
          <div>
            <span className={`
              inline-block px-4 py-2 rounded-lg text-sm font-semibold border-2
              ${caseData.urgency === "high" ? "bg-red-500/20 text-red-300 border-red-500/40" : ""}
              ${caseData.urgency === "medium" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : ""}
              ${caseData.urgency === "low" ? "bg-green-500/20 text-green-300 border-green-500/40" : ""}
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
                  ${caseData.urgency === "high" ? "bg-red-500/20 text-red-300 border border-red-500/30" : ""}
                  ${caseData.urgency === "medium" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : ""}
                  ${caseData.urgency === "low" ? "bg-green-500/20 text-green-300 border border-green-500/30" : ""}
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
              {allValid && !hasErrors ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-green-400" />
                  <span className="text-sm font-medium text-green-400">
                    Alle validaties geslaagd
                  </span>
                </div>
              ) : hasErrors ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={20} className="text-red-400" />
                  <span className="text-sm font-medium text-red-400">
                    Los eerst blokkerende problemen op
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={20} className="text-amber-400" />
                  <span className="text-sm font-medium text-amber-400">
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
                disabled={!allValid || hasErrors}
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
                  Controleer de details voordat je definitief plaatst
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
                    <p className="text-muted-foreground mb-1">Match score</p>
                    <p className="font-semibold text-green-400">94%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Urgentie</p>
                    <p className="font-semibold text-foreground capitalize">{caseData.urgency}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-300 leading-relaxed">
                  Na bevestiging wordt de casus direct toegewezen aan {provider.name}. 
                  De aanbieder ontvangt een notificatie en het dossier binnen 15 minuten. 
                  Je kunt de voortgang volgen in het plaatsingen overzicht.
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
                className="flex-1 bg-green-500 hover:bg-green-600"
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Bevestigen...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} className="mr-2" />
                    Definitief bevestigen
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