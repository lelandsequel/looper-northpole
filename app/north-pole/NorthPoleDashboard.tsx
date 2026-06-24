"use client";

import { useEffect, useState, useTransition } from "react";

import { FundingPill } from "@/components/FundingPill";
import { ReceiptBar } from "@/components/ReceiptBar";
import { LOOPER_TOUR_EVENT, type LooperTourAction } from "@/lib/tour/events";
import { runBuild, getNorthPoleState } from "./actions";
import type { Initiative } from "@/lib/agility/types";
import type { NorthPoleRun } from "@/lib/northpole/pipeline";

export function NorthPoleDashboard({
  initial,
}: {
  initial: Awaited<ReturnType<typeof getNorthPoleState>>;
}) {
  const [funded, setFunded] = useState(initial.funded);
  const [selected, setSelected] = useState<Initiative | null>(null);
  const [run, setRun] = useState<NorthPoleRun | null>(null);
  const [pending, start] = useTransition();

  function handleBuild(id: string) {
    start(async () => {
      const result = await runBuild(id);
      setRun(result);
      const refreshed = await getNorthPoleState();
      setFunded(refreshed.funded);
    });
  }

  useEffect(() => {
    function onTour(e: Event) {
      const action = (e as CustomEvent<LooperTourAction>).detail;
      if (action.type === "run-build") {
        const target = funded[0];
        if (target) {
          setSelected(target);
          handleBuild(target.id);
        }
      }
    }
    window.addEventListener(LOOPER_TOUR_EVENT, onTour);
    return () => window.removeEventListener(LOOPER_TOUR_EVENT, onTour);
  }, [funded]);

  return (
    <div className="space-y-6">
      <header data-tour="northpole-header">
        <h1 className="text-2xl font-semibold">NORTHPOLE</h1>
        <p className="mt-1 text-sm text-muted">
          6D COSMIC build workshop — spec → gate → detect/deliver → feedback to Agility.
        </p>
      </header>

      <section data-tour="northpole-funded">
        <h2 className="font-mono text-xs uppercase text-muted">Funded queue (from LOOPER ledger)</h2>
        <div className="mt-2 space-y-2">
          {funded.length === 0 && (
            <p className="text-sm text-muted">No funded initiatives. Seed data or fund via LOOPER.</p>
          )}
          {funded.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg border p-3 ${
                selected?.id === item.id ? "border-accent bg-accent/5" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setSelected(item)} className="text-left">
                  <div className="font-medium">{item.title}</div>
                  <div className="font-mono text-xs text-muted">
                    {item.id} · score {item._score}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleBuild(item.id)}
                  disabled={pending}
                  className="rounded bg-accent/20 px-3 py-1 font-mono text-xs text-accent hover:bg-accent/30 disabled:opacity-50"
                >
                  {pending ? "Running…" : "Run 6D + Build"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {run && (
        <div data-tour="build-results" className="space-y-6">
          <Stage title="Stage 1: Spec (6D COSMIC)" tourId="spec">
            <div className="space-y-2 font-mono text-xs text-muted">
              <div>
                AURORA summary:{" "}
                <span className="text-ink">
                  NO_OBJECTION={run.cosmic.gate.summary.NO_OBJECTION} · HOLD=
                  {run.cosmic.gate.summary.HOLD} · REFUSE={run.cosmic.gate.summary.REFUSE}
                </span>
              </div>
              <ReceiptBar label="COSMIC run hash" sha={run.cosmic.runHash} />
              <ReceiptBar label="LUNA entry" sha={run.cosmic.ledgerEntry?.hash} seq={run.cosmic.ledgerEntry?.seq} />
              <div>VELLUM bindings: {run.cosmic.provenance?.length ?? 0} elements</div>
            </div>
          </Stage>

          <Stage title="Stage 2: Build (demo codegen → materialize)" tourId="build">
            <div className="text-sm text-muted">
              Demo builder ships code; round 1 fails probes, round 2 self-corrects. Agent seam ready via{" "}
              <span className="font-mono text-ink">BUILD_AGENT_URL</span>.
            </div>
            <div className="mt-2 font-mono text-xs text-muted">
              {run.build.rounds.length} round(s) · status {run.build.status}
              {run.build.roundsToGreen != null && (
                <span> · green in round {run.build.roundsToGreen}</span>
              )}
            </div>
            {run.buildPendingWitness && (
              <ReceiptBar label="BUILD_PENDING witness" sha={run.buildPendingWitness.receipt.sha} />
            )}
          </Stage>

          <Stage title="Stage 3: Pan Gate" tourId="gate">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">status:</span>
                <FundingPill funding={run.build.status === "shipped" ? "FUNDED" : "BENCHED"} />
                <span className="font-mono text-xs text-muted">
                  {run.build.rounds.length} round(s) · final {run.build.finalVerdict.verdict}
                </span>
              </div>
              {run.build.rounds.map((r) => (
                <div key={r.round} className="rounded border border-border p-2 font-mono text-xs">
                  round {r.round}: {r.verdict.verdict} — passed {r.verdict.passed}/
                  {r.verdict.passed + r.verdict.failed}
                  <ReceiptBar label="round receipt" sha={r.ledgerHash} seq={r.ledgerSeq} />
                </div>
              ))}
            </div>
          </Stage>

          <Stage title="Stage 4: Detect/Deliver + STRATA audit" tourId="detect">
            <div className="font-mono text-xs text-muted">
              <div>STRATA query audit: {run.strataAudit.refused ? "REFUSED" : "certified"}</div>
              {!run.strataAudit.refused && (
                <div>
                  naive {run.strataAudit.benchmarkMs.naive}ms → optimized {run.strataAudit.benchmarkMs.optimized}ms (
                  {run.strataAudit.speedup}×)
                </div>
              )}
              <ReceiptBar label="STRATA receipt" sha={run.strataAudit.queryHash} />
            </div>
          </Stage>

          <Stage title="Stage 5: Feedback → LOOPER re-prioritize" tourId="feedback">
            <div className="font-mono text-xs text-muted">
              <div>
                deliveryConfidence: {run.feedback.priorDeliveryConfidence} →{" "}
                {run.feedback.provenDeliveryConfidence}
                {run.feedback.confidenceChanged ? " (changed)" : ""}
              </div>
              <ReceiptBar label="build receipt" sha={run.feedback.buildReceipt} />
              {run.reprioritized && (
                <div className="mt-2">
                  Queue head after feedback:{" "}
                  <span className="text-accent">{run.reprioritized.chainHead?.slice(0, 16)}…</span>
                </div>
              )}
            </div>
          </Stage>
        </div>
      )}
    </div>
  );
}

function Stage({
  title,
  tourId,
  children,
}: {
  title: string;
  tourId?: string;
  children: React.ReactNode;
}) {
  return (
    <section data-tour={tourId} className="rounded-lg border border-border p-4">
      <h2 className="font-mono text-xs uppercase text-muted">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}