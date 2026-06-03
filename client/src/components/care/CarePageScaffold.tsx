import type { ReactNode } from "react";
import { cn } from "../ui/utils";
import { CARE_RHYTHM } from "../../lib/operationalRhythm";
import { CarePageTemplate, CareUnifiedHeader } from "./CareUnifiedPage";
import type { CarePageArchetype } from "../../lib/pageArchetypes";

export type { CarePageArchetype } from "../../lib/pageArchetypes";

export type CarePageScaffoldProps = {
  archetype: CarePageArchetype;
  /** Default `care-page-scaffold`. */
  testId?: string;
  className?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Small label above the title row (optional). */
  eyebrow?: ReactNode;
  titleClassName?: string;
  subtitleClassName?: string;
  /** Optional test id for the page subtitle info trigger (when `subtitle` is set). */
  subtitleInfoTestId?: string;
  subtitleAriaLabel?: string;
  /** Right column on `CareUnifiedHeader` (refresh, etc.). */
  actions?: ReactNode;
  /** Status/metric row below the title row (e.g. `CareMetricBadge`) — same as `CareUnifiedHeader.metric`. */
  metric?: ReactNode;
  /** Page-level NBA / attention (e.g. `DominantActionPanel`) — above `kpiStrip`. */
  dominantAction?: ReactNode;
  /** Block KPI strip below dominant action, above filters (e.g. coördinatie `metric-strip`). */
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
  eyebrow,
  titleClassName,
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
      <div className={cn(CARE_RHYTHM.attentionStack, dominantAction && kpiStrip && "pb-0.5")}>
        {dominantAction}
        {kpiStrip ? <div className="opacity-95">{kpiStrip}</div> : null}
      </div>
    ) : undefined;

  const headerNode = (
    <div data-testid="care-page-header">
      {eyebrow ? (
        <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</div>
      ) : null}
      <CareUnifiedHeader
        title={title}
        metric={metric}
        actions={actions}
        titleClassName={titleClassName}
      />
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
