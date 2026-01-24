"use server";

import { amplifyClient, DOCUMENT_STOCK_DIRECTION, formatAmplifyError } from "@/lib/amplify-config";
import { normalizeStockDirection } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";
import { ymdToBogotaMidnightUtc } from "@/lib/datetime";
import { cached } from "@/lib/server-cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

const BOGOTA_TIME_ZONE = "America/Bogota";

function toYmdInBogota(now: Date): string {
  // Use formatToParts so we don't depend on server locale/time zone.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  const year = map.year;
  const month = map.month;
  const day = map.day;
  if (!year || !month || !day) {
    // Fallback: UTC date-only.
    return toIsoDateOnly(now);
  }
  return `${year}-${month}-${day}`;
}

function toIsoDateOnly(d: Date): string {
  // Use UTC to avoid server TZ surprises.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function listAllPagesCapped<T>(
  listFn: (args?: any) => Promise<{ data?: T[]; nextToken?: string | null } | T[] | null | undefined>,
  {
    args,
    maxItems,
    pageSize,
  }: {
    args?: any;
    maxItems: number;
    pageSize?: number;
  }
): Promise<{ data: T[]; truncated: boolean } | { data: T[]; truncated: boolean; error: string }> {
  try {
    const data: T[] = [];
    let nextToken: string | null | undefined = undefined;
    const limit = Number.isFinite(pageSize) ? Math.max(1, Math.trunc(Number(pageSize))) : 1000;

    do {
      const res: any = await listFn({ ...(args ?? {}), limit, nextToken });
      const pageData = Array.isArray(res) ? res : (res?.data ?? []);
      data.push(...(pageData as T[]));
      nextToken = Array.isArray(res) ? null : (res?.nextToken ?? null);

      if (data.length >= maxItems) {
        return { data: data.slice(0, maxItems), truncated: true };
      }
    } while (nextToken);

    return { data, truncated: false };
  } catch (error) {
    return { data: [], truncated: false, error: formatAmplifyError(error) };
  }
}

export type DashboardReceivableRow = {
  documentId: number;
  number: string;
  customerName: string | null;
  date: string;
  dueDate: string | null;
  total: number;
  paidApprox: number;
  pendingApprox: number;
  daysOverdue: number;
  paidStatus: number;
};

export type DashboardOverview = {
  window: {
    days: number;
    from: string;
    to: string;
  };
  inventory: {
    productsCount: number;
    totalUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
    inventoryCostValue: number;
    inventorySaleValue: number;
    potentialProfit: number;
    estimatedIvaOnSaleValue: number;
  };
  receivables: {
    pendingCount: number;
    pendingAmountApprox: number;
    overdueCount: number;
    overdueAmountApprox: number;
    topOverdue: DashboardReceivableRow[];
  };
  iva: {
    salesIva: number;
    purchaseIva: number;
    netIva: number;
  };
  trends: {
    byDay: Array<{
      date: string;
      salesTotal: number;
      purchaseTotal: number;
      salesIva: number;
      purchaseIva: number;
    }>;
  };
  alerts: {
    lowStock: Array<{
      productId: string;
      productName: string;
      productCode: string;
      currentStock: number;
      warningQuantity: number;
      warehouseName: string;
    }>;
  };
  charts: {
    inventoryByWarehouse: Array<{
      warehouseId: number;
      warehouseName: string;
      units: number;
      costValue: number;
      saleValue: number;
    }>;
    inventoryByGroup: Array<{
      productGroupId: number;
      groupName: string;
      units: number;
      costValue: number;
      saleValue: number;
    }>;
    topProductsByProfit: Array<{
      productId: number;
      productName: string;
      units: number;
      costValue: number;
      saleValue: number;
      profit: number;
    }>;
    priceCostScatter: Array<{
      productId: number;
      productName: string;
      price: number;
      cost: number;
      units: number;
    }>;
  };
};

export type DashboardOverviewArgs = {
  days?: number;
};

