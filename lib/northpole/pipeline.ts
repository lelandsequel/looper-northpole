import { createHash } from "node:crypto";

import { prioritize } from "@/lib/agility";
import { DEFAULT_CAPACITY } from "@/lib/agility/pipeline";
import { listInitiatives } from "@/lib/store/initiatives";
import { getDb } from "@/lib/store/db";
import type { Initiative } from "@/lib/agility/types";
import { initiativeToIntent } from "@/lib/loop/adapter";
import { runSixDCosmic, type CosmicRun } from "@/lib/six-d/cosmic";
import { runBuildLeg, type BuildLegResult } from "@/lib/build-leg";
import { resolveBuilder, type BuildBuilderKind } from "@/lib/build-leg/resolve-builder";
import { workOrderForInitiative } from "@/lib/northpole/build-work-order";
import { buildOutcomeToFeedback, applyBuildFeedback } from "@/lib/loop/build-feedback";
import { intakeAndPrioritize, loadAndPrioritize } from "@/lib/agility/pipeline";
import { emitBuildPending } from "@/lib/luna/witness";
import { auditQuery } from "@/lib/strata/audit";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Funding is computed at prioritize time — not stored on the DB row. */
function requireFundedInitiative(initiativeId: string): Initiative {
  const result = prioritize(listInitiatives(), { capacity: DEFAULT_CAPACITY });
  const funded = result.funded.find((it) => it.id === initiativeId);
  if (!funded) throw new Error(`initiative not funded: ${initiativeId}`);
  return funded;
}

export interface NorthPoleRun {
  initiativeId: string;
  cosmic: CosmicRun & { ledgerEntry?: { hash: string; seq: number } };
  build: BuildLegResult;
  feedback: ReturnType<typeof buildOutcomeToFeedback>;
  strataAudit: ReturnType<typeof auditQuery>;
  buildPendingWitness?: ReturnType<typeof emitBuildPending>;
  reprioritized?: ReturnType<typeof loadAndPrioritize>;
}

export async function runNorthPoleSpec(initiativeId: string) {
  const initiative = requireFundedInitiative(initiativeId);
  const intent = initiativeToIntent(initiative);
  const { run, entry } = await runSixDCosmic(intent);

  getDb()
    .prepare(
      "INSERT OR REPLACE INTO cosmic_runs (id, initiative_id, run_hash, payload) VALUES (?, ?, ?, ?)",
    )
    .run(sha(`${initiativeId}:${entry.hash}`), initiativeId, run.runHash, JSON.stringify({ run, entry }));

  const witness = emitBuildPending(initiativeId, run.runHash);

  return { run, entry, witness };
}

export type NorthPoleBuildOptions = {
  builder?: BuildBuilderKind;
  maxRounds?: number;
};

export async function runNorthPoleBuild(
  initiativeId: string,
  opts: NorthPoleBuildOptions = {},
): Promise<NorthPoleRun> {
  const initiative = requireFundedInitiative(initiativeId);
  const builderKind = opts.builder ?? "demo";
  const maxRounds = opts.maxRounds ?? 3;

  const { run, entry } = await runNorthPoleSpec(initiativeId);

  const strataAudit = auditQuery(
    `SELECT well_id, SUM(oil_bbl) FROM production_daily WHERE report_date >= '2026-01-01' GROUP BY well_id`,
  );

  const build = await runBuildLeg(workOrderForInitiative(initiativeId), resolveBuilder(builderKind), {
    maxRounds,
  });

  getDb()
    .prepare(
      "INSERT OR REPLACE INTO build_runs (id, initiative_id, status, payload, ledger_head) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      sha(build.ledgerHead),
      initiativeId,
      build.status,
      JSON.stringify(build),
      build.ledgerHead,
    );

  const feedback = buildOutcomeToFeedback(build, initiative);
  const updated = applyBuildFeedback([initiative], feedback);
  const reprioritized = intakeAndPrioritize(updated[0]!);

  return {
    initiativeId,
    cosmic: { ...run, ledgerEntry: { hash: entry.hash, seq: entry.seq } },
    build,
    feedback,
    strataAudit,
    buildPendingWitness: emitBuildPending(initiativeId, run.runHash),
    reprioritized,
  };
}

export function listFundedQueue() {
  const result = loadAndPrioritize();
  return result.funded;
}

export function getCosmicRun(initiativeId: string) {
  const row = getDb()
    .prepare("SELECT payload FROM cosmic_runs WHERE initiative_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(initiativeId) as { payload: string } | undefined;
  return row ? (JSON.parse(row.payload) as { run: CosmicRun; entry: { hash: string; seq: number } }) : null;
}

export function getBuildRun(initiativeId: string) {
  const row = getDb()
    .prepare("SELECT payload, ledger_head, status FROM build_runs WHERE initiative_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(initiativeId) as { payload: string; ledger_head: string; status: string } | undefined;
  return row
    ? { ...(JSON.parse(row.payload) as BuildLegResult), ledgerHead: row.ledger_head, status: row.status }
    : null;
}