"use server";

import {
  listFundedQueue,
  runNorthPoleBuild,
  getCosmicRun,
  getBuildRun,
} from "@/lib/northpole/pipeline";

export async function getNorthPoleState() {
  const funded = listFundedQueue();
  return { funded };
}

export async function runBuild(initiativeId: string) {
  return runNorthPoleBuild(initiativeId);
}

export async function getInitiativeStatus(initiativeId: string) {
  return {
    cosmic: getCosmicRun(initiativeId),
    build: getBuildRun(initiativeId),
  };
}