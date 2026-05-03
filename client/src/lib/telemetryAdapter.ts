/**
 * Regiekamer NBA telemetry sink (frontend-only).
 *
 * Must not import or call AuditLog, CaseDecisionLog, or `/care/api/audit-log/` —
 * see docs/REGIEKAMER_NBA_TELEMETRY.md (R1–R5).
 */
import type { RegiekamerNbaTelemetryEvent } from "./telemetrySchema";

type RegiekamerNbaTrackFn = (event: RegiekamerNbaTelemetryEvent) => void;

// TODO:
// - Add consent check
// - Add POST /care/api/instrumentation/events/
// - Add rate limiting
// - Add retention policy

export function trackNbaEvent(event: RegiekamerNbaTelemetryEvent): void {
  if (typeof window === "undefined") {
    return;
  }

  const w = window as Window & { __REGIEKAMER_NBA_TRACK__?: RegiekamerNbaTrackFn };
  const tracker = w.__REGIEKAMER_NBA_TRACK__;

  if (typeof tracker !== "function") {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- intentional dev-only instrumentation
      console.debug("[NBA_EVENT]", event);
    }
    return;
  }

  tracker(event);
}
