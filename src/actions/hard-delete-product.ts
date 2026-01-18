"use server";

import { z } from "zod";
import { unstable_noStore as noStore, revalidateTag } from "next/cache";

import { amplifyClient, formatAmplifyError, ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { writeAuditLog } from "@/services/audit-log-service";
import { CACHE_TAGS } from "@/lib/cache-tags";

const HardDeleteProductSchema = z.object({
  productId: z.coerce.number().min(1),
});

type Blocker = {
  table: string;
  count: number;
};

async function countAny(modelName: keyof typeof amplifyClient.models, filter: any): Promise<number> {
  const model: any = (amplifyClient.models as any)[modelName];
  if (!model?.list) return 0;
  const res: any = await model.list({ filter, limit: 1 } as any);
  const data = (res?.data ?? []) as any[];
  return data.length > 0 ? data.length : 0;
}

export async function hardDeleteProductAction(raw: z.input<typeof HardDeleteProductSchema>): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  blockedBy?: Blocker[];
}> {
  noStore();

  const session = await requireSession(ACCESS_LEVELS.MASTER);

  const parsed = HardDeleteProductSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  const productId = Number(parsed.data.productId);

  try {
    const existing: any = await amplifyClient.models.Product.get({ idProduct: productId } as any);
    const product = existing?.data as any;
    if (!product) return { success: false, error: "Producto no encontrado" };

    if (product?.isEnabled !== false) {
      return { success: false, error: "Solo se permite eliminación definitiva de productos desactivados." };
    }

    // Safety: never hard-delete if there is traceability data pointing to the product.
    const blockers: Blocker[] = [];

    const checks: Array<Promise<void>> = [
      countAny("DocumentItem", { productId: { eq: productId } }).then((c) => {
        if (c) blockers.push({ table: "DocumentItem", count: c });
        return undefined;
      }),
      countAny("Kardex", { productId: { eq: productId } }).then((c) => {
        if (c) blockers.push({ table: "Kardex", count: c });
        return undefined;
      }),
      countAny("KardexHistory", { productId: { eq: productId } }).then((c) => {
        if (c) blockers.push({ table: "KardexHistory", count: c });
        return undefined;
      }),
      countAny("Stock", { productId: { eq: productId } }).then((c) => {
        if (c) blockers.push({ table: "Stock", count: c });
        return undefined;
      }),
      countAny("StockControl", { productId: { eq: productId } }).then((c) => {
        if (c) blockers.push({ table: "StockControl", count: c });
        return undefined;
      }),
    ];

    await Promise.all(checks);

    if (blockers.length > 0) {
      return {
        success: false,
        error: "No se puede eliminar definitivamente: el producto tiene registros relacionados (trazabilidad).",
        blockedBy: blockers,
      };
    }

    // These are usually safe to remove (not traceability-critical), but we delete them anyway.
    const barcodeRes: any = await amplifyClient.models.Barcode.list({
      filter: { productId: { eq: productId } },
      limit: 200,
    } as any);
    for (const b of (barcodeRes?.data ?? []) as any[]) {
      const value = String(b?.value ?? "");
      if (!value) continue;
      await amplifyClient.models.Barcode.delete({ productId, value } as any);
    }

    const productTaxRes: any = await amplifyClient.models.ProductTax.list({
      filter: { productId: { eq: productId } },
      limit: 200,
    } as any);
    for (const t of (productTaxRes?.data ?? []) as any[]) {
      const taxId = Number(t?.taxId);
      if (!Number.isFinite(taxId)) continue;
      await amplifyClient.models.ProductTax.delete({ productId, taxId } as any);
    }

    const commentsRes: any = await amplifyClient.models.ProductComment.list({
      filter: { productId: { eq: productId } },
      limit: 200,
    } as any);
    for (const c of (commentsRes?.data ?? []) as any[]) {
      const commentId = Number(c?.commentId);
      if (!Number.isFinite(commentId)) continue;
      await amplifyClient.models.ProductComment.delete({ commentId } as any);
    }

    // Write audit snapshot BEFORE deleting.
    writeAuditLog({
      userId: session.userId,
      action: "HARD_DELETE",
      tableName: "Product",
      recordId: productId,
      oldValues: {
        idProduct: productId,
        name: product?.name ?? null,
        code: product?.code ?? null,
        isEnabled: product?.isEnabled ?? null,
        productGroupId: product?.productGroupId ?? null,
        price: product?.price ?? null,
        cost: product?.cost ?? null,
        createdAt: product?.createdAt ?? null,
        updatedAt: product?.updatedAt ?? null,
      },
      newValues: null,
    }).catch(() => {});

    await amplifyClient.models.Product.delete({ idProduct: productId } as any);

    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);
    revalidateTag(CACHE_TAGS.heavy.stockData);
    revalidateTag(CACHE_TAGS.heavy.productsMaster);

    return { success: true, message: "Producto eliminado definitivamente." };
  } catch (error) {
    return { success: false, error: formatAmplifyError(error) };
  }
}
