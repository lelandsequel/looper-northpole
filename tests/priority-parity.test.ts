import assert from "node:assert/strict";
import test from "node:test";

import { prioritize } from "../lib/agility/engine.mjs";
import { scoreInitiative } from "../lib/agility/score.mjs";
import { INITIATIVES } from "../lib/agility/seed/initiatives.mjs";

test("priorityRaw is consistent in score receipt breakdown", () => {
  const it = INITIATIVES[0];
  const { priorityRaw, breakdown } = scoreInitiative(it);
  assert.ok(Math.abs(priorityRaw - breakdown.priorityRaw) < 0.01);
  assert.ok(breakdown.rice.reachFactor > 0);
  assert.ok(breakdown.npv.total > 0);
});

test("prioritize produces funded items with receipts", () => {
  const r = prioritize(INITIATIVES, { capacity: 12 });
  assert.ok(r.funded.length > 0);
  const first = r.funded[0];
  assert.ok(first._scoreReceipt);
  assert.ok(first._priorityRaw);
  assert.equal(r.verify.ok, true);
});