import Link from "next/link";

import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/session";
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { AccessDenied } from "@/components/auth/access-denied";
import { inventoryService } from "@/services/inventory-service";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default async function LowStockReportPage() {
  const s = await getCurrentSession();
  if (!s.data) redirect("/login?next=%2Freports%2Flow-stock");
  if (Number(s.data.accessLevel) < ACCESS_LEVELS.CASHIER) {
    return <AccessDenied backHref="/reports" backLabel="Volver a Informes" />;
  }

  const res = await inventoryService.getLowStockAlerts();
  if (!res.success) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bajo stock</h1>
            <p className="text-muted-foreground">Productos que requieren atención.</p>
          </div>
          <Link href="/reports" className={cn(buttonVariants({ variant: "outline" }))}>
            Volver
          </Link>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{res.error ?? "No se pudo cargar"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const rows = res.alerts ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bajo stock</h1>
          <p className="text-muted-foreground">Productos bajo el umbral configurado.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/reports" className={cn(buttonVariants({ variant: "outline" }))}>
            Volver
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alertas ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay productos en bajo stock.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Umbral</TableHead>
                    <TableHead className="hidden md:table-cell">Bodega</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={`${r.productId}-${r.warehouseName}`}> 
                      <TableCell className="font-medium">{r.productName}</TableCell>
                      <TableCell className="text-right">{r.currentStock}</TableCell>
                      <TableCell className="text-right">{r.warningQuantity}</TableCell>
                      <TableCell className="hidden md:table-cell">{r.warehouseName}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/stock?q=${encodeURIComponent(String((r as any).productCode ?? r.productName ?? "").trim())}`}
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
