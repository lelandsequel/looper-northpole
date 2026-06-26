import assert from "node:assert/strict";
import test from "node:test";

import { validateInitiative } from "../lib/agility/intake.mjs";
import { initiativeFromForm, formToJson, EMPTY_INTAKE_FORM } from "../lib/looper/intake-form";

test("guided form produces a CADMUS-valid initiative", () => {
  const form = {
    ...EMPTY_INTAKE_FORM,
    title: "Deferment dashboard",
    description: "Real-time deferment tied to LOE/BOE for field ops.",
    area: "Production",
    sponsor: "Field Ops",
    outcome: "deferment visibility",
    reachValue: "120",
    reachSource: "Field ops headcount 2026-Q2",
    costSaveAnnual: "420000",
    savingsEffectiveDate: "2026-07-01",
    costSaveSource: "Ops study DEF-2026-03",
  };
  const it = initiativeFromForm(form);
  const v = validateInitiative(it);
  assert.equal(v.ok, true, v.errors.join("; "));
  assert.match(it.id, /^HL-/);
  assert.equal(JSON.parse(formToJson(form)).title, form.title);
});