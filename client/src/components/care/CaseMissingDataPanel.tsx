import { useId, useState } from "react";
import { ChevronDown, ChevronRight, Circle } from "lucide-react";
import { cn } from "../ui/utils";
import type { MissingRequiredField } from "../../lib/decisionEvaluation";
import { toCareCaseEdit } from "../../lib/routes";

interface CaseMissingDataPanelProps {
  missingFields: MissingRequiredField[];
  caseId: string;
  /** Current guided step (1-based), if a guided flow is active. */
  guidedStep?: number;
  className?: string;
}

export function buildGuidedFieldUrl(
  caseId: string,
  field: MissingRequiredField,
  step: number,
  total: number,
): string {
  const base = toCareCaseEdit(caseId, field.section);
  const extra = new URLSearchParams({ guided: "1", step: String(step), total: String(total) });
  if (field.field_hint) extra.set("field", field.field_hint);
  return `${base}&${extra.toString()}`;
}

export function CaseMissingDataPanel({
  missingFields,
  caseId,
  guidedStep,
  className,
}: CaseMissingDataPanelProps) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const count = missingFields.length;

  if (count === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-care-success-border bg-care-success-bg px-4 py-3",
          className,
        )}
      >
        <p className="text-[13px] font-semibold text-care-success-text">Casusgegevens compleet</p>
        <p className="mt-0.5 text-[12px] text-care-success-text/70">Matching kan worden gestart.</p>
      </div>
    );
  }

  const triggerLabel =
    count === 1
      ? `${missingFields[0].label} ontbreekt`
      : `${count} verplichte onderdelen ontbreken`;

  const guidedProgress =
    guidedStep != null
      ? `${guidedStep} van ${count} onderdelen`
      : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-care-warning-border bg-care-warning-bg",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-semibold text-care-warning-text">
            {triggerLabel}
          </span>
          {guidedProgress && (
            <span className="mt-0.5 text-[11px] text-care-warning-text/60">{guidedProgress}</span>
          )}
        </div>
        {expanded ? (
          <ChevronDown size={15} className="shrink-0 text-care-warning-text/60" />
        ) : (
          <ChevronRight size={15} className="shrink-0 text-care-warning-text/60" />
        )}
      </button>

      <div
        id={panelId}
        role="region"
        aria-label="Aan te vullen casusgegevens"
        className={cn(
          "border-t border-care-warning-border/60 px-4 pb-4 pt-2",
          !expanded && "hidden",
        )}
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-care-warning-text/50">
          Nog aan te vullen
        </p>
        <ul className="space-y-0.5" role="list">
          {missingFields.map((field, index) => {
            const href = buildGuidedFieldUrl(caseId, field, index + 1, count);
            const isDone = guidedStep != null && index + 1 < guidedStep;
            return (
              <li key={field.id}>
                <a
                  href={href}
                  className="group flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-care-warning-solid/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-care-brand-solid"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Circle
                      size={13}
                      className={cn(
                        "shrink-0",
                        isDone ? "text-care-success-solid" : "text-care-warning-text/35",
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "text-[13px] font-medium",
                        isDone
                          ? "text-care-success-text line-through"
                          : "text-care-warning-text",
                      )}
                    >
                      {field.label}
                    </span>
                  </div>
                  <ChevronRight
                    size={12}
                    className="shrink-0 text-care-warning-text/35 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </a>
              </li>
            );
          })}
        </ul>
        {count > 1 && (
          <div className="mt-3 border-t border-care-warning-border/40 pt-3">
            <a
              href={buildGuidedFieldUrl(caseId, missingFields[0], 1, count)}
              className="inline-flex items-center gap-1.5 rounded-full border border-care-warning-border bg-background/60 px-3 py-1.5 text-[12px] font-medium text-care-warning-text transition-colors hover:bg-background/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-care-brand-solid"
            >
              Doorloop alle onderdelen
            </a>
          </div>
        )}
      </div>

      {/* Accessibility live region — announces when list becomes visible */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {expanded ? `${count} ontbrekende onderdelen zichtbaar.` : ""}
      </div>
    </div>
  );
}
