/**
 * Regiekamer NBA telemetry sink (frontend-only).
 *
 * Must not import or call AuditLog, CaseDecisionLog, or `/care/api/audit-log/` —
 * see docs/REGIEKAMER_NBA_TELEMETRY.md (R1–R5).
 *
 * AVG / pilot posture:
 *   No event leaves the browser unless BOTH globals are set on `window`:
 *     - `__REGIEKAMER_NBA_CONSENT__ === true` (explicit consent flag)
 *     - `__REGIEKAMER_NBA_TRACK__` (a host-provided sink function)
 *   Both default to undefined, so telemetry is OFF by default. The host shell
 *   (e.g. a tenant-aware loader) is responsible for setting consent only after
 *   the user/operator has agreed, and for wiring the sink to a destination
 *   (the canonical destination — POST /care/api/instrumentation/events/ — is
 *   not yet implemented and remains tracked as a follow-up).
 *
 * Outstanding follow-ups:
 *   - Implement POST /care/api/instrumentation/events/ with rate-limit + retention
 *   - Surface a UI affordance for consent capture
 */
import type { RegiekamerNbaTelemetryEvent } from "./telemetrySchema";

type RegiekamerNbaTrackFn = (event: RegiekamerNbaTelemetryEvent) => void;

interface RegiekamerNbaWindow {
  __REGIEKAMER_NBA_CONSENT__?: boolean;
  __REGIEKAMER_NBA_TRACK__?: RegiekamerNbaTrackFn;
}

function hasConsent(w: RegiekamerNbaWindow): boolean {
  return w.__REGIEKAMER_NBA_CONSENT__ === true;
}

export function trackNbaEvent(event: RegiekamerNbaTelemetryEvent): void {
  if (typeof window === "undefined") {
    return;
  }

  const w = window as Window & RegiekamerNbaWindow;

  if (!hasConsent(w)) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- intentional dev-only instrumentation
      console.debug("[NBA_EVENT_SUPPRESSED_NO_CONSENT]", event);
    }
    return;
  }

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
