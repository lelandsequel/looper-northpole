"use client";

import Link from "next/link";

import { GateCard } from "@/components/looper/GateCard";
import { useTour } from "@/components/tour/TourProvider";
import { INTAKE_GATES } from "@/lib/looper/gates";

export function HomeLanding() {
  const { start } = useTour();

  return (
    <div data-tour="hero" className="relative space-y-10">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

      <header className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">LOOPER</h1>
          <p className="mt-1 font-mono text-xs text-muted">One engine · many front doors</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={start}
            className="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted hover:text-ink"
          >
            Tour
          </button>
          <Link
            href="/looper"
            className="rounded bg-accent/20 px-3 py-1.5 font-mono text-xs text-accent hover:bg-accent/30"
          >
            Queue
          </Link>
        </div>
      </header>

      <section data-tour="intake-gates">
        <div className="grid gap-4 sm:grid-cols-2">
          {INTAKE_GATES.map((gate) => (
            <GateCard key={gate.id} gate={gate} />
          ))}
        </div>
      </section>
    </div>
  );
}