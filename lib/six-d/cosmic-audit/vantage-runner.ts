// 6D → COSMIC · Tier 3 — the real VANTAGE runner (subprocess to its CLI).
//
// INTEGRATION SHAPE (decided after reading the real engine, documented honestly):
//
//   VANTAGE lives at `~/projects/bacchus-audit/vantage`. It is a *separate
//   runtime*: CommonJS + ts-node, Electron + Express dependencies, and it works
//   by walking a directory on disk and shelling out to `git log` (ECLIPSE).
//
//   It therefore CANNOT live in the browser bundle, and does not import cleanly
//   in-process into this ESM/Next.js codebase. The honest integration is a
//   SUBPROCESS to its CLI:
//
//       vantage run <dir> --output <report.json>
//
//   …then parse the JSON report. We read only the `pulsar` and `aurora` slices.
//
//   If/when this gate runs server-side (e.g. behind a `/api/6d/tier3` route),
//   this runner is the boundary that shells out. It is never reached from the
//   browser; `index.ts` lazy-imports it only when there is runnable code.
//
// Note: the real engine's adversarial finder (PULSAR) only inspects files
// ECLIPSE ranks medium/high-risk, so small isolated artifacts may pass even
// with unsafe patterns. That caveat is documented in ./FINDING.md; it is a
// property of the engine, surfaced honestly, not hidden by this wiring.

import * as path from "node:path";
import type { VantageReportSlice, VantageRunner } from "./types";

export interface SubprocessRunnerConfig {
  /** Path to the VANTAGE checkout. Defaults to the known JL location. */
  vantageDir?: string;
  /** Override the invocation (e.g. a globally-installed `vantage`). */
  command?: string;
  args?: (dir: string, outFile: string) => string[];
  /** ms before giving up on the subprocess. */
  timeoutMs?: number;
}

const DEFAULT_VANTAGE_DIR = path.join(
  process.env.HOME ?? "",
  "projects",
  "bacchus-audit",
  "vantage",
);

/**
 * Build a {@link VantageRunner} that shells out to the VANTAGE CLI. The default
 * invocation runs it via the checkout's own `ts-node` so no global install or
 * build step is required:
 *
 *     npx ts-node src/cli.ts run <dir> --output <report.json>
 */
export function subprocessVantageRunner(
  config: SubprocessRunnerConfig = {},
): VantageRunner {
  const vantageDir = config.vantageDir ?? DEFAULT_VANTAGE_DIR;
  const timeoutMs = config.timeoutMs ?? 120_000;

  return async (dir: string): Promise<VantageReportSlice> => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const { spawnSync } = await import("node:child_process");

    const outFile = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "vantage-out-")),
      "report.json",
    );

    const command = config.command ?? "npx";
    const args = config.args
      ? config.args(dir, outFile)
      : ["ts-node", "src/cli.ts", "run", dir, "--output", outFile];

    const res = spawnSync(command, args, {
      cwd: vantageDir,
      timeout: timeoutMs,
      encoding: "utf8",
    });

    if (res.error) {
      throw new Error(
        `VANTAGE subprocess failed to start (${command} in ${vantageDir}): ${res.error.message}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(outFile, "utf8"));
    } catch (e) {
      throw new Error(
        `VANTAGE produced no parseable report at ${outFile}. ` +
          `stderr: ${(res.stderr ?? "").slice(0, 500)}`,
      );
    }

    const report = parsed as Partial<VantageReportSlice>;
    // Normalise defensively — only the slices we consume, never trust shape.
    return {
      pulsar: {
        adversarialFindings: report.pulsar?.adversarialFindings ?? [],
      },
      aurora: {
        score: report.aurora?.score ?? 0,
        verdict: report.aurora?.verdict ?? "REJECTED",
        topIssues: report.aurora?.topIssues ?? [],
      },
    };
  };
}
