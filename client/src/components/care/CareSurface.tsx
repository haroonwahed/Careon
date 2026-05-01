import type { ReactNode } from "react";
import { cn } from "../ui/utils";

type CareTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const TONE_STYLES: Record<CareTone, { shell: string; icon: string; note: string }> = {
  neutral: {
    shell: "border-border bg-card/75",
    icon: "bg-muted/30 text-muted-foreground",
    note: "text-muted-foreground",
  },
  primary: {
    shell: "border-primary/20 bg-primary/5 shadow-[0_10px_30px_rgba(139,92,246,0.08)]",
    icon: "bg-primary/10 text-primary",
    note: "text-primary",
  },
  success: {
    shell: "border-emerald-500/20 bg-emerald-500/6",
    icon: "bg-emerald-500/10 text-emerald-300",
    note: "text-emerald-300",
  },
  warning: {
    shell: "border-amber-500/20 bg-amber-500/6",
    icon: "bg-amber-500/10 text-amber-300",
    note: "text-amber-300",
  },
  danger: {
    shell: "border-red-500/20 bg-red-500/6",
    icon: "bg-red-500/10 text-red-300",
    note: "text-red-300",
  },
  info: {
    shell: "border-cyan-500/20 bg-cyan-500/6",
    icon: "bg-cyan-500/10 text-cyan-300",
    note: "text-cyan-300",
  },
};

export function CarePageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  meta,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-b border-border/70 pb-4", className)}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          {eyebrow && (
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{subtitle}</p>}
          </div>
          {meta && <div>{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function CareInsightBanner({
  title,
  copy,
  action,
  tone = "primary",
  compact = false,
  className,
}: {
  title: ReactNode;
  copy?: ReactNode;
  action?: ReactNode;
  tone?: CareTone;
  compact?: boolean;
  className?: string;
}) {
  const styles = TONE_STYLES[tone];

  return (
    <section
      className={cn(
        compact ? "border-l-4 px-4 py-3" : "border-l-4 p-4",
        styles.shell,
        className,
      )}
    >
      <div className={cn("flex flex-col gap-4 md:justify-between", compact ? "md:flex-row md:items-center" : "md:flex-row md:items-center")}>
        <div className="space-y-1.5">
          <p className={cn(compact ? "text-xs font-semibold uppercase tracking-[0.12em]" : "text-sm font-semibold uppercase tracking-[0.12em]", styles.note)}>Operatieve aandacht</p>
          <h2 className={cn(compact ? "text-base font-semibold text-foreground" : "text-lg font-semibold text-foreground")}>{title}</h2>
          {copy && <p className={cn("max-w-4xl leading-6 text-muted-foreground", compact ? "text-xs" : "text-sm")}>{copy}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </section>
  );
}

export function CareMetricCard({
  label,
  value,
  note,
  icon,
  tone = "neutral",
  active = false,
  onClick,
  className,
  testId,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  icon?: ReactNode;
  tone?: CareTone;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  testId?: string;
}) {
  const styles = TONE_STYLES[tone];
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "group relative flex min-h-[120px] flex-col justify-between rounded-xl border p-4 text-left transition-colors duration-200",
        styles.shell,
        onClick && "cursor-pointer hover:border-border/90",
        active && "ring-2 ring-primary/30",
        className,
      )}
    >
      {active && <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-primary shadow-[0_0_0_6px_rgba(139,92,246,0.15)]" />}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          {icon && (
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70", styles.icon)}>
              {icon}
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          </div>
        </div>
      </div>
      {note && <p className={cn("mt-4 text-sm font-medium", styles.note)}>{note}</p>}
    </Comp>
  );
}

export function CareSectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border/70 bg-card/35 p-4", className)}>
      {(title || subtitle || actions) && (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function CareEmptyState({
  title,
  copy,
  action,
  className,
}: {
  title: ReactNode;
  copy?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border border-dashed border-border/70 bg-transparent px-5 py-8 text-left", className)}>
      <div className="space-y-2">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {copy && <p className="text-sm leading-6 text-muted-foreground">{copy}</p>}
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  );
}

export function CareFilterLabel({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("space-y-2", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
