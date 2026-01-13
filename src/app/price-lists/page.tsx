import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PriceListsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Listas de precios</h1>
          <p className="text-muted-foreground">
            Administración de precios/costos por producto. (Módulo en construcción)
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/tables">Ver datos (Admin)</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximo paso</CardTitle>
          <CardDescription>
            Vista tipo Aronium: lista de productos + columnas de costo/markup/precio + edición masiva.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/inventory">Ir a Productos</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/json">Importar catálogos</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
