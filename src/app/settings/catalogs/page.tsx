import Link from "next/link";

import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { getCurrentSession } from "@/lib/session";
import { AccessDenied } from "@/components/auth/access-denied";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsCatalogsPage() {
  const res = await getCurrentSession();
  if (!res.data) return <AccessDenied backHref="/" backLabel="Volver al panel" />;
  if (Number(res.data.accessLevel) < ACCESS_LEVELS.ADMIN) {
    return <AccessDenied backHref="/settings" backLabel="Volver a configuración" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogos</CardTitle>
        <CardDescription>
          Mantención de maestros del sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 text-sm">
          <Link className="hover:underline" href="/settings/taxes">Impuestos</Link>
          <Link className="hover:underline" href="/settings/payment-methods">Formas de pago</Link>
          <Link className="hover:underline" href="/warehouses">Almacenes</Link>
        </div>
      </CardContent>
    </Card>
  );
}
