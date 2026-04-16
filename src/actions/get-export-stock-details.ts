"use server";

import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

const Schema = z.object({
  productIds: z.array(z.coerce.number().int().positive()).max(5000),
});

export type ExportStockDetail = {
  productId: number;
  stockTotal: number;
  stockByWarehouse: Array<{
    warehouseId: number;
    quantity: number;
  }>;
};

export async function getExportStockDetails(raw: z.input<typeof Schema>): Promise<{
  data: ExportStockDetail[];
  error?: string;
}> {
  noStore();

  const parsed = Schema.safeParse(raw ?? {});
  if (!parsed.success) return { data: [], error: "Productos inválidos para exportación" };

  const productIds = Array.from(
    new Set(parsed.data.productIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))
  );

  if (productIds.length === 0) return { data: [] };

  try {
    const stocksRes = await listAllPages<any>((args) => amplifyClient.models.Stock.list(args));
    if ("error" in stocksRes) return { data: [], error: stocksRes.error };

    const productIdSet = new Set(productIds);
    const stockMap = new Map<number, { stockTotal: number; stockByWarehouse: Map<number, number> }>();

    for (const stock of stocksRes.data ?? []) {
      const productId = Number((stock as any)?.productId);
      const warehouseId = Number((stock as any)?.warehouseId);
      const quantity = Number((stock as any)?.quantity ?? 0);

      if (!productIdSet.has(productId)) continue;
      if (!Number.isFinite(warehouseId) || warehouseId <= 0) continue;

      const entry = stockMap.get(productId) ?? { stockTotal: 0, stockByWarehouse: new Map<number, number>() };
      const safeQty = Number.isFinite(quantity) ? quantity : 0;
      entry.stockTotal += safeQty;
      entry.stockByWarehouse.set(warehouseId, (entry.stockByWarehouse.get(warehouseId) ?? 0) + safeQty);
      stockMap.set(productId, entry);
    }

    const data = productIds.map((productId) => {
      const entry = stockMap.get(productId);
      return {
        productId,
        stockTotal: entry?.stockTotal ?? 0,
        stockByWarehouse: Array.from(entry?.stockByWarehouse.entries() ?? []).map(([warehouseId, quantity]) => ({
          warehouseId,
          quantity,
        })),
      };
    });

    return { data };
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}