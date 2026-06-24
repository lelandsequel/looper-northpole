"use client";

import { useEffect, useState, useTransition, useCallback } from "react";

import { FundingPill } from "@/components/FundingPill";
import { ReceiptBar } from "@/components/ReceiptBar";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { LOOPER_TOUR_EVENT, type LooperTourAction } from "@/lib/tour/events";
import { submitInitiative, getQueue, type LooperQueueItem, type IntakeResult } from "./actions";

const REFUSE_SAMPLE = `{
  "title": "Make things faster",
  "description": "We need a dashboard"
}`;

const SAMPLE = `{
  "id": "HL-NEW-001",
  "title": "Production deferment dashboard",
  "description": "Real-time deferment tracking tied to LOE/BOE KPIs for field ops.",
  "area": "Production",
  "sponsor": "Field Ops",
  "outcome": "deferment visibility dashboard",
  "valueType": "Internal Enabler",
  "reach": { "value": 120, "unit": "engineers", "source": "Field ops headcount 2026-Q2" },
  "revenueImpact": 0,
  "costSaveAnnual": 420000,
  "savingsEffectiveDate": "2026-07-01",
  "deliveryConfidence": 0.8,
  "valueConfidence": 0.8,
  "effortTeamWeeks": 6,
  "evidence": {
    "reach": "Field ops headcount 2026-Q2",
    "costSave": "Ops efficiency study DEF-2026-03"
  }
}`;

export function LooperDashboard({
  initial,
}: {
  initial: Awaited<ReturnType<typeof getQueue>>;
}) {
  const [queue, setQueue] = useState(initial.queue);
  const [selected, setSelected] = useState<LooperQueueItem | null>(null);
  const [input, setInput] = useState("");
  const [refusal, setRefusal] = useState<IntakeResult | null>(null);
  const [chainHead, setChainHead] = useState(initial.chainHead);
  const [verify, setVerify] = useState(initial.verify);
  const [capacity, setCapacity] = useState({ used: initial.capacityUsed, total: initial.capacity });
  const [pending, start] = useTransition();

  const handleSubmit = useCallback(() => {
    start(async () => {
      const result = await submitInitiative(input);
      if (!result.ok) {
        setRefusal(result);
        return;
      }
      setRefusal(null);
      setQueue(result.queue);
      setChainHead(result.chainHead);
      setVerify(result.verify);
      setSelected(result.queue.find((q) => q.id === result.initiative.id) ?? null);
    });
  }, [input, start]);

  useEffect(() => {
    function onTour(e: Event) {
      const action = (e as CustomEvent<LooperTourAction>).detail;
      if (action.type === "fill-refuse") setInput(REFUSE_SAMPLE);
      if (action.type === "load-sample") setInput(SAMPLE);
      if (action.type === "submit-intake") handleSubmit();
      if (action.type === "select-first-funded") {
        const funded = queue.find((q) => q._funding === "FUNDED");
        if (funded) setSelected(funded);
      }
    }
    window.addEventListener(LOOPER_TOUR_EVENT, onTour);
    return () => window.removeEventListener(LOOPER_TOUR_EVENT, onTour);
  }, [handleSubmit, queue]);

  return (
    <div className="space-y-6">
      <header data-tour="looper-header">
        <h1 className="text-2xl font-semibold">LOOPER</h1>
        <p className="mt-1 text-sm text-muted">
          Agility front-door — intake → dedup → score → allocate. Structured JSON only; CADMUS refuses the rest.
        </p>
        <div className="mt-2 flex flex-wrap gap-4 font-mono text-xs text-muted">
          <span>
            capacity {capacity.used}/{capacity.total}
          </span>
          <ReceiptBar label="ledger head" sha={chainHead} />
          <span className={verify.ok ? "text-funded" : "text-refused"}>
            chain {verify.ok ? "✓" : "✗"} ({verify.count} events)
          </span>
        </div>
      </header>

      <section data-tour="intake" className="rounded-lg border border-border p-4">
        <label className="font-mono text-xs uppercase text-muted">Intake (JSON initiative)</label>
        <textarea
          className="mt-2 w-full rounded border border-border bg-black/30 p-3 font-mono text-sm text-ink focus:border-accent focus:outline-none"
          rows={10}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste structured initiative JSON…"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            data-tour="intake-submit"
            onClick={handleSubmit}
            disabled={pending}
            className="rounded bg-accent/20 px-4 py-2 font-mono text-sm text-accent hover:bg-accent/30 disabled:opacity-50"
          >
            {pending ? "Running…" : "Intake + Prioritize"}
          </button>
          <button
            type="button"
            onClick={() => setInput(SAMPLE)}
            className="rounded border border-border px-4 py-2 font-mono text-sm text-muted hover:text-ink"
          >
            Load sample
          </button>
        </div>

        {refusal && !refusal.ok && (
          <div className="mt-4 rounded border border-refused/40 bg-refused/10 p-4">
            <div className="font-mono text-sm font-semibold text-refused">CADMUS REFUSED</div>
            <ul className="mt-2 list-inside list-disc text-sm text-muted">
              {refusal.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
            <div className="mt-3 font-mono text-xs text-muted">
              <div className="text-ink">Required rubric:</div>
              <ul className="mt-1 list-inside list-disc">
                {refusal.rubric.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section data-tour="queue">
        <h2 className="font-mono text-xs uppercase text-muted">NOW queue (ranked)</h2>
        <div className="mt-2 space-y-2">
          {queue.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className={`w-full rounded-lg border p-3 text-left transition ${
                selected?.id === item.id ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-xs text-muted">#{item._rank ?? "—"}</span>{" "}
                  <span className="font-medium">{item.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-accent">score {item._score ?? "—"}</span>
                  <FundingPill funding={item._funding} />
                </div>
              </div>
              <div className="mt-1 font-mono text-xs text-muted">
                raw={item._priorityRaw ?? "—"} · {item.area} · {item._tier ?? "—"}
              </div>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <section data-tour="score-panel" className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold">Why is this here?</h2>
          <p className="mt-1 text-sm text-muted">
            {selected.title} — {selected.outcome}
          </p>
          <div className="mt-4">
            <ScoreBreakdown breakdown={selected._breakdown as Parameters<typeof ScoreBreakdown>[0]["breakdown"]} />
          </div>
          <div className="mt-4 space-y-1">
            <ReceiptBar label="intake receipt" sha={selected._intakeReceipt} />
            <ReceiptBar label="score receipt" sha={selected._scoreReceipt} />
            {selected.chainReceipts?.map((r) => (
              <ReceiptBar key={r.sha} label={r.kind} sha={r.sha} seq={r.seq} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}