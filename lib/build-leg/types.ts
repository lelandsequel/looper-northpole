import type { PriceQuoteFn } from "./demo/contract";

/** Delivered build under test — inline fn, or agent-supplied modules to materialize. */
export interface CandidateBuild {
  /** Pre-materialized implementation (demo builder, tests). */
  priceQuote?: PriceQuoteFn | unknown;
  /** Agent-authored source files keyed by path (e.g. `priceQuote.ts`). */
  modules?: Record<string, string>;
  meta?: {
    source: "inline" | "demo" | "agent";
    agentReceipt?: string | null;
    materializedFrom?: string | null;
  };
}

export type AgentBuildRequest = {
  storyId: string;
  title: string;
  sourceInitiative: string;
  round: number;
  acceptance: Array<{ id: string; text: string; blocking: boolean }>;
  resolve: Array<{ acId: string; required: string }>;
  contract: "priceQuote.v1";
};

export type AgentBuildResponse =
  | { ok: true; modules: Record<string, string>; receipt?: string }
  | { ok: false; error: string; receipt?: string };