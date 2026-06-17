// STAGE 3 — THE BUILD LOOP — REFUSE→RESOLVE→RECOMPUTE tests.
//
// Proves the autonomous correction cycle with deterministic fake builders (no
// LLM, no clock): a builder refused on round 1 is handed the exact failing
// criteria, fixes them, and ships on round 2 — every round sealed into the LUNA
// chain. A builder that never fixes is refused after the round budget. The whole
// loop is byte-stable. 🐦‍⬛ + 🔑

import { test } from "node:test";
import assert from "node:assert/strict";

import { runBuildLeg, STALE_DATA_STORY, type Builder } from "../lib/build-leg";
import { Ledger } from "../lib/six-d/cosmic/luna";
import { priceQuote as fixedBuild } from "../lib/build-leg/demo/candidate/priceQuote";
import { priceQuote as brokenBuild } from "../lib/build-leg/demo/broken/priceQuote";

// Round 1 ships the broken build (prices on stale data); round 2+ ships the fix.
const selfCorrecting: Builder = ({ round }) =>
  round === 1 ? { priceQuote: brokenBuild } : { priceQuote: fixedBuild };
// Never learns — ships the broken build every round.
const stubborn: Builder = () => ({ priceQuote: brokenBuild });

test("REFUSE→RESOLVE→RECOMPUTE: a refused builder fixes the named criteria and ships", async () => {
  const r = await runBuildLeg(STALE_DATA_STORY, selfCorrecting, { maxRounds: 3 });
  assert.equal(r.status, "shipped");
  assert.equal(r.roundsToGreen, 2);
  assert.equal(r.rounds.length, 2);
  assert.equal(r.rounds[0].verdict.verdict, "REFUSE");
  assert.equal(r.rounds[1].verdict.verdict, "NO_OBJECTION");
  // round 1's refusal named the stale-data criterion (what gets handed back).
  assert.ok(r.rounds[0].verdict.resolve.some((x) => x.acId === "ac.1"));
});

test("RESOLVE is actually handed back — the builder receives last round's failing criteria", async () => {
  const seen: Array<{ round: number; resolveIds: string[] }> = [];
  const recording: Builder = ({ round, resolve }) => {
    seen.push({ round, resolveIds: resolve.map((x) => x.acId) });
    return round === 1 ? { priceQuote: brokenBuild } : { priceQuote: fixedBuild };
  };
  await runBuildLeg(STALE_DATA_STORY, recording, { maxRounds: 3 });
  assert.deepEqual(seen[0].resolveIds, [], "round 1 has nothing to resolve yet");
  assert.ok(seen[1].resolveIds.includes("ac.1"), "round 2 is handed the stale-data failure");
  assert.ok(seen[1].resolveIds.includes("ac.2"), "round 2 is handed the eligibility failure");
});

test("a builder that never fixes is refused after the round budget (no false ship)", async () => {
  const r = await runBuildLeg(STALE_DATA_STORY, stubborn, { maxRounds: 3 });
  assert.equal(r.status, "refused-exhausted");
  assert.equal(r.roundsToGreen, null);
  assert.equal(r.rounds.length, 3);
  assert.ok(r.rounds.every((x) => x.verdict.verdict === "REFUSE"));
});

test("every round is sealed into the LUNA chain, and the chain verifies", async () => {
  const ledger = new Ledger();
  const r = await runBuildLeg(STALE_DATA_STORY, selfCorrecting, { maxRounds: 3, ledger });
  assert.equal(ledger.length, r.rounds.length, "one ledger entry per round");
  assert.equal(ledger.head?.hash, r.ledgerHead);
  assert.equal(r.rounds[0].ledgerHash, ledger.all[0].hash, "round 1 seals the genesis link");
  const v = await ledger.verify();
  assert.equal(v.ok, true, "the build chain is intact");
});

test("the loop is deterministic — same builder ⇒ same head, outcome, round count", async () => {
  const a = await runBuildLeg(STALE_DATA_STORY, selfCorrecting, { maxRounds: 3 });
  const b = await runBuildLeg(STALE_DATA_STORY, selfCorrecting, { maxRounds: 3 });
  assert.equal(a.ledgerHead, b.ledgerHead);
  assert.equal(a.status, b.status);
  assert.equal(a.roundsToGreen, b.roundsToGreen);
  assert.match(a.ledgerHead, /^[0-9a-f]{64}$/);
});
