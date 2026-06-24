import { apiBuilder } from "./adapters/agent-api";
import { demoBuilder } from "./adapters/demo-builder";
import type { Builder } from "./orchestrator";

export type BuildBuilderKind = "demo" | "agent";

export function resolveBuilder(kind: BuildBuilderKind = "demo"): Builder {
  if (kind === "agent") {
    const url = process.env.BUILD_AGENT_URL;
    if (!url) {
      throw new Error("BUILD_AGENT_URL is required when builder=agent");
    }
    return apiBuilder({
      url,
      token: process.env.BUILD_AGENT_TOKEN,
    });
  }
  return demoBuilder();
}