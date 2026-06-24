// THE BUILD LOOP — REFUSE → RESOLVE → RECOMPUTE, run to a verdict.
//
// The validator (validator.ts) renders a single verdict. This orchestrator turns
// it into a *loop*: build → gate → if REFUSED, hand the exact failing criteria
// back to the builder → it RESOLVEs → RECOMPUTE (re-gate) → repeat until the gate
// says NO_OBJECTION or the round budget is spent. Every round is sealed into the
// LUNA chain, so the build's whole history is tamper-evident — the same ledger
// the 6D spec uses. The receipt rides the whole circle.
//
// The `builder` is injected, which is the load-bearing seam:
//   • in tests — a deterministic fake (round 1 ships broken, round 2 ships fixed)
//     proves the loop mechanics with zero non-determinism.
//   • in the live demo — a real agent reads the brief (incl. the resolve needs)
//     and self-corrects. Same loop, real code.
// 🐦‍⬛ + 🔑

import { Ledger } from "../six-d/cosmic/luna";

import { materializeCandidate } from "./materialize";
import { validateBuild, type BuildVerdict, type ResolveNeed } from "./validator";
import type { CandidateBuild } from "./types";
import type { BuildWorkOrder } from "./workorder";

/** What a builder is handed each round: the story, and (on a retry) what to fix. */
export interface BuildBrief {
  order: BuildWorkOrder;
  round: number;
  /** RESOLVE — the criteria the validator refused last round. Empty on round 1. */
  resolve: ResolveNeed[];
}

/** A builder: given a brief, produce a build. Sync or async (a real agent is async). */
export type Builder = (brief: BuildBrief) => Promise<CandidateBuild> | CandidateBuild;

export interface BuildRound {
  round: number;
  verdict: BuildVerdict;
  /** This round's position + seal in the LUNA chain. */
  ledgerSeq: number;
  ledgerHash: string;
}

export interface BuildLegResult {
  storyId: string;
  sourceInitiative: string;
  /** "shipped" — reached NO_OBJECTION; "refused-exhausted" — spent the round budget still red. */
  status: "shipped" | "refused-exhausted";
  rounds: BuildRound[];
  finalVerdict: BuildVerdict;
  /** How many rounds it took to go green (null if it never did) — the self-correction count. */
  roundsToGreen: number | null;
  /** The LUNA chain head sealing the whole build history. */
  ledgerHead: string;
}

/**
 * Run a work-order through the build loop. Each round: build → gate → seal →
 * (if refused) feed the failing criteria forward. Deterministic given a
 * deterministic builder + ledger. Default budget: 3 rounds.
 */
export async function runBuildLeg(
  order: BuildWorkOrder,
  builder: Builder,
  opts: { maxRounds?: number; ledger?: Ledger } = {},
): Promise<BuildLegResult> {
  const maxRounds = opts.maxRounds ?? 3;
  const ledger = opts.ledger ?? new Ledger();
  const rounds: BuildRound[] = [];
  let resolve: ResolveNeed[] = [];
  let finalVerdict: BuildVerdict | null = null;

  for (let round = 1; round <= maxRounds; round++) {
    const raw = await builder({ order, round, resolve });
    const build = await materializeCandidate(raw);
    const verdict = validateBuild(order, build);

    // Seal this round into the chain (the build verdict rides the LUNA ledger).
    const entry = await ledger.append("build.round", {
      storyId: order.storyId,
      round,
      verdict: verdict.verdict,
      passed: verdict.passed,
      failed: verdict.failed,
      receipt: verdict.receipt,
    });
    rounds.push({ round, verdict, ledgerSeq: entry.seq, ledgerHash: entry.hash });
    finalVerdict = verdict;

    if (verdict.verdict === "NO_OBJECTION") {
      return {
        storyId: order.storyId,
        sourceInitiative: order.sourceInitiative,
        status: "shipped",
        rounds,
        finalVerdict: verdict,
        roundsToGreen: round,
        ledgerHead: entry.hash,
      };
    }

    // REFUSE → RESOLVE: carry the failing criteria into the next round.
    resolve = verdict.resolve;
  }

  return {
    storyId: order.storyId,
    sourceInitiative: order.sourceInitiative,
    status: "refused-exhausted",
    rounds,
    finalVerdict: finalVerdict!,
    roundsToGreen: null,
    ledgerHead: ledger.head!.hash,
  };
}
