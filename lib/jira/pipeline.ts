import { createHash } from "node:crypto";

import { getCosmicRun } from "@/lib/northpole/pipeline";
import { appendLedgerEvent } from "@/lib/store/ledger";
import { getDb } from "@/lib/store/db";

import { emitJiraToFile } from "./emit-file";
import { emitJiraToHttp } from "./emit-http";
import { verifyJiraEmit } from "./verify";
import type { JiraAdapterKind, JiraEmitOutcome, JiraVerifyResult } from "./types";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function persistEmit(
  payload: { initiativeId: string; specReceipt: string },
  emitHash: string,
  adapter: JiraAdapterKind,
  status: string,
  fullPayload: unknown,
): void {
  const id = sha(`${payload.initiativeId}:${emitHash}:${adapter}`);
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO jira_emits
       (id, initiative_id, spec_receipt, emit_hash, adapter, status, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      payload.initiativeId,
      payload.specReceipt,
      emitHash,
      adapter,
      status,
      JSON.stringify(fullPayload),
    );
}

export async function previewJiraEmit(initiativeId: string): Promise<JiraVerifyResult> {
  const stored = getCosmicRun(initiativeId);
  if (!stored) {
    return {
      ok: false,
      refused: true,
      reasons: [`no COSMIC spec run for initiative ${initiativeId}`],
    };
  }
  return verifyJiraEmit(stored.run, initiativeId, stored.entry.hash);
}

export async function emitJira(
  initiativeId: string,
  adapter: JiraAdapterKind = "file",
): Promise<JiraEmitOutcome> {
  const verified = await previewJiraEmit(initiativeId);
  if (!verified.ok) {
    return {
      adapter,
      status: "refused",
      reasons: verified.reasons,
    };
  }

  const { payload, emitHash } = verified;
  let artifact: string | { epicKey: string; storyKeys: string[] };

  if (adapter === "http") {
    artifact = await emitJiraToHttp(payload);
  } else {
    artifact = emitJiraToFile(payload, emitHash);
  }

  persistEmit(payload, emitHash, adapter, "emitted", { payload, artifact });

  const ledger = appendLedgerEvent("jira.emit", {
    initiativeId,
    specReceipt: payload.specReceipt,
    emitHash,
    adapter,
    artifact,
  });

  return {
    adapter,
    status: "emitted",
    emitHash,
    payload,
    artifact,
    ledgerSeq: ledger.seq,
    ledgerSha: ledger.sha,
  };
}

export function getLatestJiraEmit(initiativeId: string) {
  const row = getDb()
    .prepare(
      "SELECT adapter, status, emit_hash, payload, created_at FROM jira_emits WHERE initiative_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(initiativeId) as
    | { adapter: string; status: string; emit_hash: string; payload: string; created_at: string }
    | undefined;
  return row
    ? {
        adapter: row.adapter as JiraAdapterKind,
        status: row.status,
        emitHash: row.emit_hash,
        payload: JSON.parse(row.payload),
        createdAt: row.created_at,
      }
    : null;
}