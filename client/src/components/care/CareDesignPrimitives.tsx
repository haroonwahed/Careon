import { Children, Fragment, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { CARE_RHYTHM } from "../../lib/operationalRhythm";
import { CareAttentionSurface, CareInfoPopover } from "./CareUnifiedPage";
import { CareEmptyState } from "./CareSurface";
import { CareAppFrame } from "./CareAppFrame";
import { CarePageHeader } from "./CareSurface";

/** Authenticated content width + vertical rhythm — use for every care route. */
export { CareAppFrame as AppShell };

/** Compositional page shell with header → dominant → KPI → filters → content. */
export { CarePageScaffold } from "./CarePageScaffold";

/** Compact list/workspace title block (default page header across Zorg OS). */
export { CareUnifiedHeader as PageHeader } from "./CareUnifiedPage";

/** Full-width hero header with border-b — use sparingly for marketing-style surfaces. */
// PageHeroHeader alias removed — use CareUnifiedHeader instead

/**
 * List surfaces, filters, and work rows — single import path for care pages.
 * `FlowPhaseBadge` is the canonical keten phase chip (alias of `CanonicalPhaseBadge`).
 */
export { CARE_RHYTHM } from "../../lib/operationalRhythm";

export {
  CARE_UNIFIED_PAGE_STACK,
  CareAttentionBar,
  CareAttentionSurface,
  CareContextHint,
  CareInfoPopover,
  CareDominantStatus,
  CareFilterTabButton,
  CareFilterTabGroup,
  CareListRow,
  CareMetaChip,
  CareMetricBadge,
  CarePageTemplate,
  CarePrimaryList,
  CareSearchFiltersBar,
  CareSearchFiltersBar as CareSearchFilterBar,
  CareWorkRow,
  CareOperationalQueueHeader,
  CareQueueInlineAction,
  OPERATIONAL_QUEUE_GRID_CLASS,
  OPERATIONAL_QUEUE_GRID_COLS,
  OPERATIONAL_QUEUE_HEADER_GRID_CLASS,
  CanonicalPhaseBadge as FlowPhaseBadge,
  normalizeBoardColumnToPhaseId,
} from "./CareUnifiedPage";

export type { CareWorkRowProps } from "./CareUnifiedPage";

/** Empty list / zero-yet state — prefer over ad-hoc dashed boxes. */
export { CareEmptyState as EmptyState } from "./CareSurface";

/** Canonical workflow-status badge — maps CasusPhase to coloured chip with icon. */
export { CaseStatusBadge as CareStatusBadge } from "./CaseStatusBadge";

export type CareBadgeTone = "emerald" | "amber" | "red" | "blue" | "cyan" | "purple" | "muted";

const CARE_BADGE_TONE: Record<CareBadgeTone, { bg: string; text: string; border: string }> = {
  emerald: { bg: "var(--care-badge-green-bg)",   text: "var(--care-badge-green-text)",   border: "var(--care-badge-green-bg)" },
  amber:   { bg: "var(--care-badge-amber-bg)",   text: "var(--care-badge-amber-text)",   border: "var(--care-badge-amber-bg)" },
  red:     { bg: "var(--care-badge-red-bg)",     text: "var(--care-badge-red-text)",     border: "var(--care-badge-red-bg)" },
  blue:    { bg: "var(--care-badge-blue-bg)",    text: "var(--care-badge-blue-text)",    border: "var(--care-badge-blue-bg)" },
  cyan:    { bg: "var(--care-badge-blue-bg)",    text: "var(--care-badge-blue-text)",    border: "var(--care-badge-blue-bg)" },
  purple:  { bg: "var(--care-badge-purple-bg)",  text: "var(--care-badge-purple-text)",  border: "var(--care-badge-purple-bg)" },
  muted:   { bg: "var(--care-badge-muted-bg)",   text: "var(--care-badge-muted-text)",   border: "var(--border)" },
};

/** Canonical semantic status badge. Replaces ad-hoc coloured `<span>` chips across care pages. */
export function CareBadge({
  tone,
  children,
  className,
}: {
  tone: CareBadgeTone;
  children: import("react").ReactNode;
  className?: string;
}) {
  const { bg, text, border } = CARE_BADGE_TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[12px] font-semibold",
        className,
      )}
      style={{ backgroundColor: bg, color: text, borderColor: border }}
    >
      {children}
    </span>
  );
}

