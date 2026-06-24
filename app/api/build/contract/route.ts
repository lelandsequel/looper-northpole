import { NextResponse } from "next/server";

import type { AgentBuildRequest } from "@/lib/build-leg/types";

/** Document the codegen agent HTTP contract (for external agent implementers). */
export async function GET() {
  return NextResponse.json({
    endpoint: "POST {BUILD_AGENT_URL}",
    request: {
      storyId: "string",
      title: "string",
      sourceInitiative: "string",
      round: "number (1-based)",
      acceptance: [{ id: "string", text: "string", blocking: "boolean" }],
      resolve: [{ acId: "string", required: "string" }],
      contract: "priceQuote.v1",
    } satisfies Record<string, unknown>,
    response_ok: {
      ok: true,
      modules: { "priceQuote.ts": "<typescript source exporting priceQuote>" },
      receipt: "optional agent-side hash",
    },
    response_refuse: { ok: false, error: "string" },
    notes: [
      "On REFUSE, NORTHPOLE re-posts with resolve[] populated from failed blocking ACs.",
      "Validator materializes modules from a temp sandbox — no eval in the orchestrator.",
      "See lib/build-leg/demo/contract.ts for the priceQuote type surface.",
    ],
    example_request: {
      storyId: "build.HL-001",
      title: "Correspondent pricing must refuse on stale data",
      sourceInitiative: "HL-001",
      round: 2,
      acceptance: [{ id: "ac.1", text: "Refuse when rate sheet is stale.", blocking: true }],
      resolve: [{ acId: "ac.1", required: "Refuse when rate sheet is stale." }],
      contract: "priceQuote.v1",
    } satisfies AgentBuildRequest,
  });
}