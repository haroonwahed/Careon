import type { RegiekamerNbaActionKey, RegiekamerNbaUiMode } from "./regiekamerNextBestAction";
import { trackNbaEvent } from "./telemetryAdapter";
import type { RegiekamerNbaTelemetryEvent } from "./telemetrySchema";

export const REGIEKAMER_NBA_ROUTE = "/regiekamer" as const;

export type RegiekamerNbaInstrumentationEventName =
  | "nba_shown"
  | "nba_primary_clicked"
  | "nba_secondary_clicked"
  | "nba_cases_link_clicked"
  | "nba_insight_opened";

/** Which Regiekamer insight `<details>` opened (`nba_insight_opened` only) — UI only; not sent in telemetry v1. */
export type RegiekamerNbaInsightSource = "why" | "flow";

/** Internal context for building telemetry (no title — privacy). */
export type RegiekamerNbaInstrumentationPayload = {
  actionKey: RegiekamerNbaActionKey;
  uiMode: RegiekamerNbaUiMode;
  reasonCount: number;
  route: typeof REGIEKAMER_NBA_ROUTE;
  /** For deterministic unit tests */
  now?: Date;
};

export function buildRegiekamerNbaInstrumentationPayload(args: {
  actionKey: RegiekamerNbaActionKey;
  uiMode: RegiekamerNbaUiMode;
  reasonCount: number;
  /** For deterministic unit tests */
  now?: Date;
}): RegiekamerNbaInstrumentationPayload {
  return {
    actionKey: args.actionKey,
    uiMode: args.uiMode,
    reasonCount: args.reasonCount,
    route: REGIEKAMER_NBA_ROUTE,
    ...(args.now !== undefined ? { now: args.now } : {}),
  };
}

function toTelemetryEvent(
  event: RegiekamerNbaInstrumentationEventName,
  payload: RegiekamerNbaInstrumentationPayload,
): RegiekamerNbaTelemetryEvent {
  const ts = (payload.now ?? new Date()).getTime();
  return {
    event,
    route: payload.route,
    uiMode: payload.uiMode,
    actionKey: payload.actionKey,
    reasonCount: payload.reasonCount,
    timestamp: ts,
    schema_version: "v1",
  };
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

/**
 * Frontend-only: delegates to `trackNbaEvent` (see `telemetryAdapter.ts`).
 */
export function emitRegiekamerNbaEvent(
  event: RegiekamerNbaInstrumentationEventName,
  payload: RegiekamerNbaInstrumentationPayload,
): void {
  trackNbaEvent(toTelemetryEvent(event, payload));
}
