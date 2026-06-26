/**
 * LOOPER → Jira emit adapter — extract, verify, file emitter.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { INITIATIVES } from "../lib/agility/seed/initiatives.mjs";
import { initiativeToIntent } from "../lib/loop/adapter";
import { runSixDCosmic } from "../lib/six-d/cosmic";
import { extractJiraPayload } from "../lib/jira/extract";
import { emitJiraToFile } from "../lib/jira/emit-file";
import { verifyJiraEmit } from "../lib/jira/verify";
import { DATA_DIR } from "../lib/store/paths";

const HL002 = INITIATIVES.find((i) => i.id === "HL-002")!;

test("extract lifts epic + stories with acceptance criteria from Distribute", async () => {
  const intent = initiativeToIntent(HL002);
  const { run, entry } = await runSixDCosmic(intent);
  const payload = extractJiraPayload(run, "HL-002", entry.hash);
  assert.ok(payload, "epic and stories should exist");
  assert.equal(payload!.initiativeId, "HL-002");
  assert.equal(payload!.specReceipt, entry.hash);
  assert.equal(payload!.cosmicRunHash, run.runHash);
  assert.ok(payload!.epic.title.length > 0);
  assert.ok(payload!.stories.length > 0);
  for (const story of payload!.stories) {
    assert.ok(story.acceptanceCriteria.length > 0, `${story.storyId} should have ACs`);
  }
});

test("verify passes on a sealed COSMIC run with LUNA receipt", async () => {
  const intent = initiativeToIntent(HL002);
  const { run, entry } = await runSixDCosmic(intent);
  const result = await verifyJiraEmit(run, "HL-002", entry.hash);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.emitHash, /^[0-9a-f]{64}$/);
    assert.equal(result.payload.stories.length, result.payload.stories.length);
  }
});

test("verify refuses without a valid spec receipt", async () => {
  const intent = initiativeToIntent(HL002);
  const { run } = await runSixDCosmic(intent);
  const result = await verifyJiraEmit(run, "HL-002", "");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.reasons.some((r) => r.includes("spec receipt")));
  }
});

test("verify refuses when a story has no acceptance criteria", async () => {
  const intent = initiativeToIntent(HL002);
  const { run, entry } = await runSixDCosmic(intent);
  const distribute = run.manifest.artifacts.find((a) => a.phase === "distribute")!;
  const story = distribute.elements.find((e) => e.kind === "story")!;
  if (story.fields) {
    story.fields.acRefs = [];
  }
  const result = await verifyJiraEmit(run, "HL-002", entry.hash);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.reasons.some((r) => r.includes("no acceptance criteria")));
  }
});

test("deterministic — same run ⇒ same emit hash", async () => {
  const intent = initiativeToIntent(HL002);
  const a = await runSixDCosmic(intent);
  const b = await runSixDCosmic(intent);
  const va = await verifyJiraEmit(a.run, "HL-002", a.entry.hash);
  const vb = await verifyJiraEmit(b.run, "HL-002", b.entry.hash);
  assert.equal(va.ok, true);
  assert.equal(vb.ok, true);
  if (va.ok && vb.ok) {
    assert.equal(va.emitHash, vb.emitHash);
    assert.deepEqual(va.payload, vb.payload);
  }
});

test("file emitter writes verified JSON under data/jira-emits/", async () => {
  const intent = initiativeToIntent(HL002);
  const { run, entry } = await runSixDCosmic(intent);
  const verified = await verifyJiraEmit(run, "HL-002", entry.hash);
  assert.equal(verified.ok, true);
  if (!verified.ok) return;

  const filePath = emitJiraToFile(verified.payload, verified.emitHash);
  assert.ok(fs.existsSync(filePath));
  assert.ok(filePath.startsWith(path.join(DATA_DIR, "jira-emits")));
  const written = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.equal(written.schema, "looper.jira.emit.v1");
  assert.equal(written.initiativeId, "HL-002");
  fs.rmSync(filePath, { force: true });
});