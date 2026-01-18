import Link from "next/link";

import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/session";
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { AccessDenied } from "@/components/auth/access-denied";

import { getProductDuplicatesAction } from "@/actions/get-product-duplicates";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default async function ComparisonReportPage() {
  const s = await getCurrentSession();
  if (!s.data) redirect("/login?next=%2Freports%2Fcomparison");
  if (Number(s.data.accessLevel) < ACCESS_LEVELS.CASHIER) {
    return <AccessDenied backHref="/reports" backLabel="Volver a Informes" />;
  }

  const res = await getProductDuplicatesAction();
  if (res.error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Comparación</h1>
            <p className="text-muted-foreground">Posibles productos duplicados.</p>
          </div>
          <Link href="/reports" className={cn(buttonVariants({ variant: "outline" }))}>
            Volver
          </Link>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{res.error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const groups = res.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comparación</h1>
          <p className="text-muted-foreground">
            Agrupa productos que parecen ser iguales por nombre normalizado o por código.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/reports" className={cn(buttonVariants({ variant: "outline" }))}>
            Volver
          </Link>
          <Link href="/inventory" className={cn(buttonVariants({}))}>
            Ir a Productos
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grupos detectados ({groups.length})</CardTitle>
          <CardDescription>
            Recomendación: abre cada grupo en Productos/Stock y valida manualmente antes de fusionar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="text-sm text-muted-foreground">No se detectaron duplicados.</div>
          ) : (
            <div className="space-y-6">
              {groups.slice(0, 30).map((g) => (
                <div key={`${g.reason}-${g.key}`} className="rounded-md border">
                  <div className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium">
                        {g.reason === "code" ? "Duplicados por código" : "Duplicados por nombre"} · {g.items.length} items
                      </div>
                      <div className="text-xs text-muted-foreground break-all">Key: {g.key}</div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/inventory?q=${encodeURIComponent(String(g.items[0]?.code ?? g.items[0]?.name ?? "").trim())}`}
                        className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                      >
                        Buscar en Productos
                      </Link>
                      <Link
                        href={`/stock?q=${encodeURIComponent(String(g.items[0]?.code ?? g.items[0]?.name ?? "").trim())}`}
                        className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                      >
                        Buscar en Stock
                      </Link>
                    </div>
                  </div>

                  <div className="border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[90px]">ID</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead className="hidden md:table-cell">Código</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.items.map((p) => (
                          <TableRow key={p.idProduct}>
                            <TableCell>{p.idProduct}</TableCell>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className="hidden md:table-cell">{p.code ?? "-"}</TableCell>
                            <TableCell className="text-right">
                              <Link
                                href={`/inventory?q=${encodeURIComponent(String(p.code ?? p.name ?? "").trim())}`}
                                className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                              >
                                Abrir
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}

              {groups.length > 30 ? (
                <div className="text-xs text-muted-foreground">
                  Mostrando 30 grupos por rendimiento. Si necesitas más, lo hacemos paginado.
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
