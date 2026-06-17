// THE VALIDATOR — Stage 3's gate, and the whole differentiator.
//
// Everyone has a builder now; it's a commodity. Nobody has a real validator.
// This is it, at the code layer: it does NOT trust the builder's own tests — it
// runs the work-order's acceptance criteria as executable probes against the
// DELIVERED build and renders an AURORA verdict. "AI that can't lie about
// whether the work is right" — applied to generated code.
//
//   • a build missing `priceQuote` (didn't honor the contract)  → REFUSE
//   • any BLOCKING criterion fails                              → REFUSE + a RESOLVE need
//   • only non-blocking criteria fail                           → HOLD
//   • every criterion passes                                    → NO_OBJECTION
//
// A probe that THROWS is caught and counts as a failure (a build that crashes
// under a criterion has not satisfied it). Deterministic: same build + same
// order ⇒ same verdict ⇒ same receipt. No clock, no randomness. 🐦‍⬛ + 🔑

import { createHash } from "node:crypto";

import type { BuildWorkOrder, ProbeResult } from "./workorder";
import type { PriceQuoteFn } from "./demo/contract";

export type Verdict = "NO_OBJECTION" | "HOLD" | "REFUSE";

export interface ProbeOutcome {
  id: string;
  text: string;
  blocking: boolean;
  pass: boolean;
  detail: string;
}

/** On REFUSE, exactly what the builder must fix — sourced to a criterion, never invented. */
export interface ResolveNeed {
  acId: string;
  required: string;
}

export interface BuildVerdict {
  storyId: string;
  sourceInitiative: string;
  verdict: Verdict;
  probes: ProbeOutcome[];
  passed: number;
  failed: number;
  blockingFailures: number;
  /** REFUSE → RESOLVE: the failing blocking criteria, handed back to the builder. */
  resolve: ResolveNeed[];
  /** sha256 over the canonical verdict — the receipt that seals this gate. */
  receipt: string;
  summary: string;
}

/** A delivered build under test: any module exposing the contract's priceQuote. */
export interface CandidateBuild {
  priceQuote?: unknown;
}

/** Deterministic, order-stable receipt over the verdict (sans the receipt itself). */
function sealReceipt(parts: {
  storyId: string;
  sourceInitiative: string;
  verdict: Verdict;
  probes: ProbeOutcome[];
}): string {
  const canonical =
    `${parts.storyId}|${parts.sourceInitiative}|${parts.verdict}|` +
    parts.probes.map((p) => `${p.id}:${p.pass ? 1 : 0}`).join(",");
  return createHash("sha256").update(canonical).digest("hex");
}

export function validateBuild(order: BuildWorkOrder, build: CandidateBuild): BuildVerdict {
  const probes: ProbeOutcome[] = [];

  // Contract gate — the build must actually expose priceQuote.
  if (typeof build.priceQuote !== "function") {
    const base = {
      storyId: order.storyId,
      sourceInitiative: order.sourceInitiative,
      verdict: "REFUSE" as Verdict,
      probes,
    };
    return {
      ...base,
      passed: 0,
      failed: 0,
      blockingFailures: 0,
      resolve: [{ acId: "contract", required: "Build must export `priceQuote` matching the contract." }],
      receipt: sealReceipt(base),
      summary: "REFUSE — build did not honor the contract (no priceQuote export).",
    };
  }

  const priceQuote = build.priceQuote as PriceQuoteFn;

  // Run every acceptance criterion as a probe against the delivered build.
  for (const ac of order.acceptance) {
    let result: ProbeResult;
    try {
      result = ac.run(priceQuote);
    } catch (err) {
      result = { pass: false, detail: `threw: ${(err as Error)?.message ?? String(err)}` };
    }
    probes.push({ id: ac.id, text: ac.text, blocking: ac.blocking, pass: result.pass, detail: result.detail });
  }

  const passed = probes.filter((p) => p.pass).length;
  const failed = probes.length - passed;
  const blockingFailures = probes.filter((p) => !p.pass && p.blocking).length;
  const nonBlockingFailures = failed - blockingFailures;

  const verdict: Verdict =
    blockingFailures > 0 ? "REFUSE" : nonBlockingFailures > 0 ? "HOLD" : "NO_OBJECTION";

  const resolve: ResolveNeed[] = probes
    .filter((p) => !p.pass && p.blocking)
    .map((p) => ({ acId: p.id, required: p.text }));

  const base = { storyId: order.storyId, sourceInitiative: order.sourceInitiative, verdict, probes };
  const summary =
    verdict === "NO_OBJECTION"
      ? `NO_OBJECTION — ${passed}/${probes.length} acceptance criteria satisfied; build is shippable.`
      : verdict === "HOLD"
        ? `HOLD — ${passed}/${probes.length} pass; ${nonBlockingFailures} non-blocking gap(s) to resolve.`
        : `REFUSE — ${blockingFailures} blocking criterion(a) failed; build cannot ship until resolved.`;

  return { ...base, passed, failed, blockingFailures, resolve, receipt: sealReceipt(base), summary };
}
