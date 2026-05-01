import type { ReactNode } from "react";
import { cn } from "../ui/utils";
import { CarePageTemplate, CareUnifiedHeader } from "./CareUnifiedPage";

/** Page archetypes for analytics, E2E, and generator docs — not a behavioral switch inside the scaffold. */
export type CarePageArchetype = "decision" | "worklist" | "signal-action" | "exception";

export type CarePageScaffoldProps = {
  archetype: CarePageArchetype;
  /** Default `care-page-scaffold`. */
  testId?: string;
  className?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Small label above the title row (optional). */
  eyebrow?: ReactNode;
  /** Right column on `CareUnifiedHeader` (refresh, etc.). */
  actions?: ReactNode;
  /** Inline metric under subtitle (e.g. `CareMetricBadge`) — same as `CareUnifiedHeader.metric`. */
  metric?: ReactNode;
  /** Page-level NBA / attention (e.g. `DominantActionPanel`) — above `kpiStrip`. */
  dominantAction?: ReactNode;
  /** Block KPI strip below dominant action, above filters (e.g. Regiekamer `metric-strip`). */
  kpiStrip?: ReactNode;
  filters?: ReactNode;
  /** Collapsible or static insights below main content. */
  insights?: ReactNode;
  children: ReactNode;
};

/**
 * Compositional Care Shell page wrapper: stable test ids + contract order over `CarePageTemplate`.
 * Domain copy and data live in the route; this primitive only orchestrates layout slots.
 *
 * Order: header → dominant → KPI strip → filters → content → insights.
 *
 * @see PAGE_GENERATOR_PATTERN.md
 */
export function CarePageScaffold({
  archetype,
  testId = "care-page-scaffold",
  className,
  title,
  subtitle,
  eyebrow,
  actions,
  metric,
  dominantAction,
  kpiStrip,
  filters,
  insights,
  children,
}: CarePageScaffoldProps) {
  const attention =
    dominantAction || kpiStrip ? (
      <div className={cn(dominantAction && kpiStrip && "space-y-4")}>
        {dominantAction}
        {kpiStrip}
      </div>
    ) : undefined;

  const headerNode = (
    <div data-testid="care-page-header">
      {eyebrow ? (
        <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</div>
      ) : null}
      <CareUnifiedHeader title={title} subtitle={subtitle} metric={metric} actions={actions} />
    </div>
  );

  return (
    <div data-testid={testId} data-care-page-archetype={archetype} className="contents">
      <CarePageTemplate className={className} header={headerNode} attention={attention} filters={filters}>
        <div data-testid="care-page-content">{children}</div>
        {insights ? <div data-testid="care-page-insights">{insights}</div> : null}
      </CarePageTemplate>
    </div>
  );
}
