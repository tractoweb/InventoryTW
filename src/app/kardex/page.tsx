import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function KardexPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kardex (Auditoría)</h1>
          <p className="text-muted-foreground">
            Historial de movimientos por producto: entradas, salidas y ajustes.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/tables">Ver Kardex (Admin)</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vista de Kardex (en construcción)</CardTitle>
          <CardDescription>
            Este módulo se conectará a Documentos para trazabilidad completa.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Próximo paso: filtros por producto/fechas/almacén, y detalle con vínculo al documento origen.
        </CardContent>
      </Card>
    </div>
  );
}
