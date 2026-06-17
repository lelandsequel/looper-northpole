// THE BUILD → AGILITY SEAM — tests. The leg that closes the circle.
//
// The build leg's MEASURED deliverability feeds back into Agility's
// deliveryConfidence and the portfolio re-decides: a shipped build confirms the
// estimate (nothing moves), a build the gate can't pass de-risks the initiative
// (score falls, the Agility ledger head moves — a new decision recorded).
// Deterministic. 🐦‍⬛ + 🔑

import { test } from "node:test";
import assert from "node:assert/strict";

import { prioritize, INITIATIVES, type Initiative } from "../lib/agility";
import { runBuildLeg, STALE_DATA_STORY, type Builder } from "../lib/build-leg";
import { priceQuote as broken } from "../lib/build-leg/demo/broken/priceQuote";
import { priceQuote as fixed } from "../lib/build-leg/demo/candidate/priceQuote";
import {
  buildOutcomeToFeedback,
  applyBuildFeedback,
  provenConfidence,
} from "../lib/loop/build-feedback";

const CAP = 12;
const hl002 = (): Initiative =>
  prioritize(INITIATIVES, { capacity: CAP }).funded.find((i) => i.id === "HL-002")!;
const scoreOf = (
  p: ReturnType<typeof prioritize>,
  id: string,
): number | undefined => (p.funded.find((f) => f.id === id) as { _score?: number } | undefined)?._score;

const oneRound: Builder = () => ({ priceQuote: fixed });
const selfCorrecting: Builder = ({ round }) => (round === 1 ? { priceQuote: broken } : { priceQuote: fixed });
const stubborn: Builder = () => ({ priceQuote: broken });

test("proven confidence: shipped-first-try → 1.0, shipped-after-fix → 0.8, refused → 0.5", async () => {
  assert.equal(provenConfidence(await runBuildLeg(STALE_DATA_STORY, oneRound, { maxRounds: 3 })), 1.0);
  assert.equal(provenConfidence(await runBuildLeg(STALE_DATA_STORY, selfCorrecting, { maxRounds: 3 })), 0.8);
  assert.equal(provenConfidence(await runBuildLeg(STALE_DATA_STORY, stubborn, { maxRounds: 3 })), 0.5);
});

test("a SHIPPED build CONFIRMS the assumption — confidence unchanged, portfolio stable", async () => {
  const init = hl002();
  const fb = buildOutcomeToFeedback(await runBuildLeg(STALE_DATA_STORY, selfCorrecting, { maxRounds: 3 }), init);
  assert.equal(fb.delivered, true);
  assert.equal(fb.provenDeliveryConfidence, 0.8);
  assert.equal(fb.priorDeliveryConfidence, init.deliveryConfidence);
  assert.equal(fb.confidenceChanged, false, "the build backed Agility's estimate");
  assert.match(fb.buildReceipt, /^[0-9a-f]{64}$/, "the build receipt rides back");

  const before = prioritize(INITIATIVES, { capacity: CAP });
  const after = prioritize(applyBuildFeedback(INITIATIVES, fb), { capacity: CAP });
  assert.equal(before.head, after.head, "a confirmed build leaves the portfolio unchanged");
});

test("THE CIRCLE CLOSES — a build the gate can't pass de-risks the initiative and Agility re-decides", async () => {
  const init = hl002();
  const fb = buildOutcomeToFeedback(await runBuildLeg(STALE_DATA_STORY, stubborn, { maxRounds: 3 }), init);
  assert.equal(fb.delivered, false);
  assert.equal(fb.verdict, "refused-exhausted");
  assert.equal(fb.provenDeliveryConfidence, 0.5);
  assert.equal(fb.confidenceChanged, true);

  const before = prioritize(INITIATIVES, { capacity: CAP });
  const after = prioritize(applyBuildFeedback(INITIATIVES, fb), { capacity: CAP });

  const s0 = scoreOf(before, "HL-002")!;
  const s1 = scoreOf(after, "HL-002")!;
  assert.ok(s1 < s0, `HL-002 risk-adjusted score should fall once unproven: ${s0} → ${s1}`);
  assert.notEqual(before.head, after.head, "the re-decision moves the Agility ledger head");
});

test("applyBuildFeedback only touches the target initiative", async () => {
  const fb = buildOutcomeToFeedback(await runBuildLeg(STALE_DATA_STORY, stubborn, { maxRounds: 3 }), hl002());
  const updated = applyBuildFeedback(INITIATIVES, fb);
  for (const i of updated) {
    const seed = INITIATIVES.find((x) => x.id === i.id)!;
    if (i.id === "HL-002") assert.equal(i.deliveryConfidence, 0.5);
    else assert.equal(i.deliveryConfidence, seed.deliveryConfidence);
  }
});

test("deterministic: same build outcome ⇒ byte-identical feedback", async () => {
  const init = hl002();
  const a = buildOutcomeToFeedback(await runBuildLeg(STALE_DATA_STORY, stubborn, { maxRounds: 3 }), init);
  const b = buildOutcomeToFeedback(await runBuildLeg(STALE_DATA_STORY, stubborn, { maxRounds: 3 }), init);
  assert.deepEqual(a, b);
});
