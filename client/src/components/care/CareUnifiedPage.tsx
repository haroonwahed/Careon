import { useId, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Info, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../ui/utils";
import { tokens } from "../../design/tokens";
import { CARE_RHYTHM } from "../../lib/operationalRhythm";
import {
  decisionUiPhaseBadgeLabel,
  decisionUiPhaseBadgeShellClass,
  mapApiPhaseToDecisionUiPhase,
  normalizeApiPhaseId,
} from "../../lib/decisionPhaseUi";

/** Vertical rhythm for unified care list pages (header → optional attention → filters → list). */
export const CARE_UNIFIED_PAGE_STACK = CARE_RHYTHM.pageStack;

/**
 * Shared list-page shell: header, optional attention strip, optional filters, then main content
 * (loading / empty / error / primary list). Keeps spacing consistent across care workspace routes.
 */
export function CarePageTemplate({
  header,
  attention,
  filters,
  children,
  className,
}: {
  header: ReactNode;
  attention?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(CARE_RHYTHM.pageStack, className)}>
      <div className={CARE_RHYTHM.zoneHeader}>{header}</div>
      {attention ? <div className={CARE_RHYTHM.zoneAlert}>{attention}</div> : null}
      {filters ? <div className={CARE_RHYTHM.zoneControl}>{filters}</div> : null}
      <div className={CARE_RHYTHM.zoneMain}>{children}</div>
    </div>
  );
}

export function CareMetricBadge({ children }: { children: ReactNode }) {
  return (
    <span
      title="Status — geen actie"
      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/55 px-3 py-1 text-[12px] font-semibold leading-none text-muted-foreground shadow-sm"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
      {children}
    </span>
  );
}

/**
 * Page/section explanatory copy behind a single info trigger — keeps headers compact (Design Constitution density).
 */
export function CareInfoPopover({
  children,
  ariaLabel,
  testId,
  align = "start",
  side = "bottom",
  contentClassName,
  triggerClassName,
}: {
  children: ReactNode;
  ariaLabel: string;
  testId?: string;
  align?: "center" | "start" | "end";
  side?: "top" | "bottom" | "left" | "right";
  contentClassName?: string;
  triggerClassName?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            triggerClassName,
          )}
          aria-label={ariaLabel}
        >
          <Info className="size-[18px]" strokeWidth={2} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className={cn(
          "w-80 max-w-[min(100vw-2rem,22rem)] border-border/60 bg-popover text-popover-foreground shadow-md",
          contentClassName,
        )}
      >
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/15 px-3 py-2 text-[13px] leading-6 text-muted-foreground">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CareMetaChip({
  children,
  className,
  title: titleAttr,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      data-component="care-meta-chip"
      title={titleAttr}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-card/55 px-2.5 py-0.5 text-[11px] font-medium leading-none text-muted-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Dominant status / problem label (middle column of work rows). */
