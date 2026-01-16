"use client";

import { usePathname } from "next/navigation";
import { SessionGuard } from "@/components/auth/session-guard";

import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/header";
import { UiPreferencesProvider } from "@/components/ui-preferences/ui-preferences-provider";
import { AnimatedPage } from "@/components/ui-preferences/animated-page";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <div className="min-h-svh p-6">{children}</div>;
  }

  return (
    <SidebarProvider>
      <SessionGuard />
      <UiPreferencesProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex min-h-svh flex-col">
            <AppHeader />
            <main className="flex-1 p-4 md:p-6 lg:p-8">
              <AnimatedPage>{children}</AnimatedPage>
            </main>
          </div>
        </SidebarInset>
      </UiPreferencesProvider>
    </SidebarProvider>
  );
}
