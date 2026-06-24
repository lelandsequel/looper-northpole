import { NextResponse } from "next/server";

import { ensureSeeded } from "@/lib/store/ensure-seeded";
import { listFundedQueue, runNorthPoleBuild } from "@/lib/northpole/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    ensureSeeded();
    const funded = listFundedQueue();
    if (!funded.length) {
      return NextResponse.json({ ok: false, error: "no funded initiatives" }, { status: 400 });
    }
    const id = funded[0]!.id;
    const run = await runNorthPoleBuild(id);
    return NextResponse.json({
      ok: true,
      id,
      buildStatus: run.build.status,
      rounds: run.build.rounds.length,
      payloadBytes: JSON.stringify(run).length,
    });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json(
      {
        ok: false,
        error: e.message,
        stack: e.stack?.split("\n").slice(0, 8),
      },
      { status: 500 },
    );
  }
}