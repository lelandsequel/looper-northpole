import type { PriceQuoteFn } from "../contract";

/**
 * Correspondent loan pricing engine — priceQuote.
 *
 * Requirements (in order of evaluation):
 *   1. Refuse when eligibility service is unavailable.
 *   2. Refuse when borrower is not eligible.
 *   3. When eligible + service available, return a priced quote.
 *   4. priceBps = max(rateSheet.basePriceBps + 10, req.marginFloorBps)
 *   5. Every successful quote carries a full AuditRecord.
 *
 * Pure function — no clock, no randomness, no I/O.
 */
export const priceQuote: PriceQuoteFn = (req, deps) => {
  const { rateSheet, eligibility } = deps;

  // Requirement 0: refuse when the rate sheet is unavailable or stale.
  if (!rateSheet.status.available || !rateSheet.status.fresh) {
    return {
      ok: false,
      refused: true,
      reason: !rateSheet.status.available
        ? "rate sheet unavailable"
        : "rate sheet stale",
    };
  }

  // Requirement 1: refuse when eligibility service is unavailable.
  if (!eligibility.status.available) {
    return {
      ok: false,
      refused: true,
      reason: "eligibility service unavailable",
    };
  }

  // Requirement 2: refuse when borrower is not eligible.
  if (!eligibility.eligible) {
    return {
      ok: false,
      refused: true,
      reason: "borrower not eligible",
    };
  }

  // Requirements 3, 4, 5: eligible + service available → produce priced quote.
  const rawPriceBps = rateSheet.basePriceBps + 10;
  const priceBps = Math.max(rawPriceBps, req.marginFloorBps);

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
