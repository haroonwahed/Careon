import type { ReactNode } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  CasusWorkspaceStatusBadges,
  FlowPhaseBadge,
  type CasusWorkspaceStatusVariant,
} from "./CareDesignPrimitives";

export type { CasusWorkspaceStatusVariant };

/**
 * Full-page casus workspace: flow bar → identity → hero (problem + primary CTA) →
 * decision panel → collapsible context. No side-rail / tab jungle — one vertical story.
 */
export interface CasusWorkspaceLayoutProps {
  onBack: () => void;
  backLabel?: string;
  /** Canonical flow progress (always visible, top of scroll story). */
  flowProgress?: ReactNode;
  title: string;
  metaLine?: string;
  /** Human label — used when `phaseId` is omitted (legacy callers). */
  phaseLabel: string;
  /** Canonical keten id — when set, shows `FlowPhaseBadge` aligned with lists/boards. */
  phaseId?: string;
  statusVariant: CasusWorkspaceStatusVariant;
  statusHint?: string | null;
  headerActions?: ReactNode;
  updatedAtLabel?: string | null;
  /** Problem + primary action — must stay visible without hunting (above decision panel). */
  caseHero: ReactNode;
  /** Explain → risk → guidance for this phase (no duplicate primary CTA here). */
  decisionPanel: ReactNode;
  /** Summary, details, evidence, secondary links — use <details> for progressive disclosure. */
  contextStack: ReactNode;
}

export function CasusWorkspaceLayout({
  onBack,
  backLabel = "Terug naar casussen",
  flowProgress,
  title,
  metaLine,
  phaseLabel,
  phaseId,
  statusVariant,
  statusHint,
  headerActions,
  updatedAtLabel,
  caseHero,
  decisionPanel,
  contextStack,
}: CasusWorkspaceLayoutProps) {
  return (
    <div className="w-full min-w-0 space-y-4 bg-background px-0 pb-8 pt-0 text-foreground">
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

      {flowProgress ? (
        <section data-testid="casus-flow-progress" className="w-full">
          {flowProgress}
        </section>
      ) : null}

      <header className="space-y-3 border-b border-border/70 pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="min-w-0 space-y-2">
            <h1 className="text-[20px] font-semibold leading-tight tracking-tight text-foreground md:text-[22px]">
              {title}
            </h1>
            {metaLine ? <p className="text-[13px] text-muted-foreground md:text-[14px]">{metaLine}</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              {phaseId ? (
                <span className="inline-flex items-center gap-1.5" title={`Stap: ${phaseLabel}`}>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Stap</span>
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
              <RefreshCw size={14} />
            </div>
          ) : null}
        </div>
      </header>

      <section data-testid="casus-hero-band" className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm md:p-5">
        {caseHero}
      </section>

      <section data-testid="casus-decision-panel" className="rounded-xl border border-primary/25 bg-primary/5 p-4 md:p-5">
        {decisionPanel}
      </section>

      <div data-testid="casus-context-stack" className="space-y-3">
        {contextStack}
      </div>
    </div>
  );
}
