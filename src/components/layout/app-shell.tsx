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

  const [sessionChecked, setSessionChecked] = React.useState(false);
  const [sessionOk, setSessionOk] = React.useState(false);

  if (pathname === "/login") {
    return <>{children}</>
  }

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      // Si por alguna razón entramos acá sin sesión válida (cookie stale),
      // no mostramos contenido: mostramos loader y redirigimos.
      setSessionChecked(false);
      const res = await getCurrentSessionAction();
      if (cancelled) return;

      if (!res?.data) {
        setSessionOk(false);
        setSessionChecked(true);
        const next = encodeURIComponent(pathname || "/");
        router.replace(`/login?next=${next}`);
        router.refresh();
        return;
      }

      setSessionOk(true);
      setSessionChecked(true);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!sessionChecked || !sessionOk) {
    return (
      <div className="min-h-svh w-full grid place-items-center p-6">
        <div className="text-sm text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <UiPreferencesProvider>
        <AnimeTopLoader />
        <AppSidebar />
        <SidebarInset>
          <div className="flex min-h-svh min-w-0 w-full flex-col">
            <AppHeader />
            <main className="flex-1 min-w-0 w-full max-w-full p-4 md:p-6 lg:p-8">
              <AnimatedPage>{children}</AnimatedPage>
            </main>
          </div>
        </SidebarInset>
      </UiPreferencesProvider>
    </SidebarProvider>
  );
}
