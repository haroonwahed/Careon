import { useState } from "react";
import { 
  ArrowLeft, 
  AlertCircle, 
  Clock, 
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  Lightbulb,
  TrendingUp,
  Shield,
  Building2,
  Users,
  Star
} from "lucide-react";
import { Button } from "../ui/button";
import { CaseStatusBadge } from "./CaseStatusBadge";
import { UrgencyBadge } from "./UrgencyBadge";
import { RiskBadge } from "./RiskBadge";
import { Case, mockCases, mockProviders, Provider } from "../../lib/casesData";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

interface CaseDetailPageProps {
  caseId: string;
  onBack: () => void;
  onStartMatching: (caseId: string) => void;
}

export function CaseDetailPage({ caseId, onBack, onStartMatching }: CaseDetailPageProps) {
  const caseData = mockCases.find(c => c.id === caseId);
  
  // Determine active phase from case status
  const getActivePhase = (status: string) => {
    if (status === "intake") return "intake";
    if (status === "assessment") return "assessment";
    if (["matching", "blocked"].includes(status)) return "matching";
    if (status === "placement") return "placement";
    return "assessment";
  };

  const [activePhase, setActivePhase] = useState<"intake" | "assessment" | "matching" | "placement">(
    caseData ? getActivePhase(caseData.status) : "assessment"
  );

  if (!caseData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Case niet gevonden</p>
          <Button onClick={onBack} className="mt-4" variant="outline">
            Terug naar overzicht
          </Button>
        </div>
      </div>
    );
  }

  // Phase configuration
  const phases = [
    { id: "intake", label: "Casus", active: ["intake"].includes(caseData.status) },
    { id: "assessment", label: "Beoordeling", active: ["assessment"].includes(caseData.status) },
    { id: "matching", label: "Matching", active: ["matching", "blocked"].includes(caseData.status) },
    { id: "placement", label: "Plaatsing", active: ["placement"].includes(caseData.status) }
  ];

  const currentPhaseIndex = phases.findIndex(p => p.id === activePhase);

  // Get recommended action based on status
  const getRecommendation = () => {
    switch (caseData.status) {
      case "blocked":
        return {
          type: "urgent",
          title: "Geen geschikte aanbieder - Escalatie vereist",
          action: "Escaleer naar capaciteitsmanager",
          icon: AlertCircle,
          description: "Er zijn geen aanbieders met beschikbare capaciteit gevonden. Directe escalatie noodzakelijk."
        };
      case "assessment":
        return {
          type: "warning",
          title: "Beoordeling loopt vertraging op",
          action: "Neem contact op met beoordelaar",
          icon: Clock,
          description: "De beoordeling is 5 dagen vertraagd. Plan een spoedoverleg met Dr. P. Bakker."
        };
      case "matching":
        return {
          type: "action",
          title: "Klaar voor matching",
          action: "Start matching proces",
          icon: TrendingUp,
          description: "Beoordeling is compleet. Systeem heeft 3 potentiële matches geïdentificeerd."
        };
      default:
        return {
          type: "normal",
          title: "Case verloopt normaal",
          action: "Volg standaard procedure",
          icon: CheckCircle2,
          description: "Geen directe actie vereist."
        };
    }
  };

  const recommendation = getRecommendation();

  return (
    <div className="space-y-6 pb-24">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={onBack}
        className="gap-2 hover:bg-primary/10 hover:text-primary"
      >
        <ArrowLeft size={16} />
        Terug naar Regiekamer
      </Button>

      {/* Decision Header */}
      <div className="premium-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold">{caseData.id}</h1>
              <CaseStatusBadge status={caseData.status} />
              <UrgencyBadge urgency={caseData.urgency} />
              <RiskBadge risk={caseData.risk} />
            </div>
            <p className="text-muted-foreground">
              {caseData.clientName} · {caseData.clientAge} jaar · {caseData.region}
            </p>
          </div>
        </div>

        {/* Recommendation Banner */}
        <div 
          className={`p-4 rounded-lg border-l-4 ${
            recommendation.type === "urgent" 
              ? "bg-red-500/10 border-red-500" 
              : recommendation.type === "warning"
              ? "bg-amber-500/10 border-amber-500"
              : recommendation.type === "action"
              ? "bg-primary/10 border-primary"
              : "bg-green-500/10 border-green-500"
          }`}
        >
          <div className="flex items-start gap-3">
            <recommendation.icon 
              className={`mt-0.5 ${
                recommendation.type === "urgent" 
                  ? "text-red-500" 
                  : recommendation.type === "warning"
                  ? "text-amber-500"
                  : recommendation.type === "action"
                  ? "text-primary"
                  : "text-green-500"
              }`} 
              size={20} 
            />
            <div className="flex-1">
              <p className="font-medium mb-1">{recommendation.title}</p>
              <p className="text-sm text-muted-foreground">{recommendation.description}</p>
            </div>
            <Button 
              size="sm"
              className={
                recommendation.type === "urgent"
                  ? "bg-red-500 hover:bg-red-600"
                  : recommendation.type === "warning"
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-primary hover:bg-primary/90"
              }
              onClick={() => {
                if (recommendation.type === "action") {
                  onStartMatching(caseId);
                }
              }}
            >
              {recommendation.action}
            </Button>
          </div>
        </div>
      </div>

      {/* Phase Indicator */}
      <div className="premium-card p-6">
        <div className="flex items-center justify-between">
          {phases.map((phase, index) => (
            <div key={phase.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-2 flex-1">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold border-2 transition-all ${
                    phase.active
                      ? "bg-primary border-primary text-white"
                      : index < currentPhaseIndex
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </div>
                <span 
                  className={`text-sm font-medium ${
                    phase.active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {phase.label}
                </span>
              </div>
              {index < phases.length - 1 && (
                <div 
                  className={`flex-1 h-0.5 -mx-2 ${
                    index < currentPhaseIndex
                      ? "bg-primary"
                      : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Case Information */}
        <div className="xl:col-span-1 space-y-6">
          {/* Client Info */}
          <div className="premium-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <User size={18} className="text-primary" />
              Cliënt informatie
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Naam</span>
                <p className="font-medium">{caseData.clientName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Leeftijd</span>
                <p className="font-medium">{caseData.clientAge} jaar</p>
              </div>
              <div>
                <span className="text-muted-foreground">Regio</span>
                <p className="font-medium flex items-center gap-1">
                  <MapPin size={14} />
                  {caseData.region}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Toegewezen aan</span>
                <p className="font-medium">{caseData.assignedTo}</p>
              </div>
            </div>
          </div>

          {/* Case Details */}
          <div className="premium-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText size={18} className="text-primary" />
              Case details
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Type zorg</span>
                <p className="font-medium">{caseData.caseType}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <div className="mt-1">
                  <CaseStatusBadge status={caseData.status} />
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Wachttijd</span>
                <p className="font-medium flex items-center gap-1">
                  <Clock size={14} />
                  {caseData.waitingDays} dagen
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Laatste activiteit</span>
                <p className="font-medium">{caseData.lastActivity}</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="premium-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-primary" />
              Tijdlijn
            </h3>
            <div className="space-y-4">
              <TimelineEvent 
                date="16 april 2026"
                title="Case aangemaakt"
                description="Initiële intake afgerond"
                type="completed"
              />
              <TimelineEvent 
                date="14 april 2026"
                title="Beoordeling gestart"
                description="Toegewezen aan Dr. P. Bakker"
                type="completed"
              />
              <TimelineEvent 
                date="8 april 2026"
                title="Beoordeling gepland"
                description="Deadline: 15 april"
                type="warning"
              />
            </div>
          </div>
        </div>

        {/* Center: Active Work Area */}
        <div className="xl:col-span-1 space-y-6">
          <div className="premium-card p-5">
            <h3 className="font-semibold mb-4">Werk gebied</h3>
            
            {caseData.status === "assessment" && (
              <AssessmentWorkArea caseData={caseData} />
            )}

            {caseData.status === "matching" && (
              <MatchingWorkArea 
                caseData={caseData} 
                onStartMatching={onStartMatching}
              />
            )}

            {caseData.status === "blocked" && (
              <BlockedWorkArea caseData={caseData} />
            )}

            {caseData.status === "placement" && (
              <PlacementWorkArea caseData={caseData} />
            )}
          </div>
        </div>

        {/* Right: System Intelligence Panel */}
        <div className="xl:col-span-1 space-y-6">
          {/* Risks */}
          <div className="premium-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Shield size={18} className="text-red-500" />
              Risico's
            </h3>
            <div className="space-y-3">
              {caseData.risk === "high" && (
                <>
                  <RiskAlert 
                    level="high"
                    title="Lange wachttijd"
                    description={`${caseData.waitingDays} dagen zonder match kan leiden tot escalatie`}
                  />
                  <RiskAlert 
                    level="medium"
                    title="Beperkte capaciteit"
                    description="Weinig beschikbare aanbieders in regio"
                  />
                </>
              )}
              {caseData.risk === "medium" && (
                <RiskAlert 
                  level="medium"
                  title="Gemiddeld risico"
                  description="Beoordeling loopt lichte vertraging op"
                />
              )}
              {caseData.risk === "low" && (
                <div className="text-sm text-muted-foreground">
                  Geen significante risico's geïdentificeerd
                </div>
              )}
            </div>
          </div>

          {/* AI Suggestions */}
          <div className="premium-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Lightbulb size={18} className="text-amber-500" />
              Suggesties
            </h3>
            <div className="space-y-3">
              <SuggestionCard
                title="Verbreed zoekgebied"
                description="Overweeg aanbieders in aangrenzende regio's"
                confidence={87}
              />
              <SuggestionCard
                title="Alternatieve zorgvorm"
                description="Ambulante zorg als tussenoplossing"
                confidence={72}
              />
            </div>
          </div>

          {/* Similar Cases */}
          <div className="premium-card p-5">
            <h3 className="font-semibold mb-4">Vergelijkbare cases</h3>
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                <div className="font-medium">C-2026-0923</div>
                <div className="text-muted-foreground text-xs">
                  Zelfde regio, vergelijkbare zorg · Opgelost in 8 dagen
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                <div className="font-medium">C-2026-0834</div>
                <div className="text-muted-foreground text-xs">
                  Vergelijkbaar risicoprofiel · In behandeling
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm z-40 px-6">
        <div className="max-w-[1400px] mx-auto py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Laatste update: {caseData.lastActivity}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline">
                Notitie toevoegen
              </Button>
              <Button variant="outline">
                Gesprek plannen
              </Button>
              {caseData.status === "matching" && (
                <Button 
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => onStartMatching(caseId)}
                >
                  Start matching
                </Button>
              )}
              {caseData.status === "blocked" && (
                <Button className="bg-red-500 hover:bg-red-600">
                  Escaleer case
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Timeline Event Component
function TimelineEvent({ 
  date, 
  title, 
  description, 
  type 
}: { 
  date: string; 
  title: string; 
  description: string; 
  type: "completed" | "warning" | "pending";
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div 
          className={`w-3 h-3 rounded-full ${
            type === "completed" 
              ? "bg-green-500" 
              : type === "warning"
              ? "bg-amber-500"
              : "bg-muted"
          }`}
        />
        <div className="w-px h-full bg-border" />
      </div>
      <div className="flex-1 pb-4">
        <div className="text-xs text-muted-foreground mb-1">{date}</div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

// Risk Alert Component
function RiskAlert({ 
  level, 
  title, 
  description 
}: { 
  level: "high" | "medium" | "low"; 
  title: string; 
  description: string;
}) {
  return (
    <div 
      className={`p-3 rounded-lg border ${
        level === "high"
          ? "bg-red-500/10 border-red-500/30"
          : level === "medium"
          ? "bg-amber-500/10 border-amber-500/30"
          : "bg-blue-500/10 border-blue-500/30"
      }`}
    >
      <div className="flex items-start gap-2">
        <AlertCircle 
          size={16} 
          className={`mt-0.5 ${
            level === "high"
              ? "text-red-500"
              : level === "medium"
              ? "text-amber-500"
              : "text-blue-500"
          }`}
        />
        <div className="flex-1">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  );
}

// Suggestion Card Component
function SuggestionCard({ 
  title, 
  description, 
  confidence 
}: { 
  title: string; 
  description: string; 
  confidence: number;
}) {
  return (
    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <p className="font-medium text-sm">{title}</p>
        <span className="text-xs text-primary font-semibold">
          {confidence}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

// Work Area Components
function AssessmentWorkArea({ caseData }: { caseData: Case }) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={16} className="text-amber-500" />
          <span className="font-medium text-sm">Beoordeling vertraagd</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Gepland voor 8 april, nu 5 dagen over deadline
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-2 block">Beoordelaar</label>
          <Input defaultValue="Dr. P. Bakker" />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Status update</label>
          <Textarea 
            placeholder="Laatste contact met beoordelaar..."
            rows={3}
          />
        </div>
        <Button className="w-full bg-primary hover:bg-primary/90">
          <Phone size={16} className="mr-2" />
          Bel beoordelaar
        </Button>
      </div>
    </div>
  );
}

function MatchingWorkArea({ 
  caseData, 
  onStartMatching 
}: { 
  caseData: Case; 
  onStartMatching: (caseId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={16} className="text-primary" />
          <span className="font-medium text-sm">3 matches gevonden</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Systeem heeft geschikte aanbieders geïdentificeerd
        </p>
      </div>

      <div className="text-sm text-muted-foreground mb-4">
        Beoordeling is compleet. Start het matching proces om geschikte aanbieders te bekijken.
      </div>

      <Button 
        className="w-full bg-primary hover:bg-primary/90"
        onClick={() => onStartMatching(caseData.id)}
      >
        Bekijk matches
      </Button>
    </div>
  );
}

function BlockedWorkArea({ caseData }: { caseData: Case }) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <XCircle size={16} className="text-red-500" />
          <span className="font-medium text-sm">Case geblokkeerd</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {caseData.signal}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-2 block">Escalatie notitie</label>
          <Textarea 
            placeholder="Reden voor escalatie..."
            rows={3}
          />
        </div>
        <Button className="w-full bg-red-500 hover:bg-red-600">
          Escaleer naar manager
        </Button>
      </div>
    </div>
  );
}

function PlacementWorkArea({ caseData }: { caseData: Case }) {
  const [placementConfirmed, setPlacementConfirmed] = useState(false);
  const [intakeScheduled, setIntakeScheduled] = useState(false);
  
  // Get matched provider (in real app, this would come from the case data)
  const matchedProvider = mockProviders[0]; // Best match
  const matchScore = 94;

  if (placementConfirmed && intakeScheduled) {
    // STATE: Intake completed, waiting for care start
    return (
      <div className="space-y-4">
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={18} className="text-green-500" />
            <span className="font-semibold">Intake afgerond</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Wachten op start zorgverlening
          </p>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Aanbieder</span>
            <span className="font-medium">{matchedProvider.name}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Intake datum</span>
            <span className="font-medium">22 april 2026</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Start zorg</span>
            <span className="font-medium">25 april 2026</span>
          </div>
        </div>

        <Button className="w-full bg-green-500 hover:bg-green-600">
          <CheckCircle2 size={16} className="mr-2" />
          Markeer als afgerond
        </Button>
      </div>
    );
  }

  if (placementConfirmed) {
    // STATE: Placement confirmed, waiting for intake
    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={18} className="text-blue-500" />
            <span className="font-semibold">Plaatsing bevestigd</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Wacht op intake planning
          </p>
        </div>

        <div className="space-y-3">
          <div className="text-sm space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Aanbieder</span>
              <span className="font-medium">{matchedProvider.name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Status</span>
              <span className="text-green-500 font-medium">Geaccepteerd</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Verwachte intake</span>
              <span className="font-medium">Binnen 3 werkdagen</span>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <label className="text-sm font-medium block">Intake datum</label>
            <Input type="date" />
            <Button 
              className="w-full bg-primary hover:bg-primary/90"
              onClick={() => setIntakeScheduled(true)}
            >
              <Calendar size={16} className="mr-2" />
              Bevestig intake planning
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // INITIAL STATE: Ready for placement confirmation
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-1">Klaar voor plaatsing</h3>
        <p className="text-sm text-muted-foreground">
          Cliënt {caseData.clientName} · {caseData.caseType}
        </p>
      </div>

      {/* Match Info */}
      <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 size={14} className="text-primary" />
          <span className="text-xs font-semibold text-primary">BESTE MATCH</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">{matchedProvider.name}</span>
          <span className="text-sm font-semibold text-primary">Score: {matchScore}%</span>
        </div>
      </div>

      {/* Selected Provider Card */}
      <div className="premium-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="text-primary" size={24} />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold mb-1">{matchedProvider.name}</h4>
            <p className="text-sm text-muted-foreground">{matchedProvider.type}</p>
          </div>
        </div>

        {/* Provider Stats */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            <MapPin className="text-muted-foreground" size={14} />
            <div>
              <p className="text-xs text-muted-foreground">Regio</p>
              <p className="text-sm font-medium">{matchedProvider.region}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="text-muted-foreground" size={14} />
            <div>
              <p className="text-xs text-muted-foreground">Reactietijd</p>
              <p className="text-sm font-medium">{matchedProvider.responseTime}u</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="text-muted-foreground" size={14} />
            <div>
              <p className="text-xs text-muted-foreground">Capaciteit</p>
              <p className="text-sm font-medium text-green-500">{matchedProvider.availableSpots} plekken</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Star className="text-amber-500 fill-amber-500" size={14} />
            <div>
              <p className="text-xs text-muted-foreground">Rating</p>
              <p className="text-sm font-medium">{matchedProvider.rating}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Why This Match? */}
      <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb size={14} className="text-blue-500" />
          <span className="text-xs font-semibold text-blue-500">WAAROM DEZE MATCH?</span>
        </div>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
            <span>Regio match: {matchedProvider.region}</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
            <span>Zorgtype match: {matchedProvider.type}</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
            <span>Directe capaciteit beschikbaar</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
            <span>Hoge acceptatiegraad (92% in vergelijkbare cases)</span>
          </li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button 
          variant="outline" 
          className="flex-1"
        >
          Annuleren
        </Button>
        <Button 
          className="flex-1 bg-primary hover:bg-primary/90"
          onClick={() => setPlacementConfirmed(true)}
        >
          <CheckCircle2 size={16} className="mr-2" />
          Bevestig plaatsing
        </Button>
      </div>
    </div>
  );
}