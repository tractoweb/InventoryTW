"use client";

import * as React from "react";
import Link from "next/link";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Minus, Plus, Tag } from "lucide-react";

import { formatDateTimeInBogota } from "@/lib/datetime";
import { useToast } from "@/hooks/use-toast";

import type { KardexEntryRow } from "@/actions/get-kardex-entries";
import {
  getProductDocumentHistoryAction,
  type ProductDocumentHistoryRow,
} from "@/actions/get-product-document-history";
import { createPrintLabelRequest } from "@/actions/print-label-requests";

function fmtNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
}

function fmtMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
}

function labelType(type: KardexEntryRow["type"]) {
  if (type === "ENTRADA") return "Entrada";
  if (type === "SALIDA") return "Salida";
  return "Creado";
}

export function KardexEntryDetailsSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: KardexEntryRow | null;
  defaultTab?: "movement" | "document";
  onOpenDocument?: (args: { documentId: number; documentNumber?: string | null; view: "pdf" | "print" }) => void;
}) {
  const { open, onOpenChange, entry, defaultTab = "movement", onOpenDocument } = props;
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"movement" | "document">(defaultTab);

  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [historyRows, setHistoryRows] = React.useState<ProductDocumentHistoryRow[]>([]);

  const [sendingLabel, setSendingLabel] = React.useState(false);
  const [labelQty, setLabelQty] = React.useState(1);

  const clampQty = (value: unknown) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.trunc(n));
  };

  React.useEffect(() => {
    if (!open) return;
    setTab(defaultTab);
  }, [open, defaultTab]);

  const qty = Number(entry?.quantity ?? 0) || 0;
  const signedQty = entry?.type === "SALIDA" ? -Math.abs(qty) : Math.abs(qty);
  const before = (Number(entry?.balance ?? 0) || 0) - signedQty;

  const productLabel = entry
    ? entry.productCode
      ? `${entry.productName ?? ""} (${entry.productCode})`
      : entry.productName ?? `#${entry.productId}`
    : "";

  const docLabel = entry
    ? entry.documentNumber ?? (entry.documentId ? `Doc #${entry.documentId}` : "—")
    : "";

  React.useEffect(() => {
    if (!open) return;
    if (!entry) return;
    if (!Number.isFinite(Number(entry.productId)) || Number(entry.productId) <= 0) return;

    // "Creado / Ajuste" doesn't have a meaningful document history context.
    if (entry.type === "AJUSTE") {
      setHistoryLoading(false);
      setHistoryError(null);
      setHistoryRows([]);
      return;
    }

    const productId = Number(entry.productId);
    const entryWarehouseId = entry.warehouseId !== null && entry.warehouseId !== undefined ? Number(entry.warehouseId) : undefined;
    const historyType = entry.type;

    let cancelled = false;
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await getProductDocumentHistoryAction({
          productId,
          warehouseId: Number.isFinite(entryWarehouseId) && (entryWarehouseId ?? 0) > 0 ? entryWarehouseId : undefined,
          type: historyType,
          limit: 50,
        });
        if (cancelled) return;
        if (res.error) {
          setHistoryRows([]);
          setHistoryError(res.error);
          return;
        }
        setHistoryRows(res.data ?? []);
      } catch (e: any) {
        if (cancelled) return;
        setHistoryRows([]);
        setHistoryError(e?.message ?? "No se pudo cargar el historial");
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [open, entry?.productId, entry?.warehouseId, entry?.type]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalles del movimiento</SheetTitle>
        </SheetHeader>

        {!entry ? (
          <div className="pt-4 text-sm text-muted-foreground">Selecciona un movimiento.</div>
        ) : (
          <div className="pt-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="movement">Movimiento</TabsTrigger>
                <TabsTrigger value="document">Documentos</TabsTrigger>
              </TabsList>

              <TabsContent value="movement">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Producto</div>
                    <div className="font-medium break-words">{productLabel}</div>
                    <div className="text-xs text-muted-foreground">ID {entry.productId}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Fecha</div>
                      <div className="text-sm">{entry.date ? formatDateTimeInBogota(entry.date) : ""}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Tipo</div>
                      <div className="text-sm">{labelType(entry.type)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Bodega</div>
                      <div className="text-sm">{entry.warehouseName ?? (entry.warehouseId ? `#${entry.warehouseId}` : "—")}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Usuario</div>
                      <div className="text-sm">{entry.userName ?? (entry.userId ? `ID ${entry.userId}` : "—")}</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Δ</div>
                      <div className={`text-sm font-medium ${signedQty > 0 ? "text-emerald-700" : signedQty < 0 ? "text-red-700" : ""}`}>
                        {`${signedQty > 0 ? "+" : ""}${fmtNumber(signedQty)}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Antes</div>
                      <div className="text-sm">{fmtNumber(before)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Saldo</div>
                      <div className="text-sm font-medium">{fmtNumber(entry.balance)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Stock actual (bodega)</div>
                      <div className="text-sm">{entry.currentStock === null || entry.currentStock === undefined ? "—" : fmtNumber(entry.currentStock)}</div>
                    </div>
                    <div />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Costo unitario</div>
                      <div className="text-sm">{fmtMoney(entry.unitCost) || "—"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Costo total</div>
                      <div className="text-sm">{fmtMoney(entry.totalCost) || "—"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Precio unitario</div>
                      <div className="text-sm">{fmtMoney(entry.unitPrice) || "—"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Precio total</div>
                      <div className="text-sm">{fmtMoney(entry.totalPrice) || "—"}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm text-muted-foreground">Total después de descuento</div>
                      <div className="text-sm">{fmtMoney(entry.totalPriceAfterDiscount) || "—"}</div>
                    </div>
                  </div>

                  {entry.note ? (
                    <>
                      <Separator />
                      <div>
                        <div className="text-sm text-muted-foreground">Nota / Motivo</div>
                        <div className="text-sm whitespace-pre-wrap break-words">{entry.note}</div>
                      </div>
                    </>
                  ) : null}

                  <div className="pt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild variant="outline">
                        <Link
                          href={`/inventory?q=${encodeURIComponent(String(entry.productCode ?? entry.productName ?? "").trim())}`}
                        >
                          Buscar producto
                        </Link>
                      </Button>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={sendingLabel}
                              onClick={async () => {
                                if (!entry) return;
                                const productId = Number(entry.productId);
                                if (!Number.isFinite(productId) || productId <= 0) return;

                                const qty = clampQty(labelQty);

                                setSendingLabel(true);
                                try {
                                  const name = String(entry.productName ?? "").trim() || `#${productId}`;
                                  const reference = entry.productCode ? String(entry.productCode) : null;
                                  const primaryBarcode = (reference ?? String(productId)).toString();

                                  const res = await createPrintLabelRequest([
                                    {
                                      productId,
                                      qty,
                                      name,
                                      reference,
                                      measurementUnit: null,
                                      productCreatedAt: null,
                                      primaryBarcode,
                                    },
                                  ]);

                                  if (res.error || !res.data) throw new Error(res.error ?? "No se pudo crear la petición");

                                  toast({
                                    title: "Enviado a etiquetas",
                                    description: `Se creó una petición (${qty} ${qty === 1 ? "unidad" : "unidades"}) para ${name}.`,
                                  });
                                } catch (e: any) {
                                  toast({
                                    variant: "destructive",
                                    title: "Error",
                                    description: e?.message ?? "No se pudo enviar a etiquetas",
                                  });
                                } finally {
                                  setSendingLabel(false);
                                }
                              }}
                              aria-label="Enviar a etiquetas"
                            >
                              <Tag className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Enviar a etiquetas</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <div className="flex items-center gap-1 rounded-md border bg-background px-1 py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={sendingLabel}
                          onClick={() => setLabelQty((q) => clampQty((q ?? 1) - 1))}
                          aria-label="Disminuir cantidad"
                          title="Disminuir"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>

                        <Input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          className="h-8 w-16 text-center"
                          value={labelQty}
                          disabled={sendingLabel}
                          onChange={(e) => setLabelQty(clampQty(e.target.value))}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={sendingLabel}
                          onClick={() => setLabelQty((q) => clampQty((q ?? 1) + 1))}
                          aria-label="Aumentar cantidad"
                          title="Aumentar"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <Button asChild variant="ghost">
                        <Link href="/print-labels/products">Ver peticiones</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="document">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Documento actual</div>
                    <div className="font-medium">{docLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.documentId ? `ID ${entry.documentId}` : ""}
                      {entry.documentItemId ? ` · Item ${entry.documentItemId}` : ""}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Fecha</div>
                      <div className="text-sm">{entry.date ? formatDateTimeInBogota(entry.date) : ""}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Precio (en ese documento)</div>
                      <div className="text-sm">{fmtMoney(entry.unitPrice) || "—"}</div>
                    </div>
                  </div>

                  {entry.documentId ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!onOpenDocument) return;
                          onOpenDocument({ documentId: Number(entry.documentId), documentNumber: entry.documentNumber, view: "print" });
                        }}
                      >
                        Imprimir
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!onOpenDocument) return;
                          onOpenDocument({ documentId: Number(entry.documentId), documentNumber: entry.documentNumber, view: "pdf" });
                        }}
                      >
                        Ver PDF
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Este movimiento no tiene documento origen.</div>
                  )}

                  <Separator />

                  <div>
                    <div className="text-sm text-muted-foreground">Historial de documentos (producto)</div>
                    <div className="text-xs text-muted-foreground">
                      {entry?.type === "ENTRADA"
                        ? "Entradas anteriores (más reciente primero)."
                        : entry?.type === "SALIDA"
                          ? "Salidas anteriores (más reciente primero)."
                          : "No aplica."}
                      {Number.isFinite(Number(entry?.warehouseId)) && Number(entry?.warehouseId) > 0 ? " · Misma bodega" : ""}
                    </div>
                  </div>

                  {entry?.type === "AJUSTE" ? (
                    <div className="text-sm text-muted-foreground">El historial no aplica para movimientos tipo ajuste/creado.</div>
                  ) : historyLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-2/3" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : historyError ? (
                    <div className="text-sm text-muted-foreground">{historyError}</div>
                  ) : historyRows.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sin historial de documentos para este producto.</div>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">Fecha</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead className="text-right w-[160px]">Precio</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyRows.map((r) => {
                            const label = r.documentNumber ?? `#${r.documentId}`;
                            const isEntrada = r.type === "ENTRADA";
                            const toneRow = isEntrada ? "bg-emerald-50/60" : "bg-red-50/60";
                            const toneText = isEntrada ? "text-emerald-800" : "text-red-800";
                            return (
                              <TableRow key={r.documentId} className={toneRow}>
                                <TableCell className="text-sm">
                                  {r.date ? formatDateTimeInBogota(r.date) : ""}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className={`text-sm font-medium break-words ${toneText}`}>{label}</div>
                                      <div className={`text-xs ${toneText} opacity-80`}>
                                        {`ID ${r.documentId}`}
                                        {r.documentItemId ? ` · Item ${r.documentItemId}` : ""}
                                      </div>
                                    </div>

                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (!onOpenDocument) return;
                                        onOpenDocument({ documentId: r.documentId, documentNumber: r.documentNumber, view: "pdf" });
                                      }}
                                    >
                                      Abrir
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {fmtMoney(r.unitPrice) || "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
