"use server";

import "server-only";

import { z } from "zod";

import type { StockInfo } from "@/lib/types";
import { amplifyClient } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";
import { cached } from "@/lib/server-cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

const Schema = z.object({
  warehouseId: z.coerce.number().int().positive(),
});

export async function getStockDataForWarehouse(raw: z.input<typeof Schema>): Promise<{
  data: StockInfo[];
  error?: string;
}> {
  const parsed = Schema.safeParse(raw ?? {});
  if (!parsed.success) return { data: [], error: "Datos inválidos" };

  const { warehouseId } = parsed.data;

  try {
    const load = cached(
      async () => {
        const [productsRes, stocksRes, barcodesRes] = await Promise.all([
          listAllPages<any>((a) => amplifyClient.models.Product.list(a)),
          listAllPages<any>((a) =>
            amplifyClient.models.Stock.list({
              ...a,
              filter: {
                ...(a as any)?.filter,
                warehouseId: { eq: warehouseId },
              },
            } as any)
          ),
          listAllPages<any>((a) => amplifyClient.models.Barcode.list(a)),
        ]);

        if ("error" in productsRes)
          return {
            data: [],
            error: String(productsRes.error ?? "Error cargando productos"),
          };
        if ("error" in stocksRes)
          return {
            data: [],
            error: String(stocksRes.error ?? "Error cargando stock"),
          };
        if ("error" in barcodesRes)
          return {
            data: [],
            error: String(barcodesRes.error ?? "Error cargando códigos de barras"),
          };

        const barcodesByProductId = new Map<number, string[]>();
        for (const b of barcodesRes.data ?? []) {
          const productId = Number((b as any)?.productId);
          const value = String((b as any)?.value ?? "").trim();
          if (!Number.isFinite(productId) || productId <= 0) continue;
          if (!value) continue;
          const list = barcodesByProductId.get(productId);
          if (list) list.push(value);
          else barcodesByProductId.set(productId, [value]);
        }

        const stockByProductId = new Map<number, number>();
        for (const s of stocksRes.data ?? []) {
          const productId = Number((s as any)?.productId);
          const qty = Number((s as any)?.quantity ?? 0);
          if (!Number.isFinite(productId) || productId <= 0) continue;
          stockByProductId.set(productId, Number.isFinite(qty) ? qty : 0);
        }

        const rows: StockInfo[] = (productsRes.data ?? [])
          .map((p: any) => {
            const idProduct = Number(p?.idProduct ?? p?.productId ?? p?.id);
            const qty = stockByProductId.get(idProduct) ?? 0;
            const barcodes = barcodesByProductId.get(idProduct) ?? [];
            const name = String(p?.name ?? "");
            const code = p?.code ? String(p?.code) : undefined;
            const searchindex = `${name} ${code ?? ""} ${barcodes.join(" ")}`.toLowerCase();

            return {
              id: idProduct,
              name,
              code,
              barcodes,
              searchindex,
              measurementunit: p?.measurementUnit ?? undefined,
              quantity: qty,
              price: Number(p?.price ?? 0),
              cost: Number(p?.cost ?? 0),
              dateupdated: p?.updatedAt ?? p?.createdAt ?? undefined,
              isenabled: Boolean(p?.isEnabled ?? true),
              istaxinclusiveprice: Boolean(p?.isTaxInclusivePrice ?? true),
            };
          })
          .filter((r: any) => Number.isFinite(r.id) && r.id > 0);

        return { data: rows };
      },
      {
        keyParts: ["heavy", "stock-data", "warehouse", String(warehouseId)],
        revalidateSeconds: 15,
        tags: [CACHE_TAGS.heavy.stockData, CACHE_TAGS.heavy.dashboardOverview],
      }
    );

    return await load();
  } catch (error: any) {
    console.error("Error al obtener el stock por almacén:", error);
    return { data: [], error: error?.message || "Error loading stock data." };
  }
}
