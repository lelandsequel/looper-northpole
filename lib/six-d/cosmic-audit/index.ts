// 6D → COSMIC · Tier 3 — generated-artifact audit (the gate).
//
// `auditGeneratedArtifacts(manifest, runner?)`:
//   1. classify every code-shaped artifact (dev prompts, contracts, scaffolds);
//   2. if NONE contain runnable code → return NOT_WORTHWHILE with the precise
//      REFUSE→RESOLVE resolution (no VANTAGE call, no hollow green pass);
//   3. if some DO contain runnable code → materialise *those* to a temp dir,
//      run VANTAGE over them (subprocess CLI in prod; injected runner in tests),
//      and fold its findings into a NO_OBJECTION / HOLD / REFUSE verdict.
//
// Deterministic for a given (manifest, runner). v1 (`/6d`) is untouched; this
// module imports the engine's *types* and a manifest, nothing more.

import type { RunManifest } from "../types";
import { classifyManifest } from "./classify";
import type {
  ClassifiedArtifact,
  GeneratedArtifactAudit,
  GeneratedArtifactFinding,
  Tier3Verdict,
  VantageReportSlice,
  VantageRunner,
} from "./types";

/**
 * The single sentence Tier 3 exists to say honestly when the artifacts are not
 * yet code-complete. Names exactly what would make the gate worthwhile.
 */
export const NOT_WORTHWHILE_RESOLUTION =
  "Tier 3 is not worthwhile against the current 6D engine: every code-shaped " +
  "artifact is a prompt, a type stub, or a comment-only test skeleton, so " +
  "VANTAGE (a code auditor) would scan them and — correctly — find nothing. " +
  "Wiring it now would ship an always-green gate that audits nothing. " +
  "RESOLVE: Tier 3 becomes valuable the moment a 6D phase emits real runnable " +
  "code — e.g. a Develop sub-phase that fills the Playwright skeleton bodies " +
  "with real `await page…` interactions, or emits a reference implementation " +
  "of the interface contract. At that point this same module routes the " +
  "runnable artifacts to VANTAGE and surfaces its findings as a real gate.";

function buildFindings(
  classified: ClassifiedArtifact[],
  report: VantageReportSlice,
): GeneratedArtifactFinding[] {
  // Map a materialised file back to the element that produced it.
  const byFileTail = new Map<string, ClassifiedArtifact>();
  for (const c of classified) byFileTail.set(c.materializedAs, c);
  const elementForFile = (file: string): string => {
    const tail = file.split(/[\\/]/).pop() ?? file;
    return byFileTail.get(tail)?.elementId ?? `(file:${tail})`;
  };
  return report.pulsar.adversarialFindings.map((f) => ({
    elementId: elementForFile(f.file),
    file: f.file,
    line: f.line,
    severity: f.severity,
    type: f.type,
    description: f.description,
    testCase: f.testCase,
  }));
}

function verdictFromFindings(
  findings: GeneratedArtifactFinding[],
): Exclude<Tier3Verdict, "NOT_WORTHWHILE"> {
  if (findings.some((f) => f.severity === "HIGH")) return "REFUSE";
  if (findings.some((f) => f.severity === "MED")) return "HOLD";
  return "NO_OBJECTION";
}

const RESOLVE_BY_VERDICT: Record<
  Exclude<Tier3Verdict, "NOT_WORTHWHILE">,
  (n: number) => string
> = {
  REFUSE: (n) =>
    `VANTAGE raised ${n} HIGH-severity finding(s) in the generated runnable ` +
    "artifacts. RESOLVE: fix the flagged patterns (e.g. add error boundaries " +
    "around async/await and JSON.parse) before this code is handed to an " +
    "engineer; then re-run the gate (RECOMPUTE).",
  HOLD: (n) =>
    `VANTAGE raised ${n} medium-severity finding(s) in the generated runnable ` +
    "artifacts. RESOLVE: review each with the accountable owner; clear or " +
    "accept-with-reason before handoff.",
  NO_OBJECTION: () =>
    "The generated runnable artifacts were audited by VANTAGE with no HIGH or " +
    "MED findings. Safe to hand off; minor improvements may still apply.",
};