export type PriorityTone = "spoed" | "hoog" | "normaal";

/** Priority badge for operational work rows — 3 tones matching the Regiekamer target design. */
export function PriorityBadge({
  tone,
  className,
}: {
  tone: PriorityTone;
  className?: string;
}) {
  const styles: Record<PriorityTone, { dot: string; badge: string }> = {
    spoed:   { dot: "bg-red-400",   badge: "border-[var(--care-badge-red-bg)]   bg-[var(--care-badge-red-bg)]   text-[var(--care-badge-red-text)]" },
    hoog:    { dot: "bg-amber-400", badge: "border-[var(--care-badge-amber-bg)] bg-[var(--care-badge-amber-bg)] text-[var(--care-badge-amber-text)]" },
    normaal: { dot: "bg-muted-foreground/40", badge: "border-border/60 bg-muted/20 text-muted-foreground" },
  };
  const labels: Record<PriorityTone, string> = { spoed: "Spoed", hoog: "Hoog", normaal: "Normaal" };
  const { dot, badge } = styles[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        badge,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full flex-shrink-0", dot)} aria-hidden />
      {labels[tone]}
    </span>
  );
}

export type CasusWorkspaceStatusVariant = "active" | "blocked" | "progress";

/**
 * Status chips for casus workspace header — maps to operational readiness, not API enum alone.
 */
export function CasusWorkspaceStatusBadges({
  variant,
  hint,
}: {
  variant: CasusWorkspaceStatusVariant;
  hint?: string | null;
}) {
  return (
    <>
      {variant === "blocked" && (
        <Badge className="border bg-care-urgent-bg text-care-urgent-text border-care-urgent-border text-[12px] font-semibold">Geblokkeerd</Badge>
      )}
      {variant === "active" && (
        <Badge className="border bg-care-success-bg text-care-success-text border-care-success-border text-[12px] font-semibold">Actief</Badge>
      )}
      {variant === "progress" && (
        <Badge className="border bg-care-info-bg text-care-info-text border-care-info-border text-[12px] font-semibold">In behandeling</Badge>
      )}
      {hint && variant === "blocked" ? (
        <Badge
          className={cn(
            "max-w-[min(100%,20rem)] truncate border text-[12px] font-semibold",
            /matching/i.test(hint)
              ? "bg-care-warning-bg text-care-warning-text border-care-warning-border"
              : "bg-care-urgent-bg text-care-urgent-text border-care-urgent-border",
          )}
          title={hint}
        >
          {hint}
        </Badge>
      ) : null}
    </>
  );
}

/**
 * Loading — one pattern for list/detail async shells (a11y: busy + status).
 * Deferred by 150 ms to suppress flicker on fast responses (local dev, warm cache).
 */
