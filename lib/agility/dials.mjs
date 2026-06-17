// HL Prioritization OS — the dials (governance knobs, §6).
//
// These are the levers the committee tunes on the Dial Board: the 5 value-type
// weights, the discount rate r, the NPV horizon H, and a confidence
// sensitivity. They live here as plain data so a change is inspectable and a
// published change is a diff. The Dial Board *previews* under proposed dials
// (sandbox, no ledger write) and *publishes* a new methodology version (ledger
// write) — see lib/methodology.mjs.

import { VALUE_TYPES, VALUE_TYPE_LIST } from "./types.mjs";

/**
 * The default dial set. v1.0 baseline.
 *  - valueTypeWeights: multiplier per value type (revenue leans heavy by design;
 *    risk-compliance close behind because must-do work is durable).
 *  - r: firm cost of capital (discount rate) for NPV.
 *  - horizon: NPV horizon in years (H).
 *  - confidenceSensitivity: exponent on the Confidence term. 1.0 = linear;
 *    >1 punishes low confidence harder; <1 softens it. A committee dial for
 *    "how much do we trust our own estimates this quarter."
 */
export const DEFAULT_DIALS = Object.freeze({
  valueTypeWeights: Object.freeze({
    [VALUE_TYPES.REVENUE]: 1.0,
    [VALUE_TYPES.SERVICE]: 0.85,
    [VALUE_TYPES.ENABLER]: 0.7,
    [VALUE_TYPES.RISK]: 0.95,
    [VALUE_TYPES.OPTIONALITY]: 0.6,
  }),
  r: 0.1,
  horizon: 3,
  confidenceSensitivity: 1.0,
});

/**
 * Merge a partial override onto the defaults, producing a complete, frozen dial
 * set. Unknown value types are ignored; missing ones fall back to default.
 * Pure — never mutates inputs.
 *
 * @param {object} [overrides]
 * @returns {object} a complete dials object (frozen)
 */
export function resolveDials(overrides = {}) {
  const weights = {};
  for (const vt of VALUE_TYPE_LIST) {
    const o = overrides.valueTypeWeights ? overrides.valueTypeWeights[vt] : undefined;
    weights[vt] = numOr(o, DEFAULT_DIALS.valueTypeWeights[vt]);
  }
  return Object.freeze({
    valueTypeWeights: Object.freeze(weights),
    r: numOr(overrides.r, DEFAULT_DIALS.r),
    horizon: Math.max(1, Math.round(numOr(overrides.horizon, DEFAULT_DIALS.horizon))),
    confidenceSensitivity: numOr(
      overrides.confidenceSensitivity,
      DEFAULT_DIALS.confidenceSensitivity
    ),
  });
}

/** The value-type weight in force for an item, defaulting to 1.0 if unknown. */
export function valueTypeWeight(dials, valueType) {
  const w = dials?.valueTypeWeights?.[valueType];
  return numOr(w, 1.0);
}

/** A stable, human-diffable description of a dial set (used in ledger entries). */
export function describeDials(dials) {
  const d = resolveDials(dials);
  return {
    r: d.r,
    horizon: d.horizon,
    confidenceSensitivity: d.confidenceSensitivity,
    valueTypeWeights: { ...d.valueTypeWeights },
  };
}

function numOr(v, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}
