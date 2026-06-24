import { priceQuote as brokenBuild } from "../demo/broken/priceQuote";
import { priceQuote as fixedBuild } from "../demo/candidate/priceQuote";
import type { Builder } from "../orchestrator";

/** Deterministic demo: round 1 REFUSED, round 2+ ships the fixed implementation. */
export function demoBuilder(): Builder {
  return ({ round }) => ({
    priceQuote: round === 1 ? brokenBuild : fixedBuild,
    meta: { source: "demo" },
  });
}