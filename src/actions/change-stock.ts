"use server";

import { z } from "zod";
import { revalidateTag } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { inventoryService } from "@/services/inventory-service";
import { amplifyClient } from "@/lib/amplify-config";

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
  previousQuantity?: number;
  difference?: number;
}> {
  let session: any;
  try {
    // Stock editing must never crash the UI; return structured errors.
    // If you want to restrict this to admins only, change to ACCESS_LEVELS.ADMIN.
    session = await requireSession(ACCESS_LEVELS.CASHIER);
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }

  const parsed = ChangeStockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos de entrada inválidos." };
  }

  const { productId, warehouseId, delta } = parsed.data;
  if (!delta) return { success: true, newQuantity: undefined };

  try {
    const { data: stock } = await amplifyClient.models.Stock.get({ productId, warehouseId } as any).catch(() => ({ data: null } as any));
    const currentQtyRaw: unknown = (stock as any)?.quantity ?? 0;
    const currentQty = Number(currentQtyRaw);
    const safeCurrent = Number.isFinite(currentQty) ? currentQty : 0;
    const targetQty = Math.max(0, safeCurrent + delta);

    const reason = `Ajuste rápido (${delta > 0 ? "+" : ""}${delta})`;

    const res = await inventoryService.adjustStock(
      String(productId),
      String(warehouseId),
      targetQty,
      reason,
      String(session.userId)
    );

    if (!res.success) {
      return { success: false, error: res.error || "No se pudo ajustar el stock." };
    }

    revalidateTag(CACHE_TAGS.heavy.stockData);
    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);

    return {
      success: true,
      newQuantity: res.newQuantity,
      previousQuantity: res.previousQuantity,
      difference: res.difference,
    };
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }
}
