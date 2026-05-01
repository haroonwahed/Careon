const STATUS_LABELS: Record<string, string> = {
  DRAFT_CASE: "Casus",
  SUMMARY_READY: "Samenvatting",
  MATCHING_READY: "Matching",
  PROVIDER_REVIEW_PENDING: "Wacht op aanbieder",
  PROVIDER_ACCEPTED: "Aanbieder akkoord",
  PROVIDER_REJECTED: "Aanbieder afwijzing",
  PLACEMENT_CONFIRMED: "Plaatsing",
  INTAKE_STARTED: "Intake",
  ARCHIVED: "Gearchiveerd",
};

const REASON_PATTERNS: Array<[RegExp, string]> = [
  [/samenvatting.*ontbreekt/i, "Samenvatting ontbreekt"],
  [/matching.*kan nog niet starten/i, "Matching wacht"],
  [/geen passende aanbieder/i, "Geen passende aanbieder"],
  [/geen zichtbare risico/i, "Geen zichtbaar risico"],
  [/capaciteit.*tekort/i, "Capaciteitstekort"],
  [/aanvullende informatie/i, "Info nodig"],
  [/intake.*nog niet gestart/i, "Intake nog niet gestart"],
  [/plaatsing.*bevestigd/i, "Plaatsing bevestigd"],
  [/afgewezen/i, "Afgewezen"],
  [/wacht op aanbieder/i, "Wacht op aanbieder"],
  [/beoordeling door aanbieder/i, "Beoordeling"],
  [/volgende beste actie/i, "Actie"],
];

function trimText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function shortenText(text: string, limit = 80): string {
  const cleaned = trimText(text);
  if (cleaned.length <= limit) {
    return cleaned;
  }

  const sentenceEnd = cleaned.search(/[.!?]\s/);
  if (sentenceEnd > 0 && sentenceEnd < limit) {
    return `${cleaned.slice(0, sentenceEnd + 1).trim()}…`;
  }

  return `${cleaned.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

export function getShortStatusLabel(value: string | null | undefined): string {
  if (!value) {
    return "Status";
  }

  return STATUS_LABELS[value] ?? shortenText(value, 18);
}

export function getShortReasonLabel(value: string | null | undefined, limit = 56): string {
  if (!value) {
    return "Geen toelichting";
  }

  const cleaned = trimText(value);

  for (const [pattern, label] of REASON_PATTERNS) {
    if (pattern.test(cleaned)) {
      return label;
    }
  }

  return shortenText(cleaned, limit);
}

export function getTooltipExplanation(value: string | null | undefined): string {
  return trimText(value ?? "");
}

export function getShortActionLabel(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const cleaned = trimText(value);
  const mappings: Array<[RegExp, string]> = [
    [/plaatsing bevestigen/i, "Bevestig"],
    [/beoordeling uitvoeren/i, "Beoordeel"],
    [/meer informatie vragen/i, "Meer info"],
    [/bekijk aanbiederreactie/i, "Bekijk reactie"],
    [/bekijk matchvoorstel/i, "Bekijk match"],
    [/start matching/i, "Match"],
    [/volg beoordeling op/i, "Opvolgen"],
    [/vul casus aan/i, "Vul aan"],
    [/genereer samenvatting/i, "Genereer"],
    [/bevestig samenvatting/i, "Bevestig"],
    [/stuur door naar aanbiederbeoordeling/i, "Naar aanbieder"],
    [/stuur naar aanbieder/i, "Naar aanbieder"],
    [/wachtlijstvoorstel doen/i, "Wachtlijst"],
    [/vraag heroverweging aan/i, "Heroverweeg"],
    [/open workflow/i, "Open"],
    [/open intake/i, "Open intake"],
    [/plaatsing starten/i, "Start plaatsing"],
  ];

  for (const [pattern, label] of mappings) {
    if (pattern.test(cleaned)) {
      return label;
    }
  }

  return shortenText(cleaned, 28);
}

export function getEmptyStateCopy(context: "casussen" | "matching" | "beoordeling" | "plaatsing" | "intake" | "regiekamer" | "default"): string {
  switch (context) {
    case "casussen":
      return "Geen casussen.";
    case "matching":
      return "Geen matches.";
    case "beoordeling":
      return "Geen open beoordelingen.";
    case "plaatsing":
      return "Geen plaatsingen.";
    case "intake":
      return "Geen open intake.";
    case "regiekamer":
      return "Geen acties nodig.";
    default:
      return "Geen resultaten.";
  }
}
