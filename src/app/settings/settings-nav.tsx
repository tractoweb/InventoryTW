"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  minLevel?: number;
};

export function SettingsNav(props: { accessLevel: number }) {
  const pathname = usePathname() ?? "/settings";

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const isAdmin = props.accessLevel >= 1;

  const preferences: NavItem[] = [{ href: "/settings/personalization", label: "Personalización" }];

  const admin: NavItem[] = isAdmin
    ? [
        { href: "/settings/users", label: "Usuarios" },
        { href: "/settings/company", label: "Mi empresa" },
        { href: "/settings/taxes", label: "Impuestos" },
        { href: "/settings/payment-methods", label: "Formas de pago" },
        { href: "/settings/application", label: "Aplicación" },
        { href: "/settings/catalogs", label: "Catálogos" },
        { href: "/settings/advanced", label: "Avanzado" },
      ]
    : [];

  const Section = ({ title, items }: { title: string; items: NavItem[] }) => {
    if (!items.length) return null;
    return (
      <div className="space-y-1">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        <div className="flex flex-col gap-1">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                isActive(it.href)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {it.label}
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <nav className="w-full">
      <div className="rounded-lg border bg-card p-2">
        <Section title="Preferencias" items={preferences} />
        {isAdmin ? <div className="my-3 border-t" /> : null}
        <Section title="Administración" items={admin} />
      </div>
    </nav>
  );
}
