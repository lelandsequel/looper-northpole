import assert from "node:assert/strict";
import test from "node:test";

import { cadmusGate } from "../lib/cadmus/gate.ts";

test("CADMUS refuses unstructured free text", () => {
  const r = cadmusGate("build me a dashboard for deferment");
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.refused, true);
  assert.ok(r.errors.some((e) => e.includes("unstructured")));
});

test("CADMUS refuses incomplete JSON initiative", () => {
  const r = cadmusGate(JSON.stringify({ title: "only a title" }));
  assert.equal(r.ok, false);
});

test("CADMUS accepts valid structured initiative", () => {
  const r = cadmusGate(
    JSON.stringify({
      id: "T-001",
      title: "Test initiative",
      description: "A real description of the work.",
      area: "Ops",
      sponsor: "TJ",
      outcome: "test outcome delivered",
      valueType: "Internal Enabler",
      reach: { value: 10, unit: "users", source: "headcount sheet" },
      effortTeamWeeks: 4,
      deliveryConfidence: 0.8,
      valueConfidence: 0.8,
      evidence: { reach: "headcount sheet" },
    }),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.initiative.id, "T-001");
});