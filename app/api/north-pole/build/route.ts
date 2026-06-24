import { NextResponse } from "next/server";

import { ensureSeeded } from "@/lib/store/ensure-seeded";
import { toNorthPoleRunView } from "@/lib/northpole/client-view";
import { runNorthPoleBuild } from "@/lib/northpole/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    ensureSeeded();
    const body = (await request.json()) as { initiativeId?: string };
    if (!body.initiativeId) {
      return NextResponse.json({ ok: false, error: "initiativeId required" }, { status: 400 });
    }
    const run = await runNorthPoleBuild(body.initiativeId);
    return NextResponse.json({ ok: true, run: toNorthPoleRunView(run) });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}