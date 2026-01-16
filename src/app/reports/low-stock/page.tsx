import Link from "next/link";

import { requireSession } from "@/lib/session";
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { inventoryService } from "@/services/inventory-service";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function LowStockReportPage() {
  await requireSession(ACCESS_LEVELS.CASHIER);

  const res = await inventoryService.getLowStockAlerts();
  if (!res.success) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bajo stock</h1>
            <p className="text-muted-foreground">Productos que requieren atención.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/reports">Volver</Link>
          </Button>
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
          <Button asChild variant="outline">
            <Link href="/reports">Volver</Link>
          </Button>
          <Button asChild>
            <Link href="/stock">Ir a Stock</Link>
          </Button>
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
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/stock?q=${encodeURIComponent(r.productName)}`}>Ver en Stock</Link>
                        </Button>
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
