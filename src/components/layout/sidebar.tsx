
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
import {
  LayoutDashboard,
  Receipt,
  Boxes,
  Tag,
  Warehouse,
  BarChart3,
  Users,
  Shield,
  CreditCard,
  Globe,
  Percent,
  Building2,
  FileText,
  Table,
  Calculator,
  Settings,
} from "lucide-react";
import { AppLogo } from "../icons";
import { DatabaseStatus } from "./database-status";

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
    href: "/user-security",
    label: "Usuario & Seguridad",
    icon: Shield,
  },
  {
    href: "/payment-methods",
    label: "Formas de pago",
    icon: CreditCard,
  },
  {
    href: "/paises",
    label: "Países",
    icon: Globe,
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
    href: "/tables",
    label: "Tablas (Admin)",
    icon: Table,
  },
  {
    href: "/documentation",
    label: "Documentación",
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
