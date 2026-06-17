import { Fragment, type ReactNode } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, FileWarning, Loader2, UserRound, Lock } from "lucide-react";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
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
}: {
  steps: readonly CaseStepperStep[];
  activeIndex: number;
}) {
  return (
    <nav className="flex min-w-[480px] items-center overflow-x-auto" aria-label="Workflow fasen">
      {steps.map((step, index, arr) => {
        const isCurrent = index === activeIndex;
        const isCompleted = index < activeIndex;
        return (
          <Fragment key={step.id}>
            <div
              aria-current={isCurrent ? "step" : undefined}
              className="flex shrink-0 items-center gap-2 px-2"
            >
              <span className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold leading-none",
                isCurrent && "border-primary/40 bg-primary text-primary-foreground",
                isCompleted && "border-emerald-500/30 bg-emerald-500/15 text-emerald-500",
                !isCurrent && !isCompleted && "border-border/50 bg-background/30 text-muted-foreground",
              )}>
                {isCompleted ? <CheckCircle2 size={13} aria-hidden /> : index + 1}
              </span>
              <span className={cn(
                "whitespace-nowrap text-[12px] font-medium leading-tight",
                isCurrent ? "text-foreground" : "text-muted-foreground/70",
              )}>
                {step.label}
              </span>
            </div>
            {index < arr.length - 1 && (
              <div className="mx-1 h-0 min-w-[16px] flex-1 border-t border-dotted border-muted-foreground/25" aria-hidden />
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

export type CasePrimaryChecklistItem = {
  label: string;
  onClick?: () => void;
};

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
  checklistItems,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  statusLabel: string;
  actionHolderLabel: string;
  waitingOnLabel: string;
  nextStepLabel: string;
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
  checklistItems?: CasePrimaryChecklistItem[];
  secondaryActionLabel?: string | null;
  onSecondaryAction?: () => void;
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
      className="grid gap-5 md:grid-cols-[1.5fr_0.85fr] md:items-start"
    >
      {/* Left: status + checklist */}
      <div className="flex items-start gap-4 md:border-r md:border-border/40 md:pr-6">
        <div className={cn(
          "mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
          statusTone === "blocked" || blocked
            ? "bg-destructive/15 text-destructive"
            : "bg-primary/12 text-primary",
        )}>
          <FileWarning size={20} strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[18px] font-semibold leading-tight text-foreground">{leadTitle}</p>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{leadDescription}</p>
          </div>
          {checklistItems && checklistItems.length > 0 && (
            <ul className="space-y-1.5">
              {checklistItems.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/40 bg-card/20 px-3 py-2.5 text-left transition-colors hover:bg-card/50"
                  >
                    <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40" aria-hidden />
                    <span className="flex-1 text-[13px] font-medium text-foreground">{item.label}</span>
                    <ChevronRight size={14} className="shrink-0 text-muted-foreground/50" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right: actiehouder + CTA */}
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-[11px] font-medium leading-none tracking-wide text-muted-foreground/70">Actiehouder</p>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground ring-1 ring-border/60">
              <UserRound size={16} aria-hidden />
            </div>
            <p className="text-[14px] font-semibold leading-tight text-foreground">{actionHolderLabel}</p>
          </div>
        </div>

        {primaryCtaLabel ? (
          <Button
            type="button"
            onClick={onPrimaryAction}
            disabled={primaryDisabled}
            className="h-11 w-full gap-2 rounded-full bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
          >
            {primaryPending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
            {primaryCtaLabel}
            {!primaryPending ? <ArrowRight size={15} aria-hidden /> : null}
          </Button>
        ) : null}

        {secondaryActionLabel && onSecondaryAction ? (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="flex w-full items-center justify-center gap-1 text-[13px] font-medium text-primary hover:underline"
          >
            {secondaryActionLabel}
            <ChevronRight size={13} aria-hidden />
          </button>
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
      className="rounded-2xl border border-border/55 bg-card/35 px-4 py-4 md:px-5 md:py-5"
      aria-label="Kerngegevens casus"
    >
      <h2 className="mb-3 text-[13px] font-semibold text-muted-foreground">
        Kerngegevens
      </h2>
      <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-3">
        {facts.map((row) => (
          <div
            key={row.label}
            className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/30 pb-2 last:border-0 sm:block sm:border-0 sm:pb-0 sm:last:border-0"
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
      className="rounded-2xl border border-border/55 bg-card/35 px-4 py-4 md:px-5 md:py-5"
      aria-label="Aandachtspunten"
    >
      <h2 className="mb-3 text-[13px] font-semibold text-muted-foreground">
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
                item.tone === "critical" && "bg-care-urgent-bg text-care-urgent-text",
                item.tone === "warning" && "bg-care-warning-bg text-care-warning-text",
                item.tone === "info" && "bg-muted/25 text-foreground",
              )}
            >
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  item.tone === "critical" && "bg-care-urgent-solid",
                  item.tone === "warning" && "bg-care-warning-solid",
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
  caseIncomplete,
  aanmelding,
}: {
  activeTab?: string;
  onTabChange?: (value: string) => void;
  overzicht: ReactNode;
  arrangement: ReactNode;
  matching: ReactNode;
  validatie: ReactNode;
  historie: ReactNode;
  documenten: ReactNode;
  /** When true, locks non-aanmelding tabs and shows aanmelding-phase tab set */
  caseIncomplete?: boolean;
  /** Content for the Aanmelding tab (only shown when caseIncomplete) */
  aanmelding?: ReactNode;
}) {
  const lockedTriggerClass = "text-[12px] cursor-not-allowed opacity-35 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-muted-foreground";

  if (caseIncomplete) {
    return (
      <TooltipProvider>
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full gap-3">
          <TabsList className="h-auto max-w-full flex-wrap justify-start gap-1 bg-muted/30 p-1">
            <TabsTrigger value="overzicht" className="text-[12px]">Overzicht</TabsTrigger>
            <TabsTrigger value="aanmelding" className="text-[12px]">Aanmelding</TabsTrigger>
            <TabsTrigger value="documenten" className="text-[12px]">Documenten</TabsTrigger>
            <TabsTrigger value="activiteit" className="text-[12px]">Activiteit</TabsTrigger>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="arrangement" disabled className={lockedTriggerClass}>
                  <Lock size={12} className="mr-1" aria-hidden />
                  Arrangement
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>Beschikbaar zodra aanmelding compleet is</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="matching" disabled className={lockedTriggerClass}>
                  <Lock size={12} className="mr-1" aria-hidden />
                  Matching
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>Beschikbaar zodra aanmelding compleet is</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="toetsing" disabled className={lockedTriggerClass}>
                  <Lock size={12} className="mr-1" aria-hidden />
                  Toetsing
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>Beschikbaar zodra aanmelding compleet is</TooltipContent>
            </Tooltip>
          </TabsList>
          <TabsContent value="overzicht" className="mt-0 space-y-3">{overzicht}</TabsContent>
          <TabsContent value="aanmelding" className="mt-0 space-y-3">{aanmelding ?? validatie}</TabsContent>
          <TabsContent value="documenten" className="mt-0 space-y-3">{documenten}</TabsContent>
          <TabsContent value="activiteit" className="mt-0 space-y-3">{historie}</TabsContent>
        </Tabs>
      </TooltipProvider>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full gap-3">
      <TabsList className="h-auto max-w-full flex-wrap justify-start gap-1 bg-muted/30 p-1">
        <TabsTrigger value="overzicht" className="text-[12px]">Overzicht</TabsTrigger>
        <TabsTrigger value="arrangement" className="text-[12px]">Arrangement</TabsTrigger>
        <TabsTrigger value="matching" className="text-[12px]">Matching</TabsTrigger>
        <TabsTrigger value="validatie" className="text-[12px]">Toetsing</TabsTrigger>
        <TabsTrigger value="activiteit" className="text-[12px]">Activiteit</TabsTrigger>
        <TabsTrigger value="documenten" className="text-[12px]">Documenten</TabsTrigger>
      </TabsList>
      <TabsContent value="overzicht" className="mt-0 space-y-3">{overzicht}</TabsContent>
      <TabsContent value="arrangement" className="mt-0 space-y-3">{arrangement}</TabsContent>
      <TabsContent value="matching" className="mt-0 space-y-3">{matching}</TabsContent>
      <TabsContent value="validatie" className="mt-0 space-y-3">{validatie}</TabsContent>
      <TabsContent value="activiteit" className="mt-0 space-y-3">{historie}</TabsContent>
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
    <div className="rounded-2xl border border-border/55 bg-card/35 px-4 py-4 md:px-5">
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
    <ul className="divide-y divide-border/30 rounded-2xl border border-border/55 bg-card/35 px-4 py-1 md:px-5">
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
  if ((lower.includes("casusoverzicht") || lower.includes("aanmelding")) && lower.includes("ontbreekt")) return "Verplichte casusgegevens ontbreken";
  if (lower.includes("samenvatting") && lower.includes("ontbreekt")) return "Verplichte casusgegevens ontbreken";
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
