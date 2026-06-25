"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";

import { FundingPill } from "@/components/FundingPill";
import { ReceiptBar } from "@/components/ReceiptBar";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { LOOPER_TOUR_EVENT, type LooperTourAction } from "@/lib/tour/events";
import { IntakeForm } from "@/components/looper/IntakeForm";
import { downloadMarkdown, runSpecViaApi, type LooperSpecView } from "@/lib/looper/client";
import type { LooperInitiative } from "@/lib/looper/gates";

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
  highlight,
}: {
  initial: Awaited<ReturnType<typeof getQueue>>;
  highlight?: string;
}) {
  const [queue, setQueue] = useState(initial.queue);
  const [selected, setSelected] = useState<LooperQueueItem | null>(
    () => initial.queue.find((q) => q.id === highlight) ?? null,
  );
  const [intakeMode, setIntakeMode] = useState<"form" | "json">("form");
  const [input, setInput] = useState("");
  const [refusal, setRefusal] = useState<IntakeResult | null>(null);
  const [chainHead, setChainHead] = useState(initial.chainHead);
  const [verify, setVerify] = useState(initial.verify);
  const [capacity, setCapacity] = useState({ used: initial.capacityUsed, total: initial.capacity });
  const [spec, setSpec] = useState<LooperSpecView | null>(null);
  const [specError, setSpecError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [specPending, startSpec] = useTransition();
  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  function handleRunSpec(id: string) {
    setSpecError(null);
    startSpec(async () => {
      try {
        const result = await runSpecViaApi(id);
        setSpec(result);
        setSelected(queue.find((q) => q.id === id) ?? null);
      } catch (e) {
        setSpecError(e instanceof Error ? e.message : "Spec failed");
      }
    });
  }

  const submitJson = useCallback((json: string) => {
    inputRef.current = json;
    setInput(json);
    start(async () => {
      const result = await submitInitiative(json);
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
  }, [start]);

  const handleSubmit = useCallback(() => {
    submitJson(inputRef.current);
  }, [submitJson]);

  useEffect(() => {
    function onTour(e: Event) {
      const action = (e as CustomEvent<LooperTourAction>).detail;
      if (action.type === "fill-refuse") {
        setIntakeMode("json");
        setInput(REFUSE_SAMPLE);
      }
      if (action.type === "load-sample") {
        setIntakeMode("json");
        setInput(SAMPLE);
      }
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
          Intake → rank → 6D spec → epic/story docs. CADMUS refuses thin intake — evidence required.
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
        <div className="flex gap-2 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setIntakeMode("form")}
            className={`font-mono text-xs uppercase ${intakeMode === "form" ? "text-accent" : "text-muted"}`}
          >
            Guided form
          </button>
          <button
            type="button"
            onClick={() => setIntakeMode("json")}
            className={`font-mono text-xs uppercase ${intakeMode === "json" ? "text-accent" : "text-muted"}`}
          >
            JSON (advanced)
          </button>
        </div>

        {intakeMode === "form" ? (
          <div className="mt-4">
            <IntakeForm onSubmit={submitJson} pending={pending} />
          </div>
        ) : (
          <>
            <label className="mt-4 block font-mono text-xs uppercase text-muted">Intake JSON</label>
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
          </>
        )}

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
            <div
              key={item.id}
              className={`rounded-lg border p-3 transition ${
                selected?.id === item.id ? "border-accent bg-accent/5" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setSelected(item)} className="flex-1 text-left">
                  <div>
                    <span className="font-mono text-xs text-muted">#{item._rank ?? "—"}</span>{" "}
                    <span className="font-medium">{item.title}</span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted">
                    raw={item._priorityRaw ?? "—"} · {item.area} · {item._tier ?? "—"}
                    {(item as LooperInitiative)._intakeGate && (
                      <span className="ml-2 text-accent">gate {(item as LooperInitiative)._intakeGate}</span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-accent">score {item._score ?? "—"}</span>
                  <FundingPill funding={item._funding} />
                  {item._funding === "FUNDED" && (
                    <button
                      type="button"
                      onClick={() => handleRunSpec(item.id)}
                      disabled={specPending}
                      className="rounded bg-accent/20 px-2 py-1 font-mono text-xs text-accent hover:bg-accent/30 disabled:opacity-50"
                    >
                      {specPending && spec?.initiativeId === item.id ? "Spec…" : "Run spec"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {specError && (
        <div className="rounded-lg border border-refused/40 bg-refused/10 p-4 font-mono text-sm text-refused">
          Spec error: {specError}
        </div>
      )}

      {spec && (
        <section data-tour="spec-docs" className="space-y-4 rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold">6D spec → docs</h2>
          <p className="text-sm text-muted">
            {spec.ticketSlice.epicTitle} · {spec.ticketSlice.storyCount} stor
            {spec.ticketSlice.storyCount === 1 ? "y" : "ies"} · verdict{" "}
            <span className={spec.update.verdict === "ready" ? "text-funded" : "text-refused"}>
              {spec.update.verdict}
            </span>
          </p>

          <div className="font-mono text-xs text-muted">
            AURORA: NO_OBJECTION={spec.cosmic.gate.summary.NO_OBJECTION} · HOLD=
            {spec.cosmic.gate.summary.HOLD} · REFUSE={spec.cosmic.gate.summary.REFUSE}
          </div>
          <div className="font-mono text-xs text-muted">
            Re-estimate: {spec.update.roughEffortTeamWeeks}w rough → {spec.update.reEstimatedEffortTeamWeeks}w
            decomposed
            {spec.update.reEstimateDiffers ? " (changed)" : ""}
            {spec.update.openIssueCount > 0 && ` · ${spec.update.openIssueCount} open issue(s)`}
          </div>

          <ReceiptBar label="COSMIC run" sha={spec.cosmic.runHash} />
          <ReceiptBar label="LUNA entry" sha={spec.cosmic.ledgerEntry.hash} seq={spec.cosmic.ledgerEntry.seq} />
          <ReceiptBar label="doc emit hash" sha={spec.ticketSlice.emitHash} />
          {spec.ledgerSha && <ReceiptBar label="ledger" sha={spec.ledgerSha} seq={spec.ledgerSeq} />}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                downloadMarkdown(`${spec.initiativeId}-epic-stories.md`, spec.docs.epicStories)
              }
              className="rounded bg-accent/20 px-3 py-1 font-mono text-xs text-accent hover:bg-accent/30"
            >
              Download epic-stories.md
            </button>
            <button
              type="button"
              onClick={() => downloadMarkdown(`${spec.initiativeId}-full-spec.md`, spec.docs.fullSpec)}
              className="rounded border border-border px-3 py-1 font-mono text-xs text-muted hover:text-ink"
            >
              Download full-spec.md
            </button>
          </div>

          <details className="rounded border border-border p-3">
            <summary className="cursor-pointer font-mono text-xs text-muted">Preview epic-stories.md</summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap font-mono text-xs text-ink">
              {spec.docs.epicStories}
            </pre>
          </details>

          <p className="font-mono text-xs text-muted">Written to {spec.docs.dir}</p>
        </section>
      )}

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