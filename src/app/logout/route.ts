import { NextResponse, type NextRequest } from "next/server";

import { logoutCurrentSession } from "@/lib/session";

export async function GET(_req: NextRequest) {
  await logoutCurrentSession();

  // Prefer forwarded headers when running behind a proxy (e.g. Amplify Hosting),
  // otherwise Next may see an internal origin like http://localhost:3000.
  const forwardedProto = _req.headers.get("x-forwarded-proto");
  const forwardedHost = _req.headers.get("x-forwarded-host");

  const url = new URL(_req.url);
  const proto = (forwardedProto || url.protocol.replace(":", "") || "https").toLowerCase();
  const host = forwardedHost || _req.headers.get("host") || url.host;
  const origin = `${proto}://${host}`;

  return NextResponse.redirect(new URL("/login", origin));
}
