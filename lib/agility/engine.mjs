// HL Prioritization OS — the engine. One call, the whole operating loop:
//
//   intake (structured + evidence) → dedup (third-calculator gate)
//   → score (RICE × 3-yr NPV) → mandate carve-out → tier (6 tiers)
//   → allocate (capacity) → ledger (receipts) → portfolio → brief
//
// Everything that happens is written to the chain as it happens, so the output
// is never a story someone assembled later — it's a replay of recorded
// decisions. Same inputs + same dials → byte-identical ranking, forever. That's
// the difference between "the PowerPoint" and "the system of record."

import { Ledger } from "./ledger.mjs";
import { intake } from "./intake.mjs";
import { applyDedup } from "./dedup.mjs";
import { scoreAll } from "./score.mjs";
import { allocate } from "./allocate.mjs";
import { assignTiers } from "./tier.mjs";
import { buildPortfolio } from "./portfolio.mjs";
import { FUNDING } from "./types.mjs";
import { resolveDials } from "./dials.mjs";
import { INITIAL_VERSION } from "./methodology.mjs";

/**
 * Run the full prioritization pipeline.
 *
 * @param {Array} initiatives  rubric Initiatives (some may be refused at intake)
 * @param {object} [opts]
 * @param {number} [opts.capacity=12]        total team capacity
 * @param {number} [opts.dedupThreshold=0.5] Jaccard outcome-cluster sensitivity
 * @param {object} [opts.dials]              dial overrides (resolved vs defaults)
 * @param {string} [opts.methodologyVersion] version stamp on every score
 * @param {Date|string} [opts.horizonStart]  NPV horizon start (reproducibility)
 * @returns {object} { ranked, tiers, funded, benched, held, portfolio, ledger,
 *                      verify, methodology_version, stats, clusters, rejected, … }
 */
export function prioritize(initiatives, opts = {}) {
  const {
    capacity = 12,
    dedupThreshold = 0.5,
    dials,
    methodologyVersion = INITIAL_VERSION,
    horizonStart,
  } = opts;

  const resolvedDials = resolveDials(dials);
  const ledger = new Ledger();

  // 1) Intake — structural + evidence gate (CADMUS + Appendix A).
  const { accepted, rejected } = intake(initiatives, ledger);

  // 2) Dedup — the third-calculator gate; hold the weaker duplicates.
  const { tagged, clusters, flagged } = applyDedup(accepted, ledger, {
    threshold: dedupThreshold,
  });

  // 3) Score — RICE × 3-yr NPV, with a full breakdown receipt per item.
  const scored = scoreAll(tagged, ledger, {
    dials: resolvedDials,
    methodologyVersion,
    horizonStart,
  });

  // 4) Allocate — mandate carve-out first, then top-down by score vs capacity.
  const { ranked, capacityUsed } = allocate(scored, ledger, { capacity });

  // 5) Tier — assign the six tiers (mandate auto-pins to Now).
  const { tiered, tiers } = assignTiers(ranked, ledger);

  // 6) Portfolio — the structural "where's growth?" distribution.
  const portfolio = buildPortfolio(tiered);

  const funded = tiered.filter((r) => r._funding === FUNDING.FUNDED);
  const benched = tiered.filter((r) => r._funding === FUNDING.BENCHED);
  const held = tiered.filter((r) => r._funding === FUNDING.HELD_DUPLICATE);
  const mandates = tiered.filter((r) => r.mandate === true);

  return {
    methodology_version: methodologyVersion,
    dials: resolvedDials,
    capacity,
    capacityUsed,
    ledger,
    head: ledger.head ? ledger.head.sha : null,
    verify: ledger.verify(),
    ranked: tiered,
    tiers,
    funded,
    benched,
    held,
    mandates,
    clusters,
    flagged: [...flagged],
    rejected,
    portfolio,
    stats: {
      intake: accepted.length,
      rejected: rejected.length,
      funded: funded.length,
      benched: benched.length,
      held_duplicates: held.length,
      mandates: mandates.length,
      duplicate_clusters: clusters.length,
      duplicatesAvoided: held.length,
      fundedNpvTotal: portfolio.fundedNpvTotal,
    },
  };
}
