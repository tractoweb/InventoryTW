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
            Este módulo fue separado: usa <b>Clientes</b> y <b>Proveedores</b>.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Proveedores</CardTitle>
            <CardDescription>Alta/edición, estado, datos fiscales, contacto.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link href="/suppliers/manage">Administrar</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/json/customer">Importar proveedores</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes</CardTitle>
            <CardDescription>Clientes de venta (tabla Client).</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link href="/clients/manage">Administrar</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pos/salidas">Ir a POS</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
