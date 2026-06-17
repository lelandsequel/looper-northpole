// HL Prioritization OS — capacity allocation (the bench model, made fair).
//
// The room's fear: "they took all my teams away." The room's actual problem:
// more demand than capacity, allocated by who shouted loudest. This allocates
// strictly by score against a fixed capacity: fund top-down until capacity runs
// out; everything below the line is benched — not because someone disliked it,
// but because priority N+1 lost to priority N, and the receipt says exactly why.
//
//   • Mandate items are funded FIRST (the carve-out) — they're must-do; their
//     teams come off the top of capacity before discretionary work is funded.
//   • Held duplicates never consume capacity.
//   • Each benched item's receipt records capacity_at_decision, so "why benched"
//     is a number, not an opinion.

import { FUNDING, DEDUP, TALENT_PROFILE } from "./types.mjs";

/**
 * Teams an initiative consumes. Explicit `teamsRequested` wins; otherwise it's
 * derived from effort (team-weeks → teams, ~6 team-weeks per team-slot) with a
 * floor of 1, nudged up one slot for scarce talent (a Staff+ ask ties up a
 * scarcer resource). Deterministic.
 */
export function teamsFor(it) {
  if (Number.isFinite(it.teamsRequested) && it.teamsRequested > 0) {
    return Math.round(it.teamsRequested);
  }
  const weeks = Math.max(1, Number(it.effortTeamWeeks) || 1);
  let teams = Math.max(1, Math.ceil(weeks / 6));
  if (it.talentProfile === TALENT_PROFILE.STAFF_PLUS) teams += 1;
  return teams;
}

/**
 * Rank by score (mandate first), allocate against capacity.
 *
 * @param {Array} scored  items carrying _score / _priorityRaw / _dedup / mandate
 * @param {object} ledger
 * @param {object} opts    { capacity:number }
 * @returns {{ ranked:Array, capacityUsed:number, capacity:number }}
 */
export function allocate(scored, ledger, { capacity }) {
  // Deterministic ordering:
  //   mandate first (must-do tops the queue), then raw priority desc,
  //   then display score desc, then id for a total order.
  const ranked = [...scored].sort((a, b) => {
    const am = a.mandate === true ? 1 : 0;
    const bm = b.mandate === true ? 1 : 0;
    if (am !== bm) return bm - am;
    const pr = num(b._priorityRaw) - num(a._priorityRaw);
    if (pr !== 0) return pr;
    if (b._score !== a._score) return num(b._score) - num(a._score);
    return String(a.id).localeCompare(String(b.id));
  });

  let used = 0;
  const out = ranked.map((it, i) => {
    const rank = i + 1;
    const teams = teamsFor(it);
    let funding;
    if (it._dedup === DEDUP.DUPLICATE) {
      funding = FUNDING.HELD_DUPLICATE; // never consumes capacity
    } else if (used + teams <= capacity) {
      used += teams;
      funding = FUNDING.FUNDED;
    } else {
      funding = FUNDING.BENCHED;
    }
    const receipt = ledger.append("PRIORITIZED", {
      id: it.id,
      rank,
      score: it._score,
      funding,
      mandate: it.mandate === true,
      teams,
      capacity_used_after: used,
      capacity_at_decision: capacity,
    });
    return { ...it, _rank: rank, _teams: teams, _funding: funding, _prioritizeReceipt: receipt };
  });

  return { ranked: out, capacityUsed: used, capacity };
}

function num(v, dflt = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}
