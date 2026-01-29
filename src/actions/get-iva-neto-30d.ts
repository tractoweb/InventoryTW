"use server";

import { DOCUMENT_STOCK_DIRECTION, formatAmplifyError, normalizeStockDirection } from "@/lib/amplify-config";
import { amplifyClient } from "@/lib/amplify-server";
import { BOGOTA_TIME_ZONE, ymdToBogotaMidnightUtc } from "@/lib/datetime";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { cached } from "@/lib/server-cache";
import { listAllPages } from "@/services/amplify-list-all";

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function looksLikeIvaTax(tax: any): boolean {
  const name = String(tax?.name ?? "").toUpperCase();
  const code = String(tax?.code ?? "").toUpperCase();
  return name.includes("IVA") || code.includes("IVA");
}

function inferPricesIncludeIvaForDoc(args: { doc: any; direction: number }): boolean {
  // POS sales in this app display "IVA incluido", so treat OUT documents as IVA-included.
  if (args.direction === DOCUMENT_STOCK_DIRECTION.OUT) return true;

  // Purchases (IN) depend on how liquidation was configured; default to included (common invoice pricing).
  if (args.direction === DOCUMENT_STOCK_DIRECTION.IN) {
    const raw = args.doc?.internalNote;
    if (typeof raw === "string" && raw.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        const v = parsed?.liquidation?.config?.ivaIncludedInCost;
        if (typeof v === "boolean") return v;
      } catch {
        // ignore
      }
    }
    return true;
  }

  return true;
}

function safeJsonParse(value: unknown): any | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  if (!(s.startsWith("{") || s.startsWith("["))) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractIvaFromInternalNote(args: { doc: any; direction: number }): number | null {
  const parsed = safeJsonParse(args.doc?.internalNote);
  if (!parsed) return null;

  // POS sales snapshot (used by the "Venta (Neto/IVA)" box)
  if (args.direction === DOCUMENT_STOCK_DIRECTION.OUT) {
    if (parsed?.source === "POS" && parsed?.kind === "Sale") {
      const iva = safeNumber(parsed?.saleTotals?.ivaTotal, NaN);
      if (Number.isFinite(iva) && iva >= 0) return iva;
    }
  }

  // Purchase liquidation snapshot
  if (args.direction === DOCUMENT_STOCK_DIRECTION.IN) {
    const ivaDirect = safeNumber(parsed?.liquidation?.totals?.totalIVA, NaN);
    if (Number.isFinite(ivaDirect) && ivaDirect > 0) return ivaDirect;

    const ivaPct = safeNumber(parsed?.liquidation?.config?.ivaPercentage, 0);
    const ivaIncluded = Boolean(parsed?.liquidation?.config?.ivaIncludedInCost);
    if (ivaIncluded && ivaPct > 0) {
      // When IVA is included in the entered costs, derive VAT portion from gross.
      const totalPurchaseCost = safeNumber(parsed?.liquidation?.totals?.totalPurchaseCost, 0);
      const totalDiscount = safeNumber(parsed?.liquidation?.totals?.totalDiscount, 0);
      const gross = Math.max(0, totalPurchaseCost - totalDiscount);
      const divisor = 1 + ivaPct / 100;
      const ivaDerived = divisor > 0 ? gross - gross / divisor : 0;
      if (ivaDerived > 0) return ivaDerived;
    }
  }

  return null;
}

function getVoidMetaFromDoc(doc: any): {
  isVoidDocument: boolean;
  reversalDocumentId: number | null;
} {
  const parsed = safeJsonParse(doc?.internalNote);
  const note = String(doc?.note ?? "");

  let isVoidDocument = false;
  let reversalDocumentId: number | null = null;

  if (parsed?.source === "SYSTEM" && parsed?.kind === "VOID") {
    isVoidDocument = true;
  }

  const ridFromInternal = Number(parsed?.void?.reversalDocumentId ?? 0);
  if (Number.isFinite(ridFromInternal) && ridFromInternal > 0) reversalDocumentId = ridFromInternal;

  if (!reversalDocumentId) {
    const m = note.match(/ANULADO_ID\s*:\s*(\d+)/i);
    if (m?.[1]) {
      const ridFromNote = Number(m[1]);
      if (Number.isFinite(ridFromNote) && ridFromNote > 0) reversalDocumentId = ridFromNote;
    }
  }

  return { isVoidDocument, reversalDocumentId };
}

