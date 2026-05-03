/**
 * Static guard: Regiekamer NBA telemetry must not live in the same module as
 * audit/governance hooks (see docs/REGIEKAMER_NBA_TELEMETRY.md).
 *
 * Scope: all `.ts` / `.tsx` files under `client/src/` — architecture docs may mention both concepts.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_SRC = join(__dirname, "..");

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkTsFiles(p));
    } else if (ent.isFile() && /\.(tsx?)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

function auditGovernanceSignals(source: string): string[] {
  const found: string[] = [];
  if (source.includes("AuditLog")) found.push("AuditLog");
  if (source.includes("CaseDecisionLog")) found.push("CaseDecisionLog");
  if (source.includes("/audit-log")) found.push("/audit-log");
  return found;
}

describe("Regiekamer NBA ↔ audit/governance coupling", () => {
  it("no client/src file that references nba_ also references audit log infrastructure", () => {
    const violations: string[] = [];
    for (const abs of walkTsFiles(CLIENT_SRC)) {
      /** This file defines matchers containing audit symbols — skip self to avoid a tautological failure. */
      if (basename(abs) === "regiekamerNbaTelemetryBoundary.test.ts") continue;
      const source = readFileSync(abs, "utf8");
      if (!source.includes("nba_")) continue;
      const signals = auditGovernanceSignals(source);
      if (signals.length > 0) {
        violations.push(
          `${relative(CLIENT_SRC, abs)} (nba_ + ${signals.join(", ")})`,
        );
      }
    }
    expect(violations).toEqual([]);
  });
});
