import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "../ui/utils";

// ─── Page shell ───────────────────────────────────────────────────────────────

export function CareCommandShell({
  title,
  subtitle,
  lastUpdatedLabel,
  onRefresh,
  actions,
  children,
  testId,
}: {
  title: ReactNode;
  subtitle?: string;
  lastUpdatedLabel?: string;
  onRefresh?: () => void;
  actions?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex min-h-0 flex-col" data-testid={testId}>
      <div className="flex items-start justify-between gap-4 pb-5">
        <div>
          <h1 className="care-text-title text-foreground">{title}</h1>
          {subtitle && <p className="mt-0.5 care-text-body text-muted-foreground">{subtitle}</p>}
        </div>
        {(actions || lastUpdatedLabel || onRefresh) && (
          <div className="flex shrink-0 items-center gap-2 pt-1">
            {actions}
            {(lastUpdatedLabel || onRefresh) && (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                {lastUpdatedLabel && <span>{lastUpdatedLabel}</span>}
                {onRefresh && (
                  <button
                    type="button"
                    onClick={onRefresh}
                    aria-label="Vernieuwen"
                    className="rounded p-0.5 hover:text-foreground transition-colors"
                  >
                    <RefreshCw size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Metric strip ─────────────────────────────────────────────────────────────

export function CareMetricStrip({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div className={cn("mb-5 grid gap-3", cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {children}
    </div>
  );
}

type MetricTone = "urgent" | "warning" | "neutral";

const METRIC_TONES: Record<MetricTone, { idle: string; active: string; value: string; label: string }> = {
  urgent: {
    idle: "border-care-urgent-border bg-care-urgent-bg hover:-translate-y-0.5 hover:shadow-md hover:border-care-urgent-solid/60",
    active: "border-care-urgent-border bg-care-urgent-bg ring-2 ring-care-urgent-solid/30 shadow-sm",
    value: "text-care-urgent-text",
    label: "text-care-urgent-text/70",
  },
  warning: {
    idle: "border-care-warning-border bg-care-warning-bg hover:-translate-y-0.5 hover:shadow-md hover:border-care-warning-solid/60",
    active: "border-care-warning-border bg-care-warning-bg ring-2 ring-care-warning-solid/30 shadow-sm",
    value: "text-care-warning-text",
    label: "text-care-warning-text/70",
  },
  neutral: {
    idle: "border-border/60 bg-card/40 hover:bg-card/55 hover:-translate-y-0.5 hover:shadow-md hover:border-border/80 dark:bg-card/20 dark:hover:bg-card/30",
    active: "border-primary/40 bg-primary/5 ring-2 ring-primary/20 shadow-sm dark:bg-primary/10",
    value: "text-foreground",
    label: "text-muted-foreground",
  },
};

export function CareMetricCard({
  value,
  label,
  tone,
  isActive = false,
  onClick,
}: {
  value: number | string;
  label: string;
  tone: MetricTone;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const t = METRIC_TONES[tone];
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-all duration-200",
        isActive ? t.active : t.idle,
      )}
    >
      <span className={cn("text-[28px] font-bold tabular-nums leading-none", t.value)}>{value}</span>
      <span className={cn("flex items-center gap-1 text-[12px] font-medium", t.label)}>
        {label}
        {isActive && <X size={11} className="shrink-0 opacity-60" aria-hidden />}
      </span>
    </button>
  );
}

// ─── Worklist container ───────────────────────────────────────────────────────

export function CareWorklist({
  children,
  testId,
  className,
}: {
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "[overflow:clip] rounded-xl border border-border/60 bg-white dark:bg-[var(--surface-elevated)]",
        className,
      )}
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
    >
      {children}
    </div>
  );
}

// ─── Worklist tabs ────────────────────────────────────────────────────────────

export function CareWorklistTabs({
  tabs,
  activeId,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Werkvoorraad filters" className="flex overflow-x-auto border-b border-border/35 px-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-3 text-[13px] font-medium whitespace-nowrap transition-colors",
            activeId === tab.id
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                activeId === tab.id
                  ? "bg-foreground/10 text-foreground"
                  : "bg-muted/40 text-muted-foreground",
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Worklist toolbar ─────────────────────────────────────────────────────────

export function CareWorklistToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Zoek in werkvoorraad...",
  filtersActive,
  showFilters,
  onToggleFilters,
  rightSlot,
}: {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filtersActive?: boolean;
  showFilters?: boolean;
  onToggleFilters?: () => void;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/35 px-4 py-3">
      <div className="relative flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full rounded-[10px] border border-border/60 bg-white dark:bg-white/[0.07] pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 focus:bg-white dark:focus:bg-white/[0.09] focus:ring-2 focus:ring-primary/10 transition-colors"
        />
      </div>
      {onToggleFilters && (
        <button
          type="button"
          onClick={onToggleFilters}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-[10px] border px-3 py-[7px] text-[13px] font-medium transition-colors",
            showFilters || filtersActive
              ? "border-primary/50 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/15"
              : "border-border/60 bg-muted/20 text-foreground/70 hover:border-border hover:bg-muted/40 hover:text-foreground",
          )}
        >
          <SlidersHorizontal size={14} aria-hidden />
          Filters
          {filtersActive && (
            <span className="flex size-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              !
            </span>
          )}
        </button>
      )}
      {rightSlot && <div className="ml-auto flex items-center gap-2">{rightSlot}</div>}
    </div>
  );
}

// ─── Worklist filter panel ────────────────────────────────────────────────────

export function CareWorklistFilterPanel({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="border-b border-border/35 bg-muted/40 dark:bg-muted/5 px-4 py-3">
      {children}
    </div>
  );
}

// ─── Worklist column header ───────────────────────────────────────────────────

export function CareWorklistColumnHeader({
  columns,
  cols,
  minWidth = "860px",
}: {
  columns: string[];
  cols: string;
  minWidth?: string;
}) {
  return (
    <div
      className="sticky top-0 z-10 grid gap-x-4 border-b border-border/35 bg-white px-[calc(1.25rem+3px)] py-2 care-text-eyebrow text-muted-foreground dark:bg-[var(--surface-elevated)]"
      style={{ gridTemplateColumns: cols, minWidth }}
    >
      {columns.map((col, i) => (
        <span key={i}>{col}</span>
      ))}
    </div>
  );
}

// ─── Worklist row ─────────────────────────────────────────────────────────────

const ROW_ACCENT_CLASS: Record<string, string> = {
  urgent: "border-l-care-urgent-solid",
  warning: "border-l-care-warning-solid",
  low: "border-l-yellow-300 dark:border-l-yellow-400/70",
  neutral: "border-l-border/60",
};

const ROW_IDLE_BG: Record<string, string> = {
  urgent:  "bg-care-urgent-bg/50  hover:bg-care-urgent-bg/80  border-care-urgent-border/50",
  warning: "bg-care-warning-bg/40 hover:bg-care-warning-bg/70 border-care-warning-border/40",
  low:     "bg-yellow-50/20 dark:bg-yellow-400/[0.05] hover:bg-yellow-50/40 dark:hover:bg-yellow-400/[0.09] border-border/50",
  neutral: "bg-white/[0.02] hover:bg-white/[0.04] dark:bg-white/[0.015] dark:hover:bg-white/[0.035] border-border/50 hover:border-border/80",
};

export function CareWorklistRow({
  cols,
  accentTone = "neutral",
  isSelected = false,
  onRowClick,
  rowClickLabel = "Open rij",
  children,
  minWidth = "860px",
  testId,
}: {
  cols: string;
  accentTone?: "urgent" | "warning" | "low" | "neutral";
  isSelected?: boolean;
  onRowClick?: () => void;
  rowClickLabel?: string;
  children: ReactNode;
  minWidth?: string;
  testId?: string;
}) {
  return (
    <div
      data-care-work-row
      data-testid={testId}
      className={cn(
        "group relative grid cursor-pointer items-start rounded-lg border border-l-[3px] transition-all duration-150",
        "gap-x-4 px-5 py-4",
        ROW_ACCENT_CLASS[accentTone],
        isSelected
          ? "border-primary/30 bg-primary/5 shadow-sm dark:bg-primary/8"
          : [ROW_IDLE_BG[accentTone] ?? ROW_IDLE_BG.neutral, "hover:-translate-y-px hover:shadow-sm"],
      )}
      style={{ gridTemplateColumns: cols, minWidth }}
    >
      {onRowClick && (
        <button
          type="button"
          aria-label={rowClickLabel}
          aria-pressed={isSelected}
          onClick={onRowClick}
          className="absolute inset-0 z-0 cursor-pointer rounded-lg border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
        />
      )}
      {children}
    </div>
  );
}

/** Wraps an action button cell so it floats above the stretched row-click button (z-10). */
export function CareWorklistRowAction({ children }: { children: ReactNode }) {
  return <div className="relative z-10 flex items-start pt-0.5">{children}</div>;
}

// ─── Worklist body ────────────────────────────────────────────────────────────

export function CareWorklistBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 p-3">
      {children}
    </div>
  );
}

// ─── Worklist empty ───────────────────────────────────────────────────────────

export function CareWorklistEmpty({ message = "Geen resultaten in dit filter." }: { message?: string }) {
  return (
    <div className="px-6 py-8 text-center text-[13px] text-muted-foreground">
      {message}
    </div>
  );
}

// ─── Worklist pagination ──────────────────────────────────────────────────────

export function CareWorklistPagination({
  count,
  singular = "resultaat",
  plural = "resultaten",
}: {
  count: number;
  singular?: string;
  plural?: string;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border/35 px-6 py-3">
      <p className="text-[12px] text-muted-foreground">
        {count} {count === 1 ? singular : plural}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled
          aria-label="Vorige pagina"
          className="flex size-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground disabled:opacity-40"
        >
          <ChevronLeft size={13} aria-hidden />
        </button>
        <button
          type="button"
          className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md bg-foreground px-1.5 text-[12px] font-medium text-background"
        >
          1
        </button>
        <button
          type="button"
          disabled
          aria-label="Volgende pagina"
          className="flex size-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-muted/20 disabled:opacity-40 transition-colors"
        >
          <ChevronRight size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}

// ─── Row action button classes ────────────────────────────────────────────────

export const ROW_ACTION_CLASSES = {
  default:
    "flex items-center gap-1.5 rounded-lg border border-border/60 bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground shadow-sm transition-all duration-150 hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:-translate-y-px hover:shadow-md active:scale-95 dark:bg-muted/10",
  primary:
    "flex items-center gap-1.5 rounded-lg border border-primary/50 bg-primary/5 px-3 py-1.5 text-[12px] font-semibold text-primary transition-all duration-150 hover:border-primary/70 hover:bg-primary/10 hover:-translate-y-px hover:shadow-md active:scale-95",
  blocking:
    "flex items-center gap-1.5 rounded-lg border border-transparent bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background shadow-sm transition-all duration-150 hover:bg-foreground/85 hover:-translate-y-px hover:shadow-md active:scale-95",
  waiting:
    "flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-[12px] font-semibold text-muted-foreground/60 cursor-default pointer-events-none",
} as const;
