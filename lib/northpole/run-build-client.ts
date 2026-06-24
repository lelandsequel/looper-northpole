import type { NorthPoleRunView } from "./client-view";

export async function runBuildViaApi(initiativeId: string): Promise<NorthPoleRunView> {
  const res = await fetch("/api/north-pole/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initiativeId }),
  });
  const data = (await res.json()) as { ok: boolean; run?: NorthPoleRunView; error?: string };
  if (!res.ok || !data.ok || !data.run) {
    throw new Error(data.error ?? `build failed (${res.status})`);
  }
  return data.run;
}