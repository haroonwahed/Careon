import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, LayoutGrid } from "lucide-react";
import type { ArrangementAlignmentSuggestion } from "../../lib/arrangementAlignmentContract";
import { fetchCaseArrangementAlignment } from "../../lib/decisionEvaluation";
import { toCareMatching } from "../../lib/routes";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { cn } from "../ui/utils";

/** Compact requested-care context from casus execution (operational scan). */
export type ArrangementAlignmentCareContext = {
  zorgvorm: string;
  regio: string;
  aanmelder: string;
  zorgintensiteit: string;
  startperiode: string;
  korteSamenvatting: string;
};

type Props = {
  caseId: string;
  /** When omitted, the left column shows placeholders until backend adds structured context. */
  careContext?: ArrangementAlignmentCareContext | null;
};

function pctFromConfidence(equivalenceConfidence: number): number {
  return Math.round(Math.max(0, Math.min(1, equivalenceConfidence)) * 100);
}

/** Operational confidence band (percent is 0–100 of equivalence score). */
function operationalMatchBandLabel(percent: number): {
  label: string;
  badgeVariant: "default" | "blue" | "yellow" | "red";
} {
  if (percent >= 85) {
    return { label: "Sterke overeenkomst", badgeVariant: "default" };
  }
  if (percent >= 65) {
    return { label: "Waarschijnlijk passend", badgeVariant: "blue" };
  }
  if (percent >= 45) {
    return { label: "Handmatige beoordeling aanbevolen", badgeVariant: "yellow" };
  }
  return { label: "Lage overeenkomst", badgeVariant: "red" };
}

function uncertaintyOperationalLine(level: "low" | "medium" | "high"): string {
  if (level === "low") {
    return "Beperkte twijfel over het arrangement.";
  }
  if (level === "medium") {
    return "Enkele onzekerheden; controleer tegen beleid en contract.";
  }
  return "Meerdere onzekerheden; extra toetsing nodig.";
}

function shortMatchReason(rationale: string, maxLen = 100): string {
  const t = rationale.trim();
  if (!t) {
    return "Indicatieve referentie — zie toelichting.";
  }
  const firstSentence = t.split(/(?<=[.!?])\s+/)[0]?.trim() ?? t;
  const chunk =
    firstSentence.length > maxLen ? firstSentence.slice(0, maxLen).trim() : firstSentence;
  const shortened = chunk.length < t.length;
  return shortened ? `${chunk}…` : chunk;
}

function matchQualityBarClass(percent: number): string {
  if (percent >= 85) {
    return "bg-emerald-500/80";
  }
  if (percent >= 65) {
    return "bg-sky-500/75";
  }
  if (percent >= 45) {
    return "bg-amber-400/85";
  }
  return "bg-rose-500/70";
}

type SuggestionCardProps = {
  hintIndex: number;
  hint: ArrangementAlignmentSuggestion["equivalence_hints"][number];
  municipalityLine: string;
  tariffSummary: string;
  defaultOpen?: boolean;
};

