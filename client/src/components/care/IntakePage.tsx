import { useState } from "react";
import { ArrowLeft, AlertCircle, Calendar, CheckCircle2 } from "lucide-react";
import { IntakeBriefing } from "./IntakeBriefing";
import { IntakeStatusTracker } from "./IntakeStatusTracker";
import { CaseTimeline } from "./CaseTimeline";
import { DocumentSection } from "./DocumentSection";
import { ActionPanel } from "./ActionPanel";
import { mockCases, mockProviders } from "../../lib/casesData";

interface IntakePageProps {
  caseId: string;
  providerId: string;
  onBack: () => void;
}

type IntakeStatus = "not-started" | "planned" | "in-progress" | "completed";

export function IntakePage({ caseId, providerId, onBack }: IntakePageProps) {
  const [intakeStatus, setIntakeStatus] = useState<IntakeStatus>("not-started");
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const caseData = mockCases.find(c => c.id === caseId);
  const provider = mockProviders.find(p => p.id === providerId);

  if (!caseData || !provider) {
    return null;
  }

  // Mock intake briefing data
  const briefingData = {
    problemDescription: `${caseData.clientName} (${caseData.clientAge} jaar) - Complexe gedragsproblematiek met agressie. Instabiele thuissituatie. School rapporteert concentratie- en contactproblemen.`,
    assessmentSummary: `Intensieve ambulante begeleiding nodig. Focus op gedragsregulatie en gezinssysteem. Trauma-geïnformeerde aanpak aanbevolen.`,
    recommendedApproach: [
      "Start met individuele gesprekken",
      "Gezinsgesprekken vanaf week 2",
      "Coördineer gedragsplan met school"
    ],
    criticalNotes: [
      {
        type: "critical" as const,
        text: "Start intake binnen 3 werkdagen - urgente situatie"
      },
      {
        type: "warning" as const,
        text: "Vader toont weerstand tegen hulpverlening"
      }
    ]
  };

  // Mock timeline events
  const timelineEvents = [
    {
      id: "1",
      type: "created" as const,
      title: "Casus aangemaakt",
      description: "Nieuwe melding ontvangen van school via gemeente Amsterdam",
      timestamp: "12 april, 09:23",
      user: "Emma Jansen"
    },
    {
      id: "2",
      type: "assessed" as const,
      title: "Beoordeling afgerond",
      description: "Uitgebreide assessment compleet, intensieve hulp geadviseerd",
      timestamp: "15 april, 14:45",
      user: "Lisa de Vries"
    },
    {
      id: "3",
      type: "matched" as const,
      title: "Matching uitgevoerd",
      description: `Beste match gevonden: ${provider.name} (94% score)`,
      timestamp: "16 april, 10:15",
      user: "Lisa de Vries"
    },
    {
      id: "4",
      type: "placed" as const,
      title: "Plaatsing bevestigd",
      description: `Casus toegewezen aan ${provider.name}`,
      timestamp: "17 april, 11:30",
      user: "Lisa de Vries"
    }
  ];

  // Mock documents
  const documents = [
    {
      id: "1",
      name: "Beoordelingsrapport_volledig.pdf",
      type: "pdf" as const,
      size: "2.4 MB",
      uploadedAt: "15 april",
      uploadedBy: "Lisa de Vries"
    },
    {
      id: "2",
      name: "School_rapportage.pdf",
      type: "pdf" as const,
      size: "856 KB",
      uploadedAt: "12 april",
      uploadedBy: "Emma Jansen"
    },
    {
      id: "3",
      name: "Gezinssituatie_notities.docx",
      type: "docx" as const,
      size: "124 KB",
      uploadedAt: "14 april",
      uploadedBy: "Lisa de Vries"
    }
  ];

  // Contact info
  const contactInfo = {
    municipality: {
      name: "Gemeente Amsterdam",
      contactPerson: "Emma Jansen",
      email: "e.jansen@amsterdam.nl",
      phone: "+31 20 123 4567"
    },
    caseOwner: {
      name: "Lisa de Vries",
      role: "Jeugdzorgspecialist",
      email: "l.devries@amsterdam.nl",
      phone: "+31 20 987 6543"
    }
  };

  const handleStatusChange = (newStatus: IntakeStatus) => {
    setIntakeStatus(newStatus);
  };

  const handlePlanIntake = () => {
    setShowPlanModal(true);
  };

  const handleConfirmPlan = () => {
    setIntakeStatus("planned");
    setShowPlanModal(false);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={20} />
        <span className="text-sm font-medium">Terug naar overzicht</span>
      </button>

      {/* TOP HEADER */}
      <div 
        className="premium-card p-6"
        style={{
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(0, 0, 0, 0.02) 100%)",
          border: "2px solid rgba(139, 92, 246, 0.4)"
        }}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                Geplaatst – Intake fase
              </span>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">
              {caseData.clientName} · {caseData.caseType}
            </h1>

            <div className="flex items-center gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Toegewezen aan:</span>
                <span className="font-semibold text-foreground">{provider.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Case ID:</span>
                <span className="font-medium text-foreground">{caseData.id}</span>
              </div>
            </div>

            <div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30"
            >
              <CheckCircle2 size={16} className="text-green-400" />
              <span className="text-sm font-medium text-green-300">
                Deze casus is aan jou toegewezen
              </span>
            </div>
          </div>

          {/* Urgency Indicator */}
          <div className="flex flex-col gap-3 items-end">
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

            {caseData.urgency === "high" && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">
                  Start intake binnen 3 werkdagen
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          {actionMessage}
        </div>
      )}

      {/* Main Layout: 3 Panels */}
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT PANEL: Case Overview */}
        <div className="col-span-3">
          <div className="premium-card p-4 sticky top-24">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Casus overzicht
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

              <div>
                <p className="text-muted-foreground text-xs mb-1">Complexiteit</p>
                <p className="font-medium text-foreground">Hoog</p>
              </div>

              <div className="pt-3 border-t border-muted-foreground/20">
                <p className="text-muted-foreground text-xs mb-2">Kern samenvatting</p>
                <p className="text-xs text-foreground leading-relaxed">
                  Complexe gedragsproblematiek met trauma-indicaties. 
                  Intensieve begeleiding noodzakelijk.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER PANEL: Intake Briefing + Documents + Timeline */}
        <div className="col-span-6 space-y-6">
          {/* Intake Briefing */}
          <IntakeBriefing caseData={briefingData} />

          {/* Documents */}
          <DocumentSection
            documents={documents}
            onPreview={(id) => setActionMessage(`Preview geopend voor document ${id}`)}
            onDownload={(id) => setActionMessage(`Download gestart voor document ${id}`)}
          />

          {/* Timeline */}
          <CaseTimeline events={timelineEvents} />
        </div>

        {/* RIGHT PANEL: Status + Actions */}
        <div className="col-span-3">
          <div className="sticky top-24 space-y-4">
            {/* Status Tracker */}
            <IntakeStatusTracker
              currentStatus={intakeStatus}
              onStatusChange={handleStatusChange}
              plannedDate={intakeStatus === "planned" ? "19 april, 14:00" : undefined}
              completedDate={intakeStatus === "completed" ? "20 april, 16:30" : undefined}
            />

            {/* Action Panel */}
            <ActionPanel
              contactInfo={contactInfo}
              onPlanIntake={intakeStatus === "not-started" ? handlePlanIntake : undefined}
              onStartIntake={intakeStatus === "planned" ? () => setIntakeStatus("in-progress") : undefined}
              onContactClient={() => setActionMessage("Contactgegevens geopend")}
              onMarkStarted={intakeStatus === "not-started" ? () => setIntakeStatus("in-progress") : undefined}
            />
          </div>
        </div>
      </div>

      {/* Plan Intake Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="premium-card p-8 max-w-lg w-full mx-4">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Plan intake afspraak
            </h2>
            
            <p className="text-sm text-muted-foreground mb-6">
              Plan een intake gesprek met {caseData.clientName} en/of familie. 
              Bij hoge urgentie dient de intake binnen 3 werkdagen plaats te vinden.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Datum en tijd
                </label>
                <input
                  type="datetime-local"
                  className="w-full px-4 py-2 rounded-lg bg-muted/30 border border-muted-foreground/30 text-foreground"
                  defaultValue="2026-04-19T14:00"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Locatie
                </label>
                <select className="w-full px-4 py-2 rounded-lg bg-muted/30 border border-muted-foreground/30 text-foreground">
                  <option>Op locatie aanbieder</option>
                  <option>Bij cliënt thuis</option>
                  <option>Online (video)</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Notities
                </label>
                <textarea
                  className="w-full px-4 py-2 rounded-lg bg-muted/30 border border-muted-foreground/30 text-foreground resize-none"
                  rows={3}
                  placeholder="Eventuele aanvullende informatie voor de intake..."
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPlanModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-muted-foreground/30 text-foreground hover:bg-muted/30 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleConfirmPlan}
                className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Calendar size={16} />
                Bevestig planning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}