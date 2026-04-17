import { AlertTriangle, Info, CheckCircle2, Lightbulb } from "lucide-react";

type ValidationLevel = "error" | "warning" | "info" | "success";

interface ValidationMessage {
  level: ValidationLevel;
  message: string;
}

interface Suggestion {
  text: string;
  action?: () => void;
}

interface ValidationPanelProps {
  validations: ValidationMessage[];
  suggestions?: Suggestion[];
}

const levelConfig: Record<ValidationLevel, {
  icon: any;
  bg: string;
  border: string;
  text: string;
  iconColor: string;
}> = {
  error: {
    icon: AlertTriangle,
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-300",
    iconColor: "text-red-400"
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-300",
    iconColor: "text-amber-400"
  },
  info: {
    icon: Info,
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-300",
    iconColor: "text-blue-400"
  },
  success: {
    icon: CheckCircle2,
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-300",
    iconColor: "text-green-400"
  }
};

export function ValidationPanel({ validations, suggestions = [] }: ValidationPanelProps) {
  const hasErrors = validations.some(v => v.level === "error");
  const hasWarnings = validations.some(v => v.level === "warning");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Validatie & Suggesties
        </h3>
        <p className="text-xs text-muted-foreground">
          Controleer de beoordeling voordat je afrondt
        </p>
      </div>

      {/* Status Summary */}
      {validations.length === 0 && (
        <div className="premium-card p-4 border-2 border-green-500/30 bg-green-500/5">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-300">
                Beoordeling compleet
              </p>
              <p className="text-xs text-green-400/70 mt-1">
                Alle vereiste velden zijn ingevuld en gevalideerd.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Validation Messages */}
      {validations.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
            {hasErrors && "Problemen gevonden"}
            {!hasErrors && hasWarnings && "Aandachtspunten"}
            {!hasErrors && !hasWarnings && "Informatie"}
          </div>
          
          {validations.map((validation, idx) => {
            const config = levelConfig[validation.level];
            const Icon = config.icon;

            return (
              <div
                key={idx}
                className={`
                  p-3 rounded-lg border
                  ${config.bg} ${config.border}
                `}
              >
                <div className="flex items-start gap-2">
                  <Icon size={16} className={`${config.iconColor} flex-shrink-0 mt-0.5`} />
                  <p className={`text-xs leading-relaxed ${config.text}`}>
                    {validation.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Suggesties
          </div>
          
          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/10"
            >
              <div className="flex items-start gap-2">
                <Lightbulb size={16} className="text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-purple-300 leading-relaxed">
                    {suggestion.text}
                  </p>
                  {suggestion.action && (
                    <button
                      onClick={suggestion.action}
                      className="text-xs text-purple-400 underline mt-2 hover:text-purple-300"
                    >
                      Toepassen
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completion Requirements */}
      {hasErrors && (
        <div className="p-3 rounded-lg bg-muted/30 border border-muted-foreground/20">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Let op:</strong> Los alle problemen op voordat je de beoordeling kunt afronden.
          </p>
        </div>
      )}
    </div>
  );
}
