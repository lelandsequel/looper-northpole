#!/usr/bin/env node
/**
 * Smoke: runNorthPoleBuild return must JSON-serialize (server action contract).
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

process.env.VERCEL = "1";
process.env.LOOPER_DATA_DIR = path.join("/tmp", `looper-smoke-${Date.now()}`);

const dataDir = process.env.LOOPER_DATA_DIR;
fs.mkdirSync(dataDir, { recursive: true });

execSync("node scripts/seed.mjs", {
  cwd: process.cwd(),
  stdio: "pipe",
  env: { ...process.env, LOOPER_DATA_DIR: dataDir },
});

// Patch seed to use LOOPER_DATA_DIR — seed.mjs uses ./data hardcoded
// Re-seed via dynamic import of ensureSeeded after fixing paths
const { ensureSeeded } = await import("../lib/store/ensure-seeded.ts");
const { listFundedQueue, runNorthPoleBuild } = await import("../lib/northpole/pipeline.ts");

ensureSeeded();
const funded = listFundedQueue();
const id = funded[0]?.id;
if (!id) throw new Error("no funded initiatives");

const run = await runNorthPoleBuild(id);
const json = JSON.stringify(run);
console.log("serialize ok", json.length, "bytes", run.build.status);