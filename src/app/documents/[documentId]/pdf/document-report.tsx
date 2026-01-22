"use client";

import * as React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatDateInBogota, formatDateTimeInBogota } from "@/lib/datetime";

import type { DocumentDetails } from "@/actions/get-document-details";

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#000",
  },
  header: {
    textAlign: "center",
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
  },
  h1: { fontSize: 14, fontWeight: 700 },
  h2: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  sub: { fontSize: 9, marginTop: 2 },

  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 4,
  },

  grid: {
    flexDirection: "row",
    gap: 8,
  },
  box: {
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    padding: 6,
    flexGrow: 1,
  },
  boxLabel: { fontSize: 8, color: "#222" },
  boxValue: { fontSize: 10, fontWeight: 700 },

  table: {
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
  },
  tr: {
    flexDirection: "row",
  },
  th: {
    fontWeight: 700,
    backgroundColor: "#f2f2f2",
  },
  cell: {
    borderRightWidth: 1,
    borderRightColor: "#000",
    borderRightStyle: "solid",
    paddingVertical: 3,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  lastCell: {
    borderRightWidth: 0,
  },
  right: { textAlign: "right" },

  footerTotals: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#000",
    borderTopStyle: "solid",
    paddingTop: 6,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  bold: { fontWeight: 700 },
});

function money(value: number) {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(safe);
}

function pct(value: number) {
  const n = Number(value ?? 0);
  return `${Number.isFinite(n) ? n.toFixed(2) : "0.00"}%`;
}

function formatInternalNote(note: unknown): { kind: "empty" | "text" | "json"; value: string } {
  const raw = String(note ?? "").trim();
  if (!raw) return { kind: "empty", value: "" };
  const looksJson = raw.startsWith("{") || raw.startsWith("[");
  if (!looksJson) return { kind: "text", value: raw };
  try {
    JSON.parse(raw);
    return { kind: "json", value: raw };
  } catch {
    return { kind: "text", value: raw };
  }
}

