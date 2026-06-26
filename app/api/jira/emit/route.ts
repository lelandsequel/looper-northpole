import { NextResponse } from "next/server";

import type { JiraAdapterKind } from "@/lib/jira/types";
import { emitJira } from "@/lib/jira/pipeline";
import { ensureSeeded } from "@/lib/store/ensure-seeded";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    ensureSeeded();
    const body = (await request.json()) as { initiativeId?: string; adapter?: JiraAdapterKind };
    if (!body.initiativeId) {
      return NextResponse.json({ ok: false, error: "initiativeId required" }, { status: 400 });
    }
    const adapter = body.adapter ?? "file";
    if (adapter !== "file" && adapter !== "http") {
      return NextResponse.json({ ok: false, error: "adapter must be file or http" }, { status: 400 });
    }
    const outcome = await emitJira(body.initiativeId, adapter);
    const status = outcome.status === "refused" ? 422 : 200;
    return NextResponse.json({ ok: outcome.status === "emitted", outcome }, { status });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}