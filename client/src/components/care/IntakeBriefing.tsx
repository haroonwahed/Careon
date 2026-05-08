import { 
  AlertTriangle, 
  FileText, 
  Target, 
  Lightbulb,
  CheckCircle2,
  Info
} from "lucide-react";
import { CarePanel } from "./CareDesignPrimitives";
import { validationToneClasses } from "./careSemanticTones";
import { cn } from "../ui/utils";

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
      shell: validationToneClasses("warning").shell,
      text: validationToneClasses("warning").text,
      iconColor: validationToneClasses("warning").text
    },
    info: {
      icon: Info,
      shell: validationToneClasses("info").shell,
      text: validationToneClasses("info").text,
      iconColor: validationToneClasses("info").text
    },
    critical: {
      icon: AlertTriangle,
      shell: validationToneClasses("error").shell,
      text: validationToneClasses("error").text,
      iconColor: validationToneClasses("error").text
    }
  };

  return (
    <CarePanel className="p-4">
      <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
        <FileText size={24} className="text-primary" />
        Intake briefing
      </h2>

      <div className="space-y-4">
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
          <div className="p-4 rounded-lg border border-cyan-500/40 bg-cyan-500/15">
            <p className="text-sm text-foreground leading-relaxed">
              {caseData.assessmentSummary}
            </p>
          </div>
        </section>

        {/* Aanbevolen aanpak */}
        <section>
          <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <Target size={16} className="text-emerald-300" />
            Aanbevolen aanpak
          </h3>
          <div className="space-y-2">
            {caseData.recommendedApproach.map((approach, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-3 p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/15"
              >
                <CheckCircle2 size={16} className="text-emerald-300 flex-shrink-0 mt-0.5" />
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
              <Lightbulb size={16} className="text-amber-300" />
              Belangrijke aandachtspunten
            </h3>
            <div className="space-y-2">
              {caseData.criticalNotes.map((note, idx) => {
                const config = noteTypeConfig[note.type];
                const Icon = config.icon;

                return (
                  <div 
                    key={idx}
                    className={cn("flex items-start gap-3 rounded-lg border p-4", config.shell)}
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
    </CarePanel>
  );
}
