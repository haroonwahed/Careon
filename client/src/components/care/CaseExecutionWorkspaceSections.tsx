import type { ReactNode } from "react";
import { ArrowRight, Lock, Loader2, UserRound } from "lucide-react";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from "../ui/utils";
import { CareFlowBoard, CareFlowStepCard } from "./CareDesignPrimitives";

export type CaseStepperStep = {
  id: string;
  label: string;
  owner: string;
  subtitle?: string;
};

export function CaseOperationalStepper({
  steps,
  activeIndex,
}: {
  steps: readonly CaseStepperStep[];
  activeIndex: number;
}) {
  return (
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
            subtitle={isCurrent ? (step.subtitle ?? "Huidige stap") : undefined}
            metric={null}
            title={<span className="text-[12px] leading-tight md:text-[12px]">{step.label}</span>}
            active={isCurrent}
            completed={isCompleted}
          />
        );
      })}
    </CareFlowBoard>
  );
}

export function CasePrimaryActionPanel({
  statusLabel,
  actionHolderLabel,
  waitingOnLabel,
  nextStepLabel,
  nextActionReason,
  statusTitle,
  statusDescription,
  statusTone = "default",
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
  statusTitle?: string | null;
  statusDescription?: string | null;
  statusTone?: "default" | "blocked";
  primaryCtaLabel: string | null;
  onPrimaryAction: () => void;
  primaryDisabled: boolean;
  primaryPending?: boolean;
  disabledReason?: string | null;
  errorMessage?: string | null;
}) {
  const blocked = primaryDisabled;
  const leadTitle = statusTitle ?? (blocked ? "Deze casus is geblokkeerd" : statusLabel);
  const leadDescription = statusDescription ?? (blocked ? (nextActionReason ?? statusLabel) : nextActionReason ?? statusLabel);
  return (
    <div
      data-testid="next-best-action"
      data-priority="primary"
      data-blocked={Boolean(primaryDisabled && (disabledReason || errorMessage))}
      data-reason-present={Boolean(nextActionReason)}
      className="grid gap-5 md:grid-cols-[1.15fr_0.82fr_0.82fr] md:items-center"
    >
      <div className="flex items-start gap-4 md:border-r md:border-border/40 md:pr-5">
        <div className={cn(
          "mt-0.5 flex h-20 w-20 shrink-0 items-center justify-center rounded-full",
          statusTone === "blocked"
            ? "bg-destructive/20 text-destructive"
            : blocked
              ? "bg-destructive/20 text-destructive"
              : "bg-primary/12 text-primary",
        )}>
          <Lock size={32} strokeWidth={2.1} aria-hidden />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Huidige situatie</p>
          <p className="text-[18px] font-semibold leading-tight text-foreground md:text-[20px]">{leadTitle}</p>
          <p className="max-w-[34rem] text-[13px] leading-6 text-muted-foreground md:text-[14px]">
            {leadDescription}
          </p>
        </div>
      </div>
      <div className="space-y-1 md:border-r md:border-border/40 md:px-5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Actiehouder</p>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground ring-1 ring-border/60">
            <UserRound size={18} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold leading-tight text-foreground">{actionHolderLabel}</p>
            <p className="mt-1 text-[12px] leading-tight text-muted-foreground">{waitingOnLabel}</p>
          </div>
        </div>
      </div>
      <div className="space-y-3 md:pl-0 md:text-left">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Volgende actie</p>
        <p className="text-[14px] font-semibold leading-tight text-foreground">{nextStepLabel}</p>
        {primaryCtaLabel ? (
          <div className="pt-1">
          <Button
            type="button"
            onClick={onPrimaryAction}
            disabled={primaryDisabled}
            className="h-12 min-h-12 w-full gap-2 rounded-full bg-primary px-5 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 sm:w-auto sm:min-w-[232px]"
          >
            {primaryPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
            {primaryCtaLabel}
            {!primaryPending ? <ArrowRight size={16} aria-hidden /> : null}
          </Button>
          </div>
        ) : null}
      </div>
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
        <TabsTrigger value="validatie" className="text-[12px]">Toetsing</TabsTrigger>
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
  if ((lower.includes("casusoverzicht") || lower.includes("aanmelding")) && lower.includes("ontbreekt")) return "Aanmelding ontbreekt";
  if (lower.includes("gemeentelijke validatie") || lower.includes("gemeentevalidatie")) {
    return "Toetsing vereist";
  }
  if (lower.includes("tarief") || lower.includes("bekostiging")) {
    return "Tarief/bekostiging handmatig toetsen";
  }
  if (lower.includes("arrangement") && lower.includes("onzeker")) return "Arrangement onzekerheden";
  if (raw.length <= 72) return raw;
  return getShortReasonLabel(raw, 72);
}
