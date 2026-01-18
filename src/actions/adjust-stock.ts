'use server';

import { z } from 'zod';
import { revalidateTag } from "next/cache";
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { inventoryService } from "@/services/inventory-service";

const AdjustStockSchema = z.object({
  productId: z.coerce.number().min(1, "Debe seleccionar un producto."),
  warehouseId: z.coerce.number().min(1, "Debe seleccionar un almacén."),
  quantity: z.coerce.number().min(0, "La cantidad no puede ser negativa."),
  reason: z.string().trim().min(1).max(280).optional(),
});

export type AdjustStockInput = z.infer<typeof AdjustStockSchema>;

/**
 * Simula el ajuste de stock para un producto en un almacén.
 * En una implementación real, esto ejecutaría una consulta SQL.
 * Por ejemplo:
 * INSERT INTO stock (productid, warehouseid, quantity)
 * VALUES (?, ?, ?)
 * ON DUPLICATE KEY UPDATE quantity = VALUES(quantity);
 */
export async function adjustStock(input: AdjustStockInput) {
  const session = await requireSession(ACCESS_LEVELS.ADMIN);

  const validation = AdjustStockSchema.safeParse(input);

  if (!validation.success) {
    return { 
        success: false, 
        error: "Datos de entrada inválidos.",
        details: validation.error.flatten().fieldErrors,
    };
  }

  try {
    const { productId, warehouseId, quantity, reason } = validation.data;

    const res = await inventoryService.adjustStock(
      String(productId),
      String(warehouseId),
      quantity,
      reason || "Ajuste manual",
      String(session.userId)
    );

    if (!res.success) {
      return { success: false, error: res.error || "No se pudo ajustar el stock." };
    }

    revalidateTag(CACHE_TAGS.heavy.stockData);
    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);

    return { success: true, message: "Stock ajustado correctamente." };
  } catch (error: any) {
    console.error("Error al ajustar stock:", error);
    return { success: false, error: error.message || "Error al conectar con la base de datos." };
  }
}
