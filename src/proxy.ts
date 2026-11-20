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

  // Skicka INTE vidare från /logga-in till /mina-sidor bara för att cookien
  // finns: en utgången eller ogiltig cookie gav då en oändlig loop
  // (/mina-sidor → /logga-in → /mina-sidor …). Inloggningssidorna kontrollerar
  // i stället sessionen på riktigt med getSession.
  return NextResponse.next();
}

export const config = {
  matcher: ["/mina-sidor/:path*"],
};
