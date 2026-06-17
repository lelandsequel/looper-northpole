// HL Prioritization OS — the portfolio view (§2.8, the "where's growth?" lens).
//
// Ranking answers "what's next." This answers the structural question a cabinet
// actually needs: "we're 80% cost-save and 0% revenue — where's growth?" It
// rolls the funded (and, separately, the whole intake) into distributions by
// Value Type, Talent Profile, Mandate, and time-to-realize. Pure aggregation
// over the scored set — no I/O, deterministic.

import {
  VALUE_TYPE_LIST,
  TALENT_PROFILE_LIST,
  FUNDING,
} from "./types.mjs";

/**
 * Time-to-realize bucket for an item, from its NPV stream. An item whose value
 * is mostly a cost-save effective next month is "This year"; one whose savings
 * start in month 24 is "Year 2+". Uses the per-year NPV the score already
 * computed, so it's consistent with the rank.
 */
export function timeToRealizeBucket(it) {
  const perYear = it._breakdown?.npv?.perYear;
  if (!Array.isArray(perYear) || perYear.length === 0) return "Unknown";
  const positives = perYear.filter((y) => y.raw > 0);
  if (positives.length === 0) return "No net value";
  const firstYear = positives[0].year;
  if (firstYear <= 1) return "This year";
  if (firstYear === 2) return "Year 2";
  return "Year 3+";
}

const TIME_BUCKETS = ["This year", "Year 2", "Year 3+", "No net value", "Unknown"];

/**
 * Build the portfolio distribution.
 *
 * @param {Array} scored  all scored items (carry _breakdown / _funding / valueType …)
 * @returns {object} distributions + the funded-only structural view
 */
export function buildPortfolio(scored) {
  const funded = scored.filter((it) => it._funding === FUNDING.FUNDED);

  return {
    total: scored.length,
    fundedCount: funded.length,
    byValueType: {
      all: countBy(scored, (it) => it.valueType, VALUE_TYPE_LIST),
      funded: countBy(funded, (it) => it.valueType, VALUE_TYPE_LIST),
      fundedNpv: sumBy(funded, (it) => it.valueType, (it) => it._breakdown?.npv?.total ?? 0, VALUE_TYPE_LIST),
    },
    byTalentProfile: {
      all: countBy(scored, (it) => it.talentProfile ?? "Any", TALENT_PROFILE_LIST),
      funded: countBy(funded, (it) => it.talentProfile ?? "Any", TALENT_PROFILE_LIST),
    },
    byMandate: {
      all: countBy(scored, (it) => (it.mandate === true ? "Mandate" : "Discretionary"), ["Mandate", "Discretionary"]),
      funded: countBy(funded, (it) => (it.mandate === true ? "Mandate" : "Discretionary"), ["Mandate", "Discretionary"]),
    },
    byTimeToRealize: {
      all: countBy(scored, timeToRealizeBucket, TIME_BUCKETS),
      funded: countBy(funded, timeToRealizeBucket, TIME_BUCKETS),
    },
    fundedNpvTotal: round2(funded.reduce((a, it) => a + (it._breakdown?.npv?.total ?? 0), 0)),
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────
function countBy(items, keyOf, order) {
  const counts = {};
  for (const k of order) counts[k] = 0;
  for (const it of items) {
    const k = keyOf(it);
    if (!(k in counts)) counts[k] = 0;
    counts[k] += 1;
  }
  const total = items.length || 1;
  return order
    .filter((k) => k in counts)
    .map((k) => ({ key: k, count: counts[k], pct: Math.round((counts[k] / total) * 100) }));
}

function sumBy(items, keyOf, valueOf, order) {
  const sums = {};
  for (const k of order) sums[k] = 0;
  for (const it of items) {
    const k = keyOf(it);
    if (!(k in sums)) sums[k] = 0;
    sums[k] += valueOf(it);
  }
  return order
    .filter((k) => k in sums)
    .map((k) => ({ key: k, value: round2(sums[k]) }));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
