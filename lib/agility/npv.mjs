// HL Prioritization OS — 3-year NPV Impact (Bailey §3.1, made deterministic).
//
// This is the Time-Value Deficit fix. A cost-save that goes live in month 11
// does NOT realize a full year of savings in Year 1 — it realizes ~1/12. The
// methodology used to wave that away ("it's a $1.2M/yr save") and over-rank
// late-effective work. Here, savings are *annuitized from their effective date*
// and the whole stream is discounted at the firm cost of capital. Two
// otherwise-identical saves now rank by WHEN the money actually shows up.
//
//   Impact = Σ_{y=1..H} [ revenue·(1−COGS)
//                       + costSaveAnnual · activeFraction(effectiveDate, y)
//                       + costAvoid · pAvoid            (Year 1 only — one-time)
//                       + riskReduction · pRisk         (Year 1 only — one-time)
//                       + customerImpact                (recurring)
//                       − ongoingTCO ] / (1+r)^y
//
// Pure / deterministic. No Date.now(), no I/O. The horizon start is a parameter
// (opts.horizonStart) so "today" never leaks into a score — same inputs, same
// number, forever. Returns { total, perYear[], components{} } as the receipt.

/**
 * Fraction of a year that an annual recurring benefit is active, for horizon
 * year `y` (1-based), given an effective date. Month-granular, so a save that
 * goes live in month M of Year 1 realizes (13 - M)/12 of the annual amount in
 * Year 1, then a full year thereafter.
 *
 * @param {string|undefined} effectiveDate  ISO date "YYYY-MM-DD" (or undefined → active immediately)
 * @param {number} y                        horizon year, 1-based
 * @param {Date}   horizonStartDate         the start of Year 1
 * @returns {number} fraction in [0, 1]
 */
export function activeFraction(effectiveDate, y, horizonStartDate) {
  if (!effectiveDate) return 1; // no effective date → active from day one
  const eff = new Date(effectiveDate);
  if (Number.isNaN(eff.getTime())) return 1; // unparseable → treat as immediate

  // Whole-month offset from the horizon start to the effective date.
  const monthsOffset =
    (eff.getUTCFullYear() - horizonStartDate.getUTCFullYear()) * 12 +
    (eff.getUTCMonth() - horizonStartDate.getUTCMonth());

  // The window for horizon year y is months [ (y-1)*12, y*12 ).
  const winStart = (y - 1) * 12;
  const winEnd = y * 12;

  // Active months within this year's window = months at/after the effective
  // month that also fall inside the window.
  const activeStart = Math.max(monthsOffset, winStart);
  const activeMonths = Math.max(0, winEnd - activeStart);
  return Math.max(0, Math.min(12, activeMonths)) / 12;
}

/**
 * Compute the 3-year (default) NPV Impact for one initiative.
 *
 * @param {object} it    Initiative (NPV input fields)
 * @param {object} opts
 * @param {number} [opts.r=0.10]          discount rate (firm cost of capital)
 * @param {number} [opts.horizon=3]       horizon in years (H)
 * @param {Date|string} [opts.horizonStart] start of Year 1 (default fixed epoch
 *                                           so scores are reproducible; callers
 *                                           that want "today" pass it explicitly)
 * @returns {{ total:number, perYear:Array, components:object, dials:object }}
 */
export function npvImpact(it, opts = {}) {
  const r = opts.r ?? 0.1;
  const horizon = opts.horizon ?? 3;
  const horizonStartDate =
    opts.horizonStart instanceof Date
      ? opts.horizonStart
      : new Date(opts.horizonStart ?? "2026-01-01T00:00:00Z");

  const revenue = num(it.revenueImpact);
  const cogs = clamp01(num(it.cogs)); // fraction; 0 if unset
  const costSaveAnnual = num(it.costSaveAnnual);
  const costAvoid = num(it.costAvoid);
  const pAvoid = clamp01(num(it.pAvoid, 1)); // default certain if amount given
  const riskReduction = num(it.riskReduction);
  const pRisk = clamp01(num(it.pRisk, 1));
  const customerImpact = num(it.customerImpact);
  const ongoingTCO = num(it.ongoingTCO);

  // Revenue is given as a 3-yr (horizon) figure; spread evenly across the
  // horizon so the discounting bites (a flat $X total != $X realized today).
  const revenuePerYear = horizon > 0 ? (revenue * (1 - cogs)) / horizon : 0;

  // One-time benefits land in Year 1 (the counterfactual / risk-register event).
  const costAvoidValue = costAvoid * pAvoid;
  const riskValue = riskReduction * pRisk;

  const perYear = [];
  let total = 0;

  // Per-component running totals (discounted), for the receipt.
  let cRevenue = 0;
  let cCostSave = 0;
  let cCostAvoid = 0;
  let cRisk = 0;
  let cCustomer = 0;
  let cTCO = 0;

  for (let y = 1; y <= horizon; y++) {
    const discount = Math.pow(1 + r, y);

    const revY = revenuePerYear;
    const saveFrac = activeFraction(it.savingsEffectiveDate, y, horizonStartDate);
    const saveY = costSaveAnnual * saveFrac;
    const avoidY = y === 1 ? costAvoidValue : 0;
    const riskY = y === 1 ? riskValue : 0;
    const custY = customerImpact; // recurring monetized CSAT/retention
    const tcoY = ongoingTCO;

    const rawY = revY + saveY + avoidY + riskY + custY - tcoY;
    const discountedY = rawY / discount;
    total += discountedY;

    cRevenue += revY / discount;
    cCostSave += saveY / discount;
    cCostAvoid += avoidY / discount;
    cRisk += riskY / discount;
    cCustomer += custY / discount;
    cTCO += tcoY / discount;

    perYear.push({
      year: y,
      discount: round2(discount),
      saveFraction: round4(saveFrac),
      revenue: round2(revY),
      costSave: round2(saveY),
      costAvoid: round2(avoidY),
      riskReduction: round2(riskY),
      customerImpact: round2(custY),
      ongoingTCO: round2(tcoY),
      raw: round2(rawY),
      discounted: round2(discountedY),
    });
  }

  return {
    total: round2(total),
    perYear,
    components: {
      revenue: round2(cRevenue),
      costSave: round2(cCostSave),
      costAvoid: round2(cCostAvoid),
      riskReduction: round2(cRisk),
      customerImpact: round2(cCustomer),
      ongoingTCO: round2(-cTCO), // shown as the negative it is
    },
    dials: { r, horizon, horizonStart: horizonStartDate.toISOString().slice(0, 10) },
  };
}

// ── tiny deterministic helpers ──────────────────────────────────────────────
function num(v, dflt = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}
function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function round4(n) {
  return Math.round(n * 10000) / 10000;
}