export function CareDominantStatus({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      data-component="care-dominant-status"
      className={cn(
        "inline-flex max-w-full items-center rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[12px] font-semibold leading-tight text-foreground shadow-sm",
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Maps workboard column ids (hyphen) to canonieke keten phase ids (underscore). */
export function normalizeBoardColumnToPhaseId(boardColumn: string): string {
  return boardColumn.replace(/-/g, "_");
}

/** Beslissingsfase (4 ketenslagen) — API-fase wordt alleen gemapt voor weergave. */
export function CanonicalPhaseBadge({ phaseId }: { phaseId: string }) {
  const normalized = normalizeApiPhaseId(
    phaseId.includes("-") ? normalizeBoardColumnToPhaseId(phaseId) : phaseId,
  );
  const decisionId = mapApiPhaseToDecisionUiPhase(normalized);
  const label = decisionUiPhaseBadgeLabel(decisionId);
  return (
    <span
      data-testid="zorg-os-flow-phase-badge"
      data-component="canonical-phase-badge"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold leading-none tracking-tight",
        decisionUiPhaseBadgeShellClass(decisionId),
      )}
      style={{ maxWidth: tokens.layout.phaseBadgeMaxWidth }}
      title="Stap in de keten (vier beslissingen)"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current opacity-90" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function CareContextHint({
  icon,
  title,
  copy,
}: {
  icon: ReactNode;
  title: ReactNode;
  copy: ReactNode;
}) {
  return (
    <div
      data-component="care-context-hint"
      className="care-hover-card mt-6 rounded-xl border border-border/70 bg-card/35 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <div className="icon-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70">{icon}</div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[13px] text-muted-foreground">{copy}</p>
        </div>
      </div>
    </div>
  );
}

export function CareUnifiedHeader({
  title,
  metric,
  actions,
  titleClassName,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  metric?: ReactNode;
  actions?: ReactNode;
  titleClassName?: string;
  subtitleClassName?: string;
  subtitleInfoTestId?: string;
  subtitleAriaLabel?: string;
}) {
  return (
    <section
      data-testid="care-unified-header"
      className={cn(
        "space-y-1.5 rounded-[24px] border border-border/60 bg-card/45 px-4 py-4 shadow-sm backdrop-blur-[2px]",
        CARE_RHYTHM.zoneHeader,
      )}
    >
      {/* Row 1: title (+ optional info) and actions — row 2: status/metric pills always below title row */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
            <h1
              className={cn(
                "min-w-0 font-semibold tracking-tight text-foreground",
                titleClassName ?? "text-[30px] sm:text-[34px] lg:text-[36px]",
              )}
            >
              <span className="min-w-0">{title}</span>
            </h1>
          </div>
          {actions ? (
            <div className="flex flex-col items-start gap-1 md:shrink-0 md:items-end">{actions}</div>
          ) : null}
        </div>
        {metric ? <div className="flex w-full min-w-0 flex-wrap items-center gap-2">{metric}</div> : null}
      </div>
    </section>
  );
}

export function CareAttentionBar({
  visible = true,
  tone = "warning",
  message,
  action,
  icon,
  layout = "default",
}: {
  visible?: boolean;
  tone?: "warning" | "info" | "critical";
  message: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  /** `compact` = flat queue band without hero chrome (operational queues). */
  layout?: "default" | "compact";
}) {
  if (!visible) return null;
  const isCompact = layout === "compact";
  const accent =
    tone === "critical" ? "border-l-red-500/80" : tone === "warning" ? "border-l-amber-500/70" : "border-l-border";
  return (
    <div
      data-component="care-attention-bar"
      data-layout={isCompact ? "compact" : "default"}
      className={cn(
        "flex min-h-[44px] items-center justify-between gap-3 border-l-2",
        isCompact
          ? "border-b border-border/40 bg-muted/10 px-4 py-2"
          : "min-h-[52px] rounded-xl bg-muted/20 px-3 py-2.5 shadow-sm",
        accent,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {icon ? <div className="shrink-0 text-muted-foreground">{icon}</div> : null}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Operatieve aandacht</p>
          <p className={cn("text-foreground", isCompact ? "truncate text-[13px]" : "truncate text-sm")}>{message}</p>
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center justify-end">{action}</div> : null}
    </div>
  );
}

/** Compact outline action for queue attention bands — not a hero CTA. */
export function CareQueueInlineAction({ className, children, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 shrink-0 rounded-lg px-3 text-[12px] font-medium", className)}
      {...props}
    >
      {children}
    </Button>
  );
}

/**
 * Segmented tabs for workload-style pages (Casussen). Same chrome as the shared search bar family.
 * Later: Zorgaanbieders, Regio’s, Signalen can reuse this shell.
 */
export function CareFilterTabGroup({
  children,
  className,
  style,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex w-full max-w-full flex-wrap rounded-2xl border border-border/60 bg-muted/35 p-0.5",
        className,
      )}
      style={{ minHeight: tokens.searchControl.tabHeight, ...style }}
    >
      {children}
    </div>
  );
}

export function CareFilterTabButton({
  selected,
  onClick,
  children,
  accentSelected = false,
  accentHex,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Strong purple selection (Casussen mock-style tabs); default keeps subtle card fill elsewhere. */
  accentSelected?: boolean;
  /** Optional brand fill when `accentSelected` (provided via design tokens). */
  accentHex?: string;
}) {
  const brandActive = Boolean(selected && accentSelected && accentHex);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      style={
        brandActive
          ? {
              backgroundColor: accentHex,
              color: "hsl(var(--primary-foreground))",
              borderColor: accentHex,
            }
          : undefined
      }
      className={cn(
        "h-9 min-w-[4.75rem] flex-1 rounded-xl px-3 text-[13px] font-medium transition-colors sm:flex-none sm:px-4",
        selected
          ? accentSelected && accentHex
            ? "shadow-sm ring-1 ring-white/20"
            : accentSelected
              ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/35"
              : "bg-card text-foreground shadow-sm ring-1 ring-border/50"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Single shared search + optional Meer filters + optional header tabs + optional right action.
 * Keep visual tokens aligned across coördinatie, Casussen, Matching, Acties (and other care lists).
 */
export function CareSearchFiltersBar({
  tabs,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  showSecondaryFilters,
  onToggleSecondaryFilters,
  secondaryFiltersLabel = "Meer filters",
  secondaryFilters,
  rightAction,
  showSecondaryFiltersToggle = true,
  /** `workspace`: tonal controls for primary werklijst surfaces (less border reliance). */
  variant = "default",
  className,
}: {
  /** Optional segmented control row above the search field (e.g. Casussen triage tabs). */
  tabs?: ReactNode;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  showSecondaryFilters?: boolean;
  onToggleSecondaryFilters?: () => void;
  secondaryFiltersLabel?: string;
  secondaryFilters?: ReactNode;
  /** Optional primary action aligned with the search row (e.g. Nieuwe casus). */
  rightAction?: ReactNode;
  /** When false, hide the search-row toggle (e.g. Casussen moves “Filters” next to tabs). */
  showSecondaryFiltersToggle?: boolean;
  variant?: "default" | "workspace";
  className?: string;
}) {
  const canToggleMore = Boolean(onToggleSecondaryFilters);
  const expanded = Boolean(showSecondaryFilters && canToggleMore);
  const showToggle = canToggleMore && showSecondaryFiltersToggle;
  const secondaryFiltersId = useId();

  return (
    <section
      data-testid="care-search-control-stack"
      className={cn(CARE_RHYTHM.searchStack, "px-1", className)}
    >
      {tabs ? <div className="w-full min-w-0">{tabs}</div> : null}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <div
          className={cn(
            "flex w-full min-w-0 flex-1 items-center gap-2.5 px-3 shadow-sm",
            variant === "workspace"
              ? "care-op-search-field"
              : "border border-border/60 bg-card/55",
          )}
          style={{
            minHeight: tokens.searchControl.rowMinHeight,
            borderRadius: tokens.searchControl.radius,
          }}
        >
          <Search className="pointer-events-none shrink-0 text-muted-foreground" size={16} aria-hidden />
          <Input
            type="search"
            data-testid="care-search-input"
            aria-label={searchPlaceholder}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] leading-normal text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
          {showToggle ? (
            <button
              type="button"
              data-testid="care-more-filters-toggle"
              onClick={onToggleSecondaryFilters}
              aria-expanded={expanded}
              aria-controls={secondaryFiltersId}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border/60 bg-card/35 px-3 text-[13px] font-medium text-primary shadow-sm transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              {secondaryFiltersLabel}
              {showSecondaryFilters ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            </button>
          ) : null}
          {rightAction ? <div className="flex items-center gap-2">{rightAction}</div> : null}
        </div>
      </div>

      {expanded ? (
        <div
          id={secondaryFiltersId}
          role="region"
          aria-label={secondaryFiltersLabel}
          className={cn(
            "rounded-xl px-3 py-2.5",
            variant === "workspace" ? "care-op-filter-panel" : "border border-border/50 bg-card/30",
          )}
        >
          {secondaryFilters}
        </div>
      ) : null}
    </section>
  );
}

/** Alias for imports that prefer singular “Filter”. */
export { CareSearchFiltersBar as CareSearchFilterBar };

export function CarePrimaryList({
  header,
  children,
}: {
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      {header}
      <div className="min-w-0 divide-y divide-border/35">{children}</div>
    </section>
  );
}

export type CareWorkRowProps = {
  title: ReactNode;
  context: ReactNode;
  status: ReactNode;
  time?: ReactNode;
  contextInfo?: ReactNode;
  actionLabel: ReactNode;
  onOpen: () => void;
  onAction: (event: React.MouseEvent<HTMLButtonElement>) => void;
  accentTone?: "critical" | "warning" | "neutral";
  /** Primary = progression CTA; ghost = secondary — always inline, never full-width. */
  actionVariant?: "primary" | "ghost";
  /** When true, no row CTA button (e.g. no next_best_action — open row for detail only). */
  hideAction?: boolean;
  /** Operational queues use compact 56px rhythm; comfortable retains legacy card padding. */
  density?: "operational" | "comfortable";
  /** Command worklist: slightly stronger accent, same grid geometry. */
  queueVariant?: "default" | "command";
  className?: string;
  testId?: string;
  /** Optional icon or badge before title/context (e.g. Acties type icon). */
  leading?: ReactNode;
};

/** Six-column dispatch grid — header and rows share this template. */
export const OPERATIONAL_QUEUE_GRID_COLS =
  "grid-cols-[5.5rem_8rem_minmax(11rem,1fr)_6.5rem_7rem_9.5rem] md:grid-cols-[88px_128px_minmax(12rem,1fr)_104px_112px_9.5rem]";

/** Shared geometry for operational queue header + row cells. */
export const OPERATIONAL_QUEUE_GRID_CLASS = cn(
  "grid w-full min-w-[52rem] items-center gap-x-3 md:gap-x-5",
  OPERATIONAL_QUEUE_GRID_COLS,
);

/** Shared column header grid for operational queue tables (Casussen, Acties, Matching, …). */
export const OPERATIONAL_QUEUE_HEADER_GRID_CLASS = cn(
  OPERATIONAL_QUEUE_GRID_CLASS,
  "border-b border-border/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:px-5",
);

export function CareOperationalQueueHeader({
  labels,
  testId = "operational-queue-column-headers",
}: {
  labels: readonly [string, string, string, string, string, string];
  testId?: string;
}) {
  return (
    <div className={OPERATIONAL_QUEUE_HEADER_GRID_CLASS} data-testid={testId}>
      {labels.map((label) => (
        <span key={label} className="min-w-0 truncate">
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * Operational work list row: shared grid, density, and interaction pattern for
 * coördinatie, Casussen, Matching, Plaatsingen, Aanbieder beoordeling, Acties, etc.
 */
export function CareWorkRow({
  title,
  context,
  status,
  time,
  contextInfo,
  actionLabel,
  onOpen,
  onAction,
  accentTone = "neutral",
  actionVariant = "ghost",
  hideAction = false,
  density = "operational",
  queueVariant = "default",
  className,
  testId,
  leading,
}: CareWorkRowProps) {
  const accentClass =
    accentTone === "critical"
      ? "border-l-red-500/80"
      : accentTone === "warning"
        ? "border-l-amber-500/70"
        : "border-l-transparent";
  const isOperational = density === "operational";
  const isCommand = queueVariant === "command";
  const rowMinHeight = isOperational ? tokens.density.compactWorklistRowHeight : tokens.density.worklistRowHeight;

  const ctaClass = cn(
    "h-8 max-w-[11rem] shrink-0 justify-center rounded-lg px-3 text-[12px] font-medium",
    isOperational
      ? actionVariant === "primary"
        ? "border-primary/35 text-primary hover:bg-primary/10"
        : "text-primary hover:bg-muted/25"
      : actionVariant === "primary"
        ? "border-primary/35 text-primary shadow-sm"
        : "text-primary hover:bg-muted/30",
  );

  return (
    <article
      data-care-work-row
      data-testid={testId}
      data-density={isOperational ? "operational" : "comfortable"}
      data-queue-variant={queueVariant}
      style={{ minHeight: rowMinHeight }}
      className={cn(
        "group relative border-b border-border/35 border-l-2 bg-transparent transition-colors hover:bg-muted/12",
        isCommand && "bg-muted/[0.05]",
        accentClass,
        className,
      )}
    >
      <div className={cn(OPERATIONAL_QUEUE_GRID_CLASS, "px-4 py-2 md:px-5")}>
        <div className="flex min-w-0 items-center justify-start overflow-hidden">{leading}</div>

        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "min-w-0 truncate text-left font-semibold leading-tight text-foreground outline-none",
            "focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1",
            isOperational ? "text-[13px]" : "text-[14px]",
          )}
          aria-label={`Open casus ${title}`}
        >
          {title}
        </button>

        <div className="min-w-0 overflow-hidden text-[11px] leading-snug text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden [&>*]:max-w-full [&>*]:shrink">
            {context}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden">{status}</div>

        <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden text-[11px] text-muted-foreground">
          {time ? <div className="min-w-0 truncate">{time}</div> : null}
          {contextInfo ? <div className="min-w-0 truncate">{contextInfo}</div> : null}
        </div>

        <div className="flex min-w-0 items-center justify-end">
          {!hideAction ? (
            <Button
              size="sm"
              variant="outline"
              type="button"
              data-care-work-row-cta={actionVariant}
              onClick={onAction}
              className={ctaClass}
            >
              <span className="truncate">{actionLabel}</span>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Alias for list-row semantics (same component as CareWorkRow). */
export const CareListRow = CareWorkRow;
