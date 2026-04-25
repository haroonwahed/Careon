import { 
  AlertTriangle, 
  FileText, 
  Target, 
  Lightbulb,
  CheckCircle2,
  Info
} from "lucide-react";

interface IntakeBriefingProps {
  caseData: {
    problemDescription: string;
    assessmentSummary: string;
    recommendedApproach: string[];
    criticalNotes: Array<{
      type: "warning" | "info" | "critical";
      text: string;
    }>;
  };
}

export function IntakeBriefing({ caseData }: IntakeBriefingProps) {
  const noteTypeConfig = {
    warning: {
      icon: AlertTriangle,
      bg: "bg-yellow-light",
      border: "border-yellow-border",
      text: "text-yellow-base",
      iconColor: "text-yellow-base"
    },
    info: {
      icon: Info,
      bg: "bg-blue-light",
      border: "border-blue-border",
      text: "text-blue-base",
      iconColor: "text-blue-base"
    },
    critical: {
      icon: AlertTriangle,
      bg: "bg-red-light",
      border: "border-red-border",
      text: "text-red-base",
      iconColor: "text-red-base"
    }
  };

  return (
    <div className="premium-card p-6">
      <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
        <FileText size={24} className="text-primary" />
        Intake briefing
      </h2>

      <div className="space-y-6">
        {/* Probleemschets */}
        <section>
          <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Probleemschets
          </h3>
          <div className="p-4 rounded-lg bg-muted/30 border border-muted-foreground/20">
            <p className="text-sm text-foreground leading-relaxed">
              {caseData.problemDescription}
            </p>
          </div>
        </section>

        {/* Samenvatting */}
        <section>
          <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Samenvatting
          </h3>
          <div className="p-4 rounded-lg border careon-alert-info">
            <p className="text-sm text-foreground leading-relaxed">
              {caseData.assessmentSummary}
            </p>
          </div>
        </section>

        {/* Aanbevolen aanpak */}
        <section>
          <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <Target size={16} className="text-green-base" />
            Aanbevolen aanpak
          </h3>
          <div className="space-y-2">
            {caseData.recommendedApproach.map((approach, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-3 p-3 rounded-lg border careon-alert-success"
              >
                <CheckCircle2 size={16} className="text-green-base flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">
                  {approach}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Belangrijke aandachtspunten */}
        {caseData.criticalNotes.length > 0 && (
          <section>
            <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <Lightbulb size={16} className="text-yellow-base" />
              Belangrijke aandachtspunten
            </h3>
            <div className="space-y-2">
              {caseData.criticalNotes.map((note, idx) => {
                const config = noteTypeConfig[note.type];
                const Icon = config.icon;

                return (
                  <div 
                    key={idx}
                    className={`flex items-start gap-3 p-4 rounded-lg border ${config.bg} ${config.border}`}
                  >
                    <Icon size={16} className={`${config.iconColor} flex-shrink-0 mt-0.5`} />
                    <p className={`text-sm ${config.text} leading-relaxed`}>
                      {note.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