function summarise(audit: Omit<GeneratedArtifactAudit, "summary">): string {
  const total = audit.classified.length;
  const auditable = audit.classified.filter((c) => c.auditable).length;
  if (audit.verdict === "NOT_WORTHWHILE") {
    return `Tier 3 — NOT_WORTHWHILE: ${total} code-shaped artifact(s), 0 contain runnable code (VANTAGE not invoked).`;
  }
  const high = audit.findings.filter((f) => f.severity === "HIGH").length;
  const med = audit.findings.filter((f) => f.severity === "MED").length;
  return `Tier 3 — ${audit.verdict}: ${auditable}/${total} artifact(s) runnable, audited by VANTAGE → ${high} HIGH, ${med} MED finding(s).`;
}

export interface AuditOptions {
  /**
   * How to run VANTAGE over a directory of materialised artifacts. Optional:
   * if omitted and there IS runnable code, the default subprocess runner
   * (`./vantage-runner`) is used. Injectable so tests stay deterministic and
   * the module never hard-depends on the external runtime.
   */
  runner?: VantageRunner;
}

/**
 * Audit the code-shaped artifacts of a completed 6D run. Tier-3 gate.
 *
 * Honest by construction: if nothing is runnable, it REFUSES to invoke VANTAGE
 * and returns NOT_WORTHWHILE with the resolution — it does not fabricate a pass.
 */
export async function auditGeneratedArtifacts(
  manifest: RunManifest,
  opts: AuditOptions = {},
): Promise<GeneratedArtifactAudit> {
  const classified = classifyManifest(manifest);
  const runnable = classified.filter((c) => c.auditable);

  // ── REFUSE → RESOLVE: nothing runnable → no hollow audit. ──────────────────
  if (runnable.length === 0) {
    const base: Omit<GeneratedArtifactAudit, "summary"> = {
      schema: "6d.cosmic.tier3.audit.v1",
      runReceipt: manifest.receipt,
      verdict: "NOT_WORTHWHILE",
      vantageInvoked: false,
      classified,
      findings: [],
      resolution: NOT_WORTHWHILE_RESOLUTION,
    };
    return { ...base, summary: summarise(base) };
  }

  // ── Some artifacts ARE runnable → route them to VANTAGE for real. ──────────
  // Thread each runnable artifact's source body through from the manifest so
  // materialize can write the real text to disk for VANTAGE to scan.
  const bodies = new Map<string, string>();
  for (const art of manifest.artifacts) {
    for (const el of art.elements) bodies.set(el.id, el.body);
  }
  const runner = opts.runner ?? (await loadDefaultRunner());
  const { runVantageOverArtifacts } = await import("./materialize");
  const report = await runVantageOverArtifacts(runnable, runner, bodies);

  const findings = buildFindings(classified, report);
  const verdict = verdictFromFindings(findings);
  const n =
    verdict === "REFUSE"
      ? findings.filter((f) => f.severity === "HIGH").length
      : verdict === "HOLD"
        ? findings.filter((f) => f.severity === "MED").length
        : 0;

  const base: Omit<GeneratedArtifactAudit, "summary"> = {
    schema: "6d.cosmic.tier3.audit.v1",
    runReceipt: manifest.receipt,
    verdict,
    vantageInvoked: true,
    classified,
    findings,
    resolution: RESOLVE_BY_VERDICT[verdict](n),
  };
  return { ...base, summary: summarise(base) };
}

/**
 * Lazily load the real subprocess runner only when actually needed, so this
 * module imports cleanly in a browser/ESM context (the runner pulls in `fs` /
 * `child_process`). Tests inject their own runner and never hit this path.
 */
async function loadDefaultRunner(): Promise<VantageRunner> {
  const mod = await import("./vantage-runner");
  return mod.subprocessVantageRunner();
}

export { classifyManifest } from "./classify";
export type {
  ClassifiedArtifact,
  GeneratedArtifactAudit,
  GeneratedArtifactFinding,
  Tier3Verdict,
  VantageRunner,
  VantageReportSlice,
} from "./types";
