import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import type { ArrangementAlignmentSuggestion } from "../../lib/arrangementAlignmentContract";
import { fetchCaseArrangementAlignment } from "../../lib/decisionEvaluation";
import { cn } from "../ui/utils";

type Props = {
  caseId: string;
};

/**
 * Read-only arrangement alignment (v1.3). GET advisory payload — no financial automation.
 */
export function ArrangementAlignmentPanel({ caseId }: Props) {
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

  if (failed || !data?.equivalence_hints?.length) {
    return null;
  }

  const hint = data.equivalence_hints[0]!;
  const uncertaintyLabel =
    hint.uncertainty === "low" ? "Lage onzekerheid" : hint.uncertainty === "medium" ? "Middelmatige onzekerheid" : "Hoge onzekerheid";

  return (
    <section
      data-testid="arrangement-alignment-panel"
      aria-label="Arrangement-afstemming (advies)"
      className="rounded-xl border border-border/70 bg-card/35 px-3.5 py-3"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Info size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Arrangement-afstemming (advies)
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground/90">
              <span className="font-medium text-foreground">{hint.source_label}</span>
              {" → "}
              <span className="font-medium text-foreground">{hint.target_label}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{hint.rationale}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className={cn("rounded-sm border px-1.5 py-0.5 font-medium", "border-border/60 bg-background/40")}>
              Semantiek: {(hint.equivalence_confidence * 100).toFixed(0)}
              %
            </span>
            <span className="rounded-sm border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-100">
              {uncertaintyLabel}
            </span>
            {data.requires_human_confirmation ? (
              <span className="rounded-sm border border-primary/35 bg-primary/10 px-1.5 py-0.5 font-medium text-primary-foreground">
                Menselijke bevestiging vereist
              </span>
            ) : null}
          </div>
          {data.tariff_alignment ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">{data.tariff_alignment.notes}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
