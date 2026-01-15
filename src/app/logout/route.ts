import { NextResponse, type NextRequest } from "next/server";

import { logoutCurrentSession } from "@/lib/session";

export async function GET(_req: NextRequest) {
  await logoutCurrentSession();
  return NextResponse.redirect(new URL("/login", _req.url));
}
