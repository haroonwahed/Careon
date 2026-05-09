import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
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

  // Validation items — only entries backed by real signals (provider acceptance + provider capacity).
  // The previously hardcoded "Overdrachtsgegevens compleet" item was removed: it was always
  // marked complete without any backing data and read as a fake validation during pilots.
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

  // Success state — calm operational acknowledgement (no celebratory chrome).
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
            icon={<CheckCircle2 size={16} />}
            message={`Plaatsing van ${formatClientReference(caseData.id)} is bevestigd. Intake wordt nu gepland.`}
            action={<PrimaryActionButton onClick={onBack}>Terug naar plaatsingen</PrimaryActionButton>}
          />
        }
      >
        <CarePanel className="p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />
            <div className="min-w-0 space-y-1">
              <h2 className="text-base font-semibold text-foreground">Plaatsing bevestigd</h2>
              <p className="text-sm text-muted-foreground" style={{ maxWidth: tokens.layout.contentMeasure }}>
                Casus <span className="font-medium text-foreground">{formatClientReference(caseData.id)}</span> is door
                {" "}<span className="font-medium text-foreground">{provider.name}</span> geaccepteerd. Intake wordt nu gepland.
              </p>
              <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="flex gap-1.5">
                  <dt>Casusreferentie:</dt>
                  <dd className="font-medium text-foreground">{formatClientReference(caseData.id)}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>Aanbieder:</dt>
                  <dd className="font-medium text-foreground">{provider.name}</dd>
                </div>
              </dl>
            </div>
          </div>
        </CarePanel>
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
              <div className="w-2 h-2 rounded-full bg-primary" />
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
                  Match geaccepteerd door <strong className="text-foreground">{provider.name}</strong>
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
              {provider.availableSpots > 0 ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-300" />
                  <span className="text-muted-foreground">Capaciteit beschikbaar</span>
                </div>
              ) : null}
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
                <p className="text-muted-foreground text-xs mb-1">Casusreferentie</p>
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
            </div>
          </CarePanel>
        </div>

        {/* CENTER PANEL: Selected Provider + Validation */}
        <div className="col-span-6 space-y-3">
          {/* Selected Provider Card — reasons/tradeOffs only render when bound to real, evidence-backed data */}
          <SelectedProviderCard provider={provider} />

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
                  <p className="mb-1 text-muted-foreground">Casusreferentie</p>
                  <p className="font-semibold text-foreground">{formatClientReference(caseData.id)}</p>
                </div>
                <div>
                  <p className="mb-1 text-muted-foreground">Aanbieder</p>
                  <p className="font-semibold text-foreground">{provider.name}</p>
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
