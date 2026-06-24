"use server";

import { ensureSeeded } from "@/lib/store/ensure-seeded";
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

export async function runBuild(initiativeId: string, opts?: NorthPoleBuildOptions) {
  ensureSeeded();
  return runNorthPoleBuild(initiativeId, opts);
}

export async function getInitiativeStatus(initiativeId: string) {
  return {
    cosmic: getCosmicRun(initiativeId),
    build: getBuildRun(initiativeId),
  };
}