import { NextResponse, type NextRequest } from "next/server";
import { decodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth-cookies";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/documentation",
  "/api",
  "/_next",
  "/favicon.ico",
  "/vendor",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATH_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/") || (p.endsWith("/") ? pathname.startsWith(p) : false)
    )
  ) {
    return NextResponse.next();
  }

  const raw = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const parsed = decodeSessionCookie(raw);
  if (!parsed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.ico$).*)"],
};
