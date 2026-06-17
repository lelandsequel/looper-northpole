// NEGATIVE CONTROL — a plausible but UNSAFE build, authored as a fixture (NOT the
// agent's build) so the validator's teeth are provable. It prices the happy path
// correctly but SKIPS the liveness guards: it never checks rateSheet.status
// (available/fresh) or eligibility.status (available), trusting the base price and
// the `eligible` flag blindly. So it will quote on stale data and on a downed
// eligibility feed — exactly the careless miss a real builder might ship. The
// validator must REFUSE it. 🐦‍⬛ + 🔑

import type { PriceQuoteFn } from "../contract";

const SPREAD_BPS = 10;

export const priceQuote: PriceQuoteFn = (req, deps) => {
  const { rateSheet, eligibility } = deps;

  // BUG: only looks at the `eligible` flag — which is meaningless when the
  // service is unavailable — and never checks rate-sheet liveness at all.
  if (!eligibility.eligible) {
    return { ok: false, refused: true, reason: "borrower not eligible" };
  }

  const priceBps = Math.max(rateSheet.basePriceBps + SPREAD_BPS, req.marginFloorBps);
  return {
    ok: true,
    priceBps,
    audit: {
      loanId: req.loanId,
      basePriceBps: rateSheet.basePriceBps,
      marginFloorBps: req.marginFloorBps,
      rateSheetPublishedAt: rateSheet.publishedAt,
      eligibilityDecision: eligibility.eligible,
    },
  };
};
