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
import { Boxes, LayoutDashboard, FileText, Calculator, Warehouse } from "lucide-react";
import { AppLogo } from "../icons";
import { DatabaseStatus } from "./database-status";

const menuItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: Boxes,
  },
  {
    href: "/stock",
    label: "Stock",
    icon: Warehouse,
  },
  {
    href: "/documentation",
    label: "Documentation",
    icon: FileText,
  },
  {
    href: "/financing-calculator",
    label: "Financing Calculator",
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
