import type { Builder } from "../orchestrator";
import type { AgentBuildRequest, AgentBuildResponse } from "../types";

export type AgentApiOptions = {
  url: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export function briefToAgentRequest(brief: Parameters<Builder>[0]): AgentBuildRequest {
  return {
    storyId: brief.order.storyId,
    title: brief.order.title,
    sourceInitiative: brief.order.sourceInitiative,
    round: brief.round,
    acceptance: brief.order.acceptance.map((ac) => ({
      id: ac.id,
      text: ac.text,
      blocking: ac.blocking,
    })),
    resolve: brief.resolve,
    contract: "priceQuote.v1",
  };
}

/**
 * HTTP codegen agent adapter — POST BuildBrief JSON, receive modules, materialize in orchestrator.
 *
 * Expected agent response:
 *   { ok: true, modules: { "priceQuote.ts": "<source>" }, receipt?: "<hash>" }
 */
export function apiBuilder(opts: AgentApiOptions): Builder {
  const fetchFn = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 120_000;

  return async (brief) => {
    const body = briefToAgentRequest(brief);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;

    const res = await fetchFn(opts.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const payload = (await res.json().catch(() => ({}))) as AgentBuildResponse & Record<string, unknown>;

    if (!res.ok) {
      throw new Error(`agent HTTP ${res.status}: ${String(payload.error ?? res.statusText)}`);
    }
    if (!payload.ok) {
      throw new Error(`agent refused: ${String(payload.error ?? "unknown")}`);
    }
    if (!payload.modules || !Object.keys(payload.modules).length) {
      throw new Error("agent returned ok but no modules");
    }

    return {
      modules: payload.modules,
      meta: { source: "agent", agentReceipt: payload.receipt ?? null },
    };
  };
}