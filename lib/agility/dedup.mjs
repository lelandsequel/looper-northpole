// HL Prioritization OS — the "third calculator" gate (Decision Gate).
//
// The three-calculator problem, made impossible to repeat. Before capacity is
// spent, every intake is compared to every other on its OUTCOME. When two areas
// propose the same outcome, the system clusters them and HOLDS the weaker ones —
// so the org funds one calculator, not three at a million dollars each. This is
// the single most expensive bug in the operating model, caught deterministically
// at intake, before a line of code is written.

import { tokenSet, DEDUP } from "./types.mjs";

/** Jaccard similarity over outcome+title token sets. */
function similarity(a, b) {
  const A = tokenSet(`${a.outcome} ${a.title}`);
  const B = tokenSet(`${b.outcome} ${b.title}`);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return inter / union;
}

/**
 * Strength of an initiative for "keep the strongest" — works whether or not the
 * item has been scored yet:
 *   1. _priorityRaw (post-score) is the truest measure of strength,
 *   2. else _score,
 *   3. else a cheap NPV-ish proxy from the raw fields (so dedup before scoring
 *      still keeps the strongest), with revenue as the final tiebreak.
 * Deterministic.
 */
function strength(it) {
  if (Number.isFinite(it._priorityRaw)) return it._priorityRaw;
  if (Number.isFinite(it._score)) return it._score;
  const proxy =
    num(it.revenueImpact) * (1 - clamp01(num(it.cogs))) +
    num(it.costSaveAnnual) +
    num(it.costAvoid) * clamp01(num(it.pAvoid, 1)) +
    num(it.riskReduction) * clamp01(num(it.pRisk, 1)) +
    num(it.customerImpact);
  return proxy;
}

/**
 * Cluster initiatives by outcome similarity (union-find over the Jaccard graph).
 * @returns {{ clusters:Array, flagged:Set<string> }}
 *   clusters: [{ outcome, members:[ids], primary:id, duplicates:[ids] }]
 */
export function findDuplicates(initiatives, { threshold = 0.5 } = {}) {
  const n = initiatives.length;
  const parent = initiatives.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => {
    parent[find(a)] = find(b);
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (similarity(initiatives[i], initiatives[j]) >= threshold) union(i, j);
    }
  }

  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }

  const clusters = [];
  const flagged = new Set();
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue;
    const members = idxs.map((i) => initiatives[i]);
    // Primary = strongest; deterministic tiebreak on id.
    members.sort((a, b) => {
      const d = strength(b) - strength(a);
      if (d !== 0) return d;
      return String(a.id).localeCompare(String(b.id));
    });
    const primary = members[0];
    const duplicates = members.slice(1);
    for (const d of duplicates) flagged.add(d.id);
    clusters.push({
      outcome: primary.outcome,
      members: members.map((m) => m.id),
      primary: primary.id,
      duplicates: duplicates.map((m) => m.id),
    });
  }
  return { clusters, flagged };
}

/** Record dedup decisions into the ledger; tag each initiative. */
export function applyDedup(initiatives, ledger, opts) {
  const { clusters, flagged } = findDuplicates(initiatives, opts);
  for (const c of clusters) {
    ledger.append("DUPLICATE_FLAGGED", {
      id: c.primary,
      outcome: c.outcome,
      primary: c.primary,
      duplicates: c.duplicates,
      note: `Outcome "${c.outcome}" proposed by ${c.members.length} areas — funding one, holding ${c.duplicates.length}.`,
    });
  }
  const tagged = initiatives.map((it) => ({
    ...it,
    _dedup: flagged.has(it.id) ? DEDUP.DUPLICATE : DEDUP.UNIQUE,
  }));
  return { tagged, clusters, flagged };
}

function num(v, dflt = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}
function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}
