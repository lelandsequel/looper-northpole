"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { GateForm } from "@/components/looper/GateForm";
import { submitGateIntakeViaApi } from "@/lib/looper/gate-client";
import type { IntakeGate } from "@/lib/looper/gates";

function defaultValues(gate: IntakeGate): Record<string, string> {
  const init: Record<string, string> = {};
  for (const f of gate.fields) {
    if (f.kind === "select" && f.options?.length) init[f.key] = f.options[0].value;
    if (f.key === "effortTeamWeeks") init[f.key] = "8";
    if (f.key === "reachUnit" && gate.id === "msp-ops") init[f.key] = "accounts";
    if (f.key === "reachUnit" && gate.id === "risk") init[f.key] = "loans";
  }
  return init;
}

export function GateIntakeClient({ gate }: { gate: IntakeGate }) {
  const router = useRouter();
  const [values, setValues] = useState(() => defaultValues(gate));
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string[] | null>(null);
  const [pending, start] = useTransition();

  const fieldCount = useMemo(() => gate.fields.length, [gate.fields.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRefusal(null);
    start(async () => {
      try {
        const result = await submitGateIntakeViaApi(gate.id, values);
        router.push(`/looper?highlight=${result.initiativeId}`);
      } catch (err) {
        const e = err as Error & { cadmusErrors?: string[] };
        if (e.cadmusErrors?.length) setRefusal(e.cadmusErrors);
        else setError(e.message ?? "Submit failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="font-mono text-xs text-muted hover:text-accent">
          ← Intake
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{gate.title}</h1>
        <p className="mt-1 font-mono text-xs text-muted">
          {fieldCount} fields · same engine
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-border p-4">
        <GateForm
          gate={gate}
          values={values}
          onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))}
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending}
          className="mt-6 rounded bg-accent/25 px-4 py-2 font-mono text-sm text-accent hover:bg-accent/35 disabled:opacity-50"
        >
          {pending ? "Running engine…" : "Submit → rank"}
        </button>
      </form>

      {refusal && (
        <div className="rounded border border-refused/40 bg-refused/10 p-4 text-sm text-refused">
          <div className="font-mono font-semibold">CADMUS refused</div>
          <ul className="mt-2 list-inside list-disc">
            {refusal.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <div className="rounded border border-refused/40 bg-refused/10 p-4 font-mono text-sm text-refused">{error}</div>}
    </div>
  );
}