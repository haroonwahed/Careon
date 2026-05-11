/**
 * Imperative next-best-action copy (decision system).
 * Used by Regiekamer and casus execution; must stay aligned with API action codes.
 */
export const NBA_IMPERATIVE_LABELS: Record<string, string> = {
  COMPLETE_CASE_DATA: "Vul aanvraag aan",
  GENERATE_SUMMARY: "Vul aanvraag aan",
  START_MATCHING: "Zoek zorgcapaciteit",
  VALIDATE_MATCHING: "Controleer matchvoorstel",
  SEND_TO_PROVIDER: "Vraag reactie aanbieder",
  WAIT_PROVIDER_RESPONSE: "Wacht op reactie",
  FOLLOW_UP_PROVIDER: "Herinner aanbieder",
  REMATCH_CASE: "Zoek opnieuw capaciteit",
  CONFIRM_PLACEMENT: "Bevestig plaatsing",
  START_INTAKE: "Start overdracht",
  MONITOR_CASE: "Volg doorstroom",
  ARCHIVE_CASE: "Rond traject af",
  PROVIDER_ACCEPT: "Verwerk acceptatie",
  PROVIDER_REJECT: "Verwerk afwijzing",
  PROVIDER_REQUEST_INFO: "Beantwoord infoverzoek",
  BUDGET_APPROVE: "Budgetverzoek beoordelen",
  BUDGET_REJECT: "Wijs budget af",
  BUDGET_REQUEST_INFO: "Vraag onderbouwing budget op",
  BUDGET_DEFER: "Stel budgetbesluit uit",
  COMPLETE_WIJKTEAM_INTAKE: "Wijkteam intake afronden",
  COMPLETE_ZORGVRAAG_ASSESSMENT: "Zorgvraag beoordelen",
  ACTIVATE_PLACEMENT_MONITORING: "Actieve plaatsing activeren",
};

/**
 * Defensive rewrites for legacy/unmapped labels that frame system automation as
 * manual human work. The Regielaag UX principle is that automation must never
 * appear as a CTA — humans only act when judgment is required. If a label slips
 * through that talks about "genereren" of summary/report, rewrite it to a
 * human-imperative ("Vul casus aan") or null it out so the caller falls back to
 * a status display instead of a manual-looking button.
 */
const LEGACY_AUTOMATION_LABEL_REWRITES: Array<[RegExp, string | null]> = [
  [/genereer\s+samenvatting/i, "Vul aanvraag aan"],
  [/samenvatting\s+genereren/i, "Vul aanvraag aan"],
  [/genereer\s+rapportage/i, null],
  [/rapportage\s+genereren/i, null],
  [/start\s+ai[-\s]?verwerking/i, null],
];

export function imperativeLabelForActionCode(
  action: string | null | undefined,
  labelFallback: string | null | undefined,
): string | null {
  const code = action?.trim();
  if (code && NBA_IMPERATIVE_LABELS[code]) {
    return NBA_IMPERATIVE_LABELS[code];
  }
  const label = labelFallback?.trim();
  if (!label) return null;
  for (const [pattern, replacement] of LEGACY_AUTOMATION_LABEL_REWRITES) {
    if (pattern.test(label)) {
      return replacement;
    }
  }
  return label;
}
