import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PartnersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes & Proveedores</h1>
          <p className="text-muted-foreground">
            En esta migración, el modelo Customer representa principalmente proveedores (y opcionalmente clientes).
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/tables">Ver datos (Admin)</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Proveedores</CardTitle>
            <CardDescription>Alta/edición, estado, datos fiscales, contacto.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/tables">Abrir tabla Customer</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/json/customer">Importar proveedores</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uso en Documentos</CardTitle>
            <CardDescription>Seleccionar proveedor en ingresos por factura/guía.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/documents/new">Nuevo ingreso</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/documents">Ver documentos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
