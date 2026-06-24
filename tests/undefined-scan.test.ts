import assert from "node:assert/strict";
import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import { listFundedQueue, runNorthPoleBuild } from "../lib/northpole/pipeline";

function findUndefined(obj: unknown, p = ""): string[] {
  if (obj === undefined) return [p || "(root)"];
  if (typeof obj !== "object" || obj === null) return [];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => findUndefined(v, `${p}[${i}]`));
  return Object.entries(obj).flatMap(([k, v]) => findUndefined(v, p ? `${p}.${k}` : k));
}

test("scan build result for undefined (breaks server actions)", async () => {
  const dataDir = path.join(process.cwd(), "data");
  for (const f of ["looper-northpole.db", "looper-northpole.db-wal", "looper-northpole.db-shm"]) {
    fs.rmSync(path.join(dataDir, f), { force: true });
  }
  execSync("node scripts/seed.mjs", { cwd: process.cwd(), stdio: "pipe" });

  const run = await runNorthPoleBuild(listFundedQueue()[0]!.id);
  const undef = findUndefined(run);
  assert.equal(undef.length, 0, `undefined at: ${undef.slice(0, 5).join(", ")}`);
});