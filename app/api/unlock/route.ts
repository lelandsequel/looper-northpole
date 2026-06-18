import { NextResponse } from "next/server";

import { GATE_COOKIE, GATE_CODE, isValidUnlockCode } from "@/lib/gate";

export async function POST(req: Request) {
  const { code } = (await req.json()) as { code?: string };
  if (!isValidUnlockCode(code)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, GATE_CODE, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}