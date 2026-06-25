import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { gateById, initiativeFromGate } from "@/lib/looper/gates";

describe("multi-entry gate intake", () => {
  it("maps gate answers to initiative with intake tag", () => {
    const gate = gateById("risk");
    assert.ok(gate);
    const init = initiativeFromGate(gate, {
      title: "FHA DTI removal",
      summary: "Remove above-50% DTI cells",
      businessProblem: "Credit box contract",
      regDriver: "FHA mandate",
      reachValue: "12000",
      reachUnit: "loans",
      reachSource: "Risk portfolio",
      effortTeamWeeks: "6",
      mandateCitation: "FHA credit box",
    });
    assert.equal(init._intakeGate, "risk");
    assert.equal(init.mandate, true);
    assert.equal(init.reach.value, 12000);
  });

  it("each gate has a distinct questionnaire shape", () => {
    const sales = gateById("sales")!;
    const risk = gateById("risk")!;
    const salesOnly = sales.fields.filter((f) => f.section === "gate").map((f) => f.key);
    const riskOnly = risk.fields.filter((f) => f.section === "gate").map((f) => f.key);
    assert.notDeepEqual(salesOnly, riskOnly);
  });
});