export function LoadingState({
  title = "Laden…",
  copy,
  className,
  delayMs = 150,
}: {
  title?: ReactNode;
  copy?: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const [visible, setVisible] = useState(delayMs === 0);
  useEffect(() => {
    if (delayMs === 0) return;
    const id = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);

  if (!visible) return null;

  return (
    <div role="status" aria-busy="true" aria-live="polite" data-testid="care-loading-state">
      <CareEmptyState title={title} copy={copy} className={className} />
    </div>
  );
}

/**
 * Recoverable error — always pair with a secondary “Opnieuw” when refetch exists.
 */
export function ErrorState({
  title = "Laden mislukt",
  copy,
  action,
  className,
}: {
  title?: ReactNode;
  copy?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" data-testid="care-error-state">
      <CareEmptyState title={title} copy={copy} action={action} className={className} />
    </div>
  );
}

/**
 * Single dominant CTA per surface — use for the one next-best action in a page or band.
 */
export function PrimaryActionButton({ className, children, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="default"
      data-component="primary-action"
      className={cn(
        "h-10 min-h-10 rounded-full px-5 text-[13px] font-semibold shadow-[var(--care-shadow-control)]",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

export function BlockingNotice({
  title = "Je kunt nog niet verder",
  message,
  className,
  tone = "critical",
}: {
  title?: string;
  message: ReactNode;
  className?: string;
  tone?: "critical" | "warning" | "info";
}) {
  const variant = tone === "critical" ? "critical" : tone === "warning" ? "attention" : "neutral";
  const iconClass =
    tone === "critical"
      ? "text-destructive"
      : tone === "warning"
        ? "text-care-warning-solid"
        : "text-muted-foreground";
  return (
    <CareAttentionSurface
      role="alert"
      variant={variant}
      density="compact"
      className={cn(className)}
      title={title}
      message={message}
      icon={<AlertTriangle size={16} className={iconClass} aria-hidden />}
    />
  );
}

type CareSectionTone = "default" | "muted" | "context" | "workspace" | "elevated";
type CareAlertTone = "critical" | "warning" | "info" | "success";

const CARE_SECTION_TONE_CLASSES: Record<CareSectionTone, string> = {
  default: "surface-section border border-border/60 bg-card/45 shadow-sm",
  muted: "border border-border/60 bg-card/40 shadow-sm",
  context: "surface-context border border-border/60 bg-card/40 shadow-sm",
  workspace: "surface-workspace overflow-hidden border border-border/60 bg-card/45 shadow-sm",
  elevated: "panel-surface border border-border/60 bg-card/50 shadow-sm",
};

const CARE_ALERT_TONE_CLASSES: Record<
  CareAlertTone,
  {
    shell: string;
    icon: string;
    metric: string;
  }
> = {
  critical: {
    shell: "care-dominant-focus care-alert-shell care-alert-shell--critical",
    icon: "border bg-care-urgent-bg text-care-urgent-text border-care-urgent-border",
    metric: "text-care-urgent-solid",
  },
  warning: {
    shell: "care-dominant-focus care-alert-shell care-alert-shell--warning",
    icon: "border bg-care-warning-bg text-care-warning-text border-care-warning-border",
    metric: "text-care-warning-solid",
  },
  info: {
    shell: "care-dominant-focus care-alert-shell care-alert-shell--info",
    icon: "border bg-care-info-bg text-care-info-text border-care-info-border",
    metric: "text-care-info-solid",
  },
  success: {
    shell: "care-dominant-focus care-alert-shell care-alert-shell--success",
    icon: "border bg-care-success-bg text-care-success-text border-care-success-border",
    metric: "text-care-success-solid",
  },
};

export function CareSection({
  children,
  tone = "default",
  className,
  testId,
  ...props
}: {
  children: ReactNode;
  tone?: CareSectionTone;
  className?: string;
  testId?: string;
} & ComponentProps<"section">) {
  return (
    <section
      data-testid={testId}
      className={cn("rounded-[22px] p-4 md:p-5", CARE_SECTION_TONE_CLASSES[tone], className)}
      {...props}
    >
      {children}
    </section>
  );
}

/**
 * @deprecated Use `<CareSection tone="elevated">` instead.
 * CarePanel is kept as a thin alias to avoid breaking existing callers.
 * Migrate callsites when touching the surrounding file.
 */
export function CarePanel({
  children,
  className,
  testId,
  ...props
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
} & ComponentProps<"section">) {
  return (
    <CareSection tone="elevated" className={className} testId={testId} {...props}>
      {children}
    </CareSection>
  );
}

export function CareSectionHeader({
  eyebrow,
  title,
  action,
  meta,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("care-section-header flex flex-col lg:flex-row lg:items-start lg:justify-between", className)}>
      <div className="min-w-0 shrink-0 space-y-1.5 lg:min-w-[12rem] lg:max-w-[min(100%,28rem)]">
        {eyebrow ? (
          <p className="care-text-eyebrow text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h2 className="care-text-title text-foreground">{title}</h2>
      </div>
      {(meta || action) ? (
        <div className="flex w-full min-w-0 flex-col items-stretch gap-2 lg:w-auto lg:max-w-none lg:flex-1 lg:items-end">
          {meta ? <div className="min-w-0 w-full">{meta}</div> : null}
          {action ? <div className="flex flex-wrap items-center justify-end gap-2">{action}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export function CareSectionBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("care-section-body", className)}>{children}</div>;
}


/** Tonal select for operational filter bars (werklijst headers). */
export const CARE_OPERATIONAL_SELECT_CLASS =
  "care-op-select h-10 w-full rounded-xl px-3 text-sm text-foreground";

export function CareOperationalSelect({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(CARE_OPERATIONAL_SELECT_CLASS, className)} {...props} />;
}

/**
 * Primary work surface — header / body / footer padding without manual `p-0` splits.
 * Use `bodyBleedX` when the list card should span edge-to-edge (e.g. coördinatie grid).
 */
export function CareWorkspaceSection({
  header,
  children,
  footer,
  bodyBleedX = false,
  bodyClassName,
  className,
  testId,
  ...props
}: {
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  bodyBleedX?: boolean;
  bodyClassName?: string;
  testId?: string;
  className?: string;
} & Omit<ComponentProps<"section">, "children">) {
  return (
    <CareSection tone="workspace" className={cn(CARE_RHYTHM.quietGap, "p-0 md:p-0", className)} testId={testId} {...props}>
      <div className="care-workspace-section__header">{header}</div>
      <CareSectionBody
        className={cn(
          "care-workspace-section__body mt-0",
          CARE_RHYTHM.zoneStack,
          bodyBleedX && "care-workspace-section__body--bleed-x",
          bodyClassName,
        )}
      >
        {children}
      </CareSectionBody>
      {footer ? <div className="care-workspace-section__footer">{footer}</div> : null}
    </CareSection>
  );
}

export function CareAlertCard({
  tone,
  icon,
  metric,
  title,
  description,
  supportingLink,
  primaryAction,
  secondaryAction,
  density = "default",
  showMetric = true,
  className,
  testId,
  ...props
}: {
  tone: CareAlertTone;
  icon: ReactNode;
  metric: ReactNode;
  title: ReactNode;
  description: ReactNode;
  supportingLink?: ReactNode;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
  density?: "default" | "compact";
  /** When false, title stands alone without a hero metric (orchestration surfaces). */
  showMetric?: boolean;
  className?: string;
  testId?: string;
} & ComponentProps<"section">) {
  const toneClasses = CARE_ALERT_TONE_CLASSES[tone];
  const isCompact = density === "compact";
  return (
    <section
      data-component="care-dominant-action-panel"
      data-testid={testId}
      className={cn(
        "px-4 py-3 md:px-5",
        isCompact ? "rounded-[1.5rem]" : "rounded-xl",
        toneClasses.shell,
        className,
      )}
      data-density={density}
      aria-live="polite"
      {...props}
    >
      <div className="relative z-10 grid grid-cols-1 items-start gap-4 md:grid-cols-[56px_minmax(12rem,1fr)_auto] md:items-center">
        <div
          data-testid={testId ? `${testId}-icon` : undefined}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border",
            isCompact ? "h-11 w-11" : "h-14 w-14",
            toneClasses.icon,
          )}
        >
          {icon}
        </div>
        <div data-testid={testId ? `${testId}-content` : undefined} className="min-w-0 max-w-full self-center">
          <h2
            className={cn(
              "font-medium leading-tight text-foreground",
              showMetric
                ? isCompact
                  ? "flex flex-col gap-0.5 text-[16px] md:text-[17px]"
                  : "flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[22px]"
                : "text-[17px] font-semibold",
            )}
          >
            {showMetric ? (
              <span
                data-testid={testId ? `${testId}-metric` : undefined}
                className={cn(
                  "font-semibold leading-none tracking-[-0.03em]",
                  isCompact ? "text-[16px] md:text-[17px]" : "text-[30px]",
                  toneClasses.metric,
                )}
              >
                {metric}
              </span>
            ) : null}
            <span>{title}</span>
          </h2>
          {description ? (
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div
          data-testid={testId ? `${testId}-actions` : undefined}
          className="flex shrink-0 flex-wrap items-center justify-end gap-2 self-center"
        >
          {primaryAction}
          {secondaryAction ? secondaryAction : null}
          {supportingLink ? <div className="w-full text-left md:text-right">{supportingLink}</div> : null}
        </div>
      </div>
    </section>
  );
}

export function CareFlowStepCard({
  icon,
  metric,
  subtitle,
  title,
  active = false,
  completed = false,
  isBottleneck = false,
  onClick,
  testId,
}: {
  icon: ReactNode;
  metric: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
  active?: boolean;
  completed?: boolean;
  /** Highlights this step as the current flow bottleneck (non-zero count + active phase). */
  isBottleneck?: boolean;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "care-flow-step__card group flex h-full w-full flex-col gap-0.5 rounded-xl px-2.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
        active && "care-flow-step__card--active",
        completed && !active && "care-flow-step__card--completed",
        isBottleneck && "ring-1 ring-[var(--care-badge-amber-bg)]",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden>
            {icon}
          </span>
          <div className="min-w-0">
            <span className="block truncate text-[13px] font-medium leading-tight text-foreground">{title}</span>
            {subtitle != null ? (
              <span className="mt-0.5 block text-[10px] font-medium leading-none text-primary">
                {subtitle}
              </span>
            ) : null}
          </div>
        </div>
        {metric != null ? (
          <span className={cn(
            "shrink-0 text-[16px] font-semibold leading-none tabular-nums",
            isBottleneck && typeof metric === "number" && metric > 0
              ? "text-[var(--care-badge-amber-text)]"
              : active ? "text-foreground" : "text-muted-foreground",
          )}>
            {metric}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function CareFlowBoard({
  children,
  className,
  testId,
  variant = "grid",
  activeStepIndex = 0,
  stepCount,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
  /** `pipeline`: horizontal orchestration lane (coördinatie / Casussen doorstroom). */
  variant?: "grid" | "pipeline";
  /** Highlights left-to-right progression on the connective track (0-based). */
  activeStepIndex?: number;
  stepCount?: number;
}) {
  if (variant === "pipeline") {
    const items = Children.toArray(children).filter(Boolean);
    const total = stepCount ?? items.length;
    const progressPct =
      total <= 1 ? 0 : Math.min(100, Math.max(8, (activeStepIndex / (total - 1)) * 100));
    return (
      <div
        data-testid={testId}
        className={cn("care-flow-pipeline", className)}
        role="list"
        aria-label="Doorstroom per fase"
      >
        <div className="care-flow-pipeline__track hidden md:block" aria-hidden />
        <div
          className="care-flow-pipeline__progress hidden md:block"
          style={{ width: `${progressPct}%` }}
          aria-hidden
        />
        <div className="relative z-[1] flex flex-col gap-3 md:flex-row md:flex-wrap md:items-stretch lg:flex-nowrap lg:gap-0">
          {items.map((child, i) => (
            <Fragment key={i}>
              {i > 0 ? (
                <div className="care-flow-connector" aria-hidden>
                  <span className="care-flow-connector__bar" />
                </div>
              ) : null}
              <div className="care-flow-step min-w-0 flex-1 basis-[calc(50%-0.25rem)] lg:basis-0" role="listitem">
                {child}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    );
  }

  const items = Children.toArray(children).filter(Boolean);
  const cols = stepCount ?? items.length;
  return (
    <div
      data-testid={testId}
      className={cn("grid gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

/** Trade-off comparison for matching recommendations. Each item has a label and a tone. */
export interface CareTradeoffItem {
  label: string;
  tone?: "positive" | "negative" | "neutral";
  detail?: string;
}

/**
 * Structured trade-off list for matching explainability.
 * Shows pros (positive), cons (negative), and neutral constraints.
 * Never imply certainty — always show why a provider may be preferable OR less suitable.
 */
export function CareTradeoffList({
  items,
  className,
  heading,
}: {
  items: CareTradeoffItem[];
  className?: string;
  heading?: string;
}) {
  if (items.length === 0) {
    return null;
  }
  const positives = items.filter((i) => i.tone === "positive");
  const negatives = items.filter((i) => i.tone === "negative");
  const neutrals = items.filter((i) => !i.tone || i.tone === "neutral");

  const renderGroup = (group: CareTradeoffItem[], icon: string, itemClass: string) =>
    group.map((item) => (
      <li key={item.label} className={cn("flex min-w-0 items-start gap-2", itemClass)}>
        <span className="mt-px shrink-0 text-[12px]" aria-hidden>{icon}</span>
        <span className="min-w-0">
          <span className="text-[13px]">{item.label}</span>
          {item.detail && (
            <span className="ml-1 text-[12px] text-muted-foreground">— {item.detail}</span>
          )}
        </span>
      </li>
    ));

  return (
    <div className={cn("space-y-2", className)}>
      {heading && (
        <p className="care-text-eyebrow text-muted-foreground/70">{heading}</p>
      )}
      <ul className="space-y-1.5">
        {renderGroup(positives, "＋", "text-[var(--care-badge-green-text)]")}
        {renderGroup(negatives, "−", "text-[var(--care-badge-red-text)]")}
        {renderGroup(neutrals, "·", "text-muted-foreground")}
      </ul>
    </div>
  );
}

/**
 * Match score display — shows numeric score with advisory label.
 * Matching is advisory only; never present the score as a certainty.
 */
export function CareMatchScore({
  score,
  maxScore = 100,
  advisoryLabel,
  className,
}: {
  score: number;
  maxScore?: number;
  advisoryLabel?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round((score / maxScore) * 100)));
  const tone = pct >= 70 ? "var(--care-badge-green-text)" : pct >= 45 ? "var(--care-badge-amber-text)" : "var(--care-badge-red-text)";
  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className="text-[22px] font-bold tabular-nums" style={{ color: tone }}>
        {pct}
      </span>
      <span className="text-[12px] text-muted-foreground">/100</span>
      {advisoryLabel && (
        <span className="text-[12px] font-medium text-muted-foreground">{advisoryLabel}</span>
      )}
    </div>
  );
}

export function CareWorkListCard({
  header,
  children,
  className,
  testId,
}: {
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        CARE_RHYTHM.queueShell,
        // `min-w-0` + horizontal scroll: wide grid rows (e.g. Werkvoorraad min-w-[980px]) stay usable beside rails / narrow main columns.
        "overflow-x-auto rounded-[22px] border border-border/60 bg-card/45 shadow-sm",
        className,
      )}
    >
      {header ? (
        <div className={cn(CARE_RHYTHM.queueHeader, "min-w-0 border-b border-border/30 bg-transparent")}>{header}</div>
      ) : null}
      <div className={cn(CARE_RHYTHM.queueRows)}>{children}</div>
    </div>
  );
}
