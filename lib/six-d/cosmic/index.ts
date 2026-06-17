// 6D Workbench — COSMIC pipeline public surface.
//
// Tier 1 of the "6D Workbench → COSMIC" upgrade (see ../6D-COSMIC-UPGRADE.md):
//   • LUNA   — append-only, hash-chained ledger (replaces v1's single-run sha)
//   • AURORA — verdict gate NO_OBJECTION/HOLD/REFUSE + REFUSE→RESOLVE→RECOMPUTE
//   • VELLUM — source+hash provenance; unbound elements flagged UNBOUND
//
// v1 (../engine.ts, app/6d/) is untouched — this module is built alongside it.
// 🐦‍⬛ + 🔑

export {
  buildCosmicRun,
  runSixDCosmic,
  runBatchCosmic,
  cosmicLedgerPayload,
  COSMIC_GENERATED_BY,
  type CosmicRun,
} from "./engine";

export {
  runAuroraGate,
  applyResolutions,
  refuseResolveRecompute,
  VERDICTS,
  type Verdict,
  type GateReport,
  type ArtifactVerdict,
  type ElementVerdict,
  type ResolveNeed,
  type Resolution,
  type ResolutionOutcome,
} from "./aurora";

export {
  bindProvenance,
  unboundElements,
  provenanceById,
  type ElementProvenance,
  type ProvenanceStatus,
  type SourceBinding,
} from "./vellum";

export {
  Ledger,
  MemoryLedgerStore,
  hashPayload,
  type LedgerEntry,
  type LedgerStore,
  type VerifyResult,
} from "./luna";
