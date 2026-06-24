import assert from "node:assert/strict";
import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import { toNorthPoleRunView } from "../lib/northpole/client-view";
import { listFundedQueue, runNorthPoleBuild } from "../lib/northpole/pipeline";

test("runNorthPoleBuild return serializes for server actions", async () => {
  const dataDir = path.join(process.cwd(), "data");
  for (const f of ["looper-northpole.db", "looper-northpole.db-wal", "looper-northpole.db-shm"]) {
    fs.rmSync(path.join(dataDir, f), { force: true });
  }
  execSync("node scripts/seed.mjs", { cwd: process.cwd(), stdio: "pipe" });

  const target = listFundedQueue()[0]!;
  const run = await runNorthPoleBuild(target.id);

  const view = toNorthPoleRunView(run);
  assert.doesNotThrow(() => JSON.stringify(view));
  const fullBytes = JSON.stringify(run).length;
  const viewBytes = JSON.stringify(view).length;
  assert.ok(viewBytes < fullBytes, "client view should be smaller than full run");
  assert.ok(viewBytes < 500_000, `client view too large: ${viewBytes}`);
});