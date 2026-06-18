import { WitnessStore } from "./chamber/witness.mjs";
import { getDb } from "@/lib/store/db";

export type AgentId = "toph" | "pan" | "yuffie" | "raven";

export interface WitnessInput {
  kind: string;
  content: Record<string, unknown>;
  source_agent: AgentId;
  observation_time: string;
  event_time: string;
  boundary?: string;
}

let store: WitnessStore | null = null;

export function getWitnessStore(): WitnessStore {
  if (!store) store = new WitnessStore();
  return store;
}

export function writeWitness(input: WitnessInput) {
  const witness = getWitnessStore().seal({
    kind: input.kind,
    content: input.content,
    subject: input.source_agent,
    source: { class: "agent", id: input.source_agent },
    observation_time: input.observation_time,
    event_time: input.event_time,
    boundary: input.boundary ?? "chamber",
    provenance: `agent:${input.source_agent}`,
  });

  getDb()
    .prepare(
      `INSERT OR REPLACE INTO build_tasks (id, initiative_id, agent, status, payload, witness_sha)
       VALUES (?, ?, ?, 'witnessed', ?, ?)`,
    )
    .run(
      witness.id,
      String(input.content.initiative_id ?? "unknown"),
      input.source_agent,
      JSON.stringify(witness),
      witness.receipt.sha,
    );

  return witness;
}

export function emitBuildPending(initiativeId: string, cosmicRunHash: string) {
  const now = new Date().toISOString();
  return writeWitness({
    kind: "BUILD_PENDING",
    content: { initiative_id: initiativeId, cosmic_run_hash: cosmicRunHash, status: "pending" },
    source_agent: "toph",
    observation_time: now,
    event_time: now,
  });
}