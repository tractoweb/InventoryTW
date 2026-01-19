"use client";

import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import * as React from "react";

import { getCurrentSessionAction } from "@/actions/auth/get-current-session";

import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/header";
import { UiPreferencesProvider } from "@/components/ui-preferences/ui-preferences-provider";
import { AnimatedPage } from "@/components/ui-preferences/animated-page";
import { AnimeTopLoader } from "@/components/ui-preferences/top-loader";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const pathnameRef = React.useRef<string>(pathname ?? "/");
  pathnameRef.current = pathname ?? "/";

  const isLogin = Boolean(pathname && (pathname === "/login" || pathname.startsWith("/login/")));
  const isDocumentPrintRoute = Boolean(
    pathname && /^\/documents\/[^/]+\/print(\/preview)?\/?$/.test(pathname)
  );

  const [sessionChecked, setSessionChecked] = React.useState(false);
  const [sessionOk, setSessionOk] = React.useState(false);
  const [session, setSession] = React.useState<any>(null);
  const [sessionVersion, setSessionVersion] = React.useState(0);
  const hasValidatedRef = React.useRef(false);

  React.useEffect(() => {
    // Allows child pages (e.g., Profile) to request a session re-fetch.
    const handler = () => setSessionVersion((v) => v + 1);
    window.addEventListener("session:refresh", handler);
    return () => window.removeEventListener("session:refresh", handler);
  }, []);

  React.useEffect(() => {
    if (isLogin) {
      // Login route is public; skip session checks.
      setSessionOk(true);
      setSessionChecked(true);
      return;
    }

    // Avoid re-checking on every client navigation.
    // Server components already protect routes; this is a safety net for stale cookies.
    if (hasValidatedRef.current && sessionVersion === 0) return;

    let cancelled = false;
    const timeoutMs = 8000;

    async function run() {
      // Si por alguna razón entramos acá sin sesión válida (cookie stale),
      // no mostramos contenido: mostramos loader y redirigimos.
      setSessionChecked(false);
      setSession(null);

      let res: Awaited<ReturnType<typeof getCurrentSessionAction>> | null = null;
      try {
        res = (await Promise.race([
          getCurrentSessionAction(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("session_check_timeout")), timeoutMs)
          ),
        ])) as Awaited<ReturnType<typeof getCurrentSessionAction>>;
      } catch {
        // If the session check fails (server actions unavailable on the host,
        // missing env/config, networking issues), do not hang on a loader.
        // Redirect to login as a safe fallback.
        setSessionOk(false);
        setSession(null);
        setSessionChecked(true);
        const next = encodeURIComponent(pathnameRef.current || "/");
        router.replace(`/login?next=${next}`);
        return;
      }
      if (cancelled) return;

      if (!res?.data) {
        setSessionOk(false);
        setSession(null);
        setSessionChecked(true);
        const next = encodeURIComponent(pathnameRef.current || "/");
        router.replace(`/login?next=${next}`);
        return;
      }

      setSessionOk(true);
      setSession(res.data);
      setSessionChecked(true);
      hasValidatedRef.current = true;
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isLogin, router, sessionVersion]);

  if (isLogin) {
    return <>{children}</>;
  }

  const showSessionLoader = !sessionChecked || !sessionOk;
  const accessLevel = typeof session?.accessLevel === "number" ? Number(session.accessLevel) : 0;

  if (isDocumentPrintRoute) {
    return showSessionLoader ? (
      <div className="min-h-svh w-full grid place-items-center">
        <div className="text-sm text-muted-foreground">Cargando…</div>
      </div>
    ) : (
      <>{children}</>
    );
  }

  return (
    <SidebarProvider>
      <UiPreferencesProvider>
        <AnimeTopLoader />
        <AppSidebar accessLevel={accessLevel} />
        <SidebarInset>
          <div className="flex min-h-svh min-w-0 w-full flex-col">
            <AppHeader session={session} />
            <main className="flex-1 min-w-0 w-full max-w-full p-4 md:p-6 lg:p-8">
              {showSessionLoader ? (
                <div className="min-h-[50vh] w-full grid place-items-center">
                  <div className="text-sm text-muted-foreground">Cargando…</div>
                </div>
              ) : (
                <AnimatedPage>{children}</AnimatedPage>
              )}
            </main>
          </div>
        </SidebarInset>
      </UiPreferencesProvider>
    </SidebarProvider>
  );
}
