// 6D Semantic Layer (Tier 2) — public surface.
//
// A NEW module, parallel to the live v1 keyword path (helpers.ts). It replaces
// keyword-bucket/regex intent parsing with a deeper DETERMINISTIC intent semantic
// model, built from two real chamber engines (ported, see each file's header):
//
//   • NEBULA action-suite → deterministic entity reconciliation (one canonical
//     "agent" entity out of "the agent"/"servicing agents"/"agents"), with
//     provenance (WAKE) and a refuse-to-guess sieve.
//   • ASTRAL schema mapper → EARS/modality/budget typing of each requirement.
//
// And — load-bearing — it REPORTS its own frontier: the residual that only an LLM
// or a human closes. We don't bullshit; the gap is a field on the model.
//
// Nothing here touches v1. Import from here to consume the model.
//
// 🐦‍⬛ + 🔑

export { buildSemanticModel } from "./model";
export type {
  IntentSemanticModel,
  TypedRequirement,
  FrontierReport,
} from "./model";

export { reconcile } from "./nebula";
export type {
  CanonicalEntity,
  Mention,
  EntityRole,
  ReviewItem,
  WakeTrail,
  MergeSignal,
} from "./nebula";

export { classifyClause } from "./astral";
export type {
  RequirementTyping,
  Modality,
  EarsClass,
  Polarity,
} from "./astral";

export { scanIntent, scanAtom } from "./mentions";
export type { MentionScan } from "./mentions";

export { lemmaKey, headNoun, singularize, titleCaseKey } from "./morphology";

export {
  actorsFrom,
  systemsFrom,
  actionsFrom,
  primaryActor,
  requirementsByModality,
  budgetedRequirements,
  narrativeRequirements,
  entityById,
} from "./adapter";

export { definePhaseSemantic, designPhaseSemantic } from "./phases-semantic";
