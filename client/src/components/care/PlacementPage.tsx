import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, PartyPopper, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { PlacementValidationChecklist } from "./PlacementValidationChecklist";
import { SelectedProviderCard } from "./SelectedProviderCard";
import { HandoverInfoPanel } from "./HandoverInfoPanel";
import { useCases } from "../../hooks/useCases";
import { useProviders } from "../../hooks/useProviders";
import { apiClient } from "../../lib/apiClient";
import { toLegacyCase, toLegacyProvider } from "../../lib/careLegacyAdapters";
import { tokens } from "../../design/tokens";
import { CareAttentionBar, CareInfoPopover, CarePageScaffold, PrimaryActionButton, LoadingState, ErrorState, EmptyState, CarePanel } from "./CareDesignPrimitives";

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

function formatClientReference(caseId: string): string {
  const digits = caseId.replace(/\D/g, "");
  if (digits.length >= 3) {
    return `CLI-${digits.padStart(5, "0").slice(-5)}`;
  }
  return "CLI-ONBEKEND";
}

function maskParticipantIdentity(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "Betrokkene afgeschermd";
  }
  return parts
    .map((part) => `${part[0] ?? ""}${"•".repeat(Math.max(3, part.length - 1))}`)
    .join(" ");
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
    return <LoadingState title="Plaatsing laden…" copy="Overdrachtsgegevens worden opgehaald." />;
  }

  if (casesError || providersError || placementDetailError) {
    return <ErrorState title="Plaatsingsgegevens niet beschikbaar" copy={casesError ?? providersError ?? placementDetailError} />;
  }

  if (!caseData || !provider) {
    return <EmptyState title="Gegevens ontbreken" copy="Casus of aanbieder is niet gevonden in deze context." />;
  }

  const providerAccepted = placementDetail?.placement?.providerResponseStatus === "ACCEPTED";

  // Validation items
  const validationItems = [
    {
      id: "provider-response",
      label: providerAccepted ? "Aanbieder akkoord ontvangen" : "Wacht op beoordeling door aanbieder",
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
      ? [{ severity: "low" as const, message: `Reactietijd ${provider.responseTime}u - houd regie op de intakeplanning` }]
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
      <CarePageScaffold
        archetype="decision"
        className="pb-8"
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Plaatsing
            <CareInfoPopover ariaLabel="Uitleg plaatsing" testId="placement-confirmed-page-info">
              <p className="text-muted-foreground">Plaatsing bevestigd. De intake kan nu worden gepland.</p>
            </CareInfoPopover>
          </span>
        }
        dominantAction={
          <CareAttentionBar
            tone="info"
            icon={<PartyPopper size={16} />}
            message={`Plaatsing van ${formatClientReference(caseData.id)} is bevestigd`}
            action={<PrimaryActionButton onClick={onBack}>Terug naar plaatsingen</PrimaryActionButton>}
          />
        }
      >
          <div className="space-y-3">
          <CarePanel className="p-4 text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-emerald-500/10">
          <PartyPopper size={48} className="text-emerald-300" />
        </div>

          <h1 className="text-3xl font-bold text-foreground mb-3">
            Plaatsing bevestigd
          </h1>
          <p className="mx-auto mb-8 text-lg text-muted-foreground" style={{ maxWidth: tokens.layout.contentMeasure }}>
            De casus van <strong className="text-foreground">{formatClientReference(caseData.id)}</strong> is 
            door <strong className="text-foreground">{provider.name}</strong> geaccepteerd.
            De intake kan nu worden ingepland vanuit de plaatsingsstap.
          </p>

          <div className="mx-auto mb-6 grid grid-cols-3 gap-4" style={{ maxWidth: tokens.layout.contentMeasure }}>
            <div className="p-4 rounded-xl bg-muted/30 border border-muted-foreground/20">
              <p className="text-sm text-muted-foreground mb-2">Casus-ID</p>
              <p className="text-xl font-bold text-foreground">{caseData.id}</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-muted-foreground/20">
              <p className="text-sm text-muted-foreground mb-2">Aanbieder</p>
          <p className="text-lg font-bold text-foreground">{provider.name}</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-muted-foreground/20">
              <p className="text-sm text-muted-foreground mb-2">Status</p>
              <p className="text-lg font-bold text-emerald-300">Plaatsing bevestigd</p>
            </div>
          </div>

          <div className="mx-auto mb-6 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4" style={{ maxWidth: tokens.layout.contentMeasure }}>
            <h3 className="text-base font-semibold text-foreground mb-3">
              Volgende stappen
            </h3>
            <div className="space-y-2 text-sm text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-emerald-300 flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Gemeente en aanbieder</strong> werken nu vanuit dezelfde planning
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-emerald-300 flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Casustraject</strong> blijft beschikbaar voor intake
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-emerald-300 flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Intake</strong> wordt nu gepland
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
          </CarePanel>
          </div>
      </CarePageScaffold>
    );
  }

  return (
    <CarePageScaffold
      archetype="decision"
      className="pb-8"
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Plaatsing
          <CareInfoPopover ariaLabel="Status plaatsing" testId="placement-flow-page-info">
            <p className="text-muted-foreground">
              {providerAccepted ? "Plaatsing kan nu worden bevestigd." : "Wacht op akkoord van de aanbieder."}
            </p>
          </CareInfoPopover>
        </span>
      }
      dominantAction={
        <CareAttentionBar
          tone={providerAccepted ? "info" : "warning"}
          icon={<CheckCircle2 size={16} />}
          message={providerAccepted ? "Alleen bevestigen als de plaatsing klopt" : "Plaatsing volgt pas na akkoord van de aanbieder"}
          action={
            <PrimaryActionButton onClick={handleConfirmClick} disabled={!providerAccepted || !allValid || hasErrors}>
              Bevestig plaatsing
            </PrimaryActionButton>
          }
        />
      }
      kpiStrip={
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {[
            { label: "Akkoord", value: providerAccepted ? "Ja" : "Nee", detail: "Van aanbieder" },
            { label: "Validaties", value: `${validationItems.filter(item => item.status === "complete").length}/${validationItems.length}`, detail: "Klaar voor bevestiging" },
            { label: "Risico's", value: riskSignals.length, detail: "Aandachtspunten" },
            { label: "Status", value: isConfirmed ? "Bevestigd" : "Open", detail: "Plaatsing" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3.5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{item.label}</p>
              <div className="mt-1.5 text-[20px] font-semibold leading-none text-foreground">{item.value}</div>
              <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      }
    >
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={20} />
        <span className="text-sm font-medium">Terug naar matching</span>
      </button>

      {/* TOP DECISION HEADER */}
      <CarePanel className="p-4 border-2 border-primary/40">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                {providerAccepted ? "Aanbieder akkoord ontvangen" : "Wacht op beoordeling door aanbieder"}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">
              {formatClientReference(caseData.id)} · {caseData.caseType}
            </h1>

            <p className="text-sm text-muted-foreground mb-4 leading-relaxed break-words">
              {providerAccepted ? (
                <>
                  Match geaccepteerd door <strong className="text-foreground">{provider.name}</strong> · Score: <strong className="text-emerald-300">94%</strong>
                </>
              ) : (
                <>
                  Wacht op beoordeling door aanbieder voor <strong className="text-foreground">{provider.name}</strong>
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Betrokkene: {maskParticipantIdentity(caseData.clientName)} · identiteit blijft afgeschermd tot geautoriseerde fase-overgang.
            </p>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                {providerAccepted ? (
                  <CheckCircle2 size={16} className="text-emerald-300" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-300" />
                )}
                <span className="text-muted-foreground">
                  {providerAccepted ? "Aanbieder heeft geaccepteerd" : "Wacht op beoordeling door aanbieder"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-300" />
                <span className="text-muted-foreground">Capaciteit afgestemd</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-300" />
                <span className="text-muted-foreground">Klaar voor intake</span>
              </div>
            </div>
          </div>

          {/* Urgency Indicator */}
          <div>
            <span className={`
              inline-block px-4 py-2 rounded-lg text-sm font-semibold border-2
              ${caseData.urgency === "high" ? "border-destructive/40 bg-destructive/15 text-destructive" : ""}
              ${caseData.urgency === "medium" ? "border-amber-500/40 bg-amber-500/15 text-amber-300" : ""}
              ${caseData.urgency === "low" ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : ""}
            `}>
              {caseData.urgency === "high" ? "Hoge urgentie" : 
               caseData.urgency === "medium" ? "Gemiddelde urgentie" : 
               "Lage urgentie"}
            </span>
          </div>
        </div>
      </CarePanel>

      {/* Main Layout: 3 Panels */}
      <div className="grid grid-cols-12 gap-4">
        {/* LEFT PANEL: Case Summary */}
        <div className="col-span-3">
      <CarePanel className="p-4 sticky" style={{ top: tokens.layout.edgeZero }}>
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Samenvatting
            </h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Casus-ID</p>
                <p className="font-medium text-foreground">{caseData.id}</p>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-1">Cliëntreferentie</p>
                <p className="font-medium text-foreground">{formatClientReference(caseData.id)}</p>
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
                  ${caseData.urgency === "high" ? "border-destructive/40 bg-destructive/15 text-destructive" : ""}
                  ${caseData.urgency === "medium" ? "border-amber-500/40 bg-amber-500/15 text-amber-300" : ""}
                  ${caseData.urgency === "low" ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : ""}
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
          </CarePanel>
        </div>

        {/* CENTER PANEL: Selected Provider + Validation */}
        <div className="col-span-6 space-y-3">
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
          <div className="sticky" style={{ top: tokens.layout.edgeZero }}>
            <HandoverInfoPanel riskSignals={riskSignals} />
          </div>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <CarePanel className="px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {providerAccepted && allValid && !hasErrors ? (
              <CheckCircle2 size={18} className="text-emerald-300" />
            ) : (
              <AlertTriangle size={18} className="text-amber-300" />
            )}
            <span className="text-sm text-muted-foreground">
              {providerAccepted && allValid && !hasErrors
                ? "Klaar om plaatsing te bevestigen via de primaire actie bovenaan."
                : "Voltooi validaties of wacht op aanbiederakkoord voor je bevestigt."}
            </span>
          </div>
          <Button onClick={onCancel} variant="outline">
            Annuleren
          </Button>
        </div>
      </CarePanel>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmationModal} onOpenChange={setShowConfirmationModal}>
        <DialogContent
          className="w-full max-w-[35rem] border-border/60 bg-card p-4 sm:p-5"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Bevestig</DialogTitle>
            <DialogDescription>
              Controleer de details voordat je de plaatsing vastzet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {placementConfirmError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {placementConfirmError}
              </div>
            )}
            <div className="rounded-lg border border-muted-foreground/20 bg-muted/30 p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="mb-1 text-muted-foreground">Cliëntreferentie</p>
                  <p className="font-semibold text-foreground">{formatClientReference(caseData.id)}</p>
                </div>
                <div>
                  <p className="mb-1 text-muted-foreground">Aanbieder</p>
                  <p className="font-semibold text-foreground">{provider.name}</p>
                </div>
                <div>
                  <p className="mb-1 text-muted-foreground">Matchscore</p>
                  <p className="font-semibold text-emerald-300">94%</p>
                </div>
                <div>
                  <p className="mb-1 text-muted-foreground">Urgentie</p>
                  <p className="font-semibold text-foreground capitalize">{caseData.urgency}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 p-4">
              <p className="text-sm leading-relaxed text-cyan-300">
                De aanbieder heeft deze match al geaccepteerd. Met deze stap bevestig je
                dat de casus door gaat naar plaatsing en daarna naar intake. Je volgt de voortgang
                daarna vanuit het plaatsingenoverzicht.
              </p>
            </div>
          </div>

          <DialogFooter>
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
              className="flex-1"
              disabled={isConfirming || !providerAccepted}
            >
              {isConfirming ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Plaatsing bevestigen...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} className="mr-2" />
                  Bevestig
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CarePageScaffold>
  );
}
