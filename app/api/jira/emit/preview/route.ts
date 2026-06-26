import { NextResponse } from "next/server";

import { previewJiraEmit } from "@/lib/jira/pipeline";
import { ensureSeeded } from "@/lib/store/ensure-seeded";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    ensureSeeded();
    const { searchParams } = new URL(request.url);
    const initiativeId = searchParams.get("initiativeId");
    if (!initiativeId) {
      return NextResponse.json({ ok: false, error: "initiativeId required" }, { status: 400 });
    }
    const result = await previewJiraEmit(initiativeId);
    return NextResponse.json({ ok: true, preview: result });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}