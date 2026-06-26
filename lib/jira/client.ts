import type { JiraEmitOutcome, JiraVerifyResult } from "./types";

export async function previewJiraViaApi(initiativeId: string): Promise<JiraVerifyResult> {
  const res = await fetch(`/api/jira/emit/preview?initiativeId=${encodeURIComponent(initiativeId)}`);
  const data = (await res.json()) as { ok: boolean; preview?: JiraVerifyResult; error?: string };
  if (!res.ok || !data.ok || !data.preview) {
    throw new Error(data.error ?? `preview failed (${res.status})`);
  }
  return data.preview;
}

export async function emitJiraViaApi(
  initiativeId: string,
  adapter: "file" | "http" = "file",
): Promise<JiraEmitOutcome> {
  const res = await fetch("/api/jira/emit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initiativeId, adapter }),
  });
  const data = (await res.json()) as { ok: boolean; outcome?: JiraEmitOutcome; error?: string };
  if (!res.ok || !data.outcome) {
    throw new Error(data.error ?? data.outcome?.reasons?.join("; ") ?? `emit failed (${res.status})`);
  }
  return data.outcome;
}