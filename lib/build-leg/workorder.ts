// THE BUILD WORK-ORDER — acceptance criteria, compiled into executable probes.
//
// A 6D Distribute story is already a build work-order: it carries acceptance
// criteria, dependencies, and provenance. Stage 3 consumes it. The load-bearing
// idea of the build leg: the validator does NOT trust the builder's own tests —
// it runs the *acceptance criteria themselves* as deterministic probes against
// the delivered build, and refuses on any red. The criteria ARE the gate.
//
// For v0 the probes are authored by hand from the story's ACs (the honest
// caveat: auto-deriving probes from prose is the frontier — CADMUS/an agent
// would generate these later). What is already real and productizable: the
// validator runs them, renders an AURORA verdict, and refuses a build that
// fails a blocking criterion. No clock, no randomness — deterministic. 🐦‍⬛ + 🔑

import type {
  PriceQuoteFn,
  PricingDeps,
  QuoteRequest,
  RateSheet,
  EligibilityService,
} from "./demo/contract";

/** One probe's outcome: did the delivered build satisfy this criterion? */
export interface ProbeResult {
  pass: boolean;
  detail: string;
}

/** An acceptance criterion as an executable check against the built function. */
export interface AcceptanceProbe {
  id: string;
  /** The criterion, in the words of the spec. */
  text: string;
  /** Blocking criteria gate the verdict; non-blocking ones only HOLD. */
  blocking: boolean;
  /** Run the criterion against the delivered build. Deterministic. */
  run: (priceQuote: PriceQuoteFn) => ProbeResult;
}

/** A buildable unit handed from 6D (Stage 2) to the build leg (Stage 3). */
export interface BuildWorkOrder {
  storyId: string;
  title: string;
  /** The Agility initiative this story decomposes from (provenance). */
  sourceInitiative: string;
  /** The 6D acceptance criteria, as executable probes. */
  acceptance: AcceptanceProbe[];
}

// ── Deterministic fixtures the probes price against ──────────────────────────

const liveRateSheet: RateSheet = {
  status: { available: true, fresh: true },
  basePriceBps: 325,
  publishedAt: "2026-06-12T14:00:00Z",
};
const staleRateSheet: RateSheet = {
  ...liveRateSheet,
  status: { available: true, fresh: false }, // reachable but past its freshness window
};
const eligibleSvc: EligibilityService = {
  status: { available: true, fresh: true },
  eligible: true,
};
const eligibilityDown: EligibilityService = {
  status: { available: false, fresh: false },
  // The eligible flag is stale/meaningless when the service is unavailable.
  // It is left `true` on purpose: a correct build refuses on UNAVAILABILITY; a
  // careless build that trusts this stale flag will wrongly quote — and the
  // validator must catch that.
  eligible: true,
};

const req: QuoteRequest = { loanId: "L-1001", amountUsd: 480_000, marginFloorBps: 300 };
// A request whose rate-sheet base (325) would fall BELOW the floor we set here,
// so the floor must bind — proves criterion 4 isn't vacuously satisfied.
const floorBindingReq: QuoteRequest = { ...req, loanId: "L-1002", marginFloorBps: 400 };

const deps = (rateSheet: RateSheet, eligibility: EligibilityService): PricingDeps => ({
  rateSheet,
  eligibility,
});

/** Did the build refuse (not return a price)? */
const refused = (r: ReturnType<PriceQuoteFn>): boolean => r.ok === false && r.refused === true;

// ── The work-order for the stale-data story (decomposed from HL-002) ─────────

export const STALE_DATA_STORY: BuildWorkOrder = {
  storyId: "HL-002.distribute.story.refuse-on-stale",
  title: "Correspondent pricing must refuse to quote on stale data",
  sourceInitiative: "HL-002",
  acceptance: [
    {
      id: "ac.1",
      text: "Refuse to quote when the rate sheet is stale — never price on stale data.",
      blocking: true,
      run: (priceQuote) => {
        const r = priceQuote(req, deps(staleRateSheet, eligibleSvc));
        return {
          pass: refused(r),
          detail: refused(r)
            ? "refused on a stale rate sheet"
            : `PRICED on stale data → ${JSON.stringify(r)}`,
        };
      },
    },
    {
      id: "ac.2",
      text: "Refuse to quote when the eligibility service is unavailable.",
      blocking: true,
      run: (priceQuote) => {
        const r = priceQuote(req, deps(liveRateSheet, eligibilityDown));
        return {
          pass: refused(r),
          detail: refused(r)
            ? "refused when eligibility was unavailable"
            : `quoted without eligibility → ${JSON.stringify(r)}`,
        };
      },
    },
    {
      id: "ac.3",
      text: "Return a priced quote when both feeds are live and the borrower is eligible.",
      blocking: true,
      run: (priceQuote) => {
        const r = priceQuote(req, deps(liveRateSheet, eligibleSvc));
        const ok = r.ok === true && typeof r.priceBps === "number";
        return {
          pass: ok,
          detail: ok ? `quoted ${(r as { priceBps: number }).priceBps}bps` : `did not quote → ${JSON.stringify(r)}`,
        };
      },
    },
    {
      id: "ac.4",
      text: "Never quote a price below the locked margin floor.",
      blocking: true,
      run: (priceQuote) => {
        const r = priceQuote(floorBindingReq, deps(liveRateSheet, eligibleSvc));
        if (r.ok !== true) return { pass: false, detail: `expected a quote, got → ${JSON.stringify(r)}` };
        const ok = r.priceBps >= floorBindingReq.marginFloorBps;
        return {
          pass: ok,
          detail: ok
            ? `${r.priceBps}bps respects the ${floorBindingReq.marginFloorBps}bps floor`
            : `${r.priceBps}bps is BELOW the ${floorBindingReq.marginFloorBps}bps floor`,
        };
      },
    },
    {
      id: "ac.5",
      text: "Every quote carries an auditable record (rate inputs + eligibility decision).",
      blocking: true,
      run: (priceQuote) => {
        const r = priceQuote(req, deps(liveRateSheet, eligibleSvc));
        if (r.ok !== true) return { pass: false, detail: `expected a quote, got → ${JSON.stringify(r)}` };
        const a = r.audit;
        const ok =
          !!a &&
          a.loanId === req.loanId &&
          typeof a.basePriceBps === "number" &&
          a.marginFloorBps === req.marginFloorBps &&
          typeof a.rateSheetPublishedAt === "string" &&
          typeof a.eligibilityDecision === "boolean";
        return {
          pass: ok,
          detail: ok ? "quote is auditable (full record present)" : `audit record incomplete → ${JSON.stringify(a)}`,
        };
      },
    },
  ],
};
