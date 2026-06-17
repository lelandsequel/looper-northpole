// OMNIS Semantic Spec Engine — the run orchestrator.
//
// This is the FIRST-CLASS semantic pipeline: a parallel sibling to v1's runSixD
// where the IntentSemanticModel (NEBULA entity reconciliation + ASTRAL EARS
// typing + the honest frontier report) DRIVES the phases — not rides alongside
// them. v1 (runSixD / phases.ts) stays byte-frozen; this pipeline produces its
// own richer manifest with its own receipt.
//
//   intent → normalize → index → buildSemanticModel (the MEANING)
//          → six phase transforms, each handed the model
//          → manifest (artifacts grounded in reconciled entities + typed reqs)
//
// The semantic model is carried INSIDE the manifest (manifest.semantic), so the
// receipt commits to it transitively (the artifacts are derived from it) and any
// consumer — VELLUM, the loop, a page — can inspect the meaning the spec was
// built from, including the frontier report that names exactly where an LLM
// would still be required. Nothing here is faked: what the deterministic layer
// can't type is surfaced as an open question, never invented.
//
// Phase roster note: Define + Design run their SEMANTIC transforms today;
// Distribute…Deliver currently consume the semantic upstream via ctx.upstream
// (their inputs — stories, ACs, ADRs — are already the reconciled ones) and get
// promoted to model-driven transforms one at a time, always green. The roster
// below is the single place that swap happens.
//
// Pure: no clock, no randomness, no network. Same intent ⇒ same model ⇒ same
// artifacts ⇒ same receipt. 🐦‍⬛ + 🔑

import {
  buildIntentIndex,
  normalizeIntent,
  type RawIntent,
} from "../engine";
import { sha256Hex, stableStringify } from "../helpers";
import { distributePhaseSemantic } from "./phases-semantic-distribute";
import { developPhaseSemantic } from "./phases-semantic-develop";
import { detectPhaseSemantic } from "./phases-semantic-detect";
import { deliverPhaseSemantic } from "./phases-semantic-deliver";
import type {
  ArtifactElement,
  IntentRef,
  PhaseArtifact,
  PhaseCtx,
  RunManifest,
} from "../types";
import { buildSemanticModel, type IntentSemanticModel } from "./model";
import { definePhaseSemantic, designPhaseSemantic } from "./phases-semantic";

export const SEMANTIC_GENERATED_BY =
  "CADMUS — the meaning-driven spec engine · deterministic · keyless · zero egress";

/** A run manifest whose artifacts were built from reconciled meaning. */
export type SemanticRunManifest = RunManifest & {
  /** The deterministic meaning the spec was built from (entities, typed reqs, frontier). */
  semantic: IntentSemanticModel;
};

/** A model-driven phase transform: sees the same PhaseCtx AND the semantic model. */
type SemanticPhase = (ctx: PhaseCtx, model: IntentSemanticModel) => PhaseArtifact;
/** A legacy v1 transform: consumes the (now semantic) upstream via ctx.upstream. */
type LegacyPhase = (ctx: PhaseCtx) => PhaseArtifact;

type PhaseSlot =
  | { semantic: true; fn: SemanticPhase }
  | { semantic: false; fn: LegacyPhase };

/**
 * The six phases of the semantic pipeline. Define + Design are model-driven now;
 * the rest consume the reconciled upstream and are promoted in place (flip the
 * slot to `{ semantic: true, fn: …PhaseSemantic }`) as each lands — the rest of
 * the engine, the loop, and the pages never change.
 */
const SEMANTIC_PHASES: PhaseSlot[] = [
  { semantic: true, fn: definePhaseSemantic },
  { semantic: true, fn: designPhaseSemantic },
  { semantic: true, fn: distributePhaseSemantic },
  { semantic: true, fn: developPhaseSemantic },
  { semantic: true, fn: detectPhaseSemantic },
  { semantic: true, fn: deliverPhaseSemantic },
];

/**
 * Run the semantic pipeline. Returns a manifest whose artifacts are grounded in
 * the reconciled model, with a deterministic receipt. Drop-in shape-compatible
 * with v1's RunManifest, so VELLUM / AURORA / LUNA wrap it unchanged.
 */
export async function runSixDSemantic(raw: RawIntent): Promise<SemanticRunManifest> {
  const intent = normalizeIntent(raw);
  const index = buildIntentIndex(intent);
  const model = buildSemanticModel(intent, index);

  const byId = new Map<string, IntentRef | ArtifactElement>();
  for (const a of index) byId.set(a.id, a);

  const artifacts: PhaseArtifact[] = [];
  for (const slot of SEMANTIC_PHASES) {
    const ctx: PhaseCtx = { intent, index, byId, upstream: artifacts };
    const art = slot.semantic ? slot.fn(ctx, model) : slot.fn(ctx);
    for (const e of art.elements) byId.set(e.id, e);
    artifacts.push(art);
  }

  const sansReceipt = {
    schema: "6d.run.v1" as const, // a valid RunManifest (VELLUM/AURORA consume it)
    intent,
    intentIndex: index,
    artifacts,
    generatedBy: SEMANTIC_GENERATED_BY,
  };
  // The receipt commits to the artifacts (which are derived from the model) +
  // the model's own fingerprint, so altering the meaning snaps the receipt.
  const receipt = await sha256Hex(
    stableStringify({ ...sansReceipt, semanticFingerprint: model.fingerprint }),
  );

  return { ...sansReceipt, receipt, semantic: model };
}

/** Re-run the manifest's own intent and confirm the receipt lands identically. */
export async function verifySemanticRun(
  manifest: SemanticRunManifest,
): Promise<{ ok: boolean; recomputed: string }> {
  const fresh = await runSixDSemantic({
    title: manifest.intent.title,
    context: manifest.intent.context,
    goals: manifest.intent.goals,
    constraints: manifest.intent.constraints,
    sourceMaterial: manifest.intent.sourceMaterial,
  });
  return { ok: fresh.receipt === manifest.receipt, recomputed: fresh.receipt };
}

/** How many phases are running their model-driven transform (vs. consuming upstream). */
export const semanticPhaseCount = (): { driven: number; total: number } => ({
  driven: SEMANTIC_PHASES.filter((s) => s.semantic).length,
  total: SEMANTIC_PHASES.length,
});

// ── The meaning-driven pipeline, through the full COSMIC gate ─────────────────
// runSixDCosmicSemantic is the drop-in the loop and the build leg use in place of
// runSixDCosmic: the SAME VELLUM (bind) → AURORA (gate) → LUNA (chain), but over
// the semantic manifest. The run's manifest carries `.semantic`, so a consumer
// can show the reconciled meaning + the frontier alongside the receipt.

import { runSixDCosmic } from "../cosmic";
import type { CosmicRun, Ledger, LedgerEntry, Resolution } from "../cosmic";

export async function runSixDCosmicSemantic(
  raw: RawIntent,
  opts: { ledger?: Ledger; resolutions?: Resolution[] } = {},
): Promise<{ run: CosmicRun; entry: LedgerEntry; ledger: Ledger }> {
  return runSixDCosmic(raw, { ...opts, produce: runSixDSemantic });
}
