import type { ReactNode } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from "../ui/utils";
import { getShortReasonLabel } from "../../lib/uxCopy";
import { ProcessTimeline } from "../design/ProcessTimeline";
import { BlockingNotice, CareFlowBoard, CareFlowStepCard } from "./CareDesignPrimitives";

export type CaseStepperStep = {
  id: string;
  label: string;
  owner: string;
};

export function CaseOperationalStepper({
  steps,
  activeIndex,
}: {
  steps: readonly CaseStepperStep[];
  activeIndex: number;
}) {
  return (
    <ProcessTimeline className="surface-context rounded-xl px-4 py-3 md:px-4 md:py-3.5">
      <CareFlowBoard variant="pipeline" activeStepIndex={activeIndex} stepCount={steps.length}>
        {steps.map((step, index) => {
          const isCurrent = index === activeIndex;
          const isCompleted = index < activeIndex;
          return (
            <CareFlowStepCard
              key={step.id}
              icon={
                  <span
                    className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold",
                    isCurrent
                      ? "bg-primary/90 text-primary-foreground"
                      : isCompleted
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-muted/50 text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
              }
              metric={null}
              title={<span className="text-[12px] leading-tight md:text-[12px]">{step.label}</span>}
              active={isCurrent}
              completed={isCompleted}
            />
          );
        })}
      </CareFlowBoard>
    </ProcessTimeline>
  );
}

