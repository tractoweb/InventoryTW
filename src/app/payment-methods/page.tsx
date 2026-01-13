import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PaymentMethodsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Formas de pago</h1>
          <p className="text-muted-foreground">
            Catálogo de PaymentType (para caja/control de dinero y conciliación).
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/tables">Ver datos (Admin)</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
          <CardDescription>
            Por ahora se administra desde importación o tabla Admin. Luego agregamos UI tipo Aronium.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/json/paymenttype">Importar formas de pago</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/tables">Abrir PaymentType</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
