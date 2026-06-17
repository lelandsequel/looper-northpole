// 6D Workbench — COSMIC pipeline orchestrator.
//
// This is the upgrade the design memo calls Tier 1: take the v1 run and put it
// through the real COSMIC pipeline shape —
//
//   produce (runSixD) → VELLUM (bind source) → AURORA (gate) →[refused]→ RESOLVE
//                       → RECOMPUTE → LUNA (chain into the append-only ledger)
//
// v1 is UNTOUCHED: we import runSixD from ../engine and consume its manifest. The
// only thing we replace is the *seal* — v1's single-run sha receipt becomes a real
// hash-chained ledger entry (LUNA), and we add the VELLUM provenance pass and the
// AURORA verdict gate around it.
//
// DETERMINISM CONTRACT (same as v1, extended to the chain):
//   Same intent ⇒ same artifacts ⇒ same provenance ⇒ same gate report ⇒ same
//   run-payload hash. And given the same prior ledger state, the same run-payload
//   ⇒ the same chained entry hash. No clock, no network, no Math.random in this path.
//
// 🐦‍⬛ + 🔑

import { runSixD, type RawIntent } from "../engine";
import { sha256Hex, stableStringify } from "../helpers";
import type { RunManifest } from "../types";
import {
  refuseResolveRecompute,
  runAuroraGate,
  type GateReport,
  type Resolution,
  type ResolutionOutcome,
} from "./aurora";
import { Ledger, type LedgerEntry, type LedgerStore } from "./luna";
import { bindProvenance, type ElementProvenance } from "./vellum";

export const COSMIC_GENERATED_BY =
  "COSMIC pipeline — VELLUM (bind) · AURORA (gate) · LUNA (chain) — deterministic · keyless · zero egress";

/** Everything one 6D run contributes, before it is chained. */
export type CosmicRun = {
  schema: "6d.cosmic.run.v1";
  manifest: RunManifest; // the untouched v1 manifest (incl. its own sha receipt)
  provenance: ElementProvenance[]; // VELLUM bindings
  gate: GateReport; // AURORA verdicts (post-resolution, if any resolutions supplied)
  /** Present when resolutions were supplied: the before/after of the refuse loop. */
  resolution?: {
    outcomes: ResolutionOutcome[];
    resolvedKeys: string[];
    before: GateReport;
  };
  /** The deterministic payload hash that gets chained into LUNA. */
  runHash: string;
};

/**
 * Build a CosmicRun for an intent: run v1, bind provenance, run the AURORA gate
 * (optionally with resolutions through the REFUSE→RESOLVE→RECOMPUTE loop), and
 * compute the deterministic run hash. Does NOT touch a ledger — pure.
 */
export async function buildCosmicRun(
  raw: RawIntent,
  resolutions: Resolution[] = [],
  produce: (raw: RawIntent) => Promise<RunManifest> = runSixD,
): Promise<CosmicRun> {
  const manifest = await produce(raw); // default: v1, byte-identical
  const provenance = await bindProvenance(manifest);

  let gate: GateReport;
  let resolution: CosmicRun["resolution"];
  if (resolutions.length) {
    const loop = await refuseResolveRecompute(manifest, resolutions);
    gate = loop.after;
    resolution = { outcomes: loop.outcomes, resolvedKeys: loop.resolvedKeys, before: loop.before };
  } else {
    gate = await runAuroraGate(manifest);
  }

  // The canonical run payload. v1's `receipt` is included (so the chain still
  // commits to it), plus the new provenance + gate. stableStringify makes key
  // order irrelevant; the hash is reproducible from this object alone.
  const payload = {
    schema: "6d.cosmic.run.v1" as const,
    receipt: manifest.receipt,
    intentId: manifest.intent.id,
    provenance,
    gate,
    resolution: resolution
      ? { resolvedKeys: resolution.resolvedKeys, summary: gate.summary }
      : undefined,
  };
  const runHash = await sha256Hex(stableStringify(payload));

  return {
    schema: "6d.cosmic.run.v1",
    manifest,
    provenance,
    gate,
    ...(resolution ? { resolution } : {}),
    runHash,
  };
}

/**
 * The full COSMIC pipeline for a single intent, chained into a LUNA ledger.
 * Pass an existing `ledger` to chain onto prior runs (the demo: run after run,
 * each chained); omit it for a fresh single-entry chain. Returns the run, the
 * sealed ledger entry, and the ledger itself.
 */
export async function runSixDCosmic(
  raw: RawIntent,
  opts: {
    ledger?: Ledger;
    resolutions?: Resolution[];
    /** Manifest producer; defaults to v1 runSixD. Pass runSixDSemantic for the
     *  meaning-driven pipeline — VELLUM/AURORA/LUNA wrap it identically. */
    produce?: (raw: RawIntent) => Promise<RunManifest>;
  } = {},
): Promise<{ run: CosmicRun; entry: LedgerEntry; ledger: Ledger }> {
  const ledger = opts.ledger ?? new Ledger();
  const run = await buildCosmicRun(raw, opts.resolutions ?? [], opts.produce);
  // Chain the canonical run payload (NOT the volatile full object) so the entry's
  // payloadHash equals run.runHash — same intent + same chain position ⇒ same seal.
  const entry = await ledger.append("6d.run", cosmicLedgerPayload(run));
  return { run, entry, ledger };
}

/** The exact object LUNA chains for a run — kept in one place for parity. */
export const cosmicLedgerPayload = (run: CosmicRun) => ({
  schema: "6d.cosmic.run.v1" as const,
  receipt: run.manifest.receipt,
  intentId: run.manifest.intent.id,
  provenance: run.provenance,
  gate: run.gate,
  resolution: run.resolution
    ? { resolvedKeys: run.resolution.resolvedKeys, summary: run.gate.summary }
    : undefined,
});

/**
 * Chain a batch of intents into one ledger, in order. Convenience for the demo
 * ("every run chained; alter any past run, the chain breaks and names where").
 */
export async function runBatchCosmic(
  raws: RawIntent[],
  store?: LedgerStore,
): Promise<{ ledger: Ledger; runs: CosmicRun[]; entries: LedgerEntry[] }> {
  const ledger = store ? new Ledger(store) : new Ledger();
  const runs: CosmicRun[] = [];
  const entries: LedgerEntry[] = [];
  for (const raw of raws) {
    const { run, entry } = await runSixDCosmic(raw, { ledger });
    runs.push(run);
    entries.push(entry);
  }
  return { ledger, runs, entries };
}

export type { GateReport, Resolution, ResolutionOutcome } from "./aurora";
export { VERDICTS, type Verdict } from "./aurora";
export type { ElementProvenance, ProvenanceStatus } from "./vellum";
export { Ledger, type LedgerEntry, type VerifyResult } from "./luna";
