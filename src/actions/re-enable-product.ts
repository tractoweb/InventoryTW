"use server";
import "server-only";

import { amplifyClient, formatAmplifyError, ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";
import { randomUUID } from "crypto";

/**
 * Rehabilita (reactiva) un producto deshabilitado.
 * 
 * @param productId ID del producto a rehabilitar
 * @param reason Razón de rehabilitación: "Was accidental", "Needed again", "Merged", etc.
 */
export async function reEnableProduct(
  productId: number,
  reason?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await requireSession(ACCESS_LEVELS.ADMIN);

    if (!Number.isFinite(productId) || productId <= 0) {
      return { success: false, error: "ID de producto inválido" };
    }

    const existing: any = await amplifyClient.models.Product.get({
      idProduct: Number(productId),
    } as any);
    const product = (existing as any)?.data;

    if (!product) {
      return { success: false, error: "Producto no encontrado" };
    }

    if (product.isEnabled === true) {
      return { success: false, error: "El producto ya está habilitado" };
    }

    // Rehabilitar producto
    const reenableReason = reason || "MANUAL_REENABLE";
    const updated: any = await amplifyClient.models.Product.update({
      idProduct: Number(productId),
      isEnabled: true,
      lastEnabledAt: new Date().toISOString(),
    } as any);

    if (!updated?.data) {
      return { success: false, error: "No se pudo rehabilitar el producto" };
    }

    // Registrar en DisabledEntityHistory que fue rehabilitado
    try {
      // Obtener el registro de deshabilitación más reciente
      const historyRes = await amplifyClient.models.DisabledEntityHistory.list({
        filter: {
          and: [
            { entityType: { eq: "Product" } },
            { entityId: { eq: productId } },
          ],
        },
      } as any);

      const mostRecentHistory = (historyRes.data ?? [])
        .sort((a: any, b: any) => {
          const aDate = new Date(a.disabledAt).getTime();
          const bDate = new Date(b.disabledAt).getTime();
          return bDate - aDate;
        })[0] as any;

      if (mostRecentHistory) {
        await amplifyClient.models.DisabledEntityHistory.update({
          historyId: mostRecentHistory.historyId,
          reenabledBy: session.userId,
          reenabledAt: new Date().toISOString(),
          reenableReason,
        } as any);
      }
    } catch (e) {
      console.error("Error updating DisabledEntityHistory:", e);
    }

    // Auditoría
    await writeAuditLog({
      userId: session.userId,
      action: "SOFT_RESTORE",
      tableName: "Product",
      recordId: Number(productId),
      reason: reenableReason,
      oldValues: {
        isEnabled: false,
        disabledReason: product.disabledReason,
      },
      newValues: {
        isEnabled: true,
        lastEnabledAt: new Date().toISOString(),
      },
    }).catch(() => {});

    return {
      success: true,
      message: `Producto "${product.name}" rehabilitado exitosamente`,
    };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
