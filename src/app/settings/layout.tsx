import * as React from "react";

import { redirect } from "next/navigation";

import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { getCurrentSession } from "@/lib/session";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const res = await getCurrentSession();
  if (!res.data) redirect("/login?next=%2Fsettings");

  const accessLevel = Number(res.data.accessLevel ?? ACCESS_LEVELS.CASHIER);

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Personaliza tu interfaz y administra parámetros del sistema.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[260px_1fr] min-w-0">
        <SettingsNav accessLevel={accessLevel} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
