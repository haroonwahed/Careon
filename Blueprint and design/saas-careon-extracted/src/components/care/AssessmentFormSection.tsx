import { ReactNode } from "react";
import { CheckCircle2, Circle } from "lucide-react";

interface AssessmentFormSectionProps {
  title: string;
  description?: string;
  isCompleted?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
  children: ReactNode;
  required?: boolean;
}

export function AssessmentFormSection({
  title,
  description,
  isCompleted = false,
  isCollapsed = false,
  onToggle,
  children,
  required = false
}: AssessmentFormSectionProps) {
  return (
    <div
      className={`
        premium-card overflow-hidden transition-all duration-200
        ${isCompleted ? "border-green-500/30 bg-green-500/5" : ""}
      `}
    >
      {/* Section Header */}
      <button
        onClick={onToggle}
        disabled={!onToggle}
        className={`
          w-full p-5 flex items-center justify-between
          ${onToggle ? "cursor-pointer hover:bg-muted/20" : "cursor-default"}
          transition-colors
        `}
      >
        <div className="flex items-center gap-3">
          {/* Completion Indicator */}
          {isCompleted ? (
            <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
          ) : (
            <Circle size={20} className="text-muted-foreground/40 flex-shrink-0" />
          )}

          {/* Title */}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                {title}
              </h3>
              {required && !isCompleted && (
                <span className="text-xs text-red-400 font-medium">
                  *Verplicht
                </span>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Collapse Indicator */}
        {onToggle && (
          <div className={`
            text-muted-foreground transition-transform duration-200
            ${isCollapsed ? "" : "rotate-180"}
          `}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 12.5L10 7.5L15 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </button>

      {/* Section Content */}
      {!isCollapsed && (
        <div className="px-5 pb-5 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}
