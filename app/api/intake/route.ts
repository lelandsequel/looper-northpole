import { NextResponse } from "next/server";

import { cadmusGate } from "@/lib/cadmus/gate";
import { intakeAndPrioritize } from "@/lib/agility/pipeline";
import { gateById, gateInitiativeJson, type GateId } from "@/lib/looper/gates";
import type { LooperInitiative } from "@/lib/looper/gates";
import { ensureSeeded } from "@/lib/store/ensure-seeded";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    ensureSeeded();
    const body = (await request.json()) as { gate?: GateId; values?: Record<string, string> };
    const gate = gateById(body.gate ?? "");
    if (!gate || !body.values) {
      return NextResponse.json({ ok: false, error: "gate and values required" }, { status: 400 });
    }

    const json = gateInitiativeJson(gate, body.values);
    const cadmus = cadmusGate(json);
    if (!cadmus.ok) {
      return NextResponse.json(
        { ok: false, refused: true, errors: cadmus.errors, rubric: cadmus.rubric },
        { status: 422 },
      );
    }

    const withGate: LooperInitiative = {
      ...cadmus.initiative,
      _intakeGate: gate.id,
      _gateAnswers: body.values,
    };

    const result = intakeAndPrioritize(withGate);
    const ranked = result.ranked.find((r) => r.id === withGate.id) as LooperInitiative | undefined;

    return NextResponse.json({
      ok: true,
      initiativeId: withGate.id,
      gate: gate.id,
      funding: ranked?._funding ?? "BENCHED",
      score: ranked?._score ?? 0,
      rank: ranked?._rank,
      chainHead: result.chainHead,
    });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}