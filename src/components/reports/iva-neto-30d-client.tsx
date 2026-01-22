"use client";

import * as React from "react";
import Link from "next/link";

import type { IvaNeto30dReport } from "@/actions/get-iva-neto-30d";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

function formatMoney(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMoneyCompact(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("es-CO", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(n);
}

type Props = {
  report: IvaNeto30dReport;
};

export function IvaNeto30dClient({ report }: Props) {
  const { window, totals, trends, documents } = report;

  const [tab, setTab] = React.useState<"all" | "sales" | "purchases">("all");

  const filteredRows = React.useMemo(() => {
    const rows = documents.rows ?? [];
    if (tab === "sales") return rows.filter((r) => r.direction === "sale");
    if (tab === "purchases") return rows.filter((r) => r.direction === "purchase");
    return rows;
  }, [documents.rows, tab]);

  const sourceLabel = React.useCallback((src: IvaNeto30dReport["documents"]["rows"][number]["ivaSource"]) => {
    if (src === "InternalNote") return "Snapshot";
    if (src === "DocumentItemTax") return "Ítems";
    if (src === "ProductTaxEstimate") return "Estimado";
    return "—";
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {documents.truncated ? (
        <Alert>
          <AlertTitle>Resultado parcial</AlertTitle>
          <AlertDescription>
            {documents.truncatedReason ?? "El reporte fue truncado por límites de consulta."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>IVA Ventas</CardTitle>
            <CardDescription>{window.from} → {window.to}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatMoney(totals.salesIva)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>IVA Compras</CardTitle>
            <CardDescription>{window.from} → {window.to}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatMoney(totals.purchaseIva)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>IVA Neto</CardTitle>
            <CardDescription>Ventas − Compras</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatMoney(totals.netIva)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Fuentes: Snapshot (POS/liquidación) → Impuestos por ítem → Estimación por impuestos de producto.
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Conteo: Snapshot {totals.sources.internalNote}, Ítems {totals.sources.documentItemTax}, Estimado {totals.sources.productTaxEstimate}, Sin IVA {totals.sources.none}.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>IVA neto (últimos {window.days} días)</CardTitle>
          <CardDescription>Serie diaria de IVA ventas, IVA compras y neto.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              salesIva: { label: "IVA Ventas", color: "hsl(var(--chart-3))" },
              purchaseIva: { label: "IVA Compras", color: "hsl(var(--chart-4))" },
              netIva: { label: "IVA Neto", color: "hsl(var(--chart-1))" },
            }}
            className="h-[320px] w-full min-w-0 overflow-hidden aspect-auto"
          >
            <AreaChart data={trends.byDay} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickMargin={8} minTickGap={20} />
              <YAxis tickFormatter={formatMoneyCompact} width={70} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <ChartTooltip content={<ChartTooltipContent />} />

              <Area type="monotone" dataKey="salesIva" stroke="var(--color-salesIva)" fill="var(--color-salesIva)" fillOpacity={0.18} />
              <Area type="monotone" dataKey="purchaseIva" stroke="var(--color-purchaseIva)" fill="var(--color-purchaseIva)" fillOpacity={0.14} />
              <Area type="monotone" dataKey="netIva" stroke="var(--color-netIva)" fill="var(--color-netIva)" fillOpacity={0.10} />
            </AreaChart>
          </ChartContainer>

          <div className="mt-2 text-xs text-muted-foreground">
            Ver detalle por documento abajo o abrir <Link href="/documents" className="underline underline-offset-2">Documentos</Link>.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trazabilidad</CardTitle>
          <CardDescription>
            {totals.documentsCount} documentos en el período. Cada fila enlaza al documento en el módulo de Documentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="sales">Ventas</TabsTrigger>
              <TabsTrigger value="purchases">Compras</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-3">
              {filteredRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No hay documentos para mostrar.</div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead className="hidden md:table-cell">Tipo</TableHead>
                        <TableHead>Contraparte</TableHead>
                        <TableHead className="hidden lg:table-cell">Origen IVA</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">IVA</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((r) => (
                        <TableRow key={r.documentId}>
                          <TableCell className="whitespace-nowrap tabular-nums">{r.date}</TableCell>
                          <TableCell className="font-medium">{r.number || `#${r.documentId}`}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="text-sm">{r.documentTypeName ?? (r.direction === "sale" ? "Venta" : "Compra")}</div>
                            <div className="text-xs text-muted-foreground">{r.direction === "sale" ? "Salida" : "Entrada"}</div>
                          </TableCell>
                          <TableCell className="max-w-[260px] truncate">{r.counterpartyName ?? "—"}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="text-sm">{sourceLabel(r.ivaSource)}</div>
                            <div className="text-xs text-muted-foreground">{r.ivaSource}</div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(r.total)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(r.iva)}</TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/documents?documentId=${encodeURIComponent(String(r.documentId))}`}
                              className="underline underline-offset-2"
                            >
                              Abrir
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
