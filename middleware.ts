import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { GATE_COOKIE, GATE_CODE, isUnlocked } from "@/lib/gate";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/health") || pathname.startsWith("/api/unlock")) {
    return NextResponse.next();
  }

  const unlocked = isUnlocked(request.cookies.get(GATE_COOKIE)?.value);
  if (!unlocked && !pathname.startsWith("/unlock")) {
    const url = request.nextUrl.clone();
    url.pathname = "/unlock";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};