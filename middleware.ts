import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, isPublicApi, isPublicPath } from "@/lib/auth/constants";
import { verifySessionTokenEdge } from "@/lib/auth/session-edge";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && isPublicApi(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionTokenEdge(token);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, message: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/login";
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