export function CasePrimaryActionPanel({
  statusLabel,
  actionHolderLabel,
  waitingOnLabel,
  nextStepLabel,
  nextActionReason,
  primaryCtaLabel,
  onPrimaryAction,
  primaryDisabled,
  primaryPending,
  disabledReason,
  errorMessage,
}: {
  statusLabel: string;
  actionHolderLabel: string;
  waitingOnLabel: string;
  nextStepLabel: string;
  /** Backend NBA reason — shown whenever present so operators know why. */
  nextActionReason?: string | null;
  primaryCtaLabel: string | null;
  onPrimaryAction: () => void;
  primaryDisabled: boolean;
  primaryPending?: boolean;
  disabledReason?: string | null;
  errorMessage?: string | null;
}) {
  return (
    <div data-testid="next-best-action" data-priority="primary" className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-md bg-muted/12 px-2.5 py-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Status</p>
          <p className="mt-0.5 text-[11px] font-medium leading-tight text-muted-foreground">{statusLabel}</p>
        </div>
        <div className="rounded-md border border-primary/20 bg-primary/8 px-2.5 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-primary/80">Actiehouder</p>
          <p className="mt-0.5 text-[12px] font-semibold leading-tight text-foreground">{actionHolderLabel}</p>
          <p className="mt-0.5 text-[10px] leading-tight text-primary/70">{waitingOnLabel}</p>
        </div>
        <div className="rounded-md border border-primary/20 bg-primary/8 px-2.5 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-primary/80">Volgende stap</p>
          <p className="mt-0.5 text-[12px] font-semibold leading-tight text-foreground">{nextStepLabel}</p>
        </div>
      </div>
      {primaryCtaLabel ? (
        <div className="flex flex-col gap-2 border-t border-border/40 pt-2 sm:flex-row sm:items-center sm:justify-start">
          <Button
            type="button"
            onClick={onPrimaryAction}
            disabled={primaryDisabled}
            className="h-10 min-h-10 w-full gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto sm:min-w-[180px]"
          >
            {primaryPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
            {primaryCtaLabel}
            {!primaryPending ? <ArrowRight size={16} aria-hidden /> : null}
          </Button>
        </div>
      ) : null}
      {(primaryDisabled && (disabledReason || errorMessage)) ? (
        <BlockingNotice
          title="Actie geblokkeerd"
          message={errorMessage ?? getShortReasonLabel(disabledReason ?? "", 110)}
          className="mt-1"
        />
      ) : null}
    </div>
  );
}

export type CaseFactRow = {
  label: string;
  value: string;
  title?: string;
};

export function CaseKeyFactsCard({ facts }: { facts: CaseFactRow[] }) {
  return (
    <section
      data-testid="case-key-facts"
      className="surface-section rounded-xl px-4 py-3.5 md:px-5 md:py-4"
      aria-label="Kerngegevens casus"
    >
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Kerngegevens
      </h2>
      <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {facts.map((row) => (
          <div
            key={row.label}
            className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/30 pb-2 last:border-0 sm:block sm:border-0 sm:pb-0"
          >
            <dt className="shrink-0 text-[12px] text-muted-foreground">{row.label}</dt>
            <dd
              className="min-w-0 truncate text-right text-[13px] font-medium text-foreground sm:text-left"
              title={row.title ?? row.value}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function CaseAttentionPointsCard({
  items,
  onShowAll,
}: {
  items: Array<{ key: string; label: string; tone: "critical" | "warning" | "info" }>;
  onShowAll?: () => void;
}) {
  const visible = items.slice(0, 3);
  const hiddenCount = Math.max(0, items.length - visible.length);

  return (
    <section
      data-testid="case-attention-points"
      className="surface-section rounded-xl px-4 py-3.5 md:px-5 md:py-4"
      aria-label="Aandachtspunten"
    >
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Aandachtspunten
      </h2>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Geen open aandachtspunten.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li
              key={item.key}
              className={cn(
                "flex items-start gap-2 rounded-lg px-2.5 py-2 text-[13px]",
                item.tone === "critical" && "bg-destructive/8 text-foreground",
                item.tone === "warning" && "bg-amber-500/8 text-foreground",
                item.tone === "info" && "bg-muted/25 text-foreground",
              )}
            >
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  item.tone === "critical" && "bg-destructive",
                  item.tone === "warning" && "bg-amber-400",
                  item.tone === "info" && "bg-muted-foreground",
                )}
                aria-hidden
              />
              <span className="min-w-0 leading-snug">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
      {hiddenCount > 0 && onShowAll ? (
        <Button
          type="button"
          variant="ghost"
          className="mt-2 h-8 px-0 text-[13px] text-primary hover:bg-transparent"
          onClick={onShowAll}
        >
          Bekijk alle aandachtspunten ({items.length})
        </Button>
      ) : null}
    </section>
  );
}

export function CaseExecutionDetailTabs({
  activeTab = "overzicht",
  onTabChange,
  overzicht,
  arrangement,
  matching,
  validatie,
  historie,
  documenten,
}: {
  activeTab?: string;
  onTabChange?: (value: string) => void;
  overzicht: ReactNode;
  arrangement: ReactNode;
  matching: ReactNode;
  validatie: ReactNode;
  historie: ReactNode;
  documenten: ReactNode;
}) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full gap-3">
      <TabsList className="h-auto max-w-full flex-wrap justify-start gap-1 bg-muted/30 p-1">
        <TabsTrigger value="overzicht" className="text-[12px]">Overzicht</TabsTrigger>
        <TabsTrigger value="arrangement" className="text-[12px]">Arrangement</TabsTrigger>
        <TabsTrigger value="matching" className="text-[12px]">Matching</TabsTrigger>
        <TabsTrigger value="validatie" className="text-[12px]">Validatie</TabsTrigger>
        <TabsTrigger value="historie" className="text-[12px]">Historie</TabsTrigger>
        <TabsTrigger value="documenten" className="text-[12px]">Documenten</TabsTrigger>
      </TabsList>
      <TabsContent value="overzicht" className="mt-0 space-y-3">{overzicht}</TabsContent>
      <TabsContent value="arrangement" className="mt-0 space-y-3">{arrangement}</TabsContent>
      <TabsContent value="matching" className="mt-0 space-y-3">{matching}</TabsContent>
      <TabsContent value="validatie" className="mt-0 space-y-3">{validatie}</TabsContent>
      <TabsContent value="historie" className="mt-0 space-y-3">{historie}</TabsContent>
      <TabsContent value="documenten" className="mt-0 space-y-3">{documenten}</TabsContent>
    </Tabs>
  );
}

export function CaseDetailEvidenceList({
  rows,
}: {
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="surface-section rounded-xl px-4 py-3.5 md:px-5">
      <dl className="divide-y divide-border/30">
        {rows.map((row) => (
          <div key={row.label} className="flex min-w-0 items-start justify-between gap-3 py-2 text-[13px]">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 break-words text-right font-medium text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CaseTimelineHistoryList({
  events,
}: {
  events: Array<{ timestamp: string; label: string; source?: string | null }>;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Geen recente gebeurtenissen.</p>;
  }
  return (
    <ul className="surface-section divide-y divide-border/30 rounded-xl px-4 py-1 md:px-5">
      {events.map((event, index) => (
        <li key={`${event.timestamp}-${index}`} className="flex flex-col gap-0.5 py-2.5 text-[13px]">
          <span className="font-medium text-foreground">{event.label}</span>
          <span className="text-xs text-muted-foreground">
            {event.timestamp}
            {event.source ? ` · ${event.source}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function shortenAttentionLabel(headline: string, body: string): string {
  const raw = body.trim();
  if (!raw) return headline;
  const lower = raw.toLowerCase();
  if (lower.includes("samenvatting") && lower.includes("ontbreekt")) return "Samenvatting ontbreekt";
  if (lower.includes("gemeentelijke validatie") || lower.includes("gemeentevalidatie")) {
    return "Gemeentelijke validatie vereist";
  }
  if (lower.includes("tarief") || lower.includes("bekostiging")) {
    return "Tarief/bekostiging handmatig toetsen";
  }
  if (lower.includes("arrangement") && lower.includes("onzeker")) return "Arrangement onzekerheden";
  if (raw.length <= 72) return raw;
  return getShortReasonLabel(raw, 72);
}
