
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Receipt,
  ArrowUpRight,
  Boxes,
  Tag,
  Warehouse,
  BarChart3,
  Users,
  History,
  FileText,
  Calculator,
  Settings,
  ChevronDown,
} from "lucide-react";
import { AppLogo } from "../icons";
import { DatabaseStatus } from "./database-status";
import { getAnime } from "@/components/ui-preferences/anime";
import { useUiPreferences } from "@/components/ui-preferences/ui-preferences-provider";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

type MenuItem = {
  href: string;
  label: string;
  icon: React.ComponentType<any>;
  minLevel?: number;
};

type MenuGroup = {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
  items: MenuItem[];
};

const topLevelItems: MenuItem[] = [
  { href: "/", label: "Panel de Control", icon: LayoutDashboard },
];

const menuGroups: MenuGroup[] = [
  {
    key: "operacion",
    label: "Operación",
    icon: Receipt,
    items: [
      { href: "/documents", label: "Documentos", icon: Receipt },
      { href: "/pos/salidas", label: "POS · Salidas", icon: ArrowUpRight },
      { href: "/partners", label: "Clientes & Proveedores", icon: Users },
    ],
  },
  {
    key: "inventario",
    label: "Inventario",
    icon: Boxes,
    items: [
      { href: "/inventory", label: "Productos", icon: Boxes },
      { href: "/stock", label: "Stock", icon: Warehouse },
      { href: "/kardex", label: "Kardex", icon: BarChart3 },
      { href: "/warehouses", label: "Almacenes", icon: Warehouse },
      { href: "/price-lists", label: "Listas de precios", icon: Tag },
    ],
  },
  {
    key: "reportes",
    label: "Reportes",
    icon: BarChart3,
    items: [
      { href: "/reports", label: "Informes", icon: BarChart3 },
      { href: "/reports/audit", label: "Auditoría", icon: History, minLevel: 1 },
    ],
  },
  {
    key: "tools",
    label: "Herramientas",
    icon: FileText,
    items: [
      { href: "/json", label: "Importar JSON", icon: FileText },
      { href: "/print-labels/products", label: "Imprimir Etiquetas", icon: FileText },
      { href: "/financing-calculator", label: "Calculadora", icon: Calculator },
    ],
  },
];

const footerMenuItems = [
  {
    href: "/settings",
    label: "Configuración",
    icon: Settings,
  },
];

export function AppSidebar({ accessLevel = 0 }: { accessLevel?: number }) {
  const pathname = usePathname();
  const { preferences } = useUiPreferences();
  const brandLogoRef = React.useRef<HTMLDivElement | null>(null);
  const brandTextRef = React.useRef<HTMLSpanElement | null>(null);

  function isActiveHref(href: string): boolean {
    const p = pathname ?? "";
    if (href === "/") return p === "/";
    return p === href || p.startsWith(`${href}/`);
  }

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    // Ensure the group containing the active route is expanded at least once.
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of menuGroups) {
        if (next[g.key] !== undefined) continue;
        const visible = g.items.filter((it) => (typeof it.minLevel === "number" ? accessLevel >= it.minLevel : true));
        const active = visible.some((it) => isActiveHref(it.href));
        if (active) next[g.key] = true;
      }
      return next;
    });
  }, [pathname, accessLevel]);

  React.useEffect(() => {
    if (!preferences.enableAnimeJs) return;
    if (prefersReducedMotion()) return;

    const logoEl = brandLogoRef.current;
    const textEl = brandTextRef.current;
    if (!logoEl || !textEl) return;

    const preset = preferences.animationPreset;
    let cancelled = false;

    void getAnime().then((anime) => {
      if (cancelled) return;
      if (!anime) return;

      const easing = preset === "show" ? anime.eases.outExpo : anime.eases.outQuad;

      anime.remove([logoEl, textEl]);
      anime.set([logoEl, textEl], {
        opacity: 0,
        translateY: preset === "show" ? 12 : 8,
      });

      const tl = anime.createTimeline({
        autoplay: true,
      });

      tl.add(
        logoEl,
        {
          opacity: [0, 1],
          translateY: [preset === "show" ? 12 : 8, 0],
          scale: [0.9, 1],
          rotate: [preset === "show" ? -10 : -6, 0],
          duration: preset === "show" ? 800 : 420,
          easing,
        },
        0
      );

      tl.add(
        textEl,
        {
          opacity: [0, 1],
          translateY: [preset === "show" ? 10 : 6, 0],
          duration: preset === "show" ? 650 : 320,
          easing,
        },
        preset === "show" ? 160 : 90
      );
    }).catch(() => {
      // fail-safe: ignore AnimeJS failures
    });

    return () => {
      cancelled = true;
    };
  }, [preferences.enableAnimeJs, preferences.animationPreset]);

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <div ref={brandLogoRef} className="ui-show-glow">
            <AppLogo className="h-8 w-8 text-primary" />
          </div>
          <span ref={brandTextRef} className="ui-show-glow text-xl font-semibold">
            InventoryTAW
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {topLevelItems
            .filter((item) => (typeof item.minLevel === "number" ? accessLevel >= item.minLevel : true))
            .map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton asChild isActive={isActiveHref(item.href)} tooltip={item.label}>
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}

          {menuGroups.map((group) => {
            const visibleItems = group.items.filter((it) => (typeof it.minLevel === "number" ? accessLevel >= it.minLevel : true));
            if (visibleItems.length === 0) return null;

            const active = visibleItems.some((it) => isActiveHref(it.href));
            const open = openGroups[group.key] ?? active;

            return (
              <Collapsible
                key={group.key}
                open={open}
                onOpenChange={(v) => setOpenGroups((prev) => ({ ...prev, [group.key]: v }))}
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={group.label}
                      className="justify-between"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <group.icon />
                        <span className="truncate">{group.label}</span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "ml-auto size-4 shrink-0 transition-transform",
                          open ? "rotate-180" : "rotate-0"
                        )}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {visibleItems.map((item) => (
                        <SidebarMenuSubItem key={`${group.key}-${item.href}`}>
                          <SidebarMenuSubButton asChild isActive={isActiveHref(item.href)}>
                            <Link href={item.href}>
                              <item.icon />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {footerMenuItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <div className="mt-2">
          <DatabaseStatus />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
