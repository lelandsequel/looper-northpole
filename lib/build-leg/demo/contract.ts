// THE BUILD CONTRACT — Stage 3, the build leg.
//
// This is the interface surface for ONE 6D story decomposed out of the
// Correspondent Pricing Engine (HL-002):
//
//   "The engine requires the rate-sheet feed and the eligibility service to be
//    live. If either is stale or unavailable it must refuse to quote rather
//    than price on stale data."  (+ never price below the locked margin floor,
//    + every quote must be auditable.)
//
// The BUILDER (an independent agent) implements `priceQuote` against this
// contract. The VALIDATOR imports the build and runs the story's acceptance
// criteria as executable probes against it. Both sides share this surface so
// the gate and the build agree on shape — the contract is the spec, the body
// is the build, the probes are the gate.
//
// No engine, no clock, no randomness here — a pure contract. 🐦‍⬛ + 🔑

/** Liveness of an upstream dependency feed. */
export interface FeedStatus {
  /** Is the feed reachable at all? */
  available: boolean;
  /** Was it refreshed within its freshness window? (stale ⇒ false) */
  fresh: boolean;
}

/** The live rate sheet the quote prices against. */
export interface RateSheet {
  status: FeedStatus;
  /** Base price in basis points — valid ONLY when status is available + fresh. */
  basePriceBps: number;
  /** ISO timestamp the sheet was published — rides into the audit record. */
  publishedAt: string;
}

/** The borrower eligibility service. */
export interface EligibilityService {
  status: FeedStatus;
  /** Whether the borrower is eligible — meaningful only when available. */
  eligible: boolean;
}

export interface QuoteRequest {
  loanId: string;
  amountUsd: number;
  /** The locked margin floor — a price may never be quoted below this. */
  marginFloorBps: number;
}

export interface PricingDeps {
  rateSheet: RateSheet;
  eligibility: EligibilityService;
}

/**
 * An auditable record of how a price was produced. Load-bearing: every quote
 * must be explainable + auditable after the fact (HL-002).
 */
export interface AuditRecord {
  loanId: string;
  basePriceBps: number;
  marginFloorBps: number;
  rateSheetPublishedAt: string;
  eligibilityDecision: boolean;
}

/** A successful priced quote, or a refusal — never a price on stale data. */
export type QuoteResult =
  | { ok: true; priceBps: number; audit: AuditRecord }
  | { ok: false; refused: true; reason: string };

/** The function the builder must implement and the validator probes. */
export type PriceQuoteFn = (req: QuoteRequest, deps: PricingDeps) => QuoteResult;
