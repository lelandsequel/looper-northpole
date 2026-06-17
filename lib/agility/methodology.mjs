// HL Prioritization OS — methodology versioning + the Dial Board (§6).
//
// This is the instrument that closes the Strategic-Lever Deficit: leadership
// shifts strategy Wednesday, the published queue reflects it Thursday, and the
// change is on the chain.
//
//   • SANDBOX (preview): any committee member previews the rank under proposed
//     dials. NOTHING is written. You get the before/after rank delta so you can
//     see "if we weight revenue heavier, what moves?" — privately, safely.
//   • PUBLISH: writes METHODOLOGY_PUBLISHED to the ledger → bumps the version
//     (v1.0 → v1.1), recording who / when / before-after-rank-delta / a
//     required "why". Every score thereafter carries the new version stamp.
//     (v1: single-actor publish + audit entry. V1.5 enforces 2-of-4.)
//
// Pure ranking under a dial set is shared by preview and publish, so the
// preview you saw is exactly what publish records.

import { scoreInitiative } from "./score.mjs";
import { findDuplicates } from "./dedup.mjs";
import { DEDUP, FUNDING } from "./types.mjs";
import { resolveDials, describeDials } from "./dials.mjs";
import { teamsFor } from "./allocate.mjs";

export const INITIAL_VERSION = "v1.0";

/**
 * Deterministically rank a set of initiatives under a given dial set — the same
 * score → dedup → mandate-first → capacity ordering the engine uses, but pure
 * (no ledger). Used for sandbox previews and publish deltas.
 *
 * @param {Array} initiatives  (already intaken; raw rubric items)
 * @param {object} dials       dial overrides (resolved against defaults)
 * @param {object} [opts]      { capacity, dedupThreshold, methodologyVersion, horizonStart }
 * @returns {Array<{ id, rank, score, priorityRaw, funding, dedup }>}
 */
export function rankUnder(initiatives, dials, opts = {}) {
  const resolved = resolveDials(dials);
  const capacity = opts.capacity ?? 12;
  const dedupThreshold = opts.dedupThreshold ?? 0.5;

  const { flagged } = findDuplicates(initiatives, { threshold: dedupThreshold });

  const scored = initiatives.map((it) => {
    const { score, priorityRaw } = scoreInitiative(it, {
      dials: resolved,
      methodologyVersion: opts.methodologyVersion ?? INITIAL_VERSION,
      horizonStart: opts.horizonStart,
    });
    return {
      id: it.id,
      mandate: it.mandate === true,
      _score: score,
      _priorityRaw: priorityRaw,
      _dedup: flagged.has(it.id) ? DEDUP.DUPLICATE : DEDUP.UNIQUE,
      _teams: teamsFor(it),
    };
  });

  scored.sort((a, b) => {
    if (a.mandate !== b.mandate) return a.mandate ? -1 : 1;
    if (b._priorityRaw !== a._priorityRaw) return b._priorityRaw - a._priorityRaw;
    if (b._score !== a._score) return b._score - a._score;
    return String(a.id).localeCompare(String(b.id));
  });

  let used = 0;
  return scored.map((it, i) => {
    let funding;
    if (it._dedup === DEDUP.DUPLICATE) funding = FUNDING.HELD_DUPLICATE;
    else if (used + it._teams <= capacity) {
      used += it._teams;
      funding = FUNDING.FUNDED;
    } else funding = FUNDING.BENCHED;
    return {
      id: it.id,
      rank: i + 1,
      score: it._score,
      priorityRaw: round2(it._priorityRaw),
      funding,
      dedup: it._dedup,
    };
  });
}

/**
 * SANDBOX preview. Computes the rank under proposed dials and the per-item rank
 * delta vs the current dials. NO ledger write.
 *
 * @returns {{ current:Array, proposed:Array, deltas:Array, summary:object }}
 */
export function preview(initiatives, { currentDials = {}, proposedDials = {}, ...opts } = {}) {
  const current = rankUnder(initiatives, currentDials, opts);
  const proposed = rankUnder(initiatives, proposedDials, opts);

  const curRank = new Map(current.map((r) => [r.id, r.rank]));
  const curFund = new Map(current.map((r) => [r.id, r.funding]));
  const deltas = proposed.map((r) => {
    const before = curRank.get(r.id) ?? null;
    const after = r.rank;
    return {
      id: r.id,
      rankBefore: before,
      rankAfter: after,
      delta: before === null ? null : before - after, // +ve = moved up
      fundingBefore: curFund.get(r.id) ?? null,
      fundingAfter: r.funding,
      scoreAfter: r.score,
    };
  });

  const moved = deltas.filter((d) => d.delta !== null && d.delta !== 0);
  const flipped = deltas.filter((d) => d.fundingBefore !== d.fundingAfter);

  return {
    current,
    proposed,
    deltas,
    summary: {
      movedCount: moved.length,
      flippedCount: flipped.length,
      biggestMover: moved.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0] ?? null,
    },
  };
}

/**
 * PUBLISH a dial change. Computes the before/after delta, appends
 * METHODOLOGY_PUBLISHED to the ledger, and bumps the version. Requires a
 * non-empty `why`.
 *
 * @param {Array} initiatives
 * @param {object} args
 * @param {object} args.ledger          the live ledger (mutated — gets the event)
 * @param {object} args.currentDials
 * @param {object} args.proposedDials
 * @param {string} args.currentVersion  e.g. "v1.0"
 * @param {string} args.who             actor id (committee member)
 * @param {string} args.why             required rationale
 * @param {object} [args.opts]          { capacity, dedupThreshold, horizonStart }
 * @returns {{ version, receipt, before, after, deltas }}
 */
export function publish(initiatives, args) {
  const {
    ledger,
    currentDials = {},
    proposedDials = {},
    currentVersion = INITIAL_VERSION,
    who,
    why,
    opts = {},
  } = args;

  if (!why || String(why).trim() === "") {
    throw new Error("publish requires a non-empty 'why' (governance: no silent dial changes)");
  }
  if (!ledger || typeof ledger.append !== "function") {
    throw new Error("publish requires a ledger");
  }

  const p = preview(initiatives, { currentDials, proposedDials, ...opts });
  const version = bumpVersion(currentVersion);

  const receipt = ledger.append("METHODOLOGY_PUBLISHED", {
    who: who ?? "unknown",
    why: String(why),
    fromVersion: currentVersion,
    toVersion: version,
    dialsBefore: describeDials(currentDials),
    dialsAfter: describeDials(proposedDials),
    rankDelta: p.deltas.map((d) => ({
      id: d.id,
      rankBefore: d.rankBefore,
      rankAfter: d.rankAfter,
      fundingBefore: d.fundingBefore,
      fundingAfter: d.fundingAfter,
    })),
    movedCount: p.summary.movedCount,
    flippedCount: p.summary.flippedCount,
  });

  return {
    version,
    receipt,
    before: p.current,
    after: p.proposed,
    deltas: p.deltas,
    summary: p.summary,
  };
}

/** v1.0 → v1.1 → v1.2 … minor bump on each publish (V1.5 adds major-version UX). */
export function bumpVersion(v) {
  const m = /^v(\d+)\.(\d+)$/.exec(String(v));
  if (!m) return "v1.1";
  const major = Number(m[1]);
  const minor = Number(m[2]) + 1;
  return `v${major}.${minor}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
