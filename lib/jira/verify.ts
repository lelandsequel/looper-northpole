import { sha256Hex, stableStringify } from "@/lib/six-d/helpers";
import type { CosmicRun } from "@/lib/six-d/cosmic";
import { VERDICTS } from "@/lib/six-d/cosmic";
import { openIssuesFrom } from "@/lib/loop/adapter";

import { extractJiraPayload } from "./extract";
import type { JiraVerifyResult } from "./types";

function blockingOpenQuestions(run: CosmicRun): string[] {
  const reasons: string[] = [];
  for (const art of run.manifest.artifacts) {
    for (const oq of art.openQuestions) {
      if (oq.blocking) {
        reasons.push(`blocking open question ${oq.id}: ${oq.question}`);
      }
    }
  }
  return reasons;
}

function auroraRefusalsOnDistribute(run: CosmicRun): string[] {
  const distribute = run.gate.artifacts.find((a) => a.phase === "distribute");
  if (!distribute) return ["distribute phase missing from AURORA gate report"];
  const reasons: string[] = [];
  for (const ev of distribute.elements) {
    if (ev.verdict === VERDICTS.REFUSE) {
      reasons.push(`AURORA REFUSE on ${ev.elementId}: ${ev.reason}`);
    }
  }
  if (distribute.verdict === VERDICTS.REFUSE) {
    reasons.push(`AURORA REFUSE on distribute artifact: ${distribute.reason}`);
  }
  return reasons;
}

/**
 * Verification-first gate. Refuses emit when the spec is not ticket-ready.
 * Deterministic — same inputs ⇒ same verdict + emit hash.
 */
export async function verifyJiraEmit(
  run: CosmicRun,
  initiativeId: string,
  specReceipt: string,
): Promise<JiraVerifyResult> {
  const reasons: string[] = [];

  if (!specReceipt || !/^[0-9a-f]{64}$/.test(specReceipt)) {
    reasons.push("spec receipt missing or invalid — LUNA chain head required");
  }

  const payload = extractJiraPayload(run, initiativeId, specReceipt);
  if (!payload) {
    reasons.push("Distribute phase produced no epic or no stories");
  }

  if (payload) {
    for (const story of payload.stories) {
      if (story.acceptanceCriteria.length === 0) {
        reasons.push(`story ${story.storyId} has no acceptance criteria`);
      }
    }
  }

  reasons.push(...blockingOpenQuestions(run));
  reasons.push(...auroraRefusalsOnDistribute(run));

  const blockingIssues = openIssuesFrom(run).filter((i) => i.blocking);
  for (const issue of blockingIssues) {
    reasons.push(`blocking AURORA need ${issue.key}: ${issue.required}`);
  }

  if (reasons.length > 0) {
    return { ok: false, refused: true, reasons };
  }

  const emitHash = await sha256Hex(stableStringify(payload!));
  return { ok: true, payload: payload!, emitHash };
}