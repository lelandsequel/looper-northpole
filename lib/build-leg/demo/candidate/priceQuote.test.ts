/**
 * priceQuote acceptance tests — Stage 3, build leg
 *
 * Exercises all five acceptance criteria plus the not-eligible edge case.
 * Uses node:test (built-in) + assert/strict.  No external dependencies.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { priceQuote } from "./priceQuote";
import type {
  QuoteRequest,
  PricingDeps,
  RateSheet,
  EligibilityService,
} from "../contract";

// ────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ────────────────────────────────────────────────────────────────────────────

const LOAN_ID = "LOAN-001";
const PUBLISHED_AT = "2026-06-13T10:00:00Z";

function baseReq(overrides: Partial<QuoteRequest> = {}): QuoteRequest {
  return {
    loanId: LOAN_ID,
    amountUsd: 500_000,
    marginFloorBps: 200,
    ...overrides,
  };
}

function liveRateSheet(
  basePriceBps = 210,
  overrides: Partial<RateSheet["status"]> = {}
): RateSheet {
  return {
    status: { available: true, fresh: true, ...overrides },
    basePriceBps,
    publishedAt: PUBLISHED_AT,
  };
}

function liveEligibility(eligible = true): EligibilityService {
  return {
    status: { available: true, fresh: true },
    eligible,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Criterion 1a — REFUSE when rate-sheet feed is unavailable
// ────────────────────────────────────────────────────────────────────────────

test("criterion 1a: refuses when rate sheet is unavailable", () => {
  const deps: PricingDeps = {
    rateSheet: {
      status: { available: false, fresh: false },
      basePriceBps: 210,
      publishedAt: PUBLISHED_AT,
    },
    eligibility: liveEligibility(true),
  };

  const result = priceQuote(baseReq(), deps);

  assert.equal(result.ok, false);
  assert.equal((result as { refused: boolean }).refused, true);
  assert.ok(
    typeof (result as { reason: string }).reason === "string" &&
      (result as { reason: string }).reason.length > 0,
    "refusal must carry a non-empty reason"
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Criterion 1b — REFUSE when rate-sheet is stale (available but not fresh)
// ────────────────────────────────────────────────────────────────────────────

test("criterion 1b: refuses when rate sheet is stale", () => {
  const deps: PricingDeps = {
    rateSheet: liveRateSheet(210, { available: true, fresh: false }),
    eligibility: liveEligibility(true),
  };

  const result = priceQuote(baseReq(), deps);

  assert.equal(result.ok, false);
  assert.equal((result as { refused: boolean }).refused, true);
  assert.match(
    (result as { reason: string }).reason,
    /stale/i,
    "reason should mention staleness"
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Criterion 2 — REFUSE when eligibility service is unavailable
// ────────────────────────────────────────────────────────────────────────────

test("criterion 2: refuses when eligibility service is unavailable", () => {
  const deps: PricingDeps = {
    rateSheet: liveRateSheet(),
    eligibility: {
      status: { available: false, fresh: false },
      eligible: false,
    },
  };

  const result = priceQuote(baseReq(), deps);

  assert.equal(result.ok, false);
  assert.equal((result as { refused: boolean }).refused, true);
  assert.match(
    (result as { reason: string }).reason,
    /eligibilit/i,
    "reason should mention eligibility"
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Edge case — borrower ineligible (service up, but borrower declined)
// ────────────────────────────────────────────────────────────────────────────

test("edge case: refuses when borrower is ineligible (service available)", () => {
  const deps: PricingDeps = {
    rateSheet: liveRateSheet(),
    eligibility: liveEligibility(false), // available but not eligible
  };

  const result = priceQuote(baseReq(), deps);

  assert.equal(result.ok, false);
  assert.equal((result as { refused: boolean }).refused, true);
  assert.ok(
    typeof (result as { reason: string }).reason === "string" &&
      (result as { reason: string }).reason.length > 0
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Criterion 3 — QUOTE when live + eligible (happy path)
// ────────────────────────────────────────────────────────────────────────────

test("criterion 3: returns a quote when rate sheet is live and borrower is eligible", () => {
  const deps: PricingDeps = {
    rateSheet: liveRateSheet(210),
    eligibility: liveEligibility(true),
  };

  const result = priceQuote(baseReq(), deps);

  assert.equal(result.ok, true);
  assert.ok(
    "priceBps" in result,
    "ok result must include priceBps"
  );
  assert.ok(
    "audit" in result,
    "ok result must include audit"
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Criterion 4 — NEVER below the margin floor
// ────────────────────────────────────────────────────────────────────────────

test("criterion 4a: priceBps is never below marginFloorBps (floor wins)", () => {
  // basePriceBps=100, floor=300 → floor must win regardless of spread
  const deps: PricingDeps = {
    rateSheet: liveRateSheet(100),
    eligibility: liveEligibility(true),
  };
  const req = baseReq({ marginFloorBps: 300 });

  const result = priceQuote(req, deps);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(
      result.priceBps >= req.marginFloorBps,
      `priceBps (${result.priceBps}) must be >= marginFloorBps (${req.marginFloorBps})`
    );
  }
});

test("criterion 4b: priceBps is at least the base price + spread when above floor", () => {
  // basePriceBps=250, floor=200 → spread should push above floor; floor does NOT compress price
  const deps: PricingDeps = {
    rateSheet: liveRateSheet(250),
    eligibility: liveEligibility(true),
  };
  const req = baseReq({ marginFloorBps: 200 });

  const result = priceQuote(req, deps);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(
      result.priceBps >= req.marginFloorBps,
      `priceBps (${result.priceBps}) must be >= marginFloorBps (${req.marginFloorBps})`
    );
    // The price should also be above the raw base (spread was applied)
    assert.ok(
      result.priceBps >= 250,
      `priceBps (${result.priceBps}) should be >= basePriceBps (250) when floor is not binding`
    );
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Criterion 5 — AUDITABLE: ok quote must carry a full AuditRecord
// ────────────────────────────────────────────────────────────────────────────

test("criterion 5: ok quote carries a complete audit record", () => {
  const BASE_PRICE = 210;
  const FLOOR = 200;
  const deps: PricingDeps = {
    rateSheet: liveRateSheet(BASE_PRICE),
    eligibility: liveEligibility(true),
  };
  const req = baseReq({ loanId: "LOAN-AUDIT-01", marginFloorBps: FLOOR });

  const result = priceQuote(req, deps);

  assert.equal(result.ok, true);
  if (result.ok) {
    const { audit } = result;

    assert.equal(audit.loanId, "LOAN-AUDIT-01");
    assert.equal(audit.basePriceBps, BASE_PRICE);
    assert.equal(audit.marginFloorBps, FLOOR);
    assert.equal(audit.rateSheetPublishedAt, PUBLISHED_AT);
    assert.equal(audit.eligibilityDecision, true);
  }
});
