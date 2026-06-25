import Link from "next/link";

import type { IntakeGate } from "@/lib/looper/gates";

const toneBorder: Record<IntakeGate["tone"], string> = {
  sales: "hover:border-funded/50",
  risk: "hover:border-refused/50",
  strategy: "hover:border-accent/60",
  ops: "hover:border-benched/50",
  default: "hover:border-accent/40",
};

export function GateCard({ gate }: { gate: IntakeGate }) {
  return (
    <Link
      href={`/intake/${gate.id}`}
      data-tour={`gate-${gate.id}`}
      className={`block rounded-xl border border-border bg-black/25 p-5 transition ${toneBorder[gate.tone]}`}
    >
      <div className="font-mono text-xs uppercase tracking-wide text-accent">{gate.subtitle}</div>
      <h2 className="mt-2 text-lg font-semibold">{gate.title}</h2>
    </Link>
  );
}