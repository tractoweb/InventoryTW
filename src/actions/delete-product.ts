"use server";
import "server-only";
import { amplifyClient } from '@/lib/amplify-config';
import { revalidateTag } from "next/cache";
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { randomUUID } from "crypto";

/**
 * Deshabilita un producto (soft-delete) con trazabilidad completa.
 * 
 * @param productId El ID del producto a eliminar.
 * @param reason Razón de deshabilitación: "Accidental", "Duplicate", "Obsolete", "Temporary", etc.
 */
export async function deleteProduct(
  productId: number,
  reason?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!productId) {
    return { success: false, error: "ID de producto no proporcionado." };
  }

  try {
    const session = await requireSession(ACCESS_LEVELS.ADMIN);

    const existing: any = await amplifyClient.models.Product.get({ idProduct: Number(productId) } as any);
    const product = (existing as any)?.data;
    if (!product) return { success: false, error: "Producto no encontrado." };

    // Safe-delete: keep traceability by disabling the product.
    const disabledReason = reason || "MANUAL_DISABLE";
    
    const updated: any = await amplifyClient.models.Product.update({
      idProduct: Number(productId),
      isEnabled: false,
      disabledReason,
      disabledAt: new Date().toISOString(),
      lastEnabledAt: product.lastEnabledAt || (product.createdAt ? new Date().toISOString() : null),
    } as any);

    if (!updated?.data && Array.isArray(updated?.errors) && updated.errors.length) {
      return {
        success: false,
        error: String(updated.errors?.[0]?.message ?? "No se pudo desactivar el producto"),
      };
    }

    if (!updated?.data) {
      return { success: false, error: "No se pudo desactivar el producto." };
    }

    if ((updated as any)?.data?.isEnabled !== false) {
      return { success: false, error: "No se pudo confirmar la desactivación del producto." };
    }

    // Crear registro en DisabledEntityHistory
    try {
      await amplifyClient.models.DisabledEntityHistory.create({
        historyId: randomUUID(),
        entityType: "Product",
        entityId: Number(productId),
        reason: disabledReason,
        disabledBy: session.userId,
        disabledAt: new Date().toISOString(),
        tags: disabledReason === "Accidental" ? ["accidental"] : [],
        notes: `Product "${product?.name}" disabled by user ${session.userId}`,
      } as any);
    } catch (e) {
      console.error("Error creating DisabledEntityHistory:", e);
      // No bloquees la operación si falla la auditoría
    }

    writeAuditLog({
      userId: session.userId,
      action: "SOFT_DELETE",
      tableName: "Product",
      recordId: Number(productId),
      reason: disabledReason,
      oldValues: {
        idProduct: Number(productId),
        name: product?.name ?? null,
        code: product?.code ?? null,
        isEnabled: product?.isEnabled ?? null,
      },
      newValues: {
        idProduct: Number(productId),
        isEnabled: false,
        disabledReason,
        disabledAt: new Date().toISOString(),
      },
    }).catch(() => {});

    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);
    revalidateTag(CACHE_TAGS.heavy.stockData);
    revalidateTag(CACHE_TAGS.heavy.productsMaster);

    return { success: true, message: "Producto desactivado (no se elimina para no romper trazabilidad)." };
  } catch (error: any) {
    return { success: false, error: error?.message ?? "No se pudo desactivar el producto." };
  }
}
