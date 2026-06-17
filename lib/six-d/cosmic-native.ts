// 6D Workbench — COSMIC-native composition seam (Tiers 1 + 2 + 3, one view).
//
// This is the SINGLE place the three consolidated tiers are composed into the
// end-to-end pipeline the design memo (lib/six-d/6D-COSMIC-UPGRADE.md) draws:
//
//   Feature Intent
//     → [SEMANTIC LAYER]  ASTRAL schema + NEBULA entity reconciliation   (Tier 2)
//          (what the intent MEANS — entities, typed requirements, + its own frontier)
//     → 6D phase transforms (Define…Deliver)                            (v1, kept)
//     → [VELLUM]  bind every element to a source; unbound = UNBOUND      (Tier 1)
//     → [AURORA]  gate each artifact NO_OBJECTION/HOLD/REFUSE            (Tier 1)
//     → [LUNA]    hash-chain the run into the append-only ledger         (Tier 1)
//     → [VANTAGE] audit the generated code-shaped artifacts             (Tier 3)
//
// FUSION DECISION (documented, on purpose — "we don't bullshit"):
//   The semantic layer is composed ALONGSIDE the pipeline, NOT spliced into v1's
//   phase transforms. Reason: v1 (runSixD / phases.ts) is byte-frozen by contract,
//   and the determinism tests pin its receipt to the exact manifest bytes. The
//   Tier-2 authors built the layer to be consumed as an EXTRA argument (see
//   semantic/phases-semantic.ts: "A real Tier-2 promotion would thread the model
//   through PhaseCtx; this shows the consuming code that promotion would use").
//   Forcing the model into the parse step without rewriting the phases would only
//   ANNOTATE — a decorative "fusion" that changes no output. That's the beautiful
//   fake the memo warns against. So the honest realization is COMPOSABLE: the
//   semantic model rides next to the run as inspectable, deterministic meaning,
//   derived from the SAME manifest (manifest.intent + manifest.intentIndex), and
//   the phase-level promotion stays available behind it (definePhaseSemantic /
//   designPhaseSemantic) for when v1 is intentionally re-cut. Nothing here mutates
//   v1's manifest, receipt, or any Tier-1 hash — so every prior suite stays green.
//
// DETERMINISM: same intent ⇒ same manifest ⇒ same provenance/gate/runHash (Tier 1)
//   ⇒ same semantic model + fingerprint (Tier 2) ⇒ same audit verdict (Tier 3,
//   for a given runner). No clock, no randomness, no network in this path.
//
// 🐦‍⬛ + 🔑

import type { RawIntent } from "./engine";
import { buildSemanticModel, type IntentSemanticModel } from "./semantic";
import {
  runSixDCosmic,
  type CosmicRun,
  Ledger,
  type LedgerEntry,
  type Resolution,
} from "./cosmic";
import {
  auditGeneratedArtifacts,
  type GeneratedArtifactAudit,
  type VantageRunner,
} from "./cosmic-audit";

/** The full COSMIC-native view for one intent: meaning + pipeline + audit. */
export type CosmicNativeRun = {
  schema: "6d.cosmic.native.v1";
  /** Tier 2 — deterministic meaning of the intent (entities, typed reqs, frontier). */
  semantic: IntentSemanticModel;
  /** Tier 1 — the VELLUM→AURORA→LUNA run over the byte-identical v1 manifest. */
  cosmic: CosmicRun;
  /** Tier 1 — the sealed ledger entry for this run (its payloadHash === cosmic.runHash). */
  entry: LedgerEntry;
  /** Tier 3 — VANTAGE audit of the generated code-shaped artifacts (honest NOT_WORTHWHILE). */
  audit: GeneratedArtifactAudit;
};

export type CosmicNativeOptions = {
  /** Chain onto a prior LUNA ledger (the demo: run after run, each chained). */
  ledger?: Ledger;
  /** REFUSE→RESOLVE→RECOMPUTE inputs for the AURORA gate, if any. */
  resolutions?: Resolution[];
  /** Injected VANTAGE runner for Tier 3 (tests stay deterministic; prod uses the default). */
  vantageRunner?: VantageRunner;
};

/**
 * Compose all three consolidated tiers over a single intent and return one
 * coherent, deterministic view. Pure orchestration: it calls each tier's public
 * surface and threads the SAME v1 manifest through, so the semantic model and the
 * audit are derived from exactly what the pipeline ran — never a re-parse that
 * could drift.
 *
 * Returns the ledger too (created if not supplied) so callers can keep chaining.
 */
export async function runSixDCosmicNative(
  raw: RawIntent,
  opts: CosmicNativeOptions = {},
): Promise<{ run: CosmicNativeRun; ledger: Ledger }> {
  // Tier 1 — run the pipeline first; it owns the (byte-identical) v1 manifest.
  const ledger = opts.ledger ?? new Ledger();
  const { run: cosmic, entry } = await runSixDCosmic(raw, {
    ledger,
    resolutions: opts.resolutions ?? [],
  });

  // Tier 2 — derive meaning from the SAME manifest's intent + index (no re-parse).
  const semantic = buildSemanticModel(cosmic.manifest.intent, cosmic.manifest.intentIndex);

  // Tier 3 — audit the generated code-shaped artifacts of that same manifest.
  const audit = await auditGeneratedArtifacts(
    cosmic.manifest,
    opts.vantageRunner ? { runner: opts.vantageRunner } : {},
  );

  return {
    run: { schema: "6d.cosmic.native.v1", semantic, cosmic, entry, audit },
    ledger,
  };
}

// Re-export the composable parts so a consumer can import the whole COSMIC-native
// surface from one module without reaching into each tier's barrel.
export type { IntentSemanticModel } from "./semantic";
export type { CosmicRun, LedgerEntry, Resolution } from "./cosmic";
export { Ledger } from "./cosmic";
export type { GeneratedArtifactAudit, VantageRunner } from "./cosmic-audit";
