import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import {
  CasusWorkspaceStatusBadges,
  FlowPhaseBadge,
  type CasusWorkspaceStatusVariant,
} from "./CareDesignPrimitives";

export type { CasusWorkspaceStatusVariant };

/**
 * Full-page casus workspace: identity → flow bar → hero (problem + primary CTA) →
 * decision panel → collapsible context. No side-rail / tab jungle — one vertical story.
 */
export interface CasusWorkspaceLayoutProps {
  onBack: () => void;
  backLabel?: string;
  /** Canonical flow progress (always visible, directly below identity). */
  flowProgress?: ReactNode;
  title: string;
  /** Human label — used when `phaseId` is omitted (legacy callers). */
  phaseLabel: string;
  /** Canonical keten id — when set, shows `FlowPhaseBadge` aligned with lists/boards. */
  phaseId?: string;
  statusVariant: CasusWorkspaceStatusVariant;
  statusHint?: string | null;
  headerActions?: ReactNode;
  updatedAtLabel?: string | null;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  /** Problem + primary action — must stay visible without hunting (above decision panel). */
  caseHero: ReactNode;
  /** Explain → risk → guidance for this phase (no duplicate primary CTA here). */
  decisionPanel?: ReactNode;
  /** Summary, details, evidence, secondary links — use <details> for progressive disclosure. */
  contextStack: ReactNode;
  /** Persistent context strip — shown as a sticky bar at the top when scrolling. */
  caseIdentityLabel?: string;
  municipality?: string;
  urgencyLabel?: string;
  urgencyTone?: "critical" | "warning" | "neutral";
  ownerLabel?: string;
  elapsedLabel?: string;
  blockerLabel?: string;
  dominantActionLabel?: string;
  onDominantAction?: () => void;
  dominantActionDisabled?: boolean;
  dominantActionPending?: boolean;
  /** Optional right-side context rail — renders a two-column layout when provided. */
  contextRail?: ReactNode;
}

