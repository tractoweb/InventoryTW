"use client";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DashboardReceivableRow } from "@/actions/get-dashboard-overview";
import { HelpPopover } from "@/components/dashboard/help-popover";

type ReceivablesPanelProps = {
  rows: DashboardReceivableRow[];
  pendingCount: number;
  pendingAmountApprox: number;
  overdueCount: number;
  overdueAmountApprox: number;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ReceivablesPanel({
  rows,
  pendingCount,
  pendingAmountApprox,
  overdueCount,
  overdueAmountApprox,
}: ReceivablesPanelProps) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Cuentas por cobrar</span>
          <HelpPopover
            title="Cómo se calcula"
            description="Se estima con documentos de venta y pagos registrados. Los montos pueden ser aproximados si faltan pagos o si el tablero limita el cálculo por rendimiento."
            href="/documents"
            hrefLabel="Abrir Documentos"
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground">Pendiente (aprox)</div>
            <Link href="/documents" className="text-lg font-semibold hover:underline">
              {formatCurrency(pendingAmountApprox)}
            </Link>
            <div className="text-xs text-muted-foreground">{pendingCount} documentos</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-muted-foreground">Vencido (aprox)</div>
            <Link href="/documents" className="text-lg font-semibold hover:underline">
              {formatCurrency(overdueAmountApprox)}
            </Link>
            <div className="text-xs text-muted-foreground">{overdueCount} documentos</div>
          </div>
        </div>

        <div className="text-sm font-medium">Top vencidos</div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doc</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead className="text-right">Días</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No hay documentos vencidos en este período.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.documentId}>
                    <TableCell className="font-medium">
                      <Link href={`/documents?documentId=${r.documentId}`} className="hover:underline">
                        {r.number}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{r.customerName ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.pendingApprox)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.daysOverdue >= 30 ? "destructive" : "secondary"}>{r.daysOverdue}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Nota: los montos “aprox” se calculan con pagos registrados; si hay muchos documentos, el tablero limita el
          cálculo de pagos por rendimiento.
        </p>
      </CardContent>
    </Card>
  );
}
