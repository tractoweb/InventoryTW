"use server";

import { z } from "zod";
import { revalidateTag } from "next/cache";

import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { inventoryService } from "@/services/inventory-service";
import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";

const ChangeStockSchema = z.object({
  productId: z.coerce.number().int().min(1),
  warehouseId: z.coerce.number().int().min(1),
  delta: z.coerce.number().int(),
});

export type ChangeStockInput = z.infer<typeof ChangeStockSchema>;

export async function changeStock(input: ChangeStockInput): Promise<{
  success: boolean;
  error?: string;
  newQuantity?: number;
}> {
  const session = await requireSession(ACCESS_LEVELS.ADMIN);

  const parsed = ChangeStockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos de entrada inválidos." };
  }

  const { productId, warehouseId, delta } = parsed.data;
  if (!delta) return { success: true, newQuantity: undefined };

  try {
    // Read current stock as reliably as possible.
    // Stock has a composite identifier (productId, warehouseId), so get() is ideal.
    let currentQuantityRaw: unknown = 0;

    try {
      const { data: stock } = await amplifyClient.models.Stock.get({ productId, warehouseId } as any);
      if (stock) {
        currentQuantityRaw = (stock as any)?.quantity ?? 0;
      } else {
        const { data: stocks } = await amplifyClient.models.Stock.list({
          filter: {
            productId: { eq: productId },
            warehouseId: { eq: warehouseId },
          },
          limit: 1,
        });
        currentQuantityRaw = (stocks?.[0] as any)?.quantity ?? 0;
      }
    } catch {
      const { data: stocks } = await amplifyClient.models.Stock.list({
        filter: {
          productId: { eq: productId },
          warehouseId: { eq: warehouseId },
        },
        limit: 1,
      });
      currentQuantityRaw = (stocks?.[0] as any)?.quantity ?? 0;
    }

    const currentQuantity = Number(currentQuantityRaw ?? 0);
    const safeCurrent = Number.isFinite(currentQuantity) ? currentQuantity : 0;
    const newQuantity = Math.max(0, safeCurrent + delta);

    const reason = `Ajuste rápido (${delta > 0 ? "+" : ""}${delta})`;

    const res = await inventoryService.adjustStock(
      String(productId),
      String(warehouseId),
      newQuantity,
      reason,
      String(session.userId)
    );

    if (!res.success) {
      return { success: false, error: res.error || "No se pudo ajustar el stock." };
    }

    revalidateTag(CACHE_TAGS.heavy.stockData);
    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);

    return { success: true, newQuantity };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
