import { 
  ArrowRight, 
  FileText, 
  Calendar, 
  Bell, 
  User,
  Info,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";

interface RiskSignal {
  severity: "low" | "medium" | "high";
  message: string;
}

interface HandoverInfoPanelProps {
  riskSignals?: RiskSignal[];
}

const severityConfig = {
  low: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-300",
    icon: Info
  },
  medium: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-300",
    icon: AlertTriangle
  },
  high: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-300",
    icon: AlertTriangle
  }
};

export function HandoverInfoPanel({ riskSignals = [] }: HandoverInfoPanelProps) {
  return (
    <div className="space-y-4">
      {/* Risk Signals */}
      {riskSignals.length > 0 && (
        <div className="premium-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            Risicosignalen
          </h3>
          <div className="space-y-2">
            {riskSignals.map((signal, idx) => {
              const config = severityConfig[signal.severity];
              const Icon = config.icon;
              
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${config.bg} ${config.border}`}
                >
                  <div className="flex items-start gap-2">
                    <Icon size={14} className={`${config.text} flex-shrink-0 mt-0.5`} />
                    <p className={`text-xs ${config.text} leading-relaxed break-words`}>
                      {signal.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* What Happens Next */}
      <div className="premium-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
          Wat volgt na plaatsing?
        </h3>
        
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">1</span>
            </div>
            <p className="text-xs text-muted-foreground pt-0.5 break-words">
              Aanbieder ontvangt bevestiging
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">2</span>
            </div>
            <p className="text-xs text-muted-foreground pt-0.5 break-words">
              Dossier wordt gedeeld voor intake
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">3</span>
            </div>
            <p className="text-xs text-muted-foreground pt-0.5 break-words">
              Intake binnen 3 werkdagen gepland
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={12} className="text-green-400" />
            </div>
            <p className="text-xs text-muted-foreground pt-0.5 break-words">
              Zorg gestart
            </p>
          </div>
        </div>
      </div>

      {/* Communication Preview - SIMPLIFIED */}
      <div className="premium-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Bell size={16} className="text-muted-foreground" />
          Notificaties
        </h3>
        
        <div className="space-y-2">
          <div className="p-2.5 rounded-lg bg-muted/20">
            <p className="text-xs font-medium text-foreground mb-1">
              Aanbieder
            </p>
            <p className="text-xs text-muted-foreground break-words">
              Dossier + contactgegevens
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-muted/20">
            <p className="text-xs font-medium text-foreground mb-1">
              Cliënt/familie
            </p>
            <p className="text-xs text-muted-foreground break-words">
              Bevestiging + contactpersoon
            </p>
          </div>
        </div>
      </div>

      {/* Responsibility Shift Indicator */}
      <div className="premium-card p-4 border-2 border-green-500/30 bg-green-500/5">
        <div className="flex items-start gap-3">
          <ArrowRight size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-300 mb-1">
              Verantwoordelijkheid verschuift
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed break-words">
              Aanbieder is verantwoordelijk voor intake en zorg. Gemeente monitort voortgang.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
