/**
 * ProviderProfilePage - Care Provider Detail View
 * 
 * High-impact decision support page showing provider details,
 * strengths/limitations, and capacity information.
 * 
 * Access points:
 * - From matching page (with selection context)
 * - From providers list (exploration mode)
 * 
 * Purpose:
 * - Build trust and understanding
 * - Support confident decision-making
 * - Reduce uncertainty
 */

import { useState } from "react";
import { 
  ArrowLeft,
  MapPin,
  Users,
  Clock,
  Star,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Building2,
  FileText,
  Calendar,
  Target,
  Award
} from "lucide-react";
import { Button } from "../ui/button";
import { Provider } from "../../lib/casesData";

// AI Components
import { 
  MatchExplanation,
  Samenvatting
} from "../ai";

interface ProviderProfilePageProps {
  provider: Provider;
  context?: "matching" | "exploration";
  matchScore?: number;
  caseId?: string;
  onSelectProvider?: () => void;
  onBack: () => void;
}

export function ProviderProfilePage({ 
  provider,
  context = "exploration",
  matchScore,
  caseId,
  onSelectProvider,
  onBack
}: ProviderProfilePageProps) {
  
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "zorgaanbod"
  ]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  // Mock capacity status
  const capacityStatus: "available" | "limited" | "full" = 
    provider.availableSpots > 3 ? "available" : 
    provider.availableSpots > 0 ? "limited" : "full";

  const estimatedWaitTime = 
    capacityStatus === "available" ? "3-5 dagen" :
    capacityStatus === "limited" ? "1-2 weken" :
    "2-4 weken";

  return (
    <div className="min-h-screen bg-background">
      
      {/* Top Bar */}
      <div className="border-b border-border bg-card sticky top-0 z-30">
        <div className="w-full px-0 py-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={onBack}
              className="gap-2 hover:bg-primary/10 hover:text-primary"
            >
              <ArrowLeft size={16} />
              {context === "matching" ? "Terug naar matching" : "Terug naar overzicht"}
            </Button>

            {context === "matching" && (
              <div className="flex items-center gap-3">
                {caseId && (
                  <span className="text-sm text-muted-foreground">
                    Matching voor {caseId}
                  </span>
                )}
                {matchScore && (
                  <div className="px-3 py-1 rounded-lg border-2 border-green-500/30 bg-green-500/10">
                    <span className="text-lg font-bold text-green-400">
                      {matchScore}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-0 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* PROVIDER HEADER */}
            <div className="premium-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    {provider.name}
                  </h1>
                  
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin size={14} />
                      <span className="text-sm">{provider.region}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 size={14} />
                      <span className="text-sm">{provider.type}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Star size={14} className="text-green-400 fill-green-400" />
                      <span className="text-sm font-semibold text-green-400">
                        {provider.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
                      Jeugdzorg
                    </span>
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-semibold">
                      Specialistisch
                    </span>
                    <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-semibold">
                      Trauma behandeling
                    </span>
                  </div>
                </div>

                {/* Capacity Status Badge */}
                <div className={`px-4 py-2 rounded-lg border-2 ${
                  capacityStatus === "available" 
                    ? "bg-green-500/10 border-green-500/30"
                    : capacityStatus === "limited"
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-red-500/10 border-red-500/30"
                }`}>
                  <p className={`text-xs font-semibold uppercase ${
                    capacityStatus === "available" ? "text-green-400" :
                    capacityStatus === "limited" ? "text-amber-400" :
                    "text-red-400"
                  }`}>
                    {capacityStatus === "available" ? "Beschikbaar" :
                     capacityStatus === "limited" ? "Beperkt" : "Wachtlijst"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {provider.availableSpots}/{provider.capacity} plekken
                  </p>
                </div>
              </div>
            </div>

            {/* QUICK SUMMARY */}
            <Samenvatting
              items={[
                {
                  icon: "success" as const,
                  text: `Gespecialiseerd in ${provider.type}`
                },
                {
                  icon: "info" as const,
                  text: "Doelgroep: Jongeren 12-18 jaar met complexe problematiek"
                },
                {
                  icon: "info" as const,
                  text: "Type zorg: Intensieve ambulante begeleiding + residentiële behandeling"
                },
                {
                  icon: capacityStatus === "available" ? "success" as const : "warning" as const,
                  text: `Capaciteit: ${provider.availableSpots} plekken beschikbaar, wachttijd ${estimatedWaitTime}`
                }
              ]}
            />

            {/* WHY THIS PROVIDER (DECISION SUPPORT) */}
            {context === "matching" && matchScore && (
              <div className="premium-card p-6">
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <Target size={20} className="text-primary" />
                  Waarom deze aanbieder?
                </h2>
                
                <MatchExplanation
                  score={matchScore}
                  strengths={[
                    "Sterke ervaring met vergelijkbare casussen (15+ afgelopen jaar)",
                    "Perfecte match met gevraagd zorgtype",
                    "Capaciteit direct beschikbaar",
                    "Snelle intake planning (gemiddeld binnen 5 dagen)",
                    "Hoge acceptatiegraad (92% van verwijzingen)"
                  ]}
                  tradeoffs={
                    matchScore < 90 ? [
                      "Afstand tot cliënt is 15km (boven gemiddelde)",
                      "Groepstherapie heeft wachtlijst van 2-3 weken"
                    ] : []
                  }
                  confidence={matchScore >= 90 ? "high" : matchScore >= 75 ? "medium" : "low"}
                />
              </div>
            )}

            {/* EXPANDABLE SECTIONS */}
            
            {/* Zorgaanbod */}
            <CollapsibleSection
              id="zorgaanbod"
              title="Zorgaanbod"
              icon={<Award size={20} />}
              expanded={expandedSections.includes("zorgaanbod")}
              onToggle={() => toggleSection("zorgaanbod")}
            >
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Type zorg
                  </h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        Intensieve Ambulante Begeleiding (IAB)
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        Residentiële behandeling (24-uurs zorg)
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        Gezinsbehandeling
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        Dagbehandeling
                      </span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Specialisaties
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1.5 bg-muted/30 rounded-md text-xs text-foreground">
                      Trauma & PTSS
                    </span>
                    <span className="px-3 py-1.5 bg-muted/30 rounded-md text-xs text-foreground">
                      Hechtingsproblematiek
                    </span>
                    <span className="px-3 py-1.5 bg-muted/30 rounded-md text-xs text-foreground">
                      Gedragsproblemen
                    </span>
                    <span className="px-3 py-1.5 bg-muted/30 rounded-md text-xs text-foreground">
                      Autisme spectrum
                    </span>
                    <span className="px-3 py-1.5 bg-muted/30 rounded-md text-xs text-foreground">
                      LVB begeleiding
                    </span>
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* Doelgroepen */}
            <CollapsibleSection
              id="doelgroepen"
              title="Doelgroepen"
              icon={<Users size={20} />}
              expanded={expandedSections.includes("doelgroepen")}
              onToggle={() => toggleSection("doelgroepen")}
            >
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Leeftijdsgroepen
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    12 tot 18 jaar (soms tot 21 jaar met indicatie)
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Problematiek
                  </h4>
                  <ul className="space-y-2">
                    <li className="text-sm text-muted-foreground">
                      • Complexe trauma en hechtingsproblemen
                    </li>
                    <li className="text-sm text-muted-foreground">
                      • Ernstige gedragsproblemen
                    </li>
                    <li className="text-sm text-muted-foreground">
                      • Combinatie autisme en gedragsproblematiek
                    </li>
                    <li className="text-sm text-muted-foreground">
                      • LVB met bijkomende problemen
                    </li>
                  </ul>
                </div>
              </div>
            </CollapsibleSection>

            {/* Werkwijze */}
            <CollapsibleSection
              id="werkwijze"
              title="Werkwijze"
              icon={<FileText size={20} />}
              expanded={expandedSections.includes("werkwijze")}
              onToggle={() => toggleSection("werkwijze")}
            >
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Intake proces
                  </h4>
                  <ol className="space-y-2 list-decimal list-inside">
                    <li className="text-sm text-muted-foreground">
                      Aanmelding en screening (binnen 5 werkdagen)
                    </li>
                    <li className="text-sm text-muted-foreground">
                      Intake gesprek met gezin en jongere
                    </li>
                    <li className="text-sm text-muted-foreground">
                      Indicatieoverleg en behandelplan
                    </li>
                    <li className="text-sm text-muted-foreground">
                      Start behandeling (binnen 2 weken na goedkeuring)
                    </li>
                  </ol>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Behandelaanpak
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Systemische en traumagerichte aanpak met focus op:
                  </p>
                  <ul className="space-y-1">
                    <li className="text-sm text-muted-foreground">
                      • Veiligheid en stabiliteit
                    </li>
                    <li className="text-sm text-muted-foreground">
                      • Hechting en relaties
                    </li>
                    <li className="text-sm text-muted-foreground">
                      • Gedragsregulatie
                    </li>
                    <li className="text-sm text-muted-foreground">
                      • Trauma verwerking
                    </li>
                  </ul>
                </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* RIGHT COLUMN (SIDEBAR - 1/3) */}
          <div className="space-y-6">
            
            {/* CAPACITY & AVAILABILITY */}
            <div className="premium-card p-5 sticky top-24">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Calendar size={16} />
                Beschikbaarheid
              </h3>

              <div className="space-y-4">
                {/* Current Status */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Huidige capaciteit
                  </p>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      capacityStatus === "available" ? "bg-green-400" :
                      capacityStatus === "limited" ? "bg-amber-400" :
                      "bg-red-400"
                    }`} />
                    <span className="text-sm font-semibold text-foreground">
                      {provider.availableSpots} van {provider.capacity} plekken vrij
                    </span>
                  </div>
                </div>

                {/* Wait Time */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Geschatte wachttijd
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {estimatedWaitTime}
                  </p>
                </div>

                {/* Response Time */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Reactietijd op verwijzing
                  </p>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-green-400" />
                    <span className="text-sm font-semibold text-green-400">
                      Binnen {provider.responseTime} uur
                    </span>
                  </div>
                </div>

                {/* Intake Planning */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Intake planning
                  </p>
                  <p className="text-sm text-foreground">
                    Flexibel, ook avonduren mogelijk
                  </p>
                </div>
              </div>

              {/* CTA */}
              {context === "matching" && onSelectProvider && (
                <Button 
                  className="w-full mt-6 bg-primary hover:bg-primary/90"
                  onClick={onSelectProvider}
                >
                  Selecteer deze aanbieder
                </Button>
              )}
            </div>

            {/* LOCATION */}
            <div className="premium-card p-5">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <MapPin size={16} />
                Locatie
              </h3>

              {/* Map Placeholder */}
              <div className="w-full h-40 bg-muted/20 rounded-lg flex items-center justify-center mb-4">
                <div className="text-center">
                  <MapPin size={32} className="mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">
                    Kaart van {provider.region}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Adres</p>
                  <p className="text-sm text-foreground">
                    Voorbeeldstraat 123<br />
                    1234 AB {provider.region}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Regio</p>
                  <p className="text-sm text-foreground">{provider.region}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Bereikbaarheid</p>
                  <p className="text-sm text-foreground">
                    OV: 15 min van station<br />
                    Auto: Gratis parkeren
                  </p>
                </div>
              </div>
            </div>

            {/* CONTACT */}
            <div className="premium-card p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">
                Contact & Verwijzing
              </h3>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Contactpersoon
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    Drs. P. Bakker
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Coördinator Intake
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-muted-foreground" />
                  <a 
                    href="tel:0201234567" 
                    className="text-sm text-primary hover:underline"
                  >
                    020 - 123 45 67
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-muted-foreground" />
                  <a 
                    href="mailto:intake@provider.nl" 
                    className="text-sm text-primary hover:underline"
                  >
                    intake@provider.nl
                  </a>
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Verwijzing via
                  </p>
                  <p className="text-sm text-foreground">
                    Veilig Thuis portaal of email
                  </p>
                </div>
              </div>
            </div>

            {/* DOCUMENTS */}
            <div className="premium-card p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">
                Documenten
              </h3>

              <div className="space-y-2">
                <a 
                  href="/care/documents/"
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 transition-colors"
                >
                  <FileText size={14} className="text-primary" />
                  <span className="text-sm text-foreground">Zorgaanbod brochure</span>
                </a>
                
                <a 
                  href="/care/documents/"
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 transition-colors"
                >
                  <FileText size={14} className="text-primary" />
                  <span className="text-sm text-foreground">Intake procedure</span>
                </a>

                <a 
                  href="/care/documents/"
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 transition-colors"
                >
                  <FileText size={14} className="text-primary" />
                  <span className="text-sm text-foreground">Privacy statement</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar (Mobile) */}
      {context === "matching" && onSelectProvider && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border">
          <Button 
            className="w-full bg-primary hover:bg-primary/90"
            onClick={onSelectProvider}
          >
            Selecteer deze aanbieder
          </Button>
        </div>
      )}
    </div>
  );
}

// Collapsible Section Component
interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ 
  title, 
  icon, 
  expanded, 
  onToggle, 
  children 
}: CollapsibleSectionProps) {
  return (
    <div className="premium-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-6 flex items-center justify-between hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-primary">{icon}</div>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
        </div>
        {expanded ? (
          <ChevronUp size={20} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={20} className="text-muted-foreground" />
        )}
      </button>
      
      {expanded && (
        <div className="px-6 pb-6 border-t border-border pt-6">
          {children}
        </div>
      )}
    </div>
  );
}
