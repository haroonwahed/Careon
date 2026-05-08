import type { CSSProperties, ReactNode } from "react";
import { ChevronDown, ChevronUp, Info, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../ui/utils";
import { tokens } from "../../design/tokens";
import {
  decisionUiPhaseBadgeLabel,
  decisionUiPhaseBadgeShellClass,
  mapApiPhaseToDecisionUiPhase,
  normalizeApiPhaseId,
} from "../../lib/decisionPhaseUi";

/** Vertical rhythm for unified care list pages (header → optional attention → filters → list). */
export const CARE_UNIFIED_PAGE_STACK = "space-y-4";

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
    <div className={cn(CARE_UNIFIED_PAGE_STACK, className)}>
      {header}
      {attention}
      {filters}
      {children}
    </div>
  );
}

export function CareMetricBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(125,211,252,0.5)] bg-[rgba(56,189,248,0.16)] px-3 py-1 text-[12px] font-semibold text-[#E0F2FE]">
      <span className="size-1.5 shrink-0 rounded-full bg-[#7DD3FC]" />
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
        <div className="space-y-2 text-sm leading-relaxed">{children}</div>
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
        "inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-muted/25 px-2 py-0.5 text-[11px] text-muted-foreground",
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
        "inline-flex max-w-full items-center rounded-full border border-border/70 bg-card/60 px-2.5 py-1 text-[12px] font-semibold leading-tight text-foreground",
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
  subtitle,
  metric,
  actions,
  titleClassName,
  subtitleClassName,
  subtitleInfoTestId,
  subtitleAriaLabel,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  metric?: ReactNode;
  actions?: ReactNode;
  titleClassName?: string;
  subtitleClassName?: string;
  /** Defaults to `care-page-subtitle-info`. */
  subtitleInfoTestId?: string;
  /** `aria-label` on the info trigger when `subtitle` is set. */
  subtitleAriaLabel?: string;
}) {
  return (
    <section data-testid="care-unified-header" className="space-y-1.5 px-1 pb-3">
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
            {subtitle ? (
              <CareInfoPopover
                ariaLabel={subtitleAriaLabel ?? "Pagina-uitleg"}
                testId={subtitleInfoTestId ?? "care-page-subtitle-info"}
              >
                <div className={cn("leading-snug text-muted-foreground", subtitleClassName ?? "text-[13px]")}>{subtitle}</div>
              </CareInfoPopover>
            ) : null}
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
}: {
  visible?: boolean;
  tone?: "warning" | "info" | "critical";
  message: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  if (!visible) return null;
  const accent =
    tone === "critical" ? "border-l-red-500" : tone === "warning" ? "border-l-amber-500" : "border-l-cyan-400";
  return (
    <div
      data-component="care-attention-bar"
      className={cn(
        "care-hover-card flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-border/70 border-l-2 bg-card/70 px-3 py-2.5",
        accent,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        {icon && <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Operatieve aandacht</p>
          <p className="truncate text-sm text-foreground">{message}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
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
  /** Optional brand fill when `accentSelected` (e.g. Casussen mock `#6D5DFC` via design tokens). */
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
              color: "#FAFAFA",
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
 * Keep visual tokens aligned across Regiekamer, Casussen, Matching, Acties (and other care lists).
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
  className?: string;
}) {
  const canToggleMore = Boolean(onToggleSecondaryFilters);
  const expanded = Boolean(showSecondaryFilters && canToggleMore);
  const showToggle = canToggleMore && showSecondaryFiltersToggle;

  return (
    <section data-testid="care-search-control-stack" className={cn("space-y-2 px-1", className)}>
      {tabs ? <div className="w-full min-w-0">{tabs}</div> : null}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <div
          className="flex w-full min-w-0 flex-1 items-center gap-2.5 border border-border/80 bg-background/90 px-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
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
              className="inline-flex h-10 items-center gap-1.5 rounded-xl px-1 text-[13px] font-medium text-primary hover:text-primary/90"
            >
              {secondaryFiltersLabel}
              {showSecondaryFilters ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            </button>
          ) : null}
          {rightAction ? <div className="flex items-center gap-2">{rightAction}</div> : null}
        </div>
      </div>

      {expanded ? <div className="rounded-xl border border-border/50 bg-card/30 px-3 py-2.5">{secondaryFilters}</div> : null}
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
    <section className="space-y-2 px-1">
      {header}
      <div className="space-y-1.5">{children}</div>
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
  /** Primary = decision CTA (Regiekamer next-best-action); ghost = secondary list action. */
  actionVariant?: "primary" | "ghost";
  /** When true, no row CTA button (e.g. no next_best_action — open row for detail only). */
  hideAction?: boolean;
  className?: string;
  testId?: string;
  /** Optional icon or badge before title/context (e.g. Acties type icon). */
  leading?: ReactNode;
};

/**
 * Operational work list row: shared grid, density, and interaction pattern for
 * Regiekamer, Casussen, Matching, Plaatsingen, Aanbieder beoordeling, Acties, etc.
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
  className,
  testId,
  leading,
}: CareWorkRowProps) {
  const accentClass = accentTone === "critical" ? "border-l-red-500/80" : accentTone === "warning" ? "border-l-amber-500/70" : "border-l-transparent";
  return (
    <article
      data-care-work-row
      data-testid={testId}
      data-density="compact"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      style={{ minHeight: tokens.density.worklistRowHeight }}
      className={cn(
        "cursor-pointer rounded-2xl border border-border/70 border-l-2 bg-card/75 px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-all hover:border-border/90 hover:bg-card/90 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        accentClass,
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
        {/* max-sm: stack phase chips above title so narrow screens get vertical rhythm; sm+: fixed leading column (tokens.layout.worklistLeadingColumnWidth). */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-2.5">
          {leading ? (
            <div className="mt-0.5 w-full shrink-0 sm:box-border sm:w-[13rem] sm:min-w-[13rem] sm:max-w-[13rem] [&_svg]:size-4">
              {leading}
            </div>
          ) : null}
          <div className="min-w-0 flex-1 space-y-1">
            {/* Below md: title then status on their own lines on xs; inline from sm–md so columns stay predictable. */}
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
              <p className="min-w-0 truncate text-[14px] font-semibold leading-tight text-foreground">{title}</p>
              <div className="min-w-0 shrink-0 md:hidden">{status}</div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] leading-none text-muted-foreground">
              {context}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2.5">
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:justify-end">
            <div
              className="hidden md:flex md:box-border md:items-center md:justify-start md:overflow-hidden"
              style={
                {
                  width: tokens.layout.worklistStatusColumnWidth,
                  minWidth: tokens.layout.worklistStatusColumnWidth,
                  maxWidth: tokens.layout.worklistStatusColumnWidth,
                } satisfies Record<string, string>
              }
            >
              {status}
            </div>
            {time}
            {contextInfo}
          </div>
          {!hideAction ? (
            <div className="flex w-full min-w-0 shrink-0 justify-end sm:w-auto sm:self-center md:min-w-[10.5rem]">
              <Button
                size="sm"
                variant={actionVariant === "primary" ? "default" : "ghost"}
                type="button"
                data-care-work-row-cta={actionVariant}
                onClick={(event) => {
                  event.stopPropagation();
                  onAction(event);
                }}
                className={cn(
                  actionVariant === "primary"
                    ? "h-9 shrink-0 justify-center rounded-xl px-4 text-[13px] font-semibold shadow-md"
                    : "h-8 shrink-0 justify-center rounded-full px-3 text-[13px] font-medium text-primary hover:bg-primary/10 hover:text-primary",
                )}
              >
                <span className="truncate">{actionLabel}</span>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Alias for list-row semantics (same component as CareWorkRow). */
export const CareListRow = CareWorkRow;
