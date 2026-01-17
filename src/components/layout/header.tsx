"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Settings, User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { formatDistanceToNow } from "date-fns";
import { es } from 'date-fns/locale';
import { ThemeToggle } from "@/components/theme-toggle";
import { AppLogo } from "@/components/icons";
import { listNotificationsAction, type NotificationItem } from "@/actions/list-notifications";


const pageTitles: { [key: string]: string } = {
  '/': 'Panel de Control',
  '/inventory': 'Inventario',
  '/stock': 'Stock',
  '/financing-calculator': 'Calculadora de Financiación',
};


export function AppHeader({ session }: { session?: any }) {
  const pathname = usePathname() ?? "/";
  if (pathname === "/login") return null;
  const pageTitle = pageTitles[pathname] || pathname.split("/").pop()?.replace("-", " ") || "Dashboard";

  const userId = Number(session?.userId ?? 0) || 0;
  const displayName = [session?.firstName, session?.lastName].filter(Boolean).join(" ").trim();
  const avatarFallback = (displayName || String(session?.email ?? "") || String(userId || "U"))
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();

  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifLoading, setNotifLoading] = React.useState(false);

  const lastSeenKey = userId ? `notif:lastSeen:${userId}` : "notif:lastSeen";
  const lastSeenIso = typeof window !== "undefined" ? window.localStorage.getItem(lastSeenKey) : null;
  const lastSeenMs = lastSeenIso ? new Date(lastSeenIso).getTime() : 0;
  const unreadNotifications = notifications.filter((n) => {
    const ms = new Date(String(n.createdAt)).getTime();
    return Number.isFinite(ms) && ms > lastSeenMs;
  }).length;

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setNotifLoading(true);
      try {
        const res = await listNotificationsAction(10);
        if (cancelled) return;
        if (res?.error) throw new Error(res.error);
        setNotifications(res?.data ?? []);
      } catch {
        if (cancelled) return;
        setNotifications([]);
      } finally {
        if (!cancelled) setNotifLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  React.useEffect(() => {
    if (!notifOpen) return;
    if (typeof window === "undefined") return;
    // Mark as seen when opening.
    window.localStorage.setItem(lastSeenKey, new Date().toISOString());
  }, [notifOpen, lastSeenKey]);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <SidebarTrigger className="md:hidden" />

      <Link href="/" className="flex items-center gap-2 md:hidden">
        <AppLogo className="h-6 w-6 text-primary" />
        <span className="text-base font-semibold">InventoryTAW</span>
      </Link>

      <h1 className="hidden text-lg font-semibold capitalize md:block">
        {pageTitle}
      </h1>

      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                  {unreadNotifications}
                </span>
              )}
              <span className="sr-only">Ver notificaciones</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0">
            <div className="p-4">
              <h4 className="font-medium">Notificaciones</h4>
            </div>
            <div className="divide-y">
              {notifLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Cargando…</div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Sin notificaciones.</div>
              ) : (
                notifications.map((notif) => {
                  const ms = new Date(String(notif.createdAt)).getTime();
                  const isUnread = Number.isFinite(ms) && ms > lastSeenMs;

                  const content = (
                    <div className="grid grid-cols-[25px_1fr] items-start gap-3 p-4 last:pb-4">
                      <span className={`flex h-2 w-2 translate-y-1 rounded-full ${isUnread ? "bg-primary" : "bg-muted-foreground/40"}`} />
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">{notif.title}</p>
                        {notif.description ? <p className="text-sm text-muted-foreground">{notif.description}</p> : null}
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    </div>
                  );

                  return notif.href ? (
                    <Link key={notif.id} href={notif.href} className="block hover:bg-muted/40" onClick={() => setNotifOpen(false)}>
                      {content}
                    </Link>
                  ) : (
                    <div key={notif.id}>{content}</div>
                  );
                })
              )}
            </div>
            <div className="border-t p-2 text-center">
              <Button
                variant="link"
                size="sm"
                className="w-full"
                asChild
              >
                <Link href="/audit">Ver auditoría</Link>
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={""} alt={displayName || "Usuario"} data-ai-hint="person face" />
                <AvatarFallback>
                  {avatarFallback || "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/logout">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
