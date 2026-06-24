// Stage 3 — THE BUILD LEG. Public surface.
//
// The third stage of the OMNIS loop: a 6D story (Stage 2) becomes a build
// work-order; an independent builder implements it; the validator runs the
// acceptance criteria as executable probes and refuses anything that fails a
// blocking one. Decide (Agility) → specify (6D) → BUILD + GATE (here) → and the
// verdict + real outcome feed back into the loop. 🐦‍⬛ + 🔑

export { validateBuild } from "./validator";
export type {
  Verdict,
  BuildVerdict,
  ProbeOutcome,
  ResolveNeed,
  CandidateBuild,
} from "./validator";

export { STALE_DATA_STORY } from "./workorder";
export type { BuildWorkOrder, AcceptanceProbe, ProbeResult } from "./workorder";

export { runBuildLeg } from "./orchestrator";
export type { Builder, BuildBrief, BuildRound, BuildLegResult } from "./orchestrator";

export { materializeCandidate } from "./materialize";
export { demoBuilder } from "./adapters/demo-builder";
export { apiBuilder, briefToAgentRequest } from "./adapters/agent-api";
export { resolveBuilder, type BuildBuilderKind } from "./resolve-builder";
export type { AgentBuildRequest, AgentBuildResponse } from "./types";
