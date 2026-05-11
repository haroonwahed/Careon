/**
 * Contract for AI-assisted arrangement alignment (v1.3).
 * Advisory only — never implies guaranteed financial correctness.
 * Wire to a read-only API when implemented; UI must show uncertainty + human confirmation.
 */
export type ArrangementAlignmentUncertainty = "low" | "medium" | "high";

export interface ArrangementEquivalenceHint {
  /** Source arrangement label/code as entered by municipality or provider context */
  source_label: string;
  /** Target arrangement label/code from candidate provider or reference table */
  target_label: string;
  /** 0–1 semantic similarity score (model-dependent; not a legal equivalence proof) */
  equivalence_confidence: number;
  /** Plain-language why the model thinks they might match */
  rationale: string;
  uncertainty: ArrangementAlignmentUncertainty;
}

export interface TariffAlignmentEstimate {
  /** Relative estimate only; currency-specific logic belongs in future services */
  estimated_delta_pct: number | null;
  notes: string;
  uncertainty: ArrangementAlignmentUncertainty;
}

export interface ArrangementAlignmentSuggestion {
  case_id: string;
  generated_at: string;
  equivalence_hints: ArrangementEquivalenceHint[];
  tariff_alignment: TariffAlignmentEstimate | null;
  requires_human_confirmation: true;
  /** Present when payload is rule-based staging (not ML). */
  staging_deterministic?: boolean;
}
