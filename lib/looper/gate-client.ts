import { apiPath } from "@/lib/api-path";

import type { GateId } from "./gates";

export async function submitGateIntakeViaApi(
  gateId: GateId,
  values: Record<string, string>,
): Promise<{ initiativeId: string; funding: string; score: number }> {
  const res = await fetch(apiPath("/api/intake"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gate: gateId, values }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    initiativeId?: string;
    funding?: string;
    score?: number;
    error?: string;
    errors?: string[];
  };
  if (!res.ok || !data.ok) {
    const err = new Error(data.error ?? data.errors?.join("; ") ?? "intake failed") as Error & {
      cadmusErrors?: string[];
    };
    if (data.errors) err.cadmusErrors = data.errors;
    throw err;
  }
  return { initiativeId: data.initiativeId!, funding: data.funding!, score: data.score! };
}