export function CasusWorkspaceLayout({
  onBack,
  backLabel = "Terug naar casussen",
  flowProgress,
  title,
  phaseLabel,
  phaseId,
  statusVariant,
  statusHint,
  headerActions,
  updatedAtLabel,
  onRefresh,
  refreshing = false,
  caseHero,
  decisionPanel,
  contextStack,
  caseIdentityLabel,
  municipality,
  urgencyLabel,
  urgencyTone = "neutral",
  ownerLabel,
  elapsedLabel,
  blockerLabel,
  dominantActionLabel,
  onDominantAction,
  dominantActionDisabled = false,
  dominantActionPending = false,
  contextRail,
}: CasusWorkspaceLayoutProps) {
  const hasStickyBar = Boolean(caseIdentityLabel || urgencyLabel || ownerLabel || blockerLabel);
  const heroBandRef = useRef<HTMLDivElement>(null);
  const [heroInView, setHeroInView] = useState(true);

  useEffect(() => {
    const el = heroBandRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn("w-full min-w-0 bg-background text-foreground", contextRail ? "flex gap-0" : undefined)}>
      <div className={cn("min-w-0 flex-1", contextRail ? "border-r border-border/50" : undefined)}>
      {hasStickyBar && (
        <div
          data-testid="casus-sticky-context-bar"
          className="sticky top-0 flex items-center gap-3 border-b border-border/60 bg-background/95 py-2 backdrop-blur-sm"
          style={{ zIndex: "var(--care-z-sticky)" }}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            {caseIdentityLabel && (
              <span className="text-[12px] font-semibold text-foreground">{caseIdentityLabel}</span>
            )}
            {urgencyLabel && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  urgencyTone === "critical"
                    ? "bg-[var(--care-badge-red-bg)] text-[var(--care-badge-red-text)]"
                    : urgencyTone === "warning"
                      ? "bg-[var(--care-badge-amber-bg)] text-[var(--care-badge-amber-text)]"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {urgencyLabel}
              </span>
            )}
            {municipality && (
              <span className="hidden text-[12px] text-muted-foreground sm:inline">{municipality}</span>
            )}
            {ownerLabel && (
              <span className="hidden text-[12px] text-muted-foreground md:inline">
                <span className="mr-1 text-muted-foreground/60">Eigenaar:</span>
                {ownerLabel}
              </span>
            )}
            {elapsedLabel && (
              <span className="hidden text-[12px] text-muted-foreground lg:inline">{elapsedLabel}</span>
            )}
            {blockerLabel && (
              <span className="flex items-center gap-1 text-[12px] text-[var(--care-badge-red-text)]">
                <AlertTriangle size={11} aria-hidden />
                <span className="max-w-[220px] truncate" title={blockerLabel}>{blockerLabel}</span>
              </span>
            )}
          </div>
          {dominantActionLabel && onDominantAction && !heroInView && (
            <Button
              type="button"
              size="sm"
              onClick={onDominantAction}
              disabled={dominantActionDisabled || dominantActionPending}
              className="ml-auto h-8 shrink-0 rounded-full px-4 text-[12px] font-semibold"
            >
              {dominantActionPending && <Loader2 size={12} className="mr-1.5 animate-spin" aria-hidden />}
              {dominantActionLabel}
            </Button>
          )}
        </div>
      )}
      <div className="space-y-4 pb-8 pt-0">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="h-9 gap-2 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground md:h-10"
          >
            <ArrowLeft size={16} />
            {backLabel}
          </Button>
          {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
        </div>

        <header className="space-y-3 border-b border-border/70 pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
            <div className="min-w-0 space-y-2">
              <h1 className="care-text-title text-foreground">
                {title}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {phaseId ? (
                  <span className="inline-flex items-center gap-1.5" title={`Stap: ${phaseLabel}`}>
                    <span className="care-text-eyebrow text-muted-foreground">Stap</span>
                    <FlowPhaseBadge phaseId={phaseId} />
                  </span>
                ) : phaseLabel ? (
                  <Badge className="border-border/60 bg-background/70 text-[12px] font-medium text-foreground shadow-sm">
                    Stap: {phaseLabel}
                  </Badge>
                ) : null}
                <CasusWorkspaceStatusBadges variant={statusVariant} hint={statusHint} />
              </div>
            </div>
            {updatedAtLabel ? (
              <div className="flex shrink-0 items-center gap-2 text-[12px] text-muted-foreground">
                <span>Bijgewerkt: {updatedAtLabel}</span>
                {onRefresh ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void onRefresh()}
                    disabled={refreshing}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    aria-label="Ververs casusgegevens"
                    title="Ververs casusgegevens"
                  >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />
                  </Button>
                ) : (
                  <RefreshCw size={14} />
                )}
              </div>
            ) : null}
          </div>
        </header>

        <section
          data-testid="casus-operational-cluster"
          className="space-y-4 rounded-[24px] border border-border/60 bg-card/50 p-4 md:p-5"
        >
          {flowProgress ? (
            <div
              data-testid="casus-flow-progress"
              className="rounded-xl bg-background/35 p-3 md:p-3.5"
            >
              {flowProgress}
            </div>
          ) : null}

          <div
            ref={heroBandRef}
            data-testid="casus-hero-band"
            className="rounded-xl bg-background/35 p-4 md:p-5"
          >
            {caseHero}
          </div>
        </section>

        {decisionPanel ? (
          <section data-testid="casus-decision-panel" className="rounded-xl border border-border/60 bg-card/40 p-4 md:p-5">
            {decisionPanel}
          </section>
        ) : null}

        <div data-testid="casus-context-stack" className="space-y-3">
          <div data-testid="case-context-panel" className="space-y-3">
            {contextStack}
          </div>
        </div>
      </div>
      </div>
      {contextRail && (
        <aside
          data-testid="casus-context-rail"
          className="hidden shrink-0 xl:block"
          style={{ width: "var(--care-context-rail-width)" }}
        >
          <div className="sticky top-0 p-4">
            {contextRail}
          </div>
        </aside>
      )}
    </div>
  );
}
