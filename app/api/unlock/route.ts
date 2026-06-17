import { NextResponse } from "next/server";

const GATE_CODE = "333333";

export async function POST(req: Request) {
  const { code } = (await req.json()) as { code?: string };
  if (code?.replace(/\D/g, "") !== GATE_CODE) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("looper_unlock", GATE_CODE, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}