"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { getCurrentSessionAction } from "@/actions/auth/get-current-session";

const PUBLIC_PREFIXES = ["/login", "/api", "/_next", "/vendor"];

function isPublicPath(pathname: string) {
  if (!pathname) return false;
  if (pathname === "/") return false;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function SessionGuard() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (isPublicPath(pathname) || pathname === "/login") return;

      const res = await getCurrentSessionAction();
      if (cancelled) return;

      if (!res?.data) {
        const next = encodeURIComponent(pathname);
        router.replace(`/login?next=${next}`);
        router.refresh();
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
