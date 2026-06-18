/**
 * End-to-end: seed → LOOPER prioritize → NORTHPOLE 6D + build → feedback loop.
 * Uses the real SQLite ledger and engines (no HTTP, no mocks).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import { loadAndPrioritize } from "../lib/agility/pipeline";
import { listFundedQueue, runNorthPoleBuild } from "../lib/northpole/pipeline";
import { verifyLedger } from "../lib/store/ledger";

test("E2E: seed → funded queue → 6D COSMIC + Pan gate build → ledger verifies", async () => {
  const dataDir = path.join(process.cwd(), "data");
  for (const f of ["looper-northpole.db", "looper-northpole.db-wal", "looper-northpole.db-shm"]) {
    fs.rmSync(path.join(dataDir, f), { force: true });
  }

  execSync("node scripts/seed.mjs", { cwd: process.cwd(), stdio: "pipe" });

  const queue = loadAndPrioritize();
  assert.ok(queue.funded.length > 0, "seed should produce funded initiatives");
  assert.ok(queue.chainHead, "prioritize should append ledger events");

  const funded = listFundedQueue();
  const target = funded[0]!;
  assert.equal(target._funding, "FUNDED");

  const run = await runNorthPoleBuild(target.id);

  assert.equal(run.initiativeId, target.id);
  assert.ok(run.cosmic.runHash, "6D COSMIC run should produce a hash");
  assert.ok(run.cosmic.ledgerEntry?.hash, "COSMIC run should seal to LUNA");
  assert.equal(run.build.status, "shipped", "self-correcting demo build should ship");
  assert.ok(run.build.rounds.length >= 2, "broken-then-fixed build uses ≥2 rounds");
  assert.ok(run.feedback.buildReceipt, "build feedback should carry a receipt");
  assert.equal(run.strataAudit.refused, false, "STRATA audit fixture should certify");
  assert.ok(run.reprioritized?.chainHead, "feedback should re-prioritize the queue");

  const verify = verifyLedger();
  assert.equal(verify.ok, true, `ledger chain should verify (${verify.count} events)`);
});