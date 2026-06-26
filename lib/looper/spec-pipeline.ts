import { createHash } from "node:crypto";

import { prioritize } from "@/lib/agility";
import { DEFAULT_CAPACITY } from "@/lib/agility/pipeline";
import { listInitiatives } from "@/lib/store/initiatives";
import { getDb } from "@/lib/store/db";
import type { Initiative } from "@/lib/agility/types";
import { initiativeToIntent, artifactsToInitiativeUpdate } from "@/lib/loop/adapter";
import { runSixDCosmic, type CosmicRun } from "@/lib/six-d/cosmic";
import { sha256Hex, stableStringify } from "@/lib/six-d/helpers";
import { extractJiraPayload } from "@/lib/jira/extract";
import { appendLedgerEvent } from "@/lib/store/ledger";
import { emitBuildPending } from "@/lib/luna/witness";

import { writeSpecDocs, type SpecDocFiles } from "./docs";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function requireFundedInitiative(initiativeId: string): Initiative {
  const result = prioritize(listInitiatives(), { capacity: DEFAULT_CAPACITY });
  const funded = result.funded.find((it) => it.id === initiativeId);
  if (!funded) throw new Error(`initiative not funded: ${initiativeId}`);
  return funded;
}

export type LooperSpecResult = {
  initiativeId: string;
  initiative: Initiative;
  cosmic: {
    runHash: string;
    gate: CosmicRun["gate"];
    ledgerEntry: { hash: string; seq: number };
    provenanceCount: number;
  };
  ticketSlice: {
    epicTitle: string;
    storyCount: number;
    emitHash: string;
  };
  update: ReturnType<typeof artifactsToInitiativeUpdate>;
  docs: SpecDocFiles;
  buildPendingWitnessSha?: string;
  ledgerSeq?: number;
  ledgerSha?: string;
};

export async function runLooperSpec(initiativeId: string): Promise<LooperSpecResult> {
  const initiative = requireFundedInitiative(initiativeId);
  const intent = initiativeToIntent(initiative);
  const { run, entry } = await runSixDCosmic(intent);

  getDb()
    .prepare(
      "INSERT OR REPLACE INTO cosmic_runs (id, initiative_id, run_hash, payload) VALUES (?, ?, ?, ?)",
    )
    .run(sha(`${initiativeId}:${entry.hash}`), initiativeId, run.runHash, JSON.stringify({ run, entry }));

  const payload = extractJiraPayload(run, initiativeId, entry.hash);
  if (!payload) {
    throw new Error("Distribute phase produced no epic or stories");
  }

  const emitHash = await sha256Hex(stableStringify(payload));
  const docs = writeSpecDocs(run, initiativeId, entry.hash, emitHash);
  const update = artifactsToInitiativeUpdate(run, initiative, entry.hash);
  const witness = emitBuildPending(initiativeId, run.runHash);

  const docId = sha(`${initiativeId}:${emitHash}`);
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO spec_docs
       (id, initiative_id, spec_receipt, run_hash, emit_hash, doc_dir, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      docId,
      initiativeId,
      entry.hash,
      run.runHash,
      emitHash,
      docs.dir,
      JSON.stringify({ paths: docs.paths, epicTitle: payload.epic.title, storyCount: payload.stories.length }),
    );

  const ledger = appendLedgerEvent("looper.spec", {
    initiativeId,
    specReceipt: entry.hash,
    emitHash,
    docDir: docs.dir,
    storyCount: payload.stories.length,
    verdict: update.verdict,
  });

  return {
    initiativeId,
    initiative,
    cosmic: {
      runHash: run.runHash,
      gate: run.gate,
      ledgerEntry: { hash: entry.hash, seq: entry.seq },
      provenanceCount: run.provenance.length,
    },
    ticketSlice: {
      epicTitle: payload.epic.title,
      storyCount: payload.stories.length,
      emitHash,
    },
    update,
    docs,
    buildPendingWitnessSha: witness.receipt.sha,
    ledgerSeq: ledger.seq,
    ledgerSha: ledger.sha,
  };
}

export function getLooperSpec(initiativeId: string) {
  const cosmic = getDb()
    .prepare("SELECT payload FROM cosmic_runs WHERE initiative_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(initiativeId) as { payload: string } | undefined;

  const docs = getDb()
    .prepare(
      "SELECT emit_hash, doc_dir, payload, spec_receipt, run_hash, created_at FROM spec_docs WHERE initiative_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(initiativeId) as
    | {
        emit_hash: string;
        doc_dir: string;
        payload: string;
        spec_receipt: string;
        run_hash: string;
        created_at: string;
      }
    | undefined;

  if (!cosmic) return null;

  const { run, entry } = JSON.parse(cosmic.payload) as {
    run: CosmicRun;
    entry: { hash: string; seq: number };
  };

  const docMeta = docs ? (JSON.parse(docs.payload) as { paths: SpecDocFiles["paths"]; epicTitle: string; storyCount: number }) : null;

  return {
    run,
    entry,
    docs: docs
      ? {
          emitHash: docs.emit_hash,
          docDir: docs.doc_dir,
          paths: docMeta?.paths,
          epicTitle: docMeta?.epicTitle,
          storyCount: docMeta?.storyCount,
          createdAt: docs.created_at,
        }
      : null,
  };
}