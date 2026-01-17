import Link from "next/link";

import { requireSession } from "@/lib/session";
import { ACCESS_LEVELS } from "@/lib/amplify-config";

import { getStockData } from "@/actions/get-stock-data";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default async function OutOfStockReportPage() {
  await requireSession(ACCESS_LEVELS.CASHIER);

  const res = await getStockData();
  if (res.error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agotados</h1>
            <p className="text-muted-foreground">Productos con stock total en 0.</p>
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

  const rows = (res.data ?? []).filter((p) => Number(p.quantity ?? 0) <= 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agotados</h1>
          <p className="text-muted-foreground">Productos que requieren reposición.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/reports" className={cn(buttonVariants({ variant: "outline" }))}>
            Volver
          </Link>
          <Link href="/stock" className={cn(buttonVariants({}))}>
            Ir a Stock
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agotados ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay productos agotados.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">ID</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="hidden md:table-cell">Código</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 250).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.id}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{r.code ?? "-"}</TableCell>
                      <TableCell className="text-right">{r.quantity}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/stock?q=${encodeURIComponent(r.name)}`}
                          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                        >
                          Ver en Stock
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
