"use server";

import {
  listFundedQueue,
  runNorthPoleBuild,
  getCosmicRun,
  getBuildRun,
  type NorthPoleBuildOptions,
} from "@/lib/northpole/pipeline";

export async function getNorthPoleState() {
  const funded = listFundedQueue();
  return { funded };
}

export async function runBuild(initiativeId: string, opts?: NorthPoleBuildOptions) {
  return runNorthPoleBuild(initiativeId, opts);
}

export async function getInitiativeStatus(initiativeId: string) {
  return {
    cosmic: getCosmicRun(initiativeId),
    build: getBuildRun(initiativeId),
  };
}