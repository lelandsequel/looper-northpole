// HL Prioritization OS — tiering (§2.5, §3.3 mandate carve-out).
//
// Six tiers: Now / Next / Later / Watchlist / Cold / Archived. Tier boundaries
// are driven by score + capacity, not by who shouted loudest:
//
//   • Mandate=Yes auto-pins to NOW (top tier). The score is still computed and
//     shown — the carve-out moves the *position*, never fakes the number.
//   • Everything funded against capacity lands in NOW.
//   • Benched-but-strong → NEXT; benched-mid → LATER.
//   • Held duplicates → WATCHLIST (parked behind their primary, not killed).
//   • Very weak / vanity work → COLD.
//   • Explicitly archived/stale items → ARCHIVED.
//   • A stale Watchlist item (state=Watchlist) stays on the WATCHLIST tier.
//
// Within-tier order is informational; the global rank is the load-bearing order.
// Pure given its inputs (no I/O); ledger writes happen in the engine.

import { TIERS, FUNDING, DEDUP, STATES } from "./types.mjs";

// Score thresholds for the benched/unfunded band. Funded work always tops out at
// NOW regardless of these; these only sort what's *below* the capacity line.
const NEXT_FLOOR = 55; // strong, just missed capacity
const LATER_FLOOR = 35; // real but not urgent
const COLD_CEIL = 20; // below this, it's cold (vanity / no case)

/**
 * Assign a tier to one already-scored, already-allocated item.
 *
 * @param {object} it  carries _score, _funding, _dedup, state, mandate
 * @returns {string} a TIERS value
 */
export function tierFor(it) {
  // Explicit lifecycle states win — an archived item is archived.
  if (it.state === STATES.ARCHIVED) return TIERS.ARCHIVED;
  if (it.state === STATES.COLD) return TIERS.COLD;

  // Mandate carve-out: regulatory/must-do pins to the top tier.
  if (it.mandate === true) return TIERS.NOW;

  // Held duplicates park on Watchlist behind their primary.
  if (it._dedup === DEDUP.DUPLICATE || it._funding === FUNDING.HELD_DUPLICATE) {
    return TIERS.WATCHLIST;
  }

  // Funded against capacity → Now.
  if (it._funding === FUNDING.FUNDED) return TIERS.NOW;

  // A stale Watchlist submission stays on Watchlist.
  if (it.state === STATES.WATCHLIST) return TIERS.WATCHLIST;

  // Benched: sort by score into Next / Later / Watchlist / Cold.
  const s = num(it._score);
  if (s >= NEXT_FLOOR) return TIERS.NEXT;
  if (s >= LATER_FLOOR) return TIERS.LATER;
  if (s > COLD_CEIL) return TIERS.WATCHLIST;
  return TIERS.COLD;
}

/**
 * Tag _tier onto every item and bucket them by tier.
 *
 * @param {Array} ranked  scored + allocated items (carry _score/_funding/_dedup)
 * @param {object} [ledger]  optional — if given, writes a TIERED event per item
 * @returns {{ tiered:Array, tiers:object }}  tiers keyed by TIER_LIST values
 */
export function assignTiers(ranked, ledger) {
  const tiered = ranked.map((it) => {
    const tier = tierFor(it);
    let receipt;
    if (ledger) {
      receipt = ledger.append("TIERED", {
        id: it.id,
        tier,
        score: it._score,
        mandate: it.mandate === true,
        funding: it._funding,
      });
    }
    return { ...it, _tier: tier, _tierReceipt: receipt };
  });

  const tiers = {};
  for (const t of Object.values(TIERS)) tiers[t] = [];
  for (const it of tiered) tiers[it._tier].push(it);

  return { tiered, tiers };
}

function num(v, dflt = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}
