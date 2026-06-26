export type LooperSpecView = {
  initiativeId: string;
  cosmic: {
    runHash: string;
    gate: {
      summary: { NO_OBJECTION: number; HOLD: number; REFUSE: number };
    };
    ledgerEntry: { hash: string; seq: number };
    provenanceCount: number;
  };
  ticketSlice: {
    epicTitle: string;
    storyCount: number;
    emitHash: string;
  };
  update: {
    verdict: "ready" | "needs-resolution";
    reEstimatedEffortTeamWeeks: number;
    roughEffortTeamWeeks: number;
    reEstimateDiffers: boolean;
    openIssueCount: number;
    specReceipt: string;
  };
  docs: {
    dir: string;
    paths: { epicStories: string; fullSpec: string };
    epicStories: string;
    fullSpec: string;
  };
  buildPendingWitnessSha?: string;
  ledgerSeq?: number;
  ledgerSha?: string;
};

export async function runSpecViaApi(initiativeId: string): Promise<LooperSpecView> {
  const res = await fetch("/api/looper/spec", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initiativeId }),
  });
  const data = (await res.json()) as { ok: boolean; spec?: LooperSpecView; error?: string };
  if (!res.ok || !data.ok || !data.spec) {
    throw new Error(data.error ?? `spec failed (${res.status})`);
  }
  return data.spec;
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}