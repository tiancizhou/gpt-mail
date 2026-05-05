import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get("gpt_mail_session")?.value);
  const path = request.nextUrl.pathname;

  if ((path.startsWith("/admin") || path.startsWith("/dashboard")) && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