export async function getDashboardOverview(args?: DashboardOverviewArgs): Promise<{ data?: DashboardOverview; error?: string }> {
  const daysRaw = args?.days ?? 30;
  const days = Number.isFinite(daysRaw) ? Math.min(365, Math.max(7, Math.trunc(Number(daysRaw)))) : 30;

  const load = cached(
    async () => {
      try {

    // IMPORTANT: Document.date is date-only (YYYY-MM-DD) and business logic is in Colombia time.
    // Using UTC here can shift the window and hide "today" documents during Bogotá evening hours.
    const now = new Date();
    const to = toYmdInBogota(now);
    const toBogotaStartUtc = ymdToBogotaMidnightUtc(to);
    const fromBogotaStartUtc = new Date(toBogotaStartUtc.getTime() - (days - 1) * 86400000);
    const from = toYmdInBogota(fromBogotaStartUtc);

    // Bulk load the data needed by the dashboard.
    const [
      stocksResult,
      productsResult,
      controlsResult,
      warehousesResult,
      productGroupsResult,
      taxesResult,
      productTaxesResult,
      docTypesResult,
      customersResult,
    ] = await Promise.all([
      listAllPages<any>((a) => amplifyClient.models.Stock.list(a)),
      listAllPages<any>((a) => amplifyClient.models.Product.list(a)),
      listAllPages<any>((a) => amplifyClient.models.StockControl.list(a), {
        filter: { isLowStockWarningEnabled: { eq: true } },
      }),
      listAllPages<any>((a) => amplifyClient.models.Warehouse.list(a)),
      listAllPages<any>((a) => amplifyClient.models.ProductGroup.list(a)),
      listAllPages<any>((a) => amplifyClient.models.Tax.list(a)),
      listAllPages<any>((a) => amplifyClient.models.ProductTax.list(a)),
      listAllPages<any>((a) => amplifyClient.models.DocumentType.list(a)),
      cached(
        async () => listAllPages<any>((a) => amplifyClient.models.Customer.list(a)),
        { keyParts: ["partners", "customers", "all"], revalidateSeconds: 60, tags: [CACHE_TAGS.heavy.customers] }
      )(),
    ]);

    if ("error" in stocksResult) return { error: stocksResult.error };
    if ("error" in productsResult) return { error: productsResult.error };

    const taxById = new Map<number, any>();
    if (!("error" in taxesResult)) {
      for (const t of taxesResult.data ?? []) {
        const id = Number((t as any)?.idTax);
        if (Number.isFinite(id) && id > 0) taxById.set(id, t);
      }
    }

    const productById = new Map<number, any>();
    for (const p of productsResult.data ?? []) {
      const id = Number((p as any)?.idProduct);
      if (Number.isFinite(id) && id > 0) productById.set(id, p);
    }

    const enabledProductIds = Array.from(productById.entries())
      .filter(([, p]) => (p as any)?.isEnabled !== false)
      .map(([id]) => id);

    const warehouseNameById = new Map<number, string>();
    if (!("error" in warehousesResult)) {
      for (const w of warehousesResult.data ?? []) {
        const id = Number((w as any)?.idWarehouse);
        if (!Number.isFinite(id) || id <= 0) continue;
        warehouseNameById.set(id, String((w as any)?.name ?? ""));
      }
    }

    const groupNameById = new Map<number, string>();
    if (!("error" in productGroupsResult)) {
      for (const g of productGroupsResult.data ?? []) {
        const id = Number((g as any)?.idProductGroup);
        if (!Number.isFinite(id) || id <= 0) continue;
        groupNameById.set(id, String((g as any)?.name ?? ""));
      }
    }

    const productTaxIds = new Map<number, number[]>();
    if (!("error" in productTaxesResult)) {
      for (const pt of productTaxesResult.data ?? []) {
        const productId = Number((pt as any)?.productId);
        const taxId = Number((pt as any)?.taxId);
        if (!Number.isFinite(productId) || productId <= 0) continue;
        if (!Number.isFinite(taxId) || taxId <= 0) continue;
        const arr = productTaxIds.get(productId) ?? [];
        arr.push(taxId);
        productTaxIds.set(productId, arr);
      }
    }

    // Aggregate stock totals per product.
    const stockTotalByProductId = new Map<number, number>();
    const stockByWarehouseProductKey = new Map<string, number>();
    for (const s of stocksResult.data ?? []) {
      const productId = Number((s as any)?.productId);
      const qty = safeNumber((s as any)?.quantity, 0);
      const warehouseId = Number((s as any)?.warehouseId);
      if (!Number.isFinite(productId) || productId <= 0) continue;
      stockTotalByProductId.set(productId, (stockTotalByProductId.get(productId) ?? 0) + qty);

      if (Number.isFinite(warehouseId) && warehouseId > 0) {
        const key = `${warehouseId}:${productId}`;
        stockByWarehouseProductKey.set(key, (stockByWarehouseProductKey.get(key) ?? 0) + qty);
      }
    }

    let inventorySaleValue = 0;
    let estimatedIvaOnSaleValue = 0;
    let inventoryCostValue = 0;
    let totalUnitsFromStocks = 0;
    let outOfStockCountByProduct = 0;

    for (const [productId, qty] of stockTotalByProductId.entries()) {
      totalUnitsFromStocks += qty;

      const product = productById.get(productId);
      const price = safeNumber(product?.price, 0);
      const cost = safeNumber(product?.cost, 0);
      const isTaxInclusive = Boolean(product?.isTaxInclusivePrice ?? true);

      if (qty > 0) {
        inventorySaleValue += qty * price;
        inventoryCostValue += qty * cost;
      }

      const taxIds = productTaxIds.get(productId) ?? [];
      if (qty > 0 && taxIds.length) {
        let percentRate = 0;
        let fixedPerUnit = 0;
        for (const taxId of taxIds) {
          const tax = taxById.get(Number(taxId));
          if (!tax) continue;
          if (tax?.isEnabled === false) continue;
          const rate = safeNumber(tax?.rate, 0);
          if (tax?.isFixed) fixedPerUnit += rate;
          else percentRate += rate;
        }

        const taxFromPercent =
          percentRate > 0
            ? isTaxInclusive
              ? price * (percentRate / (100 + percentRate))
              : price * (percentRate / 100)
            : 0;
        const taxPerUnit = taxFromPercent + fixedPerUnit;
        estimatedIvaOnSaleValue += qty * taxPerUnit;
      }
    }

    // Out-of-stock should include products with no Stock rows (treated as 0).
    outOfStockCountByProduct = 0;
    for (const productId of enabledProductIds) {
      const qty = safeNumber(stockTotalByProductId.get(productId) ?? 0, 0);
      if (qty <= 0) outOfStockCountByProduct++;
    }

    // Build chart datasets
    const invByWarehouse = new Map<number, { units: number; costValue: number; saleValue: number }>();
    for (const [key, qty] of stockByWarehouseProductKey.entries()) {
      const [warehouseIdRaw, productIdRaw] = key.split(":");
      const warehouseId = Number(warehouseIdRaw);
      const productId = Number(productIdRaw);
      if (!Number.isFinite(warehouseId) || warehouseId <= 0) continue;
      if (!Number.isFinite(productId) || productId <= 0) continue;

      const product = productById.get(productId);
      const price = safeNumber(product?.price, 0);
      const cost = safeNumber(product?.cost, 0);

      const acc = invByWarehouse.get(warehouseId) ?? { units: 0, costValue: 0, saleValue: 0 };
      acc.units += qty;
      if (qty > 0) {
        acc.costValue += qty * cost;
        acc.saleValue += qty * price;
      }
      invByWarehouse.set(warehouseId, acc);
    }

    const inventoryByWarehouse = Array.from(invByWarehouse.entries())
      .map(([warehouseId, v]) => ({
        warehouseId,
        warehouseName: warehouseNameById.get(warehouseId) ?? `#${warehouseId}`,
        units: safeNumber(v.units, 0),
        costValue: safeNumber(v.costValue, 0),
        saleValue: safeNumber(v.saleValue, 0),
      }))
      .sort((a, b) => b.saleValue - a.saleValue)
      .slice(0, 12);

    const invByGroup = new Map<number, { units: number; costValue: number; saleValue: number }>();
    for (const [productId, qty] of stockTotalByProductId.entries()) {
      const product = productById.get(productId);
      const groupId = Number(product?.productGroupId ?? 0);
      if (!Number.isFinite(groupId) || groupId <= 0) continue;

      const price = safeNumber(product?.price, 0);
      const cost = safeNumber(product?.cost, 0);

      const acc = invByGroup.get(groupId) ?? { units: 0, costValue: 0, saleValue: 0 };
      acc.units += qty;
      if (qty > 0) {
        acc.costValue += qty * cost;
        acc.saleValue += qty * price;
      }
      invByGroup.set(groupId, acc);
    }

    const inventoryByGroup = Array.from(invByGroup.entries())
      .map(([productGroupId, v]) => ({
        productGroupId,
        groupName: groupNameById.get(productGroupId) ?? `#${productGroupId}`,
        units: safeNumber(v.units, 0),
        costValue: safeNumber(v.costValue, 0),
        saleValue: safeNumber(v.saleValue, 0),
      }))
      .sort((a, b) => b.saleValue - a.saleValue)
      .slice(0, 12);

    const topProductsByProfit = Array.from(stockTotalByProductId.entries())
      .map(([productId, qty]) => {
        const product = productById.get(productId);
        const price = safeNumber(product?.price, 0);
        const cost = safeNumber(product?.cost, 0);
        const saleValue = qty > 0 ? qty * price : 0;
        const costValue = qty > 0 ? qty * cost : 0;
        const profit = saleValue - costValue;
        return {
          productId,
          productName: String(product?.name ?? `#${productId}`),
          units: safeNumber(qty, 0),
          costValue: safeNumber(costValue, 0),
          saleValue: safeNumber(saleValue, 0),
          profit: safeNumber(profit, 0),
        };
      })
      .filter((r) => r.units > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    const priceCostScatter = Array.from(stockTotalByProductId.entries())
      .map(([productId, qty]) => {
        const product = productById.get(productId);
        return {
          productId,
          productName: String(product?.name ?? `#${productId}`),
          price: safeNumber(product?.price, 0),
          cost: safeNumber(product?.cost, 0),
          units: safeNumber(qty, 0),
        };
      })
      .filter((p) => p.price > 0 || p.cost > 0)
      .slice(0, 800);

    const stockDirectionByDocTypeId = new Map<number, number>();
    if (!("error" in docTypesResult)) {
      for (const dt of docTypesResult.data ?? []) {
        const id = Number((dt as any)?.documentTypeId);
        const sd = normalizeStockDirection((dt as any)?.stockDirection);
        if (Number.isFinite(id) && id > 0) stockDirectionByDocTypeId.set(id, sd);
      }
    }

    const docsResult = await listAllPages<any>((a) =>
      amplifyClient.models.Document.list({
        ...(a ?? {}),
        filter: {
          date: { ge: from, le: to },
        },
      } as any)
    );
    if ("error" in docsResult) return { error: docsResult.error };

    const docs = docsResult.data ?? [];

    // Receivables: pending/overdue (sales docs) with best-effort payment approximation.
    const customerNameById = new Map<number, string>();
    if (!("error" in customersResult)) {
      for (const c of customersResult.data ?? []) {
        const id = Number((c as any)?.idCustomer);
        if (Number.isFinite(id) && id > 0) customerNameById.set(id, String((c as any)?.name ?? ""));
      }
    }

    const salesDocs = docs.filter((d: any) => {
      const dtId = Number(d?.documentTypeId);
      const sd = stockDirectionByDocTypeId.get(dtId) ?? DOCUMENT_STOCK_DIRECTION.NONE;
      return sd === DOCUMENT_STOCK_DIRECTION.OUT;
    });
    const purchaseDocs = docs.filter((d: any) => {
      const dtId = Number(d?.documentTypeId);
      const sd = stockDirectionByDocTypeId.get(dtId) ?? DOCUMENT_STOCK_DIRECTION.NONE;
      return sd === DOCUMENT_STOCK_DIRECTION.IN;
    });

    // VAT from document item taxes. Prefer bulk load + join (capped); fallback to 0 if too large.
    const docsById = new Map<number, any>();
    const docsInWindowIds = new Set<number>();
    for (const d of docs) {
      const docId = Number(d?.documentId);
      if (!Number.isFinite(docId) || docId <= 0) continue;
      docsById.set(docId, d);
      docsInWindowIds.add(docId);
    }

    const docTaxSumById = new Map<number, number>();
    for (const docId of docsInWindowIds) docTaxSumById.set(docId, 0);

    const itemTaxSums = await listAllPagesCapped<any>((a) => amplifyClient.models.DocumentItemTax.list(a), {
      maxItems: 50000,
      pageSize: 1000,
    });
    const docItems = await listAllPagesCapped<any>((a) => amplifyClient.models.DocumentItem.list(a), {
      maxItems: 50000,
      pageSize: 1000,
    });

    if ("error" in itemTaxSums) return { error: itemTaxSums.error };
    if ("error" in docItems) return { error: docItems.error };

    // Build tax sum per documentItemId.
    const taxSumByItemId = new Map<number, number>();
    for (const t of itemTaxSums.data ?? []) {
      const documentItemId = Number((t as any)?.documentItemId);
      if (!Number.isFinite(documentItemId) || documentItemId <= 0) continue;
      taxSumByItemId.set(documentItemId, (taxSumByItemId.get(documentItemId) ?? 0) + safeNumber((t as any)?.amount, 0));
    }

    for (const it of docItems.data ?? []) {
      const docId = Number((it as any)?.documentId);
      if (!docsInWindowIds.has(docId)) continue;
      const documentItemId = Number((it as any)?.documentItemId);
      if (!Number.isFinite(documentItemId) || documentItemId <= 0) continue;
      const add = safeNumber(taxSumByItemId.get(documentItemId) ?? 0, 0);
      if (!add) continue;
      docTaxSumById.set(docId, (docTaxSumById.get(docId) ?? 0) + add);
    }

    let salesIva = 0;
    let purchaseIva = 0;
    for (const [docId, taxSum] of docTaxSumById.entries()) {
      const d = docsById.get(docId);
      const dtId = Number(d?.documentTypeId);
      const dir = stockDirectionByDocTypeId.get(dtId) ?? DOCUMENT_STOCK_DIRECTION.NONE;
      if (dir === DOCUMENT_STOCK_DIRECTION.OUT) salesIva += safeNumber(taxSum, 0);
      if (dir === DOCUMENT_STOCK_DIRECTION.IN) purchaseIva += safeNumber(taxSum, 0);
    }

    const netIva = salesIva - purchaseIva;

    // Build day-bucket trends for the window.
    const byDayMap = new Map<string, { salesTotal: number; purchaseTotal: number; salesIva: number; purchaseIva: number }>();
    const ensureDay = (dateStr: string) => {
      if (!byDayMap.has(dateStr)) byDayMap.set(dateStr, { salesTotal: 0, purchaseTotal: 0, salesIva: 0, purchaseIva: 0 });
      return byDayMap.get(dateStr)!;
    };

    for (const d of salesDocs) {
      const date = String(d?.date ?? "");
      if (!date) continue;
      const bucket = ensureDay(date);
      bucket.salesTotal += safeNumber(d?.total, 0);
      bucket.salesIva += safeNumber(docTaxSumById.get(Number(d?.documentId)) ?? 0, 0);
    }
    for (const d of purchaseDocs) {
      const date = String(d?.date ?? "");
      if (!date) continue;
      const bucket = ensureDay(date);
      bucket.purchaseTotal += safeNumber(d?.total, 0);
      bucket.purchaseIva += safeNumber(docTaxSumById.get(Number(d?.documentId)) ?? 0, 0);
    }

    const trendsByDay = Array.from(byDayMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    // Receivables details (sales docs, unpaid/partial).
    const nowForReceivables = new Date();
    const pendingSalesDocs = salesDocs
      .filter((d: any) => safeNumber(d?.total, 0) > 0)
      .filter((d: any) => Number(d?.paidStatus ?? 0) !== 2);

    // Payments: bulk load and sum only needed docIds.
    const pendingDocIds = new Set<number>();
    for (const d of pendingSalesDocs) {
      const docId = Number(d?.documentId);
      if (Number.isFinite(docId) && docId > 0) pendingDocIds.add(docId);
    }

    const paymentsResult = await listAllPages<any>((a) => amplifyClient.models.Payment.list(a));
    if ("error" in paymentsResult) return { error: paymentsResult.error };
    const paymentSumsByDocId = new Map<number, number>();
    for (const p of paymentsResult.data ?? []) {
      const docId = Number((p as any)?.documentId);
      if (!pendingDocIds.has(docId)) continue;
      paymentSumsByDocId.set(docId, (paymentSumsByDocId.get(docId) ?? 0) + Math.max(0, safeNumber((p as any)?.amount, 0)));
    }

    const receivableRows: DashboardReceivableRow[] = pendingSalesDocs
      .map((d: any) => {
        const documentId = Number(d?.documentId);
        const total = safeNumber(d?.total, 0);
        const paidApprox = safeNumber(paymentSumsByDocId.get(documentId) ?? 0, 0);
        const pendingApprox = Math.max(0, total - paidApprox);
        const dueDate = d?.dueDate ? String(d.dueDate) : null;

        let daysOverdue = 0;
        if (dueDate) {
          const due = ymdToBogotaMidnightUtc(dueDate);
          const diffMs = nowForReceivables.getTime() - due.getTime();
          daysOverdue = diffMs > 0 ? Math.floor(diffMs / 86400000) : 0;
        }

        const customerId = d?.customerId !== undefined && d?.customerId !== null ? Number(d.customerId) : null;
        const customerName = customerId && Number.isFinite(customerId) ? customerNameById.get(customerId) ?? null : null;

        return {
          documentId,
          number: String(d?.number ?? ""),
          customerName,
          date: String(d?.date ?? ""),
          dueDate,
          total,
          paidApprox,
          pendingApprox,
          daysOverdue,
          paidStatus: Number(d?.paidStatus ?? 0),
        };
      })
      .filter((r) => Number.isFinite(r.documentId) && r.documentId > 0 && r.number.length > 0);

    const pendingCount = receivableRows.length;
    const pendingAmountApprox = receivableRows.reduce((sum, r) => sum + safeNumber(r.pendingApprox, 0), 0);

    const overdueRows = receivableRows.filter((r) => r.daysOverdue > 0 && safeNumber(r.pendingApprox, 0) > 0);
    const overdueCount = overdueRows.length;
    const overdueAmountApprox = overdueRows.reduce((sum, r) => sum + safeNumber(r.pendingApprox, 0), 0);

    const topOverdue = overdueRows
      .slice()
      .sort((a, b) => {
        if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
        return b.pendingApprox - a.pendingApprox;
      })
      .slice(0, 10);

    // Low stock alerts: compute from controls + aggregated stock totals (bulk, consistent).
    const lowStockAlerts: DashboardOverview["alerts"]["lowStock"] = [];
    if (!("error" in controlsResult)) {
      for (const c of controlsResult.data ?? []) {
        const productIdNum = Number((c as any)?.productId);
        if (!Number.isFinite(productIdNum) || productIdNum <= 0) continue;
        const warningQuantity = safeNumber((c as any)?.lowStockWarningQuantity, 0);
        const currentStock = safeNumber(stockTotalByProductId.get(productIdNum) ?? 0, 0);
        if (currentStock <= warningQuantity) {
          const product = productById.get(productIdNum);
          const code =
            String(
              (product as any)?.code ??
                (product as any)?.reference ??
                (product as any)?.sku ??
                (product as any)?.idProduct ??
                productIdNum
            ).trim() || String(productIdNum);
          lowStockAlerts.push({
            productId: String(productIdNum),
            productName: String(product?.name ?? `#${productIdNum}`),
            productCode: code,
            currentStock,
            warningQuantity,
            warehouseName: "Total",
          });
        }
      }
    }

    // Sort alerts: most critical first.
    lowStockAlerts.sort((a, b) => a.currentStock - b.currentStock);

    const data: DashboardOverview = {
      window: { days, from, to },
      inventory: {
        productsCount: enabledProductIds.length,
        totalUnits: safeNumber(totalUnitsFromStocks, 0),
        lowStockCount: safeNumber(lowStockAlerts.length, 0),
        outOfStockCount: safeNumber(outOfStockCountByProduct, 0),
        inventoryCostValue: safeNumber(inventoryCostValue, 0),
        inventorySaleValue: safeNumber(inventorySaleValue, 0),
        potentialProfit: safeNumber(inventorySaleValue - inventoryCostValue, 0),
        estimatedIvaOnSaleValue: safeNumber(estimatedIvaOnSaleValue, 0),
      },
      receivables: {
        pendingCount,
        pendingAmountApprox,
        overdueCount,
        overdueAmountApprox,
        topOverdue,
      },
      iva: {
        salesIva: safeNumber(salesIva, 0),
        purchaseIva: safeNumber(purchaseIva, 0),
        netIva: safeNumber(netIva, 0),
      },
      trends: {
        byDay: trendsByDay,
      },
      alerts: {
        lowStock: lowStockAlerts,
      },
      charts: {
        inventoryByWarehouse,
        inventoryByGroup,
        topProductsByProfit,
        priceCostScatter,
      },
    };

        return { data };
      } catch (error: any) {
        return { error: formatAmplifyError(error) };
      }
    },
    {
      keyParts: ["heavy", "dashboard-overview", String(days)],
      revalidateSeconds: 30,
      tags: [CACHE_TAGS.heavy.dashboardOverview, CACHE_TAGS.heavy.stockData, CACHE_TAGS.heavy.documents],
    }
  );

  return await load();
}
