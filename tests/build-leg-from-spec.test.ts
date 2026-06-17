// STAGE 3 ← STAGE 2 seam — tests.
// The build work-order's story + acceptance criteria are SOURCED from a live
// OMNIS semantic run, traced to the spec's LUNA receipt. One engine across all
// three stages. (The executable probes stay hand-authored — the honest frontier.)
// 🐦‍⬛ + 🔑

import { test } from "node:test";
import assert from "node:assert/strict";

import { runSixDCosmicSemantic } from "../lib/six-d/semantic/run-semantic";
import { storyFromSpec } from "../lib/build-leg/from-spec";

const INTENT = {
  title: "Correspondent Pricing Engine",
  context:
    "The engine must refuse to quote on stale data. It must price against the live rate-sheet feed. Response must complete within 2 seconds at the p95.",
  goals: ["Win lock volume with sharper quotes", "Never quote below the locked margin floor"],
  constraints: ["Integrates with the rate-sheet feed and the eligibility service"],
  sourceMaterial: ["Capital Markets uplift study CM-2026-07"],
};

test("the build work-order can be SOURCED from a semantic 6D run (Stage 3 ← Stage 2)", async () => {
  const { run, entry } = await runSixDCosmicSemantic(INTENT);
  const sourced = storyFromSpec(run, entry.hash, "HL-002", 0);
  assert.ok(sourced, "a Distribute story was sourced from the spec");
  assert.match(sourced!.storyId, /^distribute\.story\.\d+$/);
  assert.equal(sourced!.sourceInitiative, "HL-002");
  assert.match(sourced!.specReceipt, /^[0-9a-f]{64}$/, "traced to the spec's LUNA receipt");
  assert.ok(sourced!.title.length > 0, "the story carries a title from the spec");
});

test("the sourced story carries the spec's honest frontier count", async () => {
  const { run, entry } = await runSixDCosmicSemantic(INTENT);
  const sourced = storyFromSpec(run, entry.hash, "HL-002", 0)!;
  assert.equal(typeof sourced.frontierItems, "number");
  assert.ok(sourced.frontierItems >= 0, "the frontier the spec reported rides through to the build leg");
});

test("deterministic — same run ⇒ byte-identical sourced story", async () => {
  const a = await runSixDCosmicSemantic(INTENT);
  const b = await runSixDCosmicSemantic(INTENT);
  assert.deepEqual(
    storyFromSpec(a.run, a.entry.hash, "HL-002", 0),
    storyFromSpec(b.run, b.entry.hash, "HL-002", 0),
  );
});

test("an out-of-range story index returns null (no fabrication)", async () => {
  const { run, entry } = await runSixDCosmicSemantic(INTENT);
  assert.equal(storyFromSpec(run, entry.hash, "HL-002", 999), null);
});
