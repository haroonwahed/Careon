import { ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";

export type DominantActionTone = "calm" | "attention" | "urgent";

export type DominantActionPanelProps = {
  tone: DominantActionTone;
  title: string;
  description: string;
  primaryAction: {
    label: string;
    onClick: () => void;
    /** Defaults to `dominant-action-primary-cta`. */
    testId?: string;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    testId?: string;
  };
  /** Optional tertiary text link below the main row (e.g. “Bekijk casussen (n)”). */
  supplementalLink?: {
    label: string;
    onClick: () => void;
    testId?: string;
  };
  /**
   * Stable `data-testid` on the root `<section>` (route-specific, e.g. `regiekamer-dominant-action`).
   * Defaults to `dominant-action-panel`.
   */
  panelTestId?: string;
  /**
   * Extra `data-*` attributes on the root section. Use DOM keys, e.g. `{ "data-regiekamer-mode": "crisis" }`.
   */
  rootDataset?: Record<string, string | undefined>;
  className?: string;
};

const PRIMARY_CTA_DEFAULT_TESTID = "dominant-action-primary-cta";
const SECONDARY_CTA_DEFAULT_TESTID = "dominant-action-secondary-cta";
const SUPPLEMENTAL_LINK_DEFAULT_TESTID = "dominant-action-supplemental-link";

/**
 * Domain-agnostic “next best action” panel: title + description left, primary/secondary actions right (sm+).
 * Copy and workflows belong to the caller — this component is presentation only.
 */
export function DominantActionPanel({
  tone,
  title,
  description,
  primaryAction,
  secondaryAction,
  supplementalLink,
  panelTestId = "dominant-action-panel",
  rootDataset,
  className,
}: DominantActionPanelProps) {
  const borderTone =
    tone === "calm"
      ? "border-emerald-500/30 bg-emerald-950/15"
      : tone === "urgent"
        ? "border-red-500/30 bg-red-950/15"
        : "border-amber-500/35 bg-amber-950/15";

  const datasetProps = Object.fromEntries(
    Object.entries(rootDataset ?? {}).filter(([, v]) => v != null && v !== ""),
  ) as Record<string, string>;

  const primaryTestId = primaryAction.testId ?? PRIMARY_CTA_DEFAULT_TESTID;
  const secondaryTestId = secondaryAction?.testId ?? SECONDARY_CTA_DEFAULT_TESTID;
  const linkTestId = supplementalLink?.testId ?? SUPPLEMENTAL_LINK_DEFAULT_TESTID;

  return (
    <section
      data-component="care-dominant-action-panel"
      data-testid={panelTestId}
      className={cn("rounded-xl border px-4 py-5 sm:px-6 sm:py-6", borderTone, className)}
      {...datasetProps}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold leading-snug tracking-tight text-foreground sm:text-lg">{title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <Button
            type="button"
            data-testid={primaryTestId}
            size="default"
            className={cn(
              "h-10 gap-2 rounded-lg px-5 text-sm font-semibold shadow-sm",
              tone === "calm" &&
                "border border-emerald-500/40 bg-emerald-700 text-white hover:bg-emerald-700/90 dark:bg-emerald-800 dark:hover:bg-emerald-800/90",
            )}
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
            <ArrowRight size={16} className="shrink-0 opacity-95" aria-hidden />
          </Button>
          {secondaryAction && (
            <Button
              type="button"
              variant="outline"
              size="default"
              data-testid={secondaryTestId}
              className="h-10 gap-2 rounded-lg border-border/80 px-4 text-sm font-medium"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </div>
      {supplementalLink && (
        <button
          type="button"
          data-testid={linkTestId}
          className="mt-4 text-left text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          onClick={supplementalLink.onClick}
        >
          {supplementalLink.label}
        </button>
      )}
    </section>
  );
}
