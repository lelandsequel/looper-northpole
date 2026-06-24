import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

import type { AgentBuildRequest, AgentBuildResponse } from "@/lib/build-leg/types";

export const runtime = "nodejs";

const demoRoot = path.join(process.cwd(), "lib/build-leg/demo");

/**
 * Reference agent implementation — mirrors the external BUILD_AGENT_URL contract.
 * Round 1 returns broken priceQuote source; round 2+ returns the fixed implementation.
 * Use for local integration tests without a real LLM.
 */
export async function POST(req: Request) {
  let body: AgentBuildRequest;
  try {
    body = (await req.json()) as AgentBuildRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" } satisfies AgentBuildResponse, {
      status: 400,
    });
  }

  const variant = body.round <= 1 ? "broken" : "candidate";
  const sourcePath = path.join(demoRoot, variant, "priceQuote.ts");
  const source = fs.readFileSync(sourcePath, "utf8");

  return NextResponse.json({
    ok: true,
    modules: { "priceQuote.ts": source },
    receipt: `agent-stub:${body.storyId}:r${body.round}`,
  } satisfies AgentBuildResponse);
}