import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/jwt";

const PROTECTED = [
  { prefix: "/platform", roles: ["SUPER_ADMIN"] },
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/guard", roles: ["GUARD", "ADMIN"] },
  { prefix: "/user", roles: ["USER", "GUARD", "ADMIN"] },
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const match = PROTECTED.find((p) => pathname.startsWith(p.prefix));
  if (!match) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!match.roles.includes(session.role)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/platform/:path*", "/admin/:path*", "/guard/:path*", "/user/:path*"],
};
