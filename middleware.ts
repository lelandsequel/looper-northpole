import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Soft gate — courtesy lock for demo sharing. Not real security.
const GATE_COOKIE = "looper_unlock";
const GATE_CODE = "333333";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/health") || pathname.startsWith("/api/unlock")) {
    return NextResponse.next();
  }

  const unlocked = request.cookies.get(GATE_COOKIE)?.value === GATE_CODE;
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