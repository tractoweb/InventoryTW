"use client";

import * as React from "react";
import Link from "next/link";

import { getDocumentDetails, type DocumentDetails } from "@/actions/get-document-details";
import type { DocumentsCatalogRow } from "@/actions/list-documents-for-browser-all";
import { useDocumentsCatalog } from "@/components/catalog/documents-catalog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatMoney(value: unknown): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function safeJsonParse(value: unknown): any | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || !raw.startsWith("{")) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isPosSaleRow(row: DocumentsCatalogRow): boolean {
  const parsed = safeJsonParse(row.internalNote);
  return parsed?.source === "POS" && parsed?.kind === "Sale";
}

function paidStatusLabelEs(paidStatus: number): string {
  const s = Number(paidStatus ?? 0);
  if (s === 2) return "Pagada";
  if (s === 1) return "Parcial";
  return "No paga";
}

function paidStatusVariant(paidStatus: number): "default" | "secondary" | "outline" {
  const s = Number(paidStatus ?? 0);
  if (s === 2) return "default";
  if (s === 1) return "secondary";
  return "outline";
}

function rowDate(row: DocumentsCatalogRow): string {
  return String(row.stockDate || row.date || "").slice(0, 10);
}

export function PosSalesRegistryClientPage() {
  const catalog = useDocumentsCatalog();

  const [q, setQ] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const [selectedDocumentId, setSelectedDocumentId] = React.useState<number | null>(null);
  const [details, setDetails] = React.useState<DocumentDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [detailsError, setDetailsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void catalog.ensureLoaded();
  }, [catalog]);

  const rows = React.useMemo(() => {
    const text = q.trim().toLowerCase();

    return (catalog.documents ?? [])
      .filter(isPosSaleRow)
      .filter((row) => {
        const d = rowDate(row);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;

        if (!text) return true;
        const haystack = [
          row.number,
          row.referenceDocumentNumber,
          row.orderNumber,
          row.thirdPartyName,
          row.userName,
          row.warehouseName,
        ]
          .map((v) => String(v ?? "").toLowerCase())
          .join(" ");
        return haystack.includes(text);
      })
      .sort((a, b) => {
        const sd = String(b.stockDate ?? "").localeCompare(String(a.stockDate ?? ""));
        if (sd !== 0) return sd;
        return b.documentId - a.documentId;
      });
  }, [catalog.documents, q, dateFrom, dateTo]);

  React.useEffect(() => {
    if (!rows.length) {
      if (selectedDocumentId !== null) setSelectedDocumentId(null);
      return;
    }

    const stillExists = rows.some((r) => r.documentId === selectedDocumentId);
    if (!stillExists) {
      setSelectedDocumentId(rows[0].documentId);
    }
  }, [rows, selectedDocumentId]);

  React.useEffect(() => {
    if (!selectedDocumentId) {
      setDetails(null);
      setDetailsError(null);
      return;
    }

    let cancelled = false;
    setDetailsLoading(true);
    setDetailsError(null);

    getDocumentDetails(selectedDocumentId)
      .then((res: any) => {
        if (cancelled) return;
        if (res?.error) {
          setDetails(null);
          setDetailsError(String(res.error));
          return;
        }
        setDetails(res?.data ?? null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setDetails(null);
        setDetailsError(err?.message ?? "No se pudo cargar el documento");
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDocumentId]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Registro de articulos vendidos</CardTitle>
          <CardDescription>
            Trazabilidad completa del POS: venta, documento, cliente y articulos asociados.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por numero, cliente, bodega o referencia"
          />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Ventas POS registradas</CardTitle>
              <CardDescription>
                {rows.length} resultado(s) {catalog.status === "ready" ? "" : "(cargando...)"}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => void catalog.refresh()} disabled={catalog.status === "loading"}>
              Refrescar
            </Button>
          </CardHeader>
          <CardContent>
            {catalog.status === "loading" && !catalog.documents.length ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No hay ventas POS para los filtros seleccionados.</div>
            ) : (
              <div className="max-h-[560px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doc</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const selected = row.documentId === selectedDocumentId;
                      return (
                        <TableRow
                          key={row.documentId}
                          onClick={() => setSelectedDocumentId(row.documentId)}
                          className={selected ? "bg-muted/60" : "cursor-pointer"}
                        >
                          <TableCell className="font-medium">{row.number}</TableCell>
                          <TableCell>{rowDate(row)}</TableCell>
                          <TableCell>{row.thirdPartyName || "Anónimo"}</TableCell>
                          <TableCell className="text-right">{formatMoney(row.total)}</TableCell>
                          <TableCell>
                            <Badge variant={paidStatusVariant(row.paidStatus)}>{paidStatusLabelEs(row.paidStatus)}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trazabilidad de la venta</CardTitle>
            <CardDescription>
              Relacion de POS con documento, cliente y movimientos de articulos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedDocumentId ? (
              <div className="text-sm text-muted-foreground">Selecciona una venta para ver su detalle.</div>
            ) : detailsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : detailsError ? (
              <div className="text-sm text-destructive">{detailsError}</div>
            ) : !details ? (
              <div className="text-sm text-muted-foreground">No se pudo cargar la venta.</div>
            ) : (
              <>
                <div className="rounded-md border p-3">
                  <div className="text-lg font-semibold">Documento {details.number}</div>
                  <div className="text-sm text-muted-foreground">
                    Fecha: {String(details.stockdate ?? details.date ?? "").slice(0, 10)} · Usuario: {details.username || "-"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/documents?documentId=${details.id}`}>
                      <Button size="sm" variant="outline">Abrir en Documentos</Button>
                    </Link>
                    <Link href={`/documents/${details.id}/pdf`}>
                      <Button size="sm" variant="outline">Ver PDF</Button>
                    </Link>
                    <Link href={`/pos/salidas`}>
                      <Button size="sm" variant="outline">Ir al POS</Button>
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Cliente</div>
                    <div className="font-medium">{details.customername || "Anónimo"}</div>
                    {details.customername ? (
                      <Link
                        href={`/clients/manage?q=${encodeURIComponent(details.customername)}`}
                        className="text-xs text-primary underline-offset-2 hover:underline"
                      >
                        Ver cliente relacionado
                      </Link>
                    ) : null}
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Bodega</div>
                    <div className="font-medium">{details.warehousename || "-"}</div>
                    <div className="text-xs text-muted-foreground">Tipo: {details.documenttypename || "-"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Total documento</div>
                    <div className="font-semibold">{formatMoney(details.total)}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Items vendidos</div>
                    <div className="font-semibold">{details.items.length}</div>
                  </div>
                </div>

                {details.posSaleTotals ? (
                  <div className="rounded-md border p-3 text-sm">
                    <div className="font-medium">Snapshot POS</div>
                    <div className="text-muted-foreground">
                      Neto: {formatMoney(details.posSaleTotals.netTotal)} · IVA ({details.posSaleTotals.ivaPercentage}%): {formatMoney(details.posSaleTotals.ivaTotal)}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-md border">
                  <div className="border-b px-3 py-2 text-sm font-medium">Articulos vendidos</div>
                  <div className="max-h-[320px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Articulo</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Links</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {details.items.map((item) => {
                          const inventoryQuery = item.productcode || item.productname;
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="font-medium">{item.productname}</div>
                                <div className="text-xs text-muted-foreground">{item.productcode || `ID ${item.productid}`}</div>
                              </TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">{formatMoney(item.price)}</TableCell>
                              <TableCell className="text-right">{formatMoney(item.total)}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  <Link href={`/inventory?q=${encodeURIComponent(inventoryQuery)}`}>
                                    <Button size="sm" variant="outline">Producto</Button>
                                  </Link>
                                  <Link href={`/documents/${details.id}/pdf`}>
                                    <Button size="sm" variant="outline">Documento</Button>
                                  </Link>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
