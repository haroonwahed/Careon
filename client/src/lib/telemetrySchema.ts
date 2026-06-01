/**
 * Minimal Coordination NBA telemetry envelope (v1).
 * No case identifiers; no raw title strings (privacy).
 */
export type CoordinationNbaTelemetryEvent = {
  event: string;
  route: string;
  uiMode: string;
  actionKey?: string;
  reasonCount?: number;
  timestamp: number;
  schema_version: "v1";
};
