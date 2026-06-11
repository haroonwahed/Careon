import { Children, Fragment, type ComponentProps, type ReactNode } from "react";
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
export { CarePageHeader as PageHeroHeader };

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
        <Badge className="border-destructive/30 bg-destructive/10 text-[12px] font-semibold text-destructive">Geblokkeerd</Badge>
      )}
      {variant === "active" && (
        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-[12px] font-semibold text-emerald-300">Actief</Badge>
      )}
      {variant === "progress" && (
        <Badge className="border-blue-500/30 bg-blue-500/10 text-[12px] font-semibold text-blue-300">In behandeling</Badge>
      )}
      {hint && variant === "blocked" ? (
        <Badge
          className={cn(
            "max-w-[min(100%,20rem)] truncate text-[12px] font-semibold",
            /matching/i.test(hint)
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
              : "border-destructive/30 bg-destructive/10 text-destructive",
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
 */
export function LoadingState({
  title = "Laden…",
  copy,
  className,
}: {
  title?: ReactNode;
  copy?: ReactNode;
  className?: string;
}) {
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
      className={cn(
        "h-10 min-h-10 rounded-xl px-5 text-[13px] font-semibold shadow-md",
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
}: {
  title?: ReactNode;
  message: ReactNode;
  className?: string;
}) {
  return (
    <CareAttentionSurface
      role="alert"
      variant="critical"
      density="compact"
      className={cn(className)}
      title={title}
      message={message}
      icon={<AlertTriangle size={16} className="text-destructive" aria-hidden />}
    />
  );
}

type CareSectionTone = "default" | "muted" | "context" | "workspace";
type CareAlertTone = "critical" | "warning" | "info" | "success";

const CARE_SECTION_TONE_CLASSES: Record<CareSectionTone, string> = {
  default: "surface-section border border-border/60 bg-card/45 shadow-sm",
  muted: "rounded-[22px] border border-border/60 bg-card/40 p-4 shadow-sm md:p-5",
  context: "surface-context border border-border/60 bg-card/40 shadow-sm",
  workspace: "surface-workspace overflow-hidden border border-border/60 bg-card/45 shadow-sm",
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
    icon: "border border-yellow-500/15 bg-yellow-500/10 text-yellow-100",
    metric: "text-yellow-100",
  },
  warning: {
    shell: "care-dominant-focus care-alert-shell care-alert-shell--warning",
    icon: "border border-yellow-500/12 bg-yellow-500/8 text-yellow-100",
    metric: "text-yellow-100",
  },
  info: {
    shell: "care-dominant-focus care-alert-shell care-alert-shell--info",
    icon: "border border-sky-500/20 bg-sky-500/10 text-sky-100",
    metric: "text-sky-100",
  },
  success: {
    shell: "care-dominant-focus care-alert-shell care-alert-shell--success",
    icon: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
    metric: "text-emerald-100",
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
    <section
      data-testid={testId}
      className={cn("panel-surface rounded-[22px] border border-border/60 bg-card/50 shadow-sm", className)}
      {...props}
    >
      {children}
    </section>
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
  description?: ReactNode;
  descriptionAriaLabel?: string;
  descriptionTestId?: string;
  action?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("care-section-header flex flex-col lg:flex-row lg:items-start lg:justify-between", className)}>
      <div className="min-w-0 shrink-0 space-y-1.5 lg:min-w-[12rem] lg:max-w-[min(100%,28rem)]">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h2 className="text-[22px] font-semibold tracking-tight text-foreground">{title}</h2>
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
  onClick,
  testId,
}: {
  icon: ReactNode;
  metric: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
  active?: boolean;
  completed?: boolean;
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
          <span className={cn("shrink-0 text-[16px] font-semibold leading-none tabular-nums", active ? "text-foreground" : "text-muted-foreground")}>
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
                  <span className="care-flow-connector__dot" />
                  <span className="care-flow-connector__stem" />
                  <span className="care-flow-connector__dot" />
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

  return (
    <div
      data-testid={testId}
      className={cn("grid gap-2 md:grid-cols-[repeat(4,minmax(0,1fr))]", className)}
    >
      {children}
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
