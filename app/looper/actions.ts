"use server";

import { ensureSeeded } from "@/lib/store/ensure-seeded";
import { cadmusGate } from "@/lib/cadmus/gate";
import { intakeAndPrioritize, loadAndPrioritize } from "@/lib/agility/pipeline";
import { verifyLedger, receiptsForInitiative } from "@/lib/store/ledger";
import type { Initiative } from "@/lib/agility/types";

export type LooperQueueItem = Initiative & {
  chainReceipts?: ReturnType<typeof receiptsForInitiative>;
};

export type IntakeResult =
  | { ok: false; refused: true; rubric: readonly string[]; errors: string[] }
  | {
      ok: true;
      initiative: Initiative;
      queue: LooperQueueItem[];
      chainHead: string | null;
      verify: ReturnType<typeof verifyLedger>;
    };

export async function submitInitiative(raw: string): Promise<IntakeResult> {
  ensureSeeded();
  const gate = cadmusGate(raw);
  if (!gate.ok) {
    return { ok: false, refused: true, rubric: gate.rubric, errors: gate.errors };
  }

  const result = intakeAndPrioritize(gate.initiative);
  const queue = result.ranked.map((it) => ({
    ...it,
    chainReceipts: receiptsForInitiative(it.id),
  }));

  return {
    ok: true,
    initiative: gate.initiative,
    queue,
    chainHead: result.chainHead,
    verify: verifyLedger(),
  };
}

export async function getQueue(): Promise<{
  queue: LooperQueueItem[];
  chainHead: string | null;
  verify: ReturnType<typeof verifyLedger>;
  capacity: number;
  capacityUsed: number;
}> {
  ensureSeeded();
  const result = loadAndPrioritize();
  return {
    queue: result.ranked.map((it) => ({
      ...it,
      chainReceipts: receiptsForInitiative(it.id),
    })),
    chainHead: result.chainHead,
    verify: verifyLedger(),
    capacity: result.capacity,
    capacityUsed: result.capacityUsed,
  };
}