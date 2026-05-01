/**
 * Imperative next-best-action copy (decision system).
 * Used by Regiekamer and casus execution; must stay aligned with API action codes.
 */
export const NBA_IMPERATIVE_LABELS: Record<string, string> = {
  COMPLETE_CASE_DATA: "Vul casusgegevens aan",
  GENERATE_SUMMARY: "Genereer samenvatting",
  START_MATCHING: "Start matching",
  VALIDATE_MATCHING: "Valideer matching",
  SEND_TO_PROVIDER: "Stuur naar aanbieder",
  WAIT_PROVIDER_RESPONSE: "Volg aanbieder op",
  FOLLOW_UP_PROVIDER: "Volg aanbieder op",
  REMATCH_CASE: "Her-match casus",
  CONFIRM_PLACEMENT: "Bevestig plaatsing",
  START_INTAKE: "Start intake",
  MONITOR_CASE: "Bewaak casus",
  ARCHIVE_CASE: "Archiveer casus",
  PROVIDER_ACCEPT: "Verwerk acceptatie",
  PROVIDER_REJECT: "Verwerk afwijzing",
  PROVIDER_REQUEST_INFO: "Beantwoord infoverzoek",
};

export function imperativeLabelForActionCode(
  action: string | null | undefined,
  labelFallback: string | null | undefined,
): string | null {
  const code = action?.trim();
  if (code && NBA_IMPERATIVE_LABELS[code]) {
    return NBA_IMPERATIVE_LABELS[code];
  }
  const label = labelFallback?.trim();
  return label || null;
}
