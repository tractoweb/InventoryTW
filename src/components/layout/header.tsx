"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Search, Settings, User as UserIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { notifications, user } from "@/lib/data";
import { Badge } from "../ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from 'date-fns/locale';
import { ThemeToggle } from "@/components/theme-toggle";


const pageTitles: { [key: string]: string } = {
  '/': 'Panel de Control',
  '/inventory': 'Inventario',
  '/stock': 'Stock',
  '/financing-calculator': 'Calculadora de Financiación',
};


export function AppHeader() {
  const pathname = usePathname() ?? "/";
  if (pathname === "/login") return null;
  const pageTitle = pageTitles[pathname] || pathname.split("/").pop()?.replace("-", " ") || "Dashboard";

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <SidebarTrigger className="md:hidden" />

      <h1 className="hidden text-lg font-semibold capitalize md:block">
        {pageTitle}
      </h1>

      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <form className="ml-auto flex-1 sm:flex-initial">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar artículos..."
              className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
            />
          </div>
        </form>

        <Popover>
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
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="grid grid-cols-[25px_1fr] items-start gap-3 p-4 last:pb-4"
                >
                  <span className="flex h-2 w-2 translate-y-1 rounded-full bg-primary" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {notif.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {notif.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t p-2 text-center">
              <Button variant="link" size="sm" className="w-full">
                Ver todas las notificaciones
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={""} alt={user.username} data-ai-hint="person face" />
                <AvatarFallback>
                  {(user.username ?? "")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configuración</span>
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
