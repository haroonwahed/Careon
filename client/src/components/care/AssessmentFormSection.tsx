import { ReactNode } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { CareInfoPopover } from "./CareUnifiedPage";

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
        panel-surface overflow-hidden transition-all duration-200
        ${isCompleted ? "border-green-500/30 bg-green-500/5" : ""}
      `}
    >
      {/* Section header: collapse control stays one button; toelichting is a separate control (no nested buttons). */}
      <div className="flex w-full items-center justify-between gap-2 p-4">
        <button
          type="button"
          onClick={onToggle}
          disabled={!onToggle}
          className={`
            flex min-w-0 flex-1 items-center justify-between gap-3 text-left
            ${onToggle ? "cursor-pointer hover:bg-muted/20" : "cursor-default"}
            transition-colors
          `}
        >
          <div className="flex min-w-0 items-center gap-3">
            {isCompleted ? (
              <CheckCircle2 size={20} className="shrink-0 text-green-400" />
            ) : (
              <Circle size={20} className="shrink-0 text-muted-foreground/40" />
            )}
            <div className="min-w-0 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                {required && !isCompleted && (
                  <span className="text-xs font-medium text-red-400">*Verplicht</span>
                )}
              </div>
            </div>
          </div>
          {onToggle ? (
            <div
              className={`
              shrink-0 text-muted-foreground transition-transform duration-200
              ${isCollapsed ? "" : "rotate-180"}
            `}
              aria-hidden
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 12.5L10 7.5L15 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ) : null}
        </button>
        {description ? (
          <CareInfoPopover ariaLabel={`Toelichting: ${title}`} triggerClassName="shrink-0">
            <p className="text-sm text-muted-foreground">{description}</p>
          </CareInfoPopover>
        ) : null}
      </div>

      {/* Section Content */}
      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}
