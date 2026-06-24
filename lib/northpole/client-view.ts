import type { NorthPoleRun } from "./pipeline";

/** Slim, JSON-safe view for the dashboard — avoids server-action Flight limits. */
export type NorthPoleRunView = {
  initiativeId: string;
  cosmic: {
    runHash: string;
    gate: NorthPoleRun["cosmic"]["gate"];
    ledgerEntry?: { hash: string; seq: number };
    provenanceCount: number;
  };
  build: NorthPoleRun["build"];
  feedback: NorthPoleRun["feedback"];
  strataAudit: NorthPoleRun["strataAudit"];
  buildPendingWitnessSha?: string;
  reprioritizedHead?: string | null;
};

export function toNorthPoleRunView(run: NorthPoleRun): NorthPoleRunView {
  return {
    initiativeId: run.initiativeId,
    cosmic: {
      runHash: run.cosmic.runHash,
      gate: run.cosmic.gate,
      ledgerEntry: run.cosmic.ledgerEntry,
      provenanceCount: run.cosmic.provenance?.length ?? 0,
    },
    build: run.build,
    feedback: run.feedback,
    strataAudit: run.strataAudit,
    buildPendingWitnessSha: run.buildPendingWitness?.receipt.sha,
    reprioritizedHead: run.reprioritized?.chainHead ?? null,
  };
}