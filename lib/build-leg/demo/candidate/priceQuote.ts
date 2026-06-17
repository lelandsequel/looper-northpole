/**
 * priceQuote — correspondent loan-pricing engine (Stage 3, build leg)
 *
 * Implements `PriceQuoteFn` against the contract defined in `../contract`.
 *
 * Pricing formula:
 *   finalPriceBps = max(rateSheet.basePriceBps + SPREAD_BPS, req.marginFloorBps)
 *
 * SPREAD_BPS = 10 bps — a fixed correspondent-channel spread that covers
 * execution overhead. It is additive on top of the base rate but the margin
 * floor still wins if the spread + base still lands below the floor.
 *
 * No clock, no randomness, no I/O.  Pure function: same inputs → same output.
 */

import type {
  QuoteRequest,
  PricingDeps,
  QuoteResult,
  AuditRecord,
} from "../contract";

/** Fixed correspondent-channel spread (bps). Judgment call — see module note. */
const SPREAD_BPS = 10;

export const priceQuote = (
  req: QuoteRequest,
  deps: PricingDeps
): QuoteResult => {
  const { rateSheet, eligibility } = deps;

  // ── Criterion 1: REFUSE on stale/unavailable rate-sheet data ────────────
  if (!rateSheet.status.available) {
    return {
      ok: false,
      refused: true,
      reason: "Rate sheet feed is unavailable; cannot quote on missing data.",
    };
  }
  if (!rateSheet.status.fresh) {
    return {
      ok: false,
      refused: true,
      reason:
        "Rate sheet is stale (outside its freshness window); refusing to quote on stale data.",
    };
  }

  // ── Criterion 2: REFUSE when eligibility service is unavailable ──────────
  if (!eligibility.status.available) {
    return {
      ok: false,
      refused: true,
      reason:
        "Eligibility service is unavailable; cannot verify borrower eligibility.",
    };
  }

  // ── Edge case: eligibility available but borrower is NOT eligible ────────
  // A decline is still not a quote — refuse with a clear reason.
  if (!eligibility.eligible) {
    return {
      ok: false,
      refused: true,
      reason:
        "Borrower is ineligible per the eligibility service; no quote issued.",
    };
  }

  // ── Criterion 3 + 4: QUOTE when live + eligible, never below margin floor ─
  //
  // Apply spread first, then enforce the margin floor.  This guarantees the
  // floor is never breached regardless of what the rate sheet carries.
  const spreadPrice = rateSheet.basePriceBps + SPREAD_BPS;
  const priceBps = Math.max(spreadPrice, req.marginFloorBps);

  // ── Criterion 5: AUDITABLE — every ok quote carries a full audit record ──
  const audit: AuditRecord = {
    loanId: req.loanId,
    basePriceBps: rateSheet.basePriceBps,
    marginFloorBps: req.marginFloorBps,
    rateSheetPublishedAt: rateSheet.publishedAt,
    eligibilityDecision: eligibility.eligible,
  };

  return { ok: true, priceBps, audit };
};
