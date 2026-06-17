import { createHash } from "node:crypto";

import { getInitiative } from "@/lib/store/initiatives";
import { getDb } from "@/lib/store/db";
import { initiativeToIntent } from "@/lib/loop/adapter";
import { runSixDCosmic, type CosmicRun } from "@/lib/six-d/cosmic";
import { runBuildLeg, type BuildLegResult } from "@/lib/build-leg";
import { priceQuote as brokenBuild } from "@/lib/build-leg/demo/broken/priceQuote";
import { priceQuote as fixedBuild } from "@/lib/build-leg/demo/candidate/priceQuote";
import { STALE_DATA_STORY } from "@/lib/build-leg";
import { buildOutcomeToFeedback, applyBuildFeedback } from "@/lib/loop/build-feedback";
import { intakeAndPrioritize, loadAndPrioritize } from "@/lib/agility/pipeline";
import { emitBuildPending } from "@/lib/luna/witness";
import { auditQuery } from "@/lib/strata/audit";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

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
  const initiative = getInitiative(initiativeId);
  if (!initiative) throw new Error(`initiative not found: ${initiativeId}`);
  if (initiative._funding !== "FUNDED") throw new Error(`initiative not funded: ${initiativeId}`);

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

export async function runNorthPoleBuild(initiativeId: string): Promise<NorthPoleRun> {
  const initiative = getInitiative(initiativeId);
  if (!initiative) throw new Error(`initiative not found: ${initiativeId}`);

  const { run, entry } = await runNorthPoleSpec(initiativeId);

  const strataAudit = auditQuery(
    `SELECT well_id, SUM(oil_bbl) FROM production_daily WHERE report_date >= '2026-01-01' GROUP BY well_id`,
  );

  const selfCorrecting = ({ round }: { round: number }) =>
    round === 1 ? { priceQuote: brokenBuild } : { priceQuote: fixedBuild };

  const build = await runBuildLeg(
    { ...STALE_DATA_STORY, sourceInitiative: initiativeId, storyId: `build.${initiativeId}` },
    selfCorrecting,
    { maxRounds: 3 },
  );

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