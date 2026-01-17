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

  const isLogin = pathname === "/login";

  const [sessionChecked, setSessionChecked] = React.useState(false);
  const [sessionOk, setSessionOk] = React.useState(false);
  const [session, setSession] = React.useState<any>(null);
  const [sessionVersion, setSessionVersion] = React.useState(0);

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

    let cancelled = false;

    async function run() {
      // Si por alguna razón entramos acá sin sesión válida (cookie stale),
      // no mostramos contenido: mostramos loader y redirigimos.
      setSessionChecked(false);
      setSession(null);

      let res: Awaited<ReturnType<typeof getCurrentSessionAction>> | null = null;
      try {
        res = await getCurrentSessionAction();
      } catch {
        // If server actions are unavailable / transient network error,
        // treat as unauthenticated and redirect.
        res = null;
      }
      if (cancelled) return;

      if (!res?.data) {
        setSessionOk(false);
        setSession(null);
        setSessionChecked(true);
        const next = encodeURIComponent(pathname || "/");
        router.replace(`/login?next=${next}`);
        router.refresh();
        return;
      }

      setSessionOk(true);
      setSession(res.data);
      setSessionChecked(true);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isLogin, pathname, router, sessionVersion]);

  if (isLogin) {
    return <>{children}</>;
  }

  const showSessionLoader = !sessionChecked || !sessionOk;
  const accessLevel = typeof session?.accessLevel === "number" ? Number(session.accessLevel) : 0;

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
