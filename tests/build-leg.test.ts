// STAGE 3 — THE BUILD LEG — validator tests.
//
// Proves the build leg's gate is real, not theater:
//   1. the independent builder's delivered build satisfies every acceptance
//      criterion → NO_OBJECTION (the validator accepts genuine work).
//   2. THE NEGATIVE CONTROL — a build that prices on stale data is REFUSED,
//      autonomously, with the failing criteria named (the validator catches a
//      real, dangerous miss). This is the whole product in one assertion.
//   3. a build that doesn't honor the contract → REFUSE at the gate.
//   4. the verdict + receipt are deterministic.
//   5. the work-order traces back to its Agility/6D provenance.
//
// The validator runs the acceptance criteria itself — it does not trust either
// build's own tests. 🐦‍⬛ + 🔑

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateBuild, STALE_DATA_STORY, type CandidateBuild } from "../lib/build-leg";
import { priceQuote as agentBuild } from "../lib/build-leg/demo/candidate/priceQuote";
import { priceQuote as brokenBuild } from "../lib/build-leg/demo/broken/priceQuote";

test("the independent builder's delivered build satisfies every criterion → NO_OBJECTION", () => {
  const v = validateBuild(STALE_DATA_STORY, { priceQuote: agentBuild });
  assert.equal(v.verdict, "NO_OBJECTION", v.summary);
  assert.equal(v.failed, 0);
  assert.equal(v.passed, STALE_DATA_STORY.acceptance.length);
  assert.equal(v.resolve.length, 0);
});

test("NEGATIVE CONTROL — a build that prices on stale data is REFUSED, naming the failing criteria", () => {
  const v = validateBuild(STALE_DATA_STORY, { priceQuote: brokenBuild });
  assert.equal(v.verdict, "REFUSE", v.summary);
  assert.ok(v.blockingFailures >= 1, "at least one blocking criterion must fail");

  // The stale-data criterion (ac.1) must be among the refusals.
  assert.ok(v.resolve.some((r) => r.acId === "ac.1"), "must flag the stale-data criterion");
  const ac1 = v.probes.find((p) => p.id === "ac.1")!;
  assert.equal(ac1.pass, false);
  assert.match(ac1.detail, /PRICED on stale/);

  // Every resolve need is sourced to a real criterion, never invented.
  for (const need of v.resolve) {
    assert.ok(STALE_DATA_STORY.acceptance.some((ac) => ac.id === need.acId));
    assert.ok(need.required.length > 0);
  }
});

test("a build that doesn't honor the contract (no priceQuote) → REFUSE at the gate", () => {
  const v = validateBuild(STALE_DATA_STORY, {} as CandidateBuild);
  assert.equal(v.verdict, "REFUSE");
  assert.equal(v.resolve[0]?.acId, "contract");
});

test("the verdict + receipt are deterministic (same build ⇒ same receipt; different verdict ⇒ different receipt)", () => {
  const a = validateBuild(STALE_DATA_STORY, { priceQuote: agentBuild });
  const b = validateBuild(STALE_DATA_STORY, { priceQuote: agentBuild });
  assert.equal(a.receipt, b.receipt);
  assert.match(a.receipt, /^[0-9a-f]{64}$/);

  const refused = validateBuild(STALE_DATA_STORY, { priceQuote: brokenBuild });
  assert.notEqual(a.receipt, refused.receipt, "a different verdict must seal a different receipt");
});

test("the work-order carries its 6D story id + Agility source initiative (provenance)", () => {
  assert.equal(STALE_DATA_STORY.sourceInitiative, "HL-002");
  assert.match(STALE_DATA_STORY.storyId, /HL-002\.distribute\.story/);
  assert.ok(STALE_DATA_STORY.acceptance.length >= 5);
  for (const ac of STALE_DATA_STORY.acceptance) {
    assert.ok(ac.text.length > 0, "every criterion is stated");
    assert.equal(typeof ac.run, "function", "every criterion is executable");
  }
});
