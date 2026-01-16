"use server";
import { amplifyClient } from '@/lib/amplify-config';
import { revalidateTag } from "next/cache";
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";
import { CACHE_TAGS } from "@/lib/cache-tags";

/**
 * Elimina un producto de la base de datos si no tiene dependencias en documentos.
 * @param productId El ID del producto a eliminar.
 */
export async function deleteProduct(productId: number): Promise<{ success: boolean; message?: string; error?: string }> {
  const session = await requireSession(ACCESS_LEVELS.ADMIN);

  if (!productId) {
    return { success: false, error: "ID de producto no proporcionado." };
  }

  try {
    const existing: any = await amplifyClient.models.Product.get({ idProduct: Number(productId) } as any);
    const product = (existing as any)?.data;
    if (!product) return { success: false, error: "Producto no encontrado." };

    // Safe-delete: keep traceability by disabling the product.
    await amplifyClient.models.Product.update({
      idProduct: Number(productId),
      isEnabled: false,
    } as any);

    writeAuditLog({
      userId: session.userId,
      action: "SOFT_DELETE",
      tableName: "Product",
      recordId: Number(productId),
      oldValues: {
        idProduct: Number(productId),
        name: product?.name ?? null,
        code: product?.code ?? null,
        isEnabled: product?.isEnabled ?? null,
      },
      newValues: {
        idProduct: Number(productId),
        isEnabled: false,
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
