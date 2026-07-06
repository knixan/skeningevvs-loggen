import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  if (pathname.startsWith("/mina-sidor") && !sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/logga-in";
    return NextResponse.redirect(url);
  }

  if (
    (pathname === "/logga-in" || pathname === "/registrera") &&
    sessionCookie
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/mina-sidor";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/mina-sidor/:path*", "/logga-in", "/registrera"],
};