function ArrangementSuggestionCard({
  hintIndex,
  hint,
  municipalityLine,
  tariffSummary,
  defaultOpen = false,
}: SuggestionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const pct = pctFromConfidence(hint.equivalence_confidence);
  const band = operationalMatchBandLabel(pct);
  const detailId = useId();

  return (
    <article
      className={cn(
        "rounded-xl border border-border/60 bg-card/50 p-3.5 shadow-sm",
        hintIndex === 0 && "ring-1 ring-primary/20",
      )}
      aria-label={`Suggestie ${hintIndex + 1}: ${hint.target_label}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {hintIndex === 0 ? "Beste match" : `Alternatief ${hintIndex}`}
          </p>
          <h3 className="text-[15px] font-semibold leading-snug text-foreground line-clamp-2">
            {hint.target_label}
          </h3>
          <p className="text-[12px] text-muted-foreground">{municipalityLine}</p>
        </div>
        <Badge
          variant={band.badgeVariant}
          className="max-w-full shrink whitespace-normal text-center text-[10px] leading-snug sm:max-w-[11.5rem] sm:text-[11px]"
        >
          {band.label}
        </Badge>
      </div>

      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>Matchkwaliteit</span>
          <span className="font-medium normal-case text-foreground/70">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80" role="presentation">
          <div
            className={cn("h-full rounded-full transition-[width]", matchQualityBarClass(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {!open ? (
        <p className="mt-3 text-[13px] leading-snug text-foreground/90">{shortMatchReason(hint.rationale)}</p>
      ) : null}
      <p className={cn("text-[12px] text-muted-foreground", open ? "mt-3" : "mt-2")}>{tariffSummary}</p>

      <Collapsible open={open} onOpenChange={setOpen} className="mt-3 border-t border-border/50 pt-2.5">
        <CollapsibleTrigger
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-lg py-1.5 text-left text-[13px] font-medium text-primary hover:bg-muted/30"
          aria-expanded={open}
          aria-controls={detailId}
        >
          Bekijk details
          <ChevronDown
            size={16}
            className={cn("shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent id={detailId} className="data-[state=closed]:animate-none">
          <div className="mt-2 space-y-2 rounded-lg bg-muted/25 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            <p>
              <span className="font-medium text-foreground/85">Vergelijking: </span>
              <span className="text-foreground/80">{hint.source_label}</span>
              {" → "}
              <span className="text-foreground/80">{hint.target_label}</span>
            </p>
            <p className="text-foreground/80">{hint.rationale}</p>
            <p className="text-[11px] text-muted-foreground/90">
              Onzekerheid: {uncertaintyOperationalLine(hint.uncertainty)}
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
}

/**
 * Read-only arrangement alignment (v1.3). GET advisory payload — no financial automation.
 * Operational comparison surface: requested care, top suggestions, decision context.
 */
export function ArrangementAlignmentPanel({ caseId, careContext }: Props) {
  const [data, setData] = useState<ArrangementAlignmentSuggestion | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCaseArrangementAlignment(caseId);
        if (!cancelled) {
          setData(res);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setData(null);
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const topHints = useMemo(() => data?.equivalence_hints?.slice(0, 3) ?? [], [data?.equivalence_hints]);
  const totalHintsRaw = data?.equivalence_hints?.length ?? 0;

  const maxArrangementUncertainty = useMemo(() => {
    const order = { low: 0, medium: 1, high: 2 } as const;
    let max: "low" | "medium" | "high" = "low";
    for (const h of topHints) {
      if (order[h.uncertainty] > order[max]) {
        max = h.uncertainty;
      }
    }
    return max;
  }, [topHints]);

  if (failed || !data?.equivalence_hints?.length) {
    return null;
  }

  const municipalityLineBase =
    careContext?.regio && careContext.regio !== "—"
      ? `Regio / gemeente: ${careContext.regio}`
      : "Regio / gemeente: niet ingevuld";

  const tariffSummaryGlobal =
    data.tariff_alignment?.estimated_delta_pct != null
      ? `Indicatief verschil: ${data.tariff_alignment.estimated_delta_pct}%`
      : "Indicatieve tariefband: niet automatisch bepaald";

  const financialValidationRequired =
    Boolean(data.tariff_alignment?.uncertainty === "high") || Boolean(data.tariff_alignment?.notes);

  /** Matching workspace with this case opened — gemeentelijke validatie / voorstel vastleggen. */
  const primaryHref = toCareMatching(caseId);

  const hintCapacityNote = (() => {
    if (totalHintsRaw > 3) {
      return "Toont de eerste drie suggesties uit dit advies.";
    }
    if (totalHintsRaw === 1) {
      return "Er is momenteel één automatische referentie; geen extra suggesties in dit advies.";
    }
    if (totalHintsRaw === 2) {
      return "Twee referenties in dit advies; geen derde automatische suggestie.";
    }
    return null;
  })();

  const dash = "—";

  return (
    <section
      data-testid="arrangement-alignment-panel"
      aria-label="Arrangement-afstemming (advies)"
      className="rounded-2xl border border-border/60 bg-card/30 p-4 sm:p-5"
    >
      <header className="mb-5 flex flex-wrap items-start gap-3 border-b border-border/50 pb-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <LayoutGrid size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Arrangement-afstemming (advies)
          </p>
          <h2 className="text-base font-semibold leading-tight text-foreground sm:text-[17px]">
            Vergelijk aangevraagde zorg met arrangementreferenties
          </h2>
          <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
            Advies ter ondersteuning van uw beoordeling — geen automatische toewijzing of tariefcorrectheid.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
        {/* LEFT — requested care */}
        <div className="w-full shrink-0 space-y-2 xl:w-[min(100%,260px)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Aangevraagde zorg
          </p>
          <div className="rounded-xl border border-border/55 bg-background/40 p-3.5">
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex justify-between gap-3 border-b border-border/40 pb-2">
                <dt className="text-muted-foreground">Zorgvorm</dt>
                <dd className="max-w-[58%] text-right font-medium text-foreground">
                  {careContext?.zorgvorm?.trim() || dash}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-border/40 pb-2">
                <dt className="text-muted-foreground">Regio</dt>
                <dd className="max-w-[58%] text-right font-medium text-foreground">
                  {careContext?.regio?.trim() || dash}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-border/40 pb-2">
                <dt className="text-muted-foreground">Aanmelder</dt>
                <dd className="max-w-[58%] text-right font-medium text-foreground">
                  {careContext?.aanmelder?.trim() || dash}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-border/40 pb-2">
                <dt className="text-muted-foreground">Zorgintensiteit</dt>
                <dd className="max-w-[58%] text-right font-medium text-foreground">
                  {careContext?.zorgintensiteit?.trim() || dash}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-border/40 pb-2">
                <dt className="text-muted-foreground">Startperiode</dt>
                <dd className="max-w-[58%] text-right font-medium text-foreground">
                  {careContext?.startperiode?.trim() || dash}
                </dd>
              </div>
            </dl>
            <p className="mt-3 border-t border-border/40 pt-3 text-[12px] leading-snug text-foreground/85 line-clamp-4">
              {careContext?.korteSamenvatting?.trim() || "Geen korte samenvatting beschikbaar."}
            </p>
          </div>
        </div>

        {/* CENTER — suggestions */}
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Suggesties (max. 3)
          </p>
          <div className="space-y-3">
            {topHints.map((hint, index) => (
              <ArrangementSuggestionCard
                key={`${hint.target_label}-${hint.source_label}-${index}`}
                hintIndex={index}
                hint={hint}
                municipalityLine={municipalityLineBase}
                tariffSummary={tariffSummaryGlobal}
                defaultOpen={false}
              />
            ))}
          </div>
          {hintCapacityNote ? (
            <p className="text-[12px] leading-snug text-muted-foreground" role="status">
              {hintCapacityNote}
            </p>
          ) : null}

          <Collapsible className="group/finctx rounded-xl border border-dashed border-border/50 bg-muted/15">
            <CollapsibleTrigger
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[12px] font-medium text-muted-foreground hover:bg-muted/25"
            >
              Financiële en technische context
              <ChevronDown
                size={14}
                className="shrink-0 transition-transform group-data-[state=open]/finctx:rotate-180"
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 border-t border-border/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                {data.tariff_alignment?.notes ? <p>{data.tariff_alignment.notes}</p> : null}
                {data.staging_deterministic ? (
                  <p className="text-[11px]">Vergelijking op basis van vaste regels en referentietabellen (geen vrije tekstmodel).</p>
                ) : null}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* RIGHT — decision context */}
        <aside className="w-full shrink-0 space-y-3 xl:w-[min(100%,280px)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Besliscontext
          </p>
          <div className="rounded-xl border border-border/55 bg-background/40 p-3.5 space-y-3">
            <ul className="space-y-2 text-[12px] leading-snug text-foreground/90">
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                <span>
                  {data.requires_human_confirmation
                    ? "Menselijke bevestiging vereist vóór formele vaststelling."
                    : "Geen expliciete menselijke bevestiging gemarkeerd — blijf toetsen aan beleid."}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-400/70" aria-hidden />
                <span>
                  {financialValidationRequired
                    ? "Financiële validatie vereist: tarieven en bekostiging niet geautomatiseerd."
                    : "Controleer tarieven desalniettemin inhoudelijk in het contract."}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sky-400/60" aria-hidden />
                <span>Arrangement: {uncertaintyOperationalLine(maxArrangementUncertainty)}</span>
              </li>
            </ul>
            <div className="border-t border-border/50 pt-3 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Volgende stap
              </p>
              <p className="text-[12px] leading-snug text-muted-foreground">
                Open het matching-overzicht met deze casus om het voorstel te controleren en door te sturen naar
                gemeentelijke validatie wanneer u akkoord bent.
              </p>
              <Button asChild className="mt-1 w-full rounded-full text-[13px] font-semibold" size="default">
                <a href={primaryHref}>Vraag gemeentelijke validatie aan</a>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
