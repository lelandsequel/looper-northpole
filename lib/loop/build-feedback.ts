// THE BUILD → AGILITY SEAM — the leg that closes the circle.
//
// The loop adapter (adapter.ts) feeds 6D's re-estimated EFFORT back to Agility.
// This is the missing leg: the build leg's MEASURED DELIVERABILITY. The validator
// actually built the work and ran it through the gate, so Agility no longer has
// to *guess* delivery confidence — the build proves it, or fails to.
//
// Honest division of labor (no double-counting):
//   • 6D    → Agility:  effortTeamWeeks    — the decomposed size      [adapter.ts]
//   • Build → Agility:  deliveryConfidence — proven to pass the gate  [here]
//
// Confidence is exactly the right channel. Agility's score is
//   (reach × NPV × confidence) / effort,   confidence = delivery × value × talent.
// So a build that ships RAISES proven delivery; one the gate won't pass LOWERS it,
// and a low-confidence initiative falls in the ranking — the portfolio stops
// funding work the build leg can't actually deliver. Decide → specify → BUILD →
// re-decide on what the build proved.
//
// Scope caveat (v0, stated not hidden): the build leg ran ONE story of the
// initiative, so this is the deliverability signal from that story, not a whole-
// initiative re-cost. The mechanism is real; aggregating every story of the spec
// is the obvious extension. No clock, no randomness — deterministic. 🐦‍⬛ + 🔑

import type { BuildLegResult } from "../build-leg";
import type { Initiative } from "../agility";

// Agility's CONFIDENCE levels (lib/agility/types.mjs: HIGH 1.0 · MEDIUM 0.8 · LOW 0.5).
const PROVEN = 1.0; // shipped clean, first try — fully proven deliverable
const BUMPY = 0.8; // shipped, but needed correction rounds — deliverable, some risk
const UNPROVEN = 0.5; // the gate would not pass it in budget — NOT proven deliverable

export interface BuildFeedback {
  initiativeId: string;
  /** Did the build leg get the story through the gate? */
  delivered: boolean;
  roundsToGreen: number | null;
  verdict: "shipped" | "refused-exhausted";
  /** The delivery confidence the build PROVED — feeds Agility's score. */
  provenDeliveryConfidence: number;
  /** What Agility had assumed before the build ran. */
  priorDeliveryConfidence: number;
  /** Did the proven confidence differ from the assumption? */
  confidenceChanged: boolean;
  /** The build's LUNA chain head — the receipt that rides back into Agility. */
  buildReceipt: string;
}

/**
 * Map a build outcome to the delivery confidence it PROVED:
 *   shipped first try → PROVEN (1.0) · shipped after corrections → BUMPY (0.8) ·
 *   refused-exhausted → UNPROVEN (0.5). Deterministic.
 */
export function provenConfidence(result: BuildLegResult): number {
  if (result.status !== "shipped") return UNPROVEN;
  return result.roundsToGreen === 1 ? PROVEN : BUMPY;
}

/** Turn a sealed build run into the Agility-facing deliverability feedback. */
export function buildOutcomeToFeedback(
  result: BuildLegResult,
  initiative: Initiative,
): BuildFeedback {
  const proven = provenConfidence(result);
  const prior = initiative.deliveryConfidence;
  return {
    initiativeId: initiative.id,
    delivered: result.status === "shipped",
    roundsToGreen: result.roundsToGreen,
    verdict: result.status,
    provenDeliveryConfidence: proven,
    priorDeliveryConfidence: prior,
    confidenceChanged: proven !== prior,
    buildReceipt: result.ledgerHead,
  };
}

/**
 * Apply the proven delivery confidence onto the matching initiative, returning a
 * new portfolio to re-prioritize. Everything else is untouched — Agility re-runs
 * its own deterministic pipeline over the result.
 */
export function applyBuildFeedback(
  initiatives: Initiative[],
  feedback: BuildFeedback,
): Initiative[] {
  return initiatives.map((i) =>
    i.id === feedback.initiativeId
      ? { ...i, deliveryConfidence: feedback.provenDeliveryConfidence }
      : i,
  );
}
