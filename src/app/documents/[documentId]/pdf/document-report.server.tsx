import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

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

export function DocumentReportPdfServer({ details }: { details: DocumentDetails }) {
  const cfg: any = details.liquidation?.config ?? {};
  const totals: any = details.liquidation?.result?.totals ?? {};
  const lines: any[] = details.liquidation?.result?.lines ?? [];

  const freightNameById = new Map<string, string>();
  for (const f of (cfg.freightRates ?? []) as any[]) {
    freightNameById.set(String(f.id), String(f.name ?? f.id));
  }

  const headerDate = details.stockdate ? String(details.stockdate) : details.date;
  const internalNote = formatInternalNote((details as any).internalnote);
  const hasDiscounts = Boolean(cfg.discountsEnabled) && (lines ?? []).some((l) => Number(l.discountPercentage ?? 0) > 0);

  function InfoHeader() {
    return (
      <>
        <Text style={styles.sectionTitle}>Información</Text>
        <View style={styles.grid}>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Tercero</Text>
            <Text style={styles.boxValue}>{details.customername ?? "—"}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Tipo</Text>
            <Text style={styles.boxValue}>{details.documenttypename}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Almacén</Text>
            <Text style={styles.boxValue}>{details.warehousename}</Text>
          </View>
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
                    <Text style={styles.right}>{Number(l.discountPercentage ?? 0) ? String(Number(l.discountPercentage ?? 0).toFixed(0)) : ""}</Text>
                  </View>
                )}
                <View style={[styles.cell, { width: 55 }]}>
                  <Text style={styles.right}>{money(Number(l.unitCostBase ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 55 }]}>
                  <Text style={styles.right}>{money(Number(l.discountAmount ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 55 }]}>
                  <Text style={styles.right}>{money(Number(l.ivaAmount ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 55 }]}>
                  <Text style={styles.right}>{money(Number(l.freightAmount ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 55 }]}>
                  <Text style={styles.right}>{money(Number(l.unitCostFinal ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 32 }]}>
                  <Text style={styles.right}>{String(Number(l.marginPercentage ?? 0).toFixed(0))}</Text>
                </View>
                <View style={[styles.cell, { width: 55 }]}>
                  <Text style={styles.right}>{money(Number(l.unitSalePrice ?? 0))}</Text>
                </View>
                <View style={[styles.cell, { width: 60 }, styles.lastCell]}>
                  <Text>
                    {freightName ? `${freightName}: ${money(Number(l.freightAmount ?? 0))}` : ""}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.footerTotals}>
          <View style={styles.totalsRow}>
            <Text>Total Costo de Compra:</Text>
            <Text style={styles.bold}>{money(Number(totals.totalPurchaseCost ?? 0))}</Text>
          </View>
          {hasDiscounts && (
            <View style={styles.totalsRow}>
              <Text>Descuento Total Aplicado:</Text>
              <Text style={styles.bold}>{money(Number(totals.totalDiscount ?? 0))}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text>IVA Total:</Text>
            <Text style={styles.bold}>{money(Number(totals.totalIva ?? 0))}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Flete Distribuido:</Text>
            <Text style={styles.bold}>{money(Number(totals.totalFreight ?? 0))}</Text>
          </View>
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
            <Text style={styles.bold}>{money(Number(totals.projectedProfit ?? 0))}</Text>
          </View>
        </View>

        {internalNote.kind !== "empty" && (
          <>
            <Text style={styles.sectionTitle}>InternalNote</Text>
            <View style={styles.box}>
              <Text>{internalNote.value}</Text>
            </View>
          </>
        )}
      </>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.h1}>TRACTO AGRÍCOLA</Text>
          <Text style={styles.h2}>{details.documenttypename}</Text>
          <Text style={styles.sub}>Documento: {details.number} · Fecha: {headerDate}</Text>
        </View>

        <InfoHeader />
        <PurchaseLiquidationSection />
      </Page>
    </Document>
  );
}
