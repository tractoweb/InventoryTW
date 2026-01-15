"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HelpPopover } from "@/components/dashboard/help-popover";

type LowStockAlertRow = {
  productId: string;
  productName: string;
  currentStock: number;
  warningQuantity: number;
  warehouseName: string;
};

type AlertsPanelProps = {
  lowStock: LowStockAlertRow[];
};

export function AlertsPanel({ lowStock }: AlertsPanelProps) {
  const router = useRouter();

  const rows = (lowStock ?? [])
    .slice()
    .sort((a, b) => Number(a.currentStock) - Number(b.currentStock))
    .slice(0, 12);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Alertas</span>
          <HelpPopover
            title="Alertas de inventario"
            description="Lista de productos con alerta activa y stock por debajo del mínimo configurado. Haz clic en una fila para ver el producto en Stock."
            href="/stock"
            hrefLabel="Ir a Stock"
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Stock bajo:{" "}
          <Link href="/stock" className="font-medium text-foreground hover:underline">
            {lowStock?.length ?? 0}
          </Link>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No hay alertas de stock bajo.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const stock = Number(r.currentStock ?? 0);
                  const min = Number(r.warningQuantity ?? 0);
                  const critical = stock <= 0;

                  return (
                    <TableRow
                      key={`${r.productId}-${r.warehouseName}`}
                      className="cursor-pointer"
                      onClick={() => {
                        const term = String(r.productName ?? "").trim();
                        if (!term) {
                          router.push("/stock");
                          return;
                        }
                        router.push(`/stock?q=${encodeURIComponent(term)}`);
                      }}
                    >
                      <TableCell className="font-medium">
                        {r.productName}
                        {critical ? <Badge variant="destructive" className="ml-2">Agotado</Badge> : null}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{r.warehouseName || "—"}</TableCell>
                      <TableCell className="text-right">{stock}</TableCell>
                      <TableCell className="text-right">{min}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