function isoYmdInBogota(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  const y = map.year ?? String(date.getUTCFullYear());
  const m = map.month ?? String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = map.day ?? String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type IvaNeto30dByDay = {
  date: string;
  salesIva: number;
  purchaseIva: number;
  netIva: number;
};

export type IvaNeto30dDocRow = {
  documentId: number;
  number: string;
  date: string;
  documentTypeName: string | null;
  direction: "sale" | "purchase";
  counterpartyName: string | null;
  total: number;
  iva: number;
  ivaSource: "DocumentItemTax" | "InternalNote" | "ProductTaxEstimate" | "None";
};

export type IvaNeto30dReport = {
  window: {
    days: number;
    from: string;
    to: string;
  };
  totals: {
    salesIva: number;
    purchaseIva: number;
    netIva: number;
    documentsCount: number;
    sources: {
      documentItemTax: number;
      internalNote: number;
      productTaxEstimate: number;
      none: number;
    };
  };
  trends: {
    byDay: IvaNeto30dByDay[];
  };
  documents: {
    rows: IvaNeto30dDocRow[];
    truncated: boolean;
    truncatedReason: string | null;
  };
};

export async function getIvaNeto30dReport(args?: {
  days?: number;
}): Promise<{ data?: IvaNeto30dReport; error?: string }> {
  const daysRaw = args?.days ?? 30;
  const days = Number.isFinite(daysRaw) ? Math.min(90, Math.max(7, Math.trunc(Number(daysRaw)))) : 30;

  const load = cached(
    async () => {
      try {
        const to = isoYmdInBogota(new Date());
        const toStartUtc = ymdToBogotaMidnightUtc(to);
        const fromStartUtc = new Date(toStartUtc.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
        const from = isoYmdInBogota(fromStartUtc);

        const docTypesRes = await listAllPages<any>((a) => amplifyClient.models.DocumentType.list(a));
        if ("error" in docTypesRes) return { error: docTypesRes.error } as const;

        const taxesRes = await listAllPages<any>((a) => amplifyClient.models.Tax.list(a));
        if ("error" in taxesRes) return { error: taxesRes.error } as const;

        const taxById = new Map<number, any>();
        for (const t of taxesRes.data ?? []) {
          const id = Number((t as any)?.idTax);
          if (!Number.isFinite(id) || id <= 0) continue;
          taxById.set(id, t);
        }

        const stockDirectionByDocTypeId = new Map<number, number>();
        const docTypeNameById = new Map<number, string>();
        for (const dt of docTypesRes.data ?? []) {
          const id = Number((dt as any)?.documentTypeId);
          if (!Number.isFinite(id) || id <= 0) continue;
          const dir = normalizeStockDirection((dt as any)?.stockDirection);
          stockDirectionByDocTypeId.set(id, dir);
          docTypeNameById.set(id, String((dt as any)?.name ?? ""));
        }

        // Load documents only in window.
        const docsRes = await listAllPages<any>((a) => amplifyClient.models.Document.list(a), {
          filter: { date: { ge: from, le: to } },
        });
        if ("error" in docsRes) return { error: docsRes.error } as const;

        const docsInWindow = (docsRes.data ?? []).filter((d: any) => {
          const voidMeta = getVoidMetaFromDoc(d);
          if (voidMeta.isVoidDocument) return false;
          if (voidMeta.reversalDocumentId) return false;

          const dtId = Number(d?.documentTypeId);
          const dir = stockDirectionByDocTypeId.get(dtId) ?? DOCUMENT_STOCK_DIRECTION.NONE;
          return dir === DOCUMENT_STOCK_DIRECTION.IN || dir === DOCUMENT_STOCK_DIRECTION.OUT;
        });

        const docIds = Array.from(
          new Set(
            docsInWindow
              .map((d: any) => Number(d?.documentId))
              .filter((id: any) => Number.isFinite(id) && id > 0)
          )
        );

        if (docIds.length === 0) {
          const byDay: IvaNeto30dByDay[] = [];
          for (let i = 0; i < days; i++) {
            const d = new Date(fromStartUtc.getTime() + i * 24 * 60 * 60 * 1000);
            byDay.push({ date: isoYmdInBogota(d), salesIva: 0, purchaseIva: 0, netIva: 0 });
          }

          return {
            data: {
              window: { days, from, to },
              totals: {
                salesIva: 0,
                purchaseIva: 0,
                netIva: 0,
                documentsCount: 0,
                sources: { documentItemTax: 0, internalNote: 0, productTaxEstimate: 0, none: 0 },
              },
              trends: { byDay },
              documents: { rows: [], truncated: false, truncatedReason: null },
            } satisfies IvaNeto30dReport,
          };
        }

        // Guardrails: avoid huge OR filters.
        const MAX_DOCS = 800;
        const limitedDocIds = docIds.slice(0, MAX_DOCS);
        const docsTruncated = docIds.length > limitedDocIds.length;
        const docsTruncatedReason = docsTruncated ? `Se limitaron documentos a ${MAX_DOCS} para evitar consultas muy grandes.` : null;

        const limitedDocIdSet = new Set<number>(limitedDocIds);
        const docById = new Map<number, any>();
        for (const d of docsInWindow) {
          const id = Number(d?.documentId);
          if (!Number.isFinite(id) || id <= 0) continue;
          if (!limitedDocIdSet.has(id)) continue;
          docById.set(id, d);
        }

        // Load doc items for these docs (batched OR).
        const items: any[] = [];
        for (const chunk of chunkArray(limitedDocIds, 25)) {
          const filter = { or: chunk.map((id) => ({ documentId: { eq: id } })) };
          const res = await listAllPages<any>((a) => amplifyClient.models.DocumentItem.list(a), { filter });
          if ("error" in res) return { error: res.error } as const;
          items.push(...(res.data ?? []));
        }

        const productIds = Array.from(
          new Set(
            items
              .map((it: any) => Number(it?.productId))
              .filter((id: any) => Number.isFinite(id) && id > 0)
          )
        );

        // Preload IVA rates per product (ProductTax -> Tax) so we can compute fallback IVA.
        const ivaRateSumByProductId = new Map<number, number>();
        if (productIds.length) {
          for (const pid of productIds) ivaRateSumByProductId.set(pid, 0);

          for (const chunk of chunkArray(productIds, 50)) {
            const filter = { or: chunk.map((id) => ({ productId: { eq: id } })) };
            const ptRes = await listAllPages<any>((a) => amplifyClient.models.ProductTax.list(a), { filter });
            if ("error" in ptRes) return { error: ptRes.error } as const;

            for (const pt of ptRes.data ?? []) {
              const productId = Number((pt as any)?.productId);
              const taxId = Number((pt as any)?.taxId);
              if (!Number.isFinite(productId) || productId <= 0) continue;
              if (!Number.isFinite(taxId) || taxId <= 0) continue;

              const tax = taxById.get(taxId);
              if (!tax || !looksLikeIvaTax(tax)) continue;

              const rate = safeNumber((tax as any)?.rate, 0);
              if (!rate) continue;

              ivaRateSumByProductId.set(productId, (ivaRateSumByProductId.get(productId) ?? 0) + rate);
            }
          }
        }

        const itemIdToDocId = new Map<number, number>();
        const itemIds: number[] = [];
        for (const it of items) {
          const itemId = Number((it as any)?.documentItemId);
          const docId = Number((it as any)?.documentId);
          if (!Number.isFinite(itemId) || itemId <= 0) continue;
          if (!Number.isFinite(docId) || docId <= 0) continue;
          itemIdToDocId.set(itemId, docId);
          itemIds.push(itemId);
        }

        // Load taxes for those items (batched OR).
        const docTaxSumById = new Map<number, number>();
        const docIvaSourceById = new Map<number, IvaNeto30dDocRow["ivaSource"]>();
        for (const docId of limitedDocIds) docTaxSumById.set(docId, 0);

        // If there are no items, everything is 0.
        if (itemIds.length) {
          for (const chunk of chunkArray(itemIds, 50)) {
            const filter = { or: chunk.map((id) => ({ documentItemId: { eq: id } })) };
            const taxesRes = await listAllPages<any>((a) => amplifyClient.models.DocumentItemTax.list(a), { filter });
            if ("error" in taxesRes) return { error: taxesRes.error } as const;

            for (const t of taxesRes.data ?? []) {
              const documentItemId = Number((t as any)?.documentItemId);
              const taxId = Number((t as any)?.taxId);
              const tax = Number.isFinite(taxId) ? taxById.get(taxId) : null;
              if (!tax || !looksLikeIvaTax(tax)) continue;
              const add = safeNumber((t as any)?.amount, 0);
              if (!add) continue;
              const docId = itemIdToDocId.get(documentItemId);
              if (!docId) continue;
              if (!docTaxSumById.has(docId)) continue;
              docTaxSumById.set(docId, (docTaxSumById.get(docId) ?? 0) + add);
              docIvaSourceById.set(docId, "DocumentItemTax");
            }
          }
        }

        // Prefer IVA saved in InternalNote snapshots when item taxes are missing.
        for (const docId of limitedDocIds) {
          const current = safeNumber(docTaxSumById.get(docId) ?? 0, 0);
          if (current > 0) continue;

          const doc = docById.get(docId);
          if (!doc) continue;

          const dtId = Number(doc?.documentTypeId);
          const dir = stockDirectionByDocTypeId.get(dtId) ?? DOCUMENT_STOCK_DIRECTION.NONE;
          const ivaFromNote = extractIvaFromInternalNote({ doc, direction: dir });
          if (ivaFromNote !== null && ivaFromNote > 0) {
            docTaxSumById.set(docId, ivaFromNote);
            docIvaSourceById.set(docId, "InternalNote");
          }
        }

        // Fallback IVA calculation: when DocumentItemTax is missing, infer IVA from product tax setup and item totals.
        const fallbackIvaByDocId = new Map<number, number>();
        for (const it of items) {
          const docId = Number((it as any)?.documentId);
          if (!Number.isFinite(docId) || docId <= 0) continue;
          if (!docTaxSumById.has(docId)) continue;

          const productId = Number((it as any)?.productId);
          const rateSum = ivaRateSumByProductId.get(productId) ?? 0;
          if (!rateSum) continue;

          const lineTotal =
            safeNumber((it as any)?.totalAfterDocumentDiscount, NaN) ||
            safeNumber((it as any)?.total, NaN) ||
            safeNumber((it as any)?.quantity, 0) * safeNumber((it as any)?.price, 0);

          if (!Number.isFinite(lineTotal) || lineTotal <= 0) continue;

          const doc = docById.get(docId);
          const dtId = Number(doc?.documentTypeId);
          const dir = stockDirectionByDocTypeId.get(dtId) ?? DOCUMENT_STOCK_DIRECTION.NONE;
          const pricesIncludeIva = inferPricesIncludeIvaForDoc({ doc, direction: dir });

          const divisor = 1 + rateSum / 100;
          const lineIva = pricesIncludeIva && divisor > 0 ? lineTotal - lineTotal / divisor : (lineTotal * rateSum) / 100;
          if (!lineIva) continue;

          fallbackIvaByDocId.set(docId, (fallbackIvaByDocId.get(docId) ?? 0) + lineIva);
        }

        for (const [docId, current] of docTaxSumById.entries()) {
          if (safeNumber(current, 0) !== 0) continue;
          const fallback = fallbackIvaByDocId.get(docId) ?? 0;
          if (fallback) {
            docTaxSumById.set(docId, fallback);
            docIvaSourceById.set(docId, "ProductTaxEstimate");
          }
        }

        let salesIva = 0;
        let purchaseIva = 0;

        const sourceCounts = {
          documentItemTax: 0,
          internalNote: 0,
          productTaxEstimate: 0,
          none: 0,
        };

        // Build by-day buckets (always full window for nicer chart).
        const byDayMap = new Map<string, { salesIva: number; purchaseIva: number }>();
        for (let i = 0; i < days; i++) {
          const d = new Date(fromStartUtc.getTime() + i * 24 * 60 * 60 * 1000);
          const ymd = isoYmdInBogota(d);
          byDayMap.set(ymd, { salesIva: 0, purchaseIva: 0 });
        }

        const docsById = new Map<number, any>();
        for (const [docId] of docTaxSumById.entries()) {
          const d = docById.get(docId);
          if (!d) continue;
          docsById.set(docId, d);
        }

        for (const [docId, taxSum] of docTaxSumById.entries()) {
          const d = docsById.get(docId);
          if (!d) continue;

          const dtId = Number(d?.documentTypeId);
          const dir = stockDirectionByDocTypeId.get(dtId) ?? DOCUMENT_STOCK_DIRECTION.NONE;
          const ymd = String(d?.date ?? "");

          const src = docIvaSourceById.get(docId) ?? (safeNumber(taxSum, 0) > 0 ? "DocumentItemTax" : "None");
          if (src === "DocumentItemTax") sourceCounts.documentItemTax += 1;
          else if (src === "InternalNote") sourceCounts.internalNote += 1;
          else if (src === "ProductTaxEstimate") sourceCounts.productTaxEstimate += 1;
          else sourceCounts.none += 1;

          if (dir === DOCUMENT_STOCK_DIRECTION.OUT) {
            salesIva += safeNumber(taxSum, 0);
            const bucket = byDayMap.get(ymd);
            if (bucket) bucket.salesIva += safeNumber(taxSum, 0);
          }
          if (dir === DOCUMENT_STOCK_DIRECTION.IN) {
            purchaseIva += safeNumber(taxSum, 0);
            const bucket = byDayMap.get(ymd);
            if (bucket) bucket.purchaseIva += safeNumber(taxSum, 0);
          }
        }

        const netIva = salesIva - purchaseIva;

        // Resolve counterparty names (best-effort; keep traceability if missing).
        const customerIds = new Set<number>();
        const clientIds = new Set<number>();
        for (const d of docsById.values()) {
          const dtId = Number(d?.documentTypeId);
          const dir = stockDirectionByDocTypeId.get(dtId) ?? DOCUMENT_STOCK_DIRECTION.NONE;
          if (dir === DOCUMENT_STOCK_DIRECTION.IN) {
            const id = Number(d?.customerId);
            if (Number.isFinite(id) && id > 0) customerIds.add(id);
          }
          if (dir === DOCUMENT_STOCK_DIRECTION.OUT) {
            const id = Number(d?.clientId);
            if (Number.isFinite(id) && id > 0) clientIds.add(id);
          }
        }

        const customerNameById = new Map<number, string>();
        const clientNameById = new Map<number, string>();

        await Promise.all([
          Promise.all(
            Array.from(customerIds).slice(0, 200).map(async (id) => {
              try {
                const res: any = await amplifyClient.models.Customer.get({ idCustomer: id } as any);
                const name = String(res?.data?.name ?? "").trim();
                if (name) customerNameById.set(id, name);
              } catch {
                // ignore
              }
            })
          ),
          Promise.all(
            Array.from(clientIds).slice(0, 200).map(async (id) => {
              try {
                const res: any = await amplifyClient.models.Client.get({ idClient: id } as any);
                const name = String(res?.data?.name ?? "").trim();
                if (name) clientNameById.set(id, name);
              } catch {
                // ignore
              }
            })
          ),
        ]);

        const rows: IvaNeto30dDocRow[] = Array.from(docTaxSumById.entries())
          .map(([docId, taxSum]) => {
            const d = docsById.get(docId);
            if (!d) return null;
            const dtId = Number(d?.documentTypeId);
            const dir = stockDirectionByDocTypeId.get(dtId) ?? DOCUMENT_STOCK_DIRECTION.NONE;
            if (dir !== DOCUMENT_STOCK_DIRECTION.IN && dir !== DOCUMENT_STOCK_DIRECTION.OUT) return null;

            const direction: "sale" | "purchase" =
              dir === DOCUMENT_STOCK_DIRECTION.OUT ? "sale" : "purchase";

            const number = String(d?.number ?? "");
            const date = String(d?.date ?? "");
            const total = safeNumber(d?.total, 0);
            const iva = safeNumber(taxSum, 0);
            const ivaSource =
              docIvaSourceById.get(docId) ?? (iva > 0 ? "DocumentItemTax" : "None");

            const docTypeName = dtId ? (docTypeNameById.get(dtId) ?? null) : null;

            let counterpartyName: string | null = null;
            if (direction === "sale") {
              const snap = String(d?.clientNameSnapshot ?? "").trim();
              if (snap) counterpartyName = snap;
              if (!counterpartyName) {
                const id = Number(d?.clientId);
                if (Number.isFinite(id) && id > 0) counterpartyName = clientNameById.get(id) ?? null;
              }
            } else {
              const id = Number(d?.customerId);
              if (Number.isFinite(id) && id > 0) counterpartyName = customerNameById.get(id) ?? null;
            }

            return {
              documentId: docId,
              number,
              date,
              documentTypeName: docTypeName,
              direction,
              counterpartyName,
              total,
              iva,
              ivaSource,
            } satisfies IvaNeto30dDocRow;
          })
          .filter(Boolean)
          .sort((a, b) => String(b!.date).localeCompare(String(a!.date)) || safeNumber(b!.documentId) - safeNumber(a!.documentId)) as IvaNeto30dDocRow[];

        const byDay: IvaNeto30dByDay[] = Array.from(byDayMap.entries())
          .map(([date, v]) => ({ date, salesIva: v.salesIva, purchaseIva: v.purchaseIva, netIva: v.salesIva - v.purchaseIva }))
          .sort((a, b) => String(a.date).localeCompare(String(b.date)));

        return {
          data: {
            window: { days, from, to },
            totals: {
              salesIva,
              purchaseIva,
              netIva,
              documentsCount: rows.length,
              sources: sourceCounts,
            },
            trends: { byDay },
            documents: {
              rows,
              truncated: docsTruncated,
              truncatedReason: docsTruncatedReason,
            },
          } satisfies IvaNeto30dReport,
        };
      } catch (error) {
        return { error: formatAmplifyError(error) } as const;
      }
    },
    {
      keyParts: ["reports", "iva-neto", "30d", String(daysRaw)],
      revalidateSeconds: 60,
      tags: [CACHE_TAGS.heavy.documents],
    }
  );

  return load();
}
