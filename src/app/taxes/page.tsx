import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TaxesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasas de impuestos</h1>
          <p className="text-muted-foreground">Catálogo de Tax y reglas asociadas a productos/documentos.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/tables">Ver datos (Admin)</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
          <CardDescription>
            Luego agregamos UI de edición tipo Aronium (porcentaje, código, nombre, vigencia).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/json/tax">Importar impuestos</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/tables">Abrir Tax</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
