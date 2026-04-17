import { Check, Circle } from "lucide-react";

interface Step {
  id: string;
  label: string;
  completed: boolean;
}

interface AssessmentStepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
}

export function AssessmentStepper({ steps, currentStep, onStepClick }: AssessmentStepperProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = step.completed;
        const isPast = index < currentStep;
        const isFuture = index > currentStep;
        const isClickable = onStepClick && (isCompleted || isPast || isActive);

        return (
          <div key={step.id} className="flex items-center flex-1">
            {/* Step Circle */}
            <button
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              className={`
                relative flex items-center justify-center w-10 h-10 rounded-full
                border-2 transition-all duration-200
                ${isActive ? "border-primary bg-primary/10 scale-110" : ""}
                ${isCompleted ? "border-green-500 bg-green-500/10" : ""}
                ${isPast && !isCompleted ? "border-primary/50 bg-primary/5" : ""}
                ${isFuture ? "border-muted-foreground/30 bg-muted/20" : ""}
                ${isClickable ? "cursor-pointer hover:scale-105" : "cursor-default"}
              `}
            >
              {isCompleted ? (
                <Check size={20} className="text-green-400" />
              ) : (
                <span className={`
                  text-sm font-semibold
                  ${isActive ? "text-primary" : ""}
                  ${isFuture ? "text-muted-foreground/50" : ""}
                  ${isPast ? "text-primary/70" : ""}
                `}>
                  {index + 1}
                </span>
              )}

              {/* Active Pulse */}
              {isActive && (
                <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" />
              )}
            </button>

            {/* Step Label */}
            <div className="ml-3 flex-1">
              <p className={`
                text-sm font-medium transition-colors
                ${isActive ? "text-foreground" : ""}
                ${isCompleted ? "text-green-400" : ""}
                ${isPast ? "text-muted-foreground" : ""}
                ${isFuture ? "text-muted-foreground/50" : ""}
              `}>
                {step.label}
              </p>
              {isActive && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Actieve stap
                </p>
              )}
              {isCompleted && (
                <p className="text-xs text-green-400/70 mt-0.5">
                  Voltooid
                </p>
              )}
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className={`
                h-0.5 w-full mx-4 transition-colors duration-300
                ${isCompleted || isPast ? "bg-primary/40" : "bg-muted-foreground/20"}
              `} />
            )}
          </div>
        );
      })}
    </div>
  );
}
