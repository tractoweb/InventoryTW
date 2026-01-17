
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
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Receipt,
  Boxes,
  Tag,
  Warehouse,
  BarChart3,
  Users,
  Shield,
  History,
  CreditCard,
  Percent,
  Building2,
  FileText,
  Calculator,
  Settings,
} from "lucide-react";
import { AppLogo } from "../icons";
import { DatabaseStatus } from "./database-status";
import { getAnime } from "@/components/ui-preferences/anime";
import { useUiPreferences } from "@/components/ui-preferences/ui-preferences-provider";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

const menuItems = [
  {
    href: "/",
    label: "Panel de Control",
    icon: LayoutDashboard,
  },
  {
    href: "/documents",
    label: "Documentos",
    icon: Receipt,
  },
  {
    href: "/inventory",
    label: "Productos",
    icon: Boxes,
  },
  {
    href: "/price-lists",
    label: "Listas de precios",
    icon: Tag,
  },
  {
    href: "/stock",
    label: "Stock",
    icon: Warehouse,
  },
  {
    href: "/warehouses",
    label: "Almacenes",
    icon: Warehouse,
  },
  {
    href: "/reports",
    label: "Informes",
    icon: BarChart3,
  },
  {
    href: "/partners",
    label: "Clientes & Proveedores",
    icon: Users,
  },
  {
    href: "/kardex",
    label: "Kardex",
    icon: BarChart3,
  },
  {
    href: "/users",
    label: "Usuario & Seguridad",
    icon: Shield,
  },
  {
    href: "/audit",
    label: "Auditoría",
    icon: History,
  },
  {
    href: "/payment-methods",
    label: "Formas de pago",
    icon: CreditCard,
  },
  {
    href: "/taxes",
    label: "Tasas de impuestos",
    icon: Percent,
  },
  {
    href: "/company",
    label: "Mi empresa",
    icon: Building2,
  },
  {
    href: "/json",
    label: "Importar JSON",
    icon: FileText,
  },
  {
    href: "/print-labels/products",
    label: "Imprimir Etiquetas",
    icon: FileText,
  },
  {
    href: "/financing-calculator",
    label: "Calculadora",
    icon: Calculator,
  },
];

const footerMenuItems = [
  {
    href: "/settings",
    label: "Configuración",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { preferences } = useUiPreferences();
  const brandLogoRef = React.useRef<HTMLDivElement | null>(null);
  const brandTextRef = React.useRef<HTMLSpanElement | null>(null);

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
          {menuItems.map((item) => (
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
