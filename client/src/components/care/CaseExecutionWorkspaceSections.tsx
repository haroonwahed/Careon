import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ProcessTimeline } from "../design/ProcessTimeline";
import { cn } from "../ui/utils";
import { getShortReasonLabel } from "../../lib/uxCopy";

export type CaseStepperStep = {
  id: string;
  label: string;
  owner: string;
};

export function CaseOperationalStepper({
  steps,
  activeIndex,
  warningStepIndexes = [],
}: {
  steps: readonly CaseStepperStep[];
  activeIndex: number;
  warningStepIndexes?: number[];
}) {
  const progressPct =
    steps.length <= 1 ? 0 : Math.min(100, Math.max(8, (activeIndex / (steps.length - 1)) * 100));

  const chipLabel = (index: number) => {
    if (index < activeIndex) return "Klaar";
    if (index === activeIndex) return "Actief";
    if (index === activeIndex + 1) return "Volgende";
    return "Open";
  };

  return (
    <ProcessTimeline className="surface-context rounded-xl px-4 py-3.5 md:px-5 md:py-4">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Operationele keten
      </h2>
      <div className="care-flow-pipeline relative px-0 py-0" aria-label="Operationele keten">
        <div className="care-flow-pipeline__track hidden md:block" aria-hidden />
        <div
          className="care-flow-pipeline__progress hidden md:block"
          style={{ width: `${progressPct}%` }}
          aria-hidden
        />
        <div className="relative z-[1] grid grid-cols-1 gap-2 md:grid-cols-4 md:gap-1">
          {steps.map((step, index) => {
            const isCurrent = index === activeIndex;
            const isCompleted = index < activeIndex;
            const hasWarning = warningStepIndexes.includes(index);
            return (
              <div
                key={step.id}
                className={cn(
                  "min-w-0 rounded-lg px-2 py-2 md:text-center",
                  isCurrent && "bg-muted/25",
                )}
              >
                <div className="flex items-center gap-2 md:flex-col md:items-center md:gap-1">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      isCurrent
                        ? "bg-primary/90 text-primary-foreground"
                        : isCompleted
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-muted/50 text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <p
                    className={cn(
                      "min-w-0 text-[12px] font-semibold leading-tight",
                      isCurrent ? "text-foreground" : "text-foreground/80",
                    )}
                  >
                    {step.label}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 md:justify-center">
                  <span
                    className={cn(
                      "inline-flex h-5 items-center rounded-sm px-1.5 text-[10px] font-medium",
                      isCurrent
                        ? "bg-primary/15 text-primary"
                        : isCompleted
                          ? "bg-emerald-500/10 text-emerald-200"
                          : "bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {chipLabel(index)}
                  </span>
                  {hasWarning ? (
                    <span
                      className="inline-flex h-5 items-center gap-0.5 rounded-sm bg-amber-500/12 px-1.5 text-[10px] font-medium text-amber-200"
                      title="Aandacht vereist"
                    >
                      <AlertTriangle size={10} aria-hidden />
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ProcessTimeline>
  );
}

export function CasePrimaryActionPanel({
  statusLabel,
  actionHolderLabel,
  waitingOnLabel,
  nextStepLabel,
  primaryCtaLabel,
  onPrimaryAction,
  primaryDisabled,
  disabledReason,
  errorMessage,
}: {
  statusLabel: string;
  actionHolderLabel: string;
  waitingOnLabel: string;
  nextStepLabel: string;
  primaryCtaLabel: string | null;
  onPrimaryAction: () => void;
  primaryDisabled: boolean;
  disabledReason?: string | null;
  errorMessage?: string | null;
}) {
  return (
    <div data-testid="next-best-action" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{statusLabel}</p>
        </div>
        <div className="rounded-lg bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Actiehouder</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{actionHolderLabel}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{waitingOnLabel}</p>
        </div>
        <div className="rounded-lg bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Volgende stap</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{nextStepLabel}</p>
        </div>
      </div>
      {primaryCtaLabel ? (
        <div className="flex flex-col gap-2 border-t border-border/40 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            onClick={onPrimaryAction}
            disabled={primaryDisabled}
            className="h-11 min-h-[44px] w-full gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto sm:min-w-[220px]"
          >
            {primaryCtaLabel}
            <ArrowRight size={16} aria-hidden />
          </Button>
        </div>
      ) : null}
      {(primaryDisabled && (disabledReason || errorMessage)) ? (
        <p className="text-[12px] text-destructive">
          {errorMessage ?? getShortReasonLabel(disabledReason ?? "", 110)}
        </p>
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
          <div key={row.label} className="flex items-center justify-between gap-3 py-2 text-[13px]">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-medium text-foreground">{row.value}</dd>
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
