import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NewDocumentPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo ingreso</h1>
          <p className="text-muted-foreground">
            Captura de documento de ingreso (factura/guía) y sus items.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/documents">Volver</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formulario (en construcción)</CardTitle>
          <CardDescription>
            Este módulo se construirá ligado a: Document, DocumentItem, Stock, Kardex y Customer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Checklist funcional del ingreso:
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>Seleccionar almacén y tipo de documento (stockDirection).</li>
            <li>Seleccionar proveedor (Customer) y datos de factura.</li>
            <li>Agregar items con búsqueda de producto/barcode.</li>
            <li>Previsualizar existencias y costo/valoración.</li>
            <li>Guardar como borrador y/o finalizar (actualiza Stock + Kardex).</li>
            <li>Registrar impacto en caja si aplica (StartingCash/ZReport/Pagos internos).</li>
          </ul>
          <div className="flex gap-2 pt-2">
            <Button asChild variant="outline">
              <Link href="/json">Importar datos (si falta catálogo)</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/tables">Ver modelos actuales</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
