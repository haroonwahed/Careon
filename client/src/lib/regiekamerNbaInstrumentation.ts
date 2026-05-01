import type { RegiekamerNbaActionKey, RegiekamerNbaUiMode } from "./regiekamerNextBestAction";

export const REGIEKAMER_NBA_ROUTE = "/regiekamer" as const;

export type RegiekamerNbaInstrumentationEventName =
  | "nba_shown"
  | "nba_primary_clicked"
  | "nba_secondary_clicked"
  | "nba_cases_link_clicked"
  | "nba_insight_opened";

/** Which Regiekamer insight `<details>` opened (`nba_insight_opened` only). */
export type RegiekamerNbaInsightSource = "why" | "flow";

export type RegiekamerNbaInstrumentationPayload = {
  actionKey: RegiekamerNbaActionKey;
  uiMode: RegiekamerNbaUiMode;
  title: string;
  reasonCount: number;
  timestamp: string;
  route: typeof REGIEKAMER_NBA_ROUTE;
  /** Present for `nba_insight_opened` — extend with more literals when disclosures grow */
  source?: RegiekamerNbaInsightSource;
};

export function buildRegiekamerNbaInstrumentationPayload(args: {
  actionKey: RegiekamerNbaActionKey;
  uiMode: RegiekamerNbaUiMode;
  title: string;
  reasonCount: number;
  /** For deterministic unit tests */
  now?: Date;
  source?: RegiekamerNbaInsightSource;
}): RegiekamerNbaInstrumentationPayload {
  const t = args.now ?? new Date();
  const base: RegiekamerNbaInstrumentationPayload = {
    actionKey: args.actionKey,
    uiMode: args.uiMode,
    title: args.title,
    reasonCount: args.reasonCount,
    timestamp: t.toISOString(),
    route: REGIEKAMER_NBA_ROUTE,
  };
  if (args.source !== undefined) {
    base.source = args.source;
  }
  return base;
}

let lastShownDedupe: { fingerprint: string; at: number } | null = null;

/**
 * Deduplicates `nba_shown` for the same Regiekamer NBA snapshot (e.g. React StrictMode
 * double effect) without suppressing a real re-show after data refresh.
 */
export function shouldEmitRegiekamerNbaShown(fingerprint: string, windowMs = 150): boolean {
  const now = Date.now();
  if (
    lastShownDedupe &&
    lastShownDedupe.fingerprint === fingerprint &&
    now - lastShownDedupe.at < windowMs
  ) {
    return false;
  }
  lastShownDedupe = { fingerprint, at: now };
  return true;
}

/** @internal */
export function resetRegiekamerNbaShownDedupeForTests(): void {
  lastShownDedupe = null;
}

type RegiekamerNbaTrackFn = (
  event: RegiekamerNbaInstrumentationEventName,
  payload: RegiekamerNbaInstrumentationPayload,
) => void;

function getOptionalTrack(): RegiekamerNbaTrackFn | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const w = window as Window & { __REGIEKAMER_NBA_TRACK__?: RegiekamerNbaTrackFn };
  return typeof w.__REGIEKAMER_NBA_TRACK__ === "function" ? w.__REGIEKAMER_NBA_TRACK__ : undefined;
}

/**
 * Frontend-only hook: logs in development; optional `window.__REGIEKAMER_NBA_TRACK__`
 * for staging/analytics wiring later (same payload shape).
 */
export function emitRegiekamerNbaEvent(
  event: RegiekamerNbaInstrumentationEventName,
  payload: RegiekamerNbaInstrumentationPayload,
): void {
  const track = getOptionalTrack();
  if (track) {
    track(event, payload);
    return;
  }
  if (!import.meta.env.DEV) {
    return;
  }
  // eslint-disable-next-line no-console -- intentional dev-only instrumentation
  console.debug("[regiekamer-nba]", event, payload);
}
