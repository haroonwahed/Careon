/**
 * Compact example of the case detail + AI layer pattern.
 */

import { useState } from "react";
import { ArrowLeft, Calendar, FileText, User, MapPin } from "lucide-react";
import { Button } from "../ui/button";
import { CaseStatusBadge } from "../care/CaseStatusBadge";
import { UrgencyBadge } from "../care/UrgencyBadge";
import { RiskBadge } from "../care/RiskBadge";
import { mockCases } from "../../lib/casesData";
import { CareAppFrame } from "../care/CareAppFrame";

// AI Components
import { 
  AanbevolenActie, 
  Risicosignalen, 
  Samenvatting,
  SystemInsight,
  AIInsightPanel 
} from "../ai";

interface CaseDetailWithAIProps {
  caseId: string;
  onBack: () => void;
  onStartMatching: (caseId: string) => void;
}

export function CaseDetailWithAI({ 
  caseId, 
  onBack, 
  onStartMatching 
}: CaseDetailWithAIProps) {
  const caseData = mockCases.find(c => c.id === caseId);

  if (!caseData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Casus niet gevonden</p>
      </div>
    );
  }

  // AI Decision Logic
  const getRecommendation = () => {
    if (caseData.status === "matching") {
      return {
        title: "Start matching proces",
        explanation: "Casus is compleet. Er zijn 3 passende matches.",
        actionLabel: "Start matching",
        confidence: "high" as const,
        onAction: () => onStartMatching(caseId)
      };
    }
    
    if (caseData.status === "blocked") {
      return {
        title: "Escaleer naar capaciteitsmanager",
        explanation: "Geen geschikte aanbieders. Directe actie nodig.",
        actionLabel: "Escaleer case",
        confidence: "high" as const,
        variant: "urgent" as const,
        onAction: () => console.log("Escalate case")
      };
    }

    return {
      title: "Wacht op beoordeling",
      explanation: "Beoordeling staat gepland op 18 april 2026.",
      actionLabel: "Bekijk beoordeling",
      confidence: "high" as const,
      onAction: () => console.log("View assessment")
    };
  };

  const getRiskSignals = () => {
    const signals = [];
    
    if (caseData.urgency === "high" && caseData.status === "assessment") {
      signals.push({
        severity: "warning" as const,
        message: "Urgente casus: beoordeling loopt 3 dagen uit"
      });
    }

    if (caseData.status === "blocked") {
      signals.push({
        severity: "critical" as const,
        message: "Geen beschikbare capaciteit in regio Amsterdam"
      });
    }

    if (caseData.risk === "high") {
      signals.push({
        severity: "warning" as const,
        message: "Hoog risico op escalatie"
      });
    }

    return signals;
  };

  const getSummary = () => {
    return [
      { 
        text: `${caseData.clientAge} jaar, woonachtig in ${caseData.region}`,
        type: "default" as const
      },
      { 
        text: `Zorgvraag: ${caseData.caseType}`,
        type: "info" as const
      },
      { 
        text: caseData.urgency === "high" 
          ? "Hoge urgentie" 
          : "Regulier traject",
        type: caseData.urgency === "high" ? "warning" as const : "success" as const
      },
      { 
        text: "Beoordeling gepland",
        type: "info" as const
      }
    ];
  };

  const recommendation = getRecommendation();
  const riskSignals = getRiskSignals();
  const summary = getSummary();

  return (
    <CareAppFrame className="space-y-6 pb-24">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={onBack}
        className="gap-2 hover:bg-primary/10 hover:text-primary"
      >
        <ArrowLeft size={16} />
        Terug naar Regiekamer
      </Button>

      {/* Header */}
      <div className="premium-card p-6">
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

      {/* AI LAYER: Recommended Action (Top Priority) */}
      <AanbevolenActie
        title={recommendation.title}
        explanation={recommendation.explanation}
        actionLabel={recommendation.actionLabel}
        confidence={recommendation.confidence}
        variant={recommendation.variant}
        onAction={recommendation.onAction}
      />

      {/* Main Layout: 3-Column Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Case info (4 cols) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="premium-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">
              Casusinfo
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <User size={16} className="text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Cliënt</p>
                  <p className="font-medium">{caseData.clientName}</p>
                  <p className="text-xs text-muted-foreground">{caseData.clientAge} jaar</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Regio</p>
                  <p className="font-medium">{caseData.region}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText size={16} className="text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Zorgtype</p>
                  <p className="font-medium">{caseData.caseType}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Aangemaakt</p>
                  <p className="font-medium">{caseData.createdAt}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Summary & Work Area (5 cols) */}
        <div className="xl:col-span-5 space-y-6">
          {/* AI LAYER: Case Summary */}
          <Samenvatting
            title="Samenvatting"
            items={summary}
          />

          {/* Inline AI Insight Examples */}
          <div className="space-y-3">
            <SystemInsight
              type="info"
              message="Beoordeling gepland op 18 april"
            />
            
            {caseData.status === "matching" && (
              <SystemInsight
                type="success"
                message="3 matches gevonden (78-94%)"
              />
            )}
          </div>

          {/* Placeholder for work area content */}
          <div className="premium-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
              Werkgebied
            </h3>
            <p className="text-sm text-muted-foreground">
              Workflow-inhoud afhankelijk van status.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: AI Insights Panel (3 cols) */}
        <div className="xl:col-span-3">
          <AIInsightPanel title="Beslissingsondersteuning">
            
            {/* AI LAYER: Risk Signals */}
            {riskSignals.length > 0 && (
              <Risicosignalen signals={riskSignals} />
            )}

            {/* Additional AI Insights */}
            <div className="premium-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Voortgang
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Intake</span>
                  <span className="text-green-400 font-semibold">Compleet</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Beoordeling</span>
                  <span className="text-amber-400 font-semibold">
                    {caseData.status === "assessment" ? "Loopt" : "Gepland"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Matching</span>
                  <span className="text-muted-foreground">Wachtend</span>
                </div>
              </div>
            </div>

            {/* Suggestion based on context */}
            {caseData.urgency === "high" && (
              <div className="premium-card p-4 bg-purple-500/5 border-2 border-purple-500/20">
                <h3 className="text-sm font-semibold text-purple-300 mb-2">
                  Overweging
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed break-words">
                  Bij hoge urgentie: overweeg parallelle intake.
                </p>
              </div>
            )}
          </AIInsightPanel>
        </div>
      </div>
    </CareAppFrame>
  );
}
