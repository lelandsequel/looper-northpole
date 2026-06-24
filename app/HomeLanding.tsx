"use client";

import Link from "next/link";

import { useTour } from "@/components/tour/TourProvider";

export function HomeLanding() {
  const { start } = useTour();

  return (
    <div data-tour="hero" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-funded/10 blur-3xl" />

      <div className="relative space-y-8 py-12 md:py-20">
        <div className="space-y-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            HL prioritization portal · proof of engine
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Intake → rank → spec → gate → receipt
          </h1>
          <p className="max-w-2xl text-lg text-muted">
            LOOPER scores structured initiatives with deterministic NPV. NORTHPOLE builds only what
            wins the queue — with executable acceptance probes, not vibes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={start}
            className="rounded-lg bg-accent/25 px-6 py-3 font-mono text-sm text-accent transition hover:bg-accent/35"
          >
            Start guided tour
          </button>
          <Link
            href="/looper"
            className="rounded-lg border border-border px-6 py-3 font-mono text-sm text-muted transition hover:border-accent/40 hover:text-ink"
          >
            Skip to LOOPER
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "CADMUS gate", detail: "Thin intake dies before the queue" },
            { label: "RICE × NPV", detail: "Every score cites a receipt" },
            { label: "Build loop", detail: "REFUSE → resolve → re-gate until green" },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-border bg-black/20 p-4">
              <div className="font-mono text-xs uppercase text-accent">{c.label}</div>
              <p className="mt-2 text-sm text-muted">{c.detail}</p>
            </div>
          ))}
        </div>

        <p className="font-mono text-xs text-muted">
          Apache-2.0 · no telemetry · 42 tests · Chase adapters next
        </p>
      </div>
    </div>
  );
}