import type { CoordinationNbaActionKey, CoordinationNbaUiMode } from "./coordinationNextBestAction";
import { trackNbaEvent } from "./telemetryAdapter";
import type { CoordinationNbaTelemetryEvent } from "./telemetrySchema";

export const COORDINATION_NBA_ROUTE = "/regiekamer" as const;

export type CoordinationNbaInstrumentationEventName =
  | "nba_shown"
  | "nba_primary_clicked"
  | "nba_secondary_clicked"
  | "nba_cases_link_clicked"
  | "nba_insight_opened";

/** Which Coordination insight `<details>` opened (`nba_insight_opened` only) — UI only; not sent in telemetry v1. */
export type CoordinationNbaInsightSource = "why" | "flow";

/** Internal context for building telemetry (no title — privacy). */
export type CoordinationNbaInstrumentationPayload = {
  actionKey: CoordinationNbaActionKey;
  uiMode: CoordinationNbaUiMode;
  reasonCount: number;
  route: typeof COORDINATION_NBA_ROUTE;
  /** For deterministic unit tests */
  now?: Date;
};

export function buildCoordinationNbaInstrumentationPayload(args: {
  actionKey: CoordinationNbaActionKey;
  uiMode: CoordinationNbaUiMode;
  reasonCount: number;
  /** For deterministic unit tests */
  now?: Date;
}): CoordinationNbaInstrumentationPayload {
  return {
    actionKey: args.actionKey,
    uiMode: args.uiMode,
    reasonCount: args.reasonCount,
    route: COORDINATION_NBA_ROUTE,
    ...(args.now !== undefined ? { now: args.now } : {}),
  };
}

function toTelemetryEvent(
  event: CoordinationNbaInstrumentationEventName,
  payload: CoordinationNbaInstrumentationPayload,
): CoordinationNbaTelemetryEvent {
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
 * Deduplicates `nba_shown` for the same Coordination NBA snapshot (e.g. React StrictMode
 * double effect) without suppressing a real re-show after data refresh.
 */
export function shouldEmitCoordinationNbaShown(fingerprint: string, windowMs = 150): boolean {
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
export function resetCoordinationNbaShownDedupeForTests(): void {
  lastShownDedupe = null;
}

/**
 * Frontend-only: delegates to `trackNbaEvent` (see `telemetryAdapter.ts`).
 */
export function emitCoordinationNbaEvent(
  event: CoordinationNbaInstrumentationEventName,
  payload: CoordinationNbaInstrumentationPayload,
): void {
  trackNbaEvent(toTelemetryEvent(event, payload));
}
