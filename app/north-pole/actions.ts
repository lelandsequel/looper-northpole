"use server";

import { ensureSeeded } from "@/lib/store/ensure-seeded";
import { toNorthPoleRunView, type NorthPoleRunView } from "@/lib/northpole/client-view";
import {
  listFundedQueue,
  runNorthPoleBuild,
  getCosmicRun,
  getBuildRun,
  type NorthPoleBuildOptions,
} from "@/lib/northpole/pipeline";

export async function getNorthPoleState() {
  ensureSeeded();
  const funded = listFundedQueue();
  return { funded };
}

/** Prefer POST /api/north-pole/build from the client — large COSMIC payloads break Flight. */
export async function runBuild(
  initiativeId: string,
  opts?: NorthPoleBuildOptions,
): Promise<NorthPoleRunView> {
  ensureSeeded();
  const run = await runNorthPoleBuild(initiativeId, opts);
  return toNorthPoleRunView(run);
}

export async function getInitiativeStatus(initiativeId: string) {
  return {
    cosmic: getCosmicRun(initiativeId),
    build: getBuildRun(initiativeId),
  };
}