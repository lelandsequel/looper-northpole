// HL Prioritization OS — RICE scoring with a 3-year NPV Impact (Bailey §3.1/§4).
//
// "Mathematically, algorithmically sound, so it doesn't just come off as
// opinion." Here it is, made concrete:
//
//   Priority = (Reach × Impact × Confidence) / Effort × valueTypeWeight
//
//   Impact      = 3-yr NPV (lib/npv.mjs) — the time-value-correct dollar figure
//   Confidence  = deliveryConfidence × valueConfidence × talentFactor,
//                 raised to the committee's confidenceSensitivity dial
//   Effort      = effortTeamWeeks vs the standard team (2 mid eng + 1 PM)
//   Reach       = customers/loans/engineers affected per year
//
// The raw priority is monotone-compressed to a 0–100 DISPLAY score so the board
// reads cleanly; the *raw* priority is preserved in the receipt so nothing is
// lost. Mandate items are still fully scored (transparency) — the carve-out
// pins their TIER, it does not fake their number.
//
// Pure function. Same inputs + same dials → byte-identical score + receipt.
// That is the audit guarantee.

import { clamp, TALENT_PROFILE, TALENT_CONFIDENCE_FACTOR } from "./types.mjs";
import { npvImpact } from "./npv.mjs";
import { resolveDials, valueTypeWeight } from "./dials.mjs";

export const METHODOLOGY_VERSION = "v1.0";

// Compression constant for the display map. Priority is in "RICE units"
// (reach × NPV$ × conf / effort), which spans many orders of magnitude. We map
// it to 0–100 with a fixed log curve so the *ordering is preserved exactly* and
// the numbers are legible. The knee is chosen so a strong HL initiative lands
// in the 70–95 band and a marginal one in the 20–40 band.
const DISPLAY_KNEE = 5_000_000; // raw priority that maps to ~score 50
const DISPLAY_SPAN = 16; // larger = flatter curve

/**
 * Score one initiative. Pure.
 *
 * @param {object} it     Initiative
 * @param {object} [opts]
 * @param {object} [opts.dials]            dial overrides (resolved against defaults)
 * @param {string} [opts.methodologyVersion]  stamp carried into the receipt
 * @param {Date|string} [opts.horizonStart]   NPV horizon start (reproducibility)
 * @returns {{ score:number, priorityRaw:number, breakdown:object }}
 */
export function scoreInitiative(it, opts = {}) {
  const dials = resolveDials(opts.dials);
  const methodologyVersion = opts.methodologyVersion ?? METHODOLOGY_VERSION;

  // ── Impact: 3-yr NPV ──────────────────────────────────────────────────────
  const npv = npvImpact(it, {
    r: dials.r,
    horizon: dials.horizon,
    horizonStart: opts.horizonStart,
  });
  const impact = npv.total;

  // ── Reach: annual affected population ─────────────────────────────────────
  const reach = num(it.reach?.value, 0);

  // ── Confidence: delivery × value × talent, shaped by sensitivity ──────────
  const delivery = clampConfidence(it.deliveryConfidence);
  const value = clampConfidence(it.valueConfidence);
  const talentProfile = it.talentProfile ?? TALENT_PROFILE.ANY;
  const talentFactor = TALENT_CONFIDENCE_FACTOR[talentProfile] ?? 1.0;
  const confidenceBase = delivery * value * talentFactor;
  // confidenceSensitivity is an exponent: >1 punishes low confidence harder.
  const confidence = Math.pow(confidenceBase, dials.confidenceSensitivity);

  // ── Effort: team-weeks (floor at 1 so we never divide by zero) ────────────
  const effort = Math.max(1, num(it.effortTeamWeeks, 1));

  // ── value_type_weight ─────────────────────────────────────────────────────
  const vtWeight = valueTypeWeight(dials, it.valueType);

  // ── RICE ──────────────────────────────────────────────────────────────────
  // reachFactor keeps reach from dominating: a population term that contributes
  // sub-linearly (sqrt) so a 5M-customer item doesn't bury a 50k-loan item that
  // has 100× the per-unit NPV. Bailey's "Reach" is a multiplier, not the story.
  const reachFactor = reach > 0 ? Math.sqrt(reach) : 1;
  const priorityRaw = (reachFactor * impact * confidence) / effort * vtWeight;

  const score = toDisplay(priorityRaw);

  const breakdown = {
    methodologyVersion,
    score,
    priorityRaw: round2(priorityRaw),
    rice: {
      reach,
      reachFactor: round2(reachFactor),
      impact: round2(impact),
      confidence: round4(confidence),
      confidenceBase: round4(confidenceBase),
      deliveryConfidence: delivery,
      valueConfidence: value,
      talentProfile,
      talentFactor,
      effortTeamWeeks: effort,
      valueType: it.valueType,
      valueTypeWeight: vtWeight,
    },
    npv: {
      total: npv.total,
      components: npv.components,
      perYear: npv.perYear,
    },
    dials: {
      r: dials.r,
      horizon: dials.horizon,
      confidenceSensitivity: dials.confidenceSensitivity,
      valueTypeWeights: { ...dials.valueTypeWeights },
    },
    budgetCyclePosition: it.budgetCyclePosition ?? null, // surfaced, not scored
  };

  return { score, priorityRaw, breakdown };
}

/**
 * Score a batch; record each into the ledger with its breakdown as the receipt.
 * Tags _score / _priorityRaw / _breakdown / _scoreReceipt onto each item.
 */
export function scoreAll(initiatives, ledger, opts = {}) {
  return initiatives.map((it) => {
    const { score, priorityRaw, breakdown } = scoreInitiative(it, opts);
    const receipt = ledger.append("SCORED", {
      id: it.id,
      score,
      methodologyVersion: breakdown.methodologyVersion,
      npvTotal: breakdown.npv.total,
      priorityRaw: breakdown.priorityRaw,
    });
    return {
      ...it,
      _score: score,
      _priorityRaw: priorityRaw,
      _breakdown: breakdown,
      _scoreReceipt: receipt,
    };
  });
}

// ── display mapping ─────────────────────────────────────────────────────────
// Monotone log-compression of raw priority → 0..100. Strictly increasing, so it
// never changes the ranking — only the legibility.
export function toDisplay(priorityRaw) {
  if (!(priorityRaw > 0)) return 0;
  const v = 50 + DISPLAY_SPAN * Math.log10(priorityRaw / DISPLAY_KNEE);
  return Math.round(clamp(v, 0, 100));
}

// ── tiny deterministic helpers ──────────────────────────────────────────────
function num(v, dflt = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}
function clampConfidence(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0.5, Math.min(1.0, n));
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function round4(n) {
  return Math.round(n * 10000) / 10000;
}
