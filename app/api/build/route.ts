import { NextResponse } from "next/server";

import { runNorthPoleBuild, type NorthPoleBuildOptions } from "@/lib/northpole/pipeline";
import type { BuildBuilderKind } from "@/lib/build-leg/resolve-builder";

export const runtime = "nodejs";

type BuildBody = {
  initiativeId?: string;
  builder?: BuildBuilderKind;
  maxRounds?: number;
};

export async function POST(req: Request) {
  let body: BuildBody;
  try {
    body = (await req.json()) as BuildBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const initiativeId = String(body.initiativeId ?? "").trim();
  if (!initiativeId) {
    return NextResponse.json({ ok: false, error: "initiativeId required" }, { status: 400 });
  }

  const builder = body.builder === "agent" ? "agent" : "demo";
  const opts: NorthPoleBuildOptions = { builder, maxRounds: body.maxRounds };

  try {
    const result = await runNorthPoleBuild(initiativeId, opts);
    return NextResponse.json({
      ok: true,
      initiativeId: result.initiativeId,
      builder,
      build: result.build,
      cosmic: {
        runHash: result.cosmic.runHash,
        ledgerEntry: result.cosmic.ledgerEntry,
      },
      strataAudit: result.strataAudit,
      reprioritized: {
        chainHead: result.reprioritized?.chainHead ?? null,
        fundedCount: result.reprioritized?.funded.length ?? 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "build failed",
      },
      { status: 500 },
    );
  }
}