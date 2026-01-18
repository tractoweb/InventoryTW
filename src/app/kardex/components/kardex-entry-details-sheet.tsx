"use client";

import * as React from "react";
import Link from "next/link";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { formatDateTimeInBogota } from "@/lib/datetime";

import type { KardexEntryRow } from "@/actions/get-kardex-entries";

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
  return "Ajuste";
}

export function KardexEntryDetailsSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: KardexEntryRow | null;
  defaultTab?: "movement" | "document";
  onOpenDocument?: (args: { entry: KardexEntryRow; view: "pdf" | "print" }) => void;
}) {
  const { open, onOpenChange, entry, defaultTab = "movement", onOpenDocument } = props;
  const [tab, setTab] = React.useState<"movement" | "document">(defaultTab);

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
                <TabsTrigger value="document">Documento</TabsTrigger>
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
                    <Button asChild variant="outline">
                      <Link
                        href={`/inventory?q=${encodeURIComponent(String(entry.productCode ?? entry.productName ?? "").trim())}`}
                      >
                        Buscar producto
                      </Link>
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="document">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Documento</div>
                    <div className="font-medium">{docLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.documentId ? `ID ${entry.documentId}` : ""}
                      {entry.documentItemId ? ` · Item ${entry.documentItemId}` : ""}
                    </div>
                  </div>

                  {entry.documentId ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!onOpenDocument) return;
                          onOpenDocument({ entry, view: "print" });
                        }}
                      >
                        Imprimir
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!onOpenDocument) return;
                          onOpenDocument({ entry, view: "pdf" });
                        }}
                      >
                        Ver PDF
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Este movimiento no tiene documento origen.</div>
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
