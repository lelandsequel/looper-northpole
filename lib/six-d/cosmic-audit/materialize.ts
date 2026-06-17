// 6D → COSMIC · Tier 3 — materialise runnable artifacts for VANTAGE.
//
// VANTAGE reads CODE FROM DISK (it walks a directory). 6D artifacts are strings
// in a manifest. So to audit them we must write the runnable ones to a temp
// directory with sensible extensions, hand the directory to the runner, then
// clean up. Node-only (`fs`/`os`/`path`); never imported from the browser path.

import type { ClassifiedArtifact, VantageReportSlice, VantageRunner } from "./types";

/**
 * Write the runnable artifacts' source to a fresh temp dir under their
 * `materializedAs` names. We do not have the source text on the classified
 * record (it only carries signals), so callers pass the bodies alongside.
 */
export async function materializeRunnable(
  artifacts: Array<ClassifiedArtifact & { body: string }>,
): Promise<{ dir: string; cleanup: () => void }> {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "6d-tier3-"));
  for (const a of artifacts) {
    fs.writeFileSync(path.join(dir, a.materializedAs), a.body, "utf8");
  }
  return {
    dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    },
  };
}

/**
 * The bridge `index.ts` calls: materialise the runnable artifacts, run VANTAGE
 * over the directory via the injected runner, clean up, return the report.
 *
 * The runnable artifacts must carry their `body` (the source to write). The
 * caller in `index.ts` attaches it from the manifest before invoking.
 */
export async function runVantageOverArtifacts(
  runnable: ClassifiedArtifact[],
  runner: VantageRunner,
  bodies?: Map<string, string>,
): Promise<VantageReportSlice> {
  // Bodies may be supplied explicitly (preferred) or already attached.
  const withBody = runnable.map((a) => ({
    ...a,
    body: (a as ClassifiedArtifact & { body?: string }).body ?? bodies?.get(a.elementId) ?? "",
  }));
  const { dir, cleanup } = await materializeRunnable(withBody);
  try {
    return await runner(dir);
  } finally {
    cleanup();
  }
}
