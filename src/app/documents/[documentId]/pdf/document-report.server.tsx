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
  trRow: {
    flexDirection: "row",
    width: "100%",
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

  colIndex: { width: 18 },
  colProduct: { flexGrow: 1, flexShrink: 1 },
  colQty: { width: 34 },
  colMoney: { width: 62 },
  colSmall: { width: 48 },

  productName: { fontWeight: 700 },
  productMeta: { fontSize: 8, color: "#222", marginTop: 1 },

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
          <View style={[styles.trRow, styles.th]}>
            <View style={[styles.cell, styles.colIndex]}>
              <Text>#</Text>
            </View>
            <View style={[styles.cell, styles.colProduct]}>
              <Text>Producto / Detalle</Text>
            </View>
            <View style={[styles.cell, styles.colQty]}>
              <Text>Cant.</Text>
            </View>
            <View style={[styles.cell, styles.colMoney]}>
              <Text>Total</Text>
            </View>
            <View style={[styles.cell, styles.colMoney]}>
              <Text>Unit Final</Text>
            </View>
            <View style={[styles.cell, styles.colMoney]}>
              <Text>Venta Unit</Text>
            </View>
            <View style={[styles.cell, styles.colSmall, styles.lastCell]}>
              <Text>Marg%</Text>
            </View>
          </View>

          {(lines ?? []).map((l: any, idx: number) => {
            const freightName = freightNameById.get(String(l.freightId ?? "")) ?? "";
            const metaBits: string[] = [];
            const purchaseRef = String(l.purchaseReference ?? "").trim();
            const warehouseRef = String(l.warehouseReference ?? "").trim();
            if (purchaseRef) metaBits.push(`Ref. Compra: ${purchaseRef}`);
            if (warehouseRef) metaBits.push(`Ref. Bodega: ${warehouseRef}`);

            const discPct = Number(l.discountPercentage ?? 0);
            const discAmt = Number(l.discountAmount ?? 0);
            if (hasDiscounts && (discPct > 0 || discAmt > 0)) {
              metaBits.push(`Desc: ${discPct ? `${discPct.toFixed(0)}%` : ""}${discAmt ? ` (${money(discAmt)})` : ""}`.trim());
            }

            const ivaAmt = Number(l.ivaAmount ?? 0);
            if (ivaAmt) metaBits.push(`IVA: ${money(ivaAmt)}`);

            const freightAmt = Number(l.freightAmount ?? 0);
            if (freightName || freightAmt) metaBits.push(`Flete: ${freightName ? `${freightName} ` : ""}${money(freightAmt)}`.trim());

            const metaLine = metaBits.join(" · ");

            return (
              <View key={String(l.id ?? idx)} style={styles.trRow} wrap={false}>
                <View style={[styles.cell, styles.colIndex]}>
                  <Text style={styles.right}>{idx + 1}</Text>
                </View>
                <View style={[styles.cell, styles.colProduct]}>
                  <Text style={styles.productName}>{String(l.name ?? "")}</Text>
                  {metaLine ? <Text style={styles.productMeta}>{metaLine}</Text> : null}
                </View>
                <View style={[styles.cell, styles.colQty]}>
                  <Text style={styles.right}>{String(Number(l.quantity ?? 0))}</Text>
                </View>
                <View style={[styles.cell, styles.colMoney]}>
                  <Text style={styles.right}>{money(Number(l.totalCost ?? 0))}</Text>
                </View>
                <View style={[styles.cell, styles.colMoney]}>
                  <Text style={styles.right}>{money(Number(l.unitCostFinal ?? 0))}</Text>
                </View>
                <View style={[styles.cell, styles.colMoney]}>
                  <Text style={styles.right}>{money(Number(l.unitSalePrice ?? 0))}</Text>
                </View>
                <View style={[styles.cell, styles.colSmall, styles.lastCell]}>
                  <Text style={styles.right}>{String(Number(l.marginPercentage ?? 0).toFixed(0))}</Text>
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
