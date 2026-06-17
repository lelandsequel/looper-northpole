// HL Prioritization OS — rubric evidence enforcement (Bailey Appendix A, §4.2).
//
// "Evidence is enforced at submission, not at review." The failure mode the
// methodology is built to kill is the napkin-PowerPoint deal: a number with no
// source behind it. So before an Initiative can move Draft → Submitted, every
// CLAIM it makes must cite its evidence. If you assert revenue, you owe a
// revenue source. If you assert a cost-save, you owe a source AND an effective
// date (that's the input the time-value fix depends on). Mandate? Cite the
// statute. No source, no submission.
//
// This is a conditional rule set: a field is required ONLY when the
// corresponding claim is present. An item that makes no revenue claim doesn't
// owe a revenue source. Pure — validate(it) → { ok, missing[] }.

import { STATES } from "./types.mjs";

/**
 * Evidence rules. Each rule fires only `when` the item makes the related claim;
 * if it fires, `evidence[field]` (or, for cost-save, also `savingsEffectiveDate`)
 * must be present. `field` is the key the submitter must populate in
 * `it.evidence`, and `label` is the human-readable requirement.
 */
export const EVIDENCE_RULES = Object.freeze([
  {
    field: "mandate",
    label: "Mandate citation",
    when: (it) => it.mandate === true,
    satisfied: (it) =>
      nonEmpty(it.mandateCitation) || nonEmpty(it.evidence?.mandate),
  },
  {
    field: "reach",
    label: "Reach source",
    when: (it) => num(it.reach?.value) > 0,
    satisfied: (it) => nonEmpty(it.reach?.source) || nonEmpty(it.evidence?.reach),
  },
  {
    field: "revenue",
    label: "Revenue source",
    when: (it) => num(it.revenueImpact) > 0,
    satisfied: (it) => nonEmpty(it.evidence?.revenue),
  },
  {
    field: "costSave",
    label: "CostSave source + effective date",
    when: (it) => num(it.costSaveAnnual) > 0,
    satisfied: (it) =>
      nonEmpty(it.evidence?.costSave) && nonEmpty(it.savingsEffectiveDate),
  },
  {
    field: "costAvoid",
    label: "CostAvoid counterfactual",
    when: (it) => num(it.costAvoid) > 0,
    satisfied: (it) => nonEmpty(it.evidence?.costAvoid),
  },
  {
    field: "riskReduction",
    label: "RiskReduction register ref",
    when: (it) => num(it.riskReduction) > 0,
    satisfied: (it) => nonEmpty(it.evidence?.riskReduction),
  },
  {
    field: "customerImpact",
    label: "CustomerImpact monetization source",
    when: (it) => num(it.customerImpact) > 0,
    satisfied: (it) => nonEmpty(it.evidence?.customerImpact),
  },
  {
    field: "tco",
    label: "TCO quote",
    when: (it) => num(it.ongoingTCO) > 0,
    satisfied: (it) => nonEmpty(it.evidence?.tco),
  },
]);

/**
 * Validate that an Initiative carries the evidence its claims require.
 *
 * @param {object} it
 * @returns {{ ok:boolean, missing:Array<{field,label}> }}
 */
export function validate(it) {
  const missing = [];
  for (const rule of EVIDENCE_RULES) {
    if (rule.when(it) && !rule.satisfied(it)) {
      missing.push({ field: rule.field, label: rule.label });
    }
  }
  return { ok: missing.length === 0, missing };
}

/**
 * The Draft→Submitted gate. Returns whether the transition is allowed, the
 * blocking evidence gaps, and the resulting state. Pure; the engine/app decides
 * what to do with `rejected` items.
 *
 * @param {object} it
 * @returns {{ allowed:boolean, state:string, missing:Array, reason?:string }}
 */
export function canSubmit(it) {
  const { ok, missing } = validate(it);
  if (ok) {
    return { allowed: true, state: STATES.SUBMITTED, missing: [] };
  }
  return {
    allowed: false,
    state: STATES.DRAFT,
    missing,
    reason: `blocked Draft→Submitted: missing ${missing.map((m) => m.label).join("; ")}`,
  };
}

function nonEmpty(v) {
  return v !== undefined && v !== null && String(v).trim() !== "";
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
