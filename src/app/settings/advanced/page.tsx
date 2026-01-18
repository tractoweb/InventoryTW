import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { getCurrentSession } from "@/lib/session";
import { AccessDenied } from "@/components/auth/access-denied";

import { HardDeleteProductsCard } from "@/components/settings/hard-delete-products-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsAdvancedPage() {
  const res = await getCurrentSession();
  if (!res.data) return <AccessDenied backHref="/" backLabel="Volver al panel" />;
  if (Number(res.data.accessLevel) < ACCESS_LEVELS.ADMIN) {
    return <AccessDenied backHref="/settings" backLabel="Volver a configuración" />;
  }

  const isMaster = Number(res.data.accessLevel) >= ACCESS_LEVELS.MASTER;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Avanzado</CardTitle>
          <CardDescription>
            Opciones de sistema: contadores/secuencias, plantillas y propiedades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Recomendado: configurar <strong>Counter</strong> para secuencias de IDs y
            <strong>Template</strong>/<strong>ApplicationProperty</strong>.
          </p>
        </CardContent>
      </Card>

      {isMaster ? <HardDeleteProductsCard /> : null}
    </div>
  );
}
