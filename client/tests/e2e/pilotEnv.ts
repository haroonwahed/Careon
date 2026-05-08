/**
 * Canonical pilot Playwright environment (aligned with `./scripts/prepare_pilot_e2e.sh`
 * and `manage.py seed_pilot_e2e`).
 *
 * Password contract:
 * - **E2E_DEMO_PASSWORD** — demo_gemeente + provider accounts (default `pilot_demo_pass_123`)
 * - **E2E_SMOKE_PASSWORD** — `e2e_owner` (default `e2e_pass_123`)
 * - **E2E_PASSWORD** — legacy: if set, used as fallback when the explicit vars above are unset
 *
 * Database: `settings_rehearsal` / `db_rehearsal.sqlite3` when using the prepare script.
 *
 * @see docs/E2E_RUNBOOK.md
 */

/** Django origin for `/login/`, `/register/`, `/dashboard/` (no trailing slash). */
export const E2E_BASE_URL = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:8010").replace(/\/$/, "");

export const DEFAULT_E2E_DEMO_PASSWORD = "pilot_demo_pass_123";
export const DEFAULT_E2E_SMOKE_PASSWORD = "e2e_pass_123";

/** Legacy single-password fallback (both tiers) when explicit tier passwords omitted. */
function legacyPasswordFallback(): string | undefined {
  const v = process.env.E2E_PASSWORD;
  return v != null && v !== "" ? v : undefined;
}

/** Gemeente + providers (`pilot-demo.spec.ts`). */
export function pilotDemoPassword(): string {
  return (
    process.env.E2E_DEMO_PASSWORD ??
    legacyPasswordFallback() ??
    DEFAULT_E2E_DEMO_PASSWORD
  );
}

/** `e2e_owner` and pilot-smoke flows. */
export function pilotSmokePassword(): string {
  return (
    process.env.E2E_SMOKE_PASSWORD ??
    legacyPasswordFallback() ??
    DEFAULT_E2E_SMOKE_PASSWORD
  );
}

export function pilotDemoGemeenteUsername(): string {
  return process.env.E2E_GEMEENTE_USERNAME ?? "demo_gemeente";
}

export function pilotDemoGemeentePassword(): string {
  return process.env.E2E_GEMEENTE_PASSWORD ?? pilotDemoPassword();
}

export function pilotDemoProviderPassword(): string {
  return process.env.E2E_PROVIDER_PASSWORD ?? pilotDemoPassword();
}

export function pilotDemoProviderOneUsername(): string {
  return process.env.E2E_PROVIDER_ONE_USERNAME ?? "demo_provider_brug";
}

export function pilotDemoProviderTwoUsername(): string {
  return process.env.E2E_PROVIDER_TWO_USERNAME ?? "demo_provider_kompas";
}

export function pilotSmokeUsername(): string {
  return process.env.E2E_USERNAME ?? "e2e_owner";
}

/** @deprecated use pilotDemoGemeenteUsername() */
export const E2E_GEMEENTE_USERNAME = pilotDemoGemeenteUsername();

/** @deprecated use pilotDemoProviderOneUsername() */
export const E2E_PROVIDER_ONE_USERNAME = pilotDemoProviderOneUsername();

/** @deprecated use pilotDemoProviderTwoUsername() */
export const E2E_PROVIDER_TWO_USERNAME = pilotDemoProviderTwoUsername();

export const E2E_PROVIDER_ONE_NAME = process.env.E2E_PROVIDER_ONE_NAME ?? "Jeugdzorg De Brug";
export const E2E_PROVIDER_TWO_NAME = process.env.E2E_PROVIDER_TWO_NAME ?? "Kompas Jeugdzorg";
export const E2E_MUNICIPALITY_NAME = process.env.E2E_MUNICIPALITY_NAME ?? "Gemeente Utrecht";
export const E2E_REGION_NAME = process.env.E2E_REGION_NAME ?? "Regio Utrecht";
export const E2E_DEMO_CASE_TITLE =
  process.env.E2E_DEMO_CASE_TITLE ?? "Pilot demo casus: urgente jeugdzorg";

/** @deprecated use pilotSmokeUsername() */
export const E2E_SMOKE_USERNAME = pilotSmokeUsername();
