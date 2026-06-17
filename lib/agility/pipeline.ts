import { prioritize } from "@/lib/agility";
import { appendLedgerEvent } from "@/lib/store/ledger";
import { listInitiatives, replaceInitiatives } from "@/lib/store/initiatives";
import type { Initiative, PrioritizeResult } from "@/lib/agility/types";

export const DEFAULT_CAPACITY = 12;

export function runPrioritize(
  initiatives: Initiative[],
  opts: { capacity?: number } = {},
): PrioritizeResult & { chainHead: string | null } {
  const capacity = opts.capacity ?? DEFAULT_CAPACITY;
  const result = prioritize(initiatives, { capacity });

  appendLedgerEvent("PRIORITIZE_RUN", {
    capacity,
    funded: result.funded.map((f) => f.id),
    head: result.head,
    methodology: result.methodology_version,
  });

  for (const it of result.ranked) {
    if (it._intakeReceipt) {
      appendLedgerEvent("INITIATIVE", {
        id: it.id,
        title: it.title,
        funding: it._funding,
        score: it._score,
        priorityRaw: it._priorityRaw,
        intakeReceipt: it._intakeReceipt,
        scoreReceipt: it._scoreReceipt,
      });
    }
  }

  return { ...result, chainHead: result.head };
}

export function loadAndPrioritize(opts: { capacity?: number } = {}) {
  const initiatives = listInitiatives();
  return runPrioritize(initiatives, opts);
}

export function intakeAndPrioritize(
  newInitiative: Initiative,
  opts: { capacity?: number } = {},
) {
  const existing = listInitiatives();
  const merged = [...existing.filter((e) => e.id !== newInitiative.id), newInitiative];
  replaceInitiatives(merged);
  return runPrioritize(merged, opts);
}