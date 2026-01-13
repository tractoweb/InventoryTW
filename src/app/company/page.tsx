import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CompanyPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mi empresa</h1>
          <p className="text-muted-foreground">Datos de la empresa (Company) y parámetros generales.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/tables">Ver datos (Admin)</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
          <CardDescription>
            Luego agregamos UI de edición. Por ahora: importar o revisar el registro en la tabla.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/json/company">Importar empresa</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/tables">Abrir Company</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
