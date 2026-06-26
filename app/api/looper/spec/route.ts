import { NextResponse } from "next/server";

import { getLooperSpec, runLooperSpec } from "@/lib/looper/spec-pipeline";
import { ensureSeeded } from "@/lib/store/ensure-seeded";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function toView(result: Awaited<ReturnType<typeof runLooperSpec>>) {
  return {
    initiativeId: result.initiativeId,
    cosmic: result.cosmic,
    ticketSlice: result.ticketSlice,
    update: {
      verdict: result.update.verdict,
      reEstimatedEffortTeamWeeks: result.update.reEstimatedEffortTeamWeeks,
      roughEffortTeamWeeks: result.update.roughEffortTeamWeeks,
      reEstimateDiffers: result.update.reEstimateDiffers,
      openIssueCount: result.update.openIssueCount,
      specReceipt: result.update.specReceipt,
    },
    docs: {
      dir: result.docs.dir,
      paths: result.docs.paths,
      epicStories: result.docs.epicStories,
      fullSpec: result.docs.fullSpec,
    },
    buildPendingWitnessSha: result.buildPendingWitnessSha,
    ledgerSeq: result.ledgerSeq,
    ledgerSha: result.ledgerSha,
  };
}

export async function GET(request: Request) {
  try {
    ensureSeeded();
    const { searchParams } = new URL(request.url);
    const initiativeId = searchParams.get("initiativeId");
    if (!initiativeId) {
      return NextResponse.json({ ok: false, error: "initiativeId required" }, { status: 400 });
    }
    const stored = getLooperSpec(initiativeId);
    if (!stored) {
      return NextResponse.json({ ok: false, error: "no spec run" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, spec: stored });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    ensureSeeded();
    const body = (await request.json()) as { initiativeId?: string };
    if (!body.initiativeId) {
      return NextResponse.json({ ok: false, error: "initiativeId required" }, { status: 400 });
    }
    const result = await runLooperSpec(body.initiativeId);
    return NextResponse.json({ ok: true, spec: toView(result) });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}