export function DocumentReportPdf({ details }: { details: DocumentDetails }) {
  const templateKey = String(details.documenttypeprinttemplate ?? "").trim();
  const categoryId = Number((details as any).documenttypecategoryid ?? 0) || 0;
  const terceroLabel = categoryId === 2 ? "Cliente" : categoryId === 1 ? "Proveedor" : "Tercero";

  const cfg: any = details.liquidation?.config ?? {};
  const totals: any = details.liquidation?.result?.totals ?? {};
  const lines: any[] = details.liquidation?.result?.lines ?? [];

  const freightNameById = new Map<string, string>();
  for (const f of (cfg.freightRates ?? []) as any[]) {
    freightNameById.set(String(f.id), String(f.name ?? f.id));
  }

  const rawHeaderDate = categoryId === 1
    ? (details.stockdate ? String(details.stockdate) : details.date)
    : details.date;

  const headerDate = !rawHeaderDate
    ? ""
    : String(rawHeaderDate).includes("T")
      ? formatDateTimeInBogota(String(rawHeaderDate))
      : formatDateInBogota(String(rawHeaderDate));

  const internalNote = formatInternalNote((details as any).internalnote);

  const hasDiscounts = Boolean(cfg.discountsEnabled) && (lines ?? []).some((l) => Number(l.discountPercentage ?? 0) > 0);

  function InfoHeader() {
    return (
      <>
        <Text style={styles.sectionTitle}>Información</Text>
        <View style={styles.grid}>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>{terceroLabel}</Text>
            <Text style={styles.boxValue}>{details.customername ?? "—"}</Text>
            {details.customertaxnumber ? (
              <Text style={styles.boxLabel}>NIT/CC: {details.customertaxnumber}</Text>
            ) : null}
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Tipo</Text>
            <Text style={styles.boxValue}>{details.documenttypename}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Almacén</Text>
            <Text style={styles.boxValue}>{details.warehousename}</Text>
          </View>
          {details.note ? (
            <View style={styles.box}>
              <Text style={styles.boxLabel}>Nota</Text>
              <Text style={styles.boxValue}>{String(details.note)}</Text>
            </View>
          ) : null}
        </View>
      </>
    );
  }

  function PurchaseLiquidationSection() {
    return (
      <>
        <Text style={styles.sectionTitle}>Configuración General</Text>
        <View style={styles.grid}>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>IVA</Text>
            <Text style={styles.boxValue}>{pct(Number(cfg.ivaPercentage ?? 0))}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>IVA incluido en costo</Text>
            <Text style={styles.boxValue}>{cfg.ivaIncludedInCost ? "Sí" : "No"}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Fletes</Text>
            <Text style={styles.boxValue}>
              {cfg.useMultipleFreights
                ? money(Number(totals.totalFreight ?? 0))
                : money(Number((cfg.freightRates?.[0]?.cost ?? totals.totalFreight) ?? 0))}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Detalle de Productos</Text>
        <View style={styles.table}>
          <View style={[styles.tr, styles.th]}>
            <View style={[styles.cell, { width: 18 }]}>
              <Text>#</Text>
            </View>
            <View style={[styles.cell, { width: 140 }]}>
              <Text>Producto</Text>
            </View>
            <View style={[styles.cell, { width: 58 }]}>
              <Text>Ref. Compra</Text>
            </View>
            <View style={[styles.cell, { width: 58 }]}>
              <Text>Ref. Bodega</Text>
            </View>
            <View style={[styles.cell, { width: 30 }]}>
              <Text>Cant.</Text>
            </View>
            <View style={[styles.cell, { width: 55 }]}>
              <Text>Total</Text>
            </View>
            {hasDiscounts && (
              <View style={[styles.cell, { width: 28 }]}>
                <Text>Desc%</Text>
              </View>
            )}
            <View style={[styles.cell, { width: 55 }]}>
              <Text>Unit Base</Text>
            </View>
            <View style={[styles.cell, { width: 55 }]}>
              <Text>-Desc</Text>
            </View>
            <View style={[styles.cell, { width: 55 }]}>
              <Text>+IVA</Text>
            </View>
            <View style={[styles.cell, { width: 55 }]}>
              <Text>+Flete</Text>
            </View>
            <View style={[styles.cell, { width: 55 }]}>
              <Text>Unit Final</Text>
            </View>
            <View style={[styles.cell, { width: 32 }]}>
              <Text>Marg%</Text>
            </View>
            <View style={[styles.cell, { width: 55 }]}>
              <Text>Venta Unit</Text>
            </View>
            <View style={[styles.cell, { width: 60 }, styles.lastCell]}>
              <Text>Flete</Text>
            </View>
          </View>

          {(lines ?? []).map((l: any, idx: number) => {
            const freightName = freightNameById.get(String(l.freightId ?? "")) ?? "";
            return (
              <View key={String(l.id ?? idx)} style={styles.tr}>
                <View style={[styles.cell, { width: 18 }]}>
                  <Text style={styles.right}>{idx + 1}</Text>
                </View>
                <View style={[styles.cell, { width: 140 }]}>
                  <Text>{String(l.name ?? "")}</Text>
                </View>
                <View style={[styles.cell, { width: 58 }]}>
                  <Text>{String(l.purchaseReference ?? "")}</Text>
                </View>
                <View style={[styles.cell, { width: 58 }]}>
                  <Text>{String(l.warehouseReference ?? "")}</Text>
                </View>
                <View style={[styles.cell, { width: 30 }]}>
                  <Text style={styles.right}>{String(Number(l.quantity ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 55 }]}>
                  <Text style={styles.right}>{money(Number(l.totalCost ?? 0))}</Text>
                </View>
                {hasDiscounts && (
                  <View style={[styles.cell, { width: 28 }]}>
                    <Text style={styles.right}>{String(Number(l.discountPercentage ?? 0))}</Text>
                  </View>
                )}
                <View style={[styles.cell, { width: 55 }]}>
                  <Text style={styles.right}>{money(Number(l.unitCost ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 55 }]}>
                  <Text style={styles.right}>{money(Number(l.unitDiscount ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 55 }]}>
                  <Text style={styles.right}>{money(Number(l.unitIVA ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 55 }]}>
                  <Text style={styles.right}>{money(Number(l.unitFreight ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 55 }]}>
                  <Text style={styles.right}>{money(Number(l.unitFinalCost ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 32 }]}>
                  <Text style={styles.right}>{String(Number(l.marginPercentage ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 55 }]}>
                  <Text style={styles.right}>{money(Number(l.unitSalePrice ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 60 }, styles.lastCell]}>
                  <Text>{freightName}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.footerTotals}>
          <View style={styles.totalsRow}>
            <Text>Costo Total de Compra:</Text>
            <Text style={styles.bold}>{money(Number(totals.totalPurchaseCost ?? 0))}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Descuento Total Aplicado:</Text>
            <Text style={styles.bold}>{money(Number(totals.totalDiscount ?? 0))}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>IVA Total:</Text>
            <Text style={styles.bold}>{money(Number(totals.totalIVA ?? 0))}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Flete Distribuido:</Text>
            <Text style={styles.bold}>{money(Number(totals.totalFreight ?? 0))}</Text>
          </View>

          <View style={{ marginTop: 6 }} />
          <View style={styles.totalsRow}>
            <Text style={styles.bold}>TOTAL COSTO:</Text>
            <Text style={styles.bold}>{money(Number(totals.totalFinalCost ?? 0))}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.bold}>PRECIO DE VENTA TOTAL:</Text>
            <Text style={styles.bold}>{money(Number(totals.totalSalePrice ?? 0))}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.bold}>GANANCIA PROYECTADA:</Text>
            <Text style={styles.bold}>{money(Number(totals.totalProfit ?? 0))}</Text>
          </View>
        </View>
      </>
    );
  }

  function InternalNoteSection() {
    if (categoryId !== 1) return null;
    if (internalNote.kind === "empty") return null;
    return (
      <>
        <Text style={styles.sectionTitle}>InternalNote</Text>
        <View style={styles.box}>
          <Text style={styles.boxLabel}>
            {internalNote.kind === "json" ? "Snapshot interno guardado (JSON)." : "Nota interna"}
          </Text>
          {internalNote.kind === "json" ? (
            <Text>Ver detalle en el sistema.</Text>
          ) : (
            <Text>{internalNote.value}</Text>
          )}
        </View>
      </>
    );
  }

  function GenericItemsSection(opts: { title: string }) {
    const items = details.items ?? [];
    const hasTax = items.some((it) => Number(it.taxamount ?? 0) > 0);

    return (
      <>
        <Text style={styles.sectionTitle}>{opts.title}</Text>
        <View style={styles.table}>
          <View style={[styles.tr, styles.th]}>
            <View style={[styles.cell, { width: 18 }]}>
              <Text>#</Text>
            </View>
            <View style={[styles.cell, { width: 220 }]}>
              <Text>Producto</Text>
            </View>
            <View style={[styles.cell, { width: 40 }]}>
              <Text>Cant.</Text>
            </View>
            <View style={[styles.cell, { width: 70 }]}>
              <Text>Unit</Text>
            </View>
            {hasTax && (
              <View style={[styles.cell, { width: 70 }]}>
                <Text>IVA</Text>
              </View>
            )}
            <View style={[styles.cell, { width: 80 }, styles.lastCell]}>
              <Text>Total</Text>
            </View>
          </View>

          {items.map((it, idx) => (
            <View key={String(it.id ?? idx)} style={styles.tr}>
              <View style={[styles.cell, { width: 18 }]}>
                <Text style={styles.right}>{idx + 1}</Text>
              </View>
              <View style={[styles.cell, { width: 220 }]}>
                <Text>{String(it.productname ?? "")}</Text>
              </View>
              <View style={[styles.cell, { width: 40 }]}>
                <Text style={styles.right}>{String(Number(it.quantity ?? 0))}</Text>
              </View>
              <View style={[styles.cell, { width: 70 }]}>
                <Text style={styles.right}>{money(Number(it.price ?? 0))}</Text>
              </View>
              {hasTax && (
                <View style={[styles.cell, { width: 70 }]}>
                  <Text style={styles.right}>{money(Number(it.taxamount ?? 0))}</Text>
                </View>
              )}
              <View style={[styles.cell, { width: 80 }, styles.lastCell]}>
                <Text style={styles.right}>{money(Number(it.total ?? 0))}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footerTotals}>
          <View style={styles.totalsRow}>
            <Text style={styles.bold}>TOTAL:</Text>
            <Text style={styles.bold}>{money(Number(details.total ?? 0))}</Text>
          </View>
        </View>
      </>
    );
  }

  function SaleSection() {
    const items = details.items ?? [];
    const payments = details.payments ?? [];
    const posTotals = (details as any).posSaleTotals as
      | { ivaPercentage: number; grossTotal: number; netTotal: number; ivaTotal: number }
      | undefined;

    const hasTax = items.some((it) => Number(it.taxamount ?? 0) > 0);

    const subtotal = items.reduce((sum, it) => sum + (Number(it.total ?? 0) || 0), 0);
    const taxTotal = items.reduce((sum, it) => sum + (Number(it.taxamount ?? 0) || 0), 0);
    const computedTotal = subtotal + taxTotal;

    const paidTotal = payments.reduce((sum, p) => sum + (Number((p as any).amount ?? 0) || 0), 0);
    const balance = computedTotal - paidTotal;

    return (
      <>
        <Text style={styles.sectionTitle}>Detalle de Venta</Text>

        <View style={styles.table}>
          <View style={[styles.tr, styles.th]}>
            <View style={[styles.cell, { width: 18 }]}>
              <Text>#</Text>
            </View>
            <View style={[styles.cell, { width: 170 }]}>
              <Text>Producto</Text>
            </View>
            <View style={[styles.cell, { width: 50 }]}>
              <Text>Cód.</Text>
            </View>
            <View style={[styles.cell, { width: 36 }]}>
              <Text>Cant.</Text>
            </View>
            <View style={[styles.cell, { width: 68 }]}>
              <Text>Unit</Text>
            </View>
            {hasTax && (
              <View style={[styles.cell, { width: 58 }]}>
                <Text>IVA</Text>
              </View>
            )}
            <View style={[styles.cell, { width: 72 }, styles.lastCell]}>
              <Text>Total</Text>
            </View>
          </View>

          {items.map((it, idx) => (
            <View key={String(it.id ?? idx)} style={styles.tr}>
              <View style={[styles.cell, { width: 18 }]}>
                <Text style={styles.right}>{idx + 1}</Text>
              </View>
              <View style={[styles.cell, { width: 170 }]}>
                <Text>{String(it.productname ?? "")}</Text>
              </View>
              <View style={[styles.cell, { width: 50 }]}>
                <Text>{String(it.productcode ?? "")}</Text>
              </View>
              <View style={[styles.cell, { width: 36 }]}>
                <Text style={styles.right}>{String(Number(it.quantity ?? 0))}</Text>
              </View>
              <View style={[styles.cell, { width: 68 }]}>
                <Text style={styles.right}>{money(Number(it.price ?? 0))}</Text>
              </View>
              {hasTax && (
                <View style={[styles.cell, { width: 58 }]}>
                  <Text style={styles.right}>{money(Number(it.taxamount ?? 0))}</Text>
                </View>
              )}
              <View style={[styles.cell, { width: 72 }, styles.lastCell]}>
                <Text style={styles.right}>{money(Number(it.total ?? 0))}</Text>
              </View>
            </View>
          ))}
        </View>

        {payments.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Pagos</Text>
            <View style={styles.table}>
              <View style={[styles.tr, styles.th]}>
                <View style={[styles.cell, { width: 18 }]}>
                  <Text>#</Text>
                </View>
                <View style={[styles.cell, { width: 180 }]}>
                  <Text>Método</Text>
                </View>
                <View style={[styles.cell, { width: 96 }]}>
                  <Text>Fecha</Text>
                </View>
                <View style={[styles.cell, { width: 80 }, styles.lastCell]}>
                  <Text>Valor</Text>
                </View>
              </View>
              {payments.map((p, idx) => (
                <View key={String((p as any).id ?? idx)} style={styles.tr}>
                  <View style={[styles.cell, { width: 18 }]}>
                    <Text style={styles.right}>{idx + 1}</Text>
                  </View>
                  <View style={[styles.cell, { width: 180 }]}>
                    <Text>{String((p as any).paymenttypename ?? "")}</Text>
                  </View>
                  <View style={[styles.cell, { width: 96 }]}>
                    <Text>{String((p as any).date ?? "")}</Text>
                  </View>
                  <View style={[styles.cell, { width: 80 }, styles.lastCell]}>
                    <Text style={styles.right}>{money(Number((p as any).amount ?? 0))}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.footerTotals}>
          <View style={styles.totalsRow}>
            <Text>Subtotal:</Text>
            <Text style={styles.bold}>{money(subtotal)}</Text>
          </View>
          {posTotals && Number(posTotals.ivaPercentage ?? 0) > 0 ? (
            <>
              <View style={styles.totalsRow}>
                <Text>Venta neta:</Text>
                <Text style={styles.bold}>{money(Number(posTotals.netTotal ?? 0))}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text>IVA incluido ({pct(Number(posTotals.ivaPercentage ?? 0))}):</Text>
                <Text style={styles.bold}>{money(Number(posTotals.ivaTotal ?? 0))}</Text>
              </View>
            </>
          ) : null}
          {hasTax && (
            <View style={styles.totalsRow}>
              <Text>IVA (informativo):</Text>
              <Text style={styles.bold}>{money(taxTotal)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text>Total (documento):</Text>
            <Text style={styles.bold}>{money(Number(details.total ?? 0))}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Total (subtotal + IVA):</Text>
            <Text style={styles.bold}>{money(computedTotal)}</Text>
          </View>
          {payments.length > 0 ? (
            <>
              <View style={styles.totalsRow}>
                <Text>Pagado:</Text>
                <Text style={styles.bold}>{money(paidTotal)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text>Saldo:</Text>
                <Text style={styles.bold}>{money(balance)}</Text>
              </View>
            </>
          ) : null}
        </View>
      </>
    );
  }

  function InvoiceSection() {
    const items = details.items ?? [];
    const hasTax = items.some((it) => Number(it.taxamount ?? 0) > 0);
    const posTotals = (details as any).posSaleTotals as
      | { ivaPercentage: number; grossTotal: number; netTotal: number; ivaTotal: number }
      | undefined;

    const subtotal = items.reduce((sum, it) => sum + (Number(it.total ?? 0) || 0), 0);
    const taxTotal = items.reduce((sum, it) => sum + (Number(it.taxamount ?? 0) || 0), 0);

    return (
      <>
        {GenericItemsSection({ title: "Detalle de Factura" })}

        <View style={styles.footerTotals}>
          <View style={styles.totalsRow}>
            <Text>Subtotal:</Text>
            <Text style={styles.bold}>{money(subtotal)}</Text>
          </View>
          {posTotals && Number(posTotals.ivaPercentage ?? 0) > 0 ? (
            <>
              <View style={styles.totalsRow}>
                <Text>Venta neta:</Text>
                <Text style={styles.bold}>{money(Number(posTotals.netTotal ?? 0))}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text>IVA incluido ({pct(Number(posTotals.ivaPercentage ?? 0))}):</Text>
                <Text style={styles.bold}>{money(Number(posTotals.ivaTotal ?? 0))}</Text>
              </View>
            </>
          ) : hasTax ? (
            <View style={styles.totalsRow}>
              <Text>IVA:</Text>
              <Text style={styles.bold}>{money(taxTotal)}</Text>
            </View>
          ) : null}
          <View style={styles.totalsRow}>
            <Text style={styles.bold}>TOTAL:</Text>
            <Text style={styles.bold}>{money(Number(details.total ?? 0))}</Text>
          </View>
        </View>
      </>
    );
  }

  function BodyByTemplate() {
    switch (templateKey) {
      case "Purchase":
        return PurchaseLiquidationSection();
      case "Sale":
        return SaleSection();
      case "Invoice":
        return InvoiceSection();
      case "Proforma":
        return GenericItemsSection({ title: "Detalle de Productos" });
      case "Refund":
        return GenericItemsSection({ title: "Detalle de Productos (Devolución)" });
      case "InventoryCount":
        return GenericItemsSection({ title: "Detalle de Productos (Conteo)" });
      case "LossAndDamage":
        return GenericItemsSection({ title: "Detalle de Productos (Merma/Daño)" });
      case "StockReturn":
        return GenericItemsSection({ title: "Detalle de Productos (Devolución de stock)" });
      default:
        // If the document has liquidation info, prefer that view.
        if (details.liquidation?.result?.lines?.length) return PurchaseLiquidationSection();
        return GenericItemsSection({ title: "Detalle de Productos" });
    }
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.sub}>{formatDateTimeInBogota(new Date())}</Text>
          <Text style={styles.sub}>Reporte - Tracto Agrícola</Text>
          <Text style={styles.h1}>TRACTO AGRÍCOLA</Text>
          <Text style={styles.h2}>{details.documenttypename}</Text>
          <Text style={styles.sub}>Documento: {details.number} · Fecha: {headerDate}</Text>
        </View>

        <InfoHeader />
        <BodyByTemplate />
        <InternalNoteSection />
      </Page>
    </Document>
  );
}
