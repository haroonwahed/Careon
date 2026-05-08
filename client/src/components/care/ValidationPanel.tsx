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
  text: string;
  alertClass: string;
}> = {
  error: {
    icon: AlertTriangle,
    text: "text-red-base",
    alertClass: "careon-alert-error"
  },
  warning: {
    icon: AlertTriangle,
    text: "text-yellow-base",
    alertClass: "careon-alert-warning"
  },
  info: {
    icon: Info,
    text: "text-blue-base",
    alertClass: "careon-alert-info"
  },
  success: {
    icon: CheckCircle2,
    text: "text-green-base",
    alertClass: "careon-alert-success"
  }
};

export function ValidationPanel({ validations, suggestions = [] }: ValidationPanelProps) {
  const hasErrors = validations.some(v => v.level === "error");
  const hasWarnings = validations.some(v => v.level === "warning");

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Validatie & Suggesties
        </h3>
        <p className="text-xs text-muted-foreground">
          Controleer de samenvatting voordat je doorgaat
        </p>
      </div>

      {/* Status Summary */}
      {validations.length === 0 && (
        <div className="panel-surface p-4 border careon-alert-success">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-green-base flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-base">
                Samenvatting compleet
              </p>
              <p className="text-xs text-green-base/80 mt-1">
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
                  ${config.alertClass}
                `}
              >
                <div className="flex items-start gap-2">
                  <Icon size={16} className={`${config.text} flex-shrink-0 mt-0.5`} />
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
              className="p-3 rounded-lg border careon-alert-primary"
            >
              <div className="flex items-start gap-2">
                <Lightbulb size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-primary leading-relaxed">
                    {suggestion.text}
                  </p>
                  {suggestion.action && (
                    <button
                      onClick={suggestion.action}
                      className="text-xs text-primary underline mt-2 hover:text-primary-hover"
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
        <div className="p-3 rounded-lg border careon-alert-warning">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Let op:</strong> Los alle problemen op voordat je de beoordeling kunt afronden.
          </p>
        </div>
      )}
    </div>
  );
}
