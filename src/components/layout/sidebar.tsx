
"use client";

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
import { Boxes, LayoutDashboard, FileText, Calculator, Warehouse, Table, BarChart3, Receipt, Settings } from "lucide-react";
import { AppLogo } from "../icons";
import { DatabaseStatus } from "./database-status";

import { Globe } from "lucide-react";

const menuItems = [
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
    href: "/import-data",
    label: "Importar datos",
    icon: FileText,
  },
  {
    href: "/users",
    label: "Usuarios",
    icon: Settings, // Puedes cambiar el icono por uno más representativo si lo deseas
  },
  {
    href: "/",
    label: "Panel de Control",
    icon: LayoutDashboard,
  },
  {
    href: "/inventory",
    label: "Inventario",
    icon: Boxes,
  },
  {
    href: "/stock",
    label: "Stock",
    icon: Warehouse,
  },
  {
    href: "/documents",
    label: "Documentos",
    icon: Receipt,
  },
  {
    href: "/kardex",
    label: "Kardex (Auditoría)",
    icon: BarChart3,
  },
  {
    href: "/reporting",
    label: "Reportes",
    icon: BarChart3,
  },
  {
    href: "/tables",
    label: "Tablas",
    icon: Table,
  },
  {
    href: "/settings",
    label: "Configuración",
    icon: Settings,
  },
  {
    href: "/documentation",
    label: "Documentación",
    icon: FileText,
  },
  {
    href: "/financing-calculator",
    label: "Calculadora de Financiación",
    icon: Calculator,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <AppLogo className="h-8 w-8 text-primary" />
          <span className="text-xl font-semibold">InventoryEdge</span>
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
        <DatabaseStatus />
      </SidebarFooter>
    </Sidebar>
  );
}
