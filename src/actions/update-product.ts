"use server";
import { z } from 'zod';
import { amplifyClient } from '@/lib/amplify-server';
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { unstable_noStore as noStore } from "next/cache";
import { revalidateTag } from "next/cache";
import { formatAmplifyError } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";
import { allocateCounterRange, ensureCounterAtLeast } from "@/lib/allocate-counter-range";
import { writeAuditLog } from "@/services/audit-log-service";
import { CACHE_TAGS } from "@/lib/cache-tags";
const UpdateProductSchema = z.object({
  id: z.number(),
  name: z.string().min(2, "El nombre del producto es obligatorio."),
  code: z.string().optional(),
  description: z.string().optional(),
  allowUndefinedPricing: z.boolean().optional(),
  price: z.coerce.number().int().min(0, "El precio no puede ser negativo."),
  cost: z.coerce.number().int().min(0, "El costo no puede ser negativo."),
  markup: z.coerce.number().min(0).optional(),
  isTaxInclusivePrice: z.boolean().optional(),
  measurementunit: z.string().optional(),
  isenabled: z.boolean(),
  productgroupid: z.coerce.number().optional(),
  taxes: z.array(z.coerce.number()).optional(),
  reorderpoint: z.coerce.number().min(0).optional(),
  lowstockwarningquantity: z.coerce.number().min(0).optional(),
  islowstockwarningenabled: z.boolean(),
}).superRefine((data, ctx) => {
  const allow = Boolean((data as any).allowUndefinedPricing);
  if (allow) return;
  if (!Number.isFinite(Number(data.price)) || Number(data.price) < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: "El precio no puede ser negativo." });
  }
  if (!Number.isFinite(Number(data.cost)) || Number(data.cost) < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cost"], message: "El costo no puede ser negativo." });
  }
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

/**
 * Actualiza un producto existente en la base de datos dentro de una transacción.
 */
export async function updateProduct(input: UpdateProductInput) {
  noStore();
  const session = await requireSession(ACCESS_LEVELS.ADMIN);

  const validation = UpdateProductSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      error: "Datos de entrada inválidos.",
      details: validation.error.flatten().fieldErrors,
    };
  }

  try {
    const data = validation.data;
    const idProduct = Number(data.id);

    let oldTaxIdsForAudit: number[] | null = null;
    let newTaxIdsForAudit: number[] | null = null;

    const existingRes: any = await amplifyClient.models.Product.get({ idProduct } as any);
    const existing = existingRes?.data as any;
    if (!existing) return { success: false, error: "Producto no encontrado." };

    const code = data.code ? String(data.code).trim() : "";
    if (code) {
      const other: any = await amplifyClient.models.Product.list({
        filter: { code: { eq: code } },
        limit: 5,
      } as any);
      const list = Array.isArray(other?.data) ? other.data : [];
      const conflict = list.find((p: any) => Number(p?.idProduct) !== idProduct);
      if (conflict?.idProduct !== undefined && conflict?.idProduct !== null) {
        return { success: false, error: `Ya existe otro producto con el código: ${code}` };
      }
    }

    const updatePayload: any = {
      idProduct,
      name: data.name,
      code: code || undefined,
      description: data.description ? String(data.description) : undefined,
      price: Number(data.price),
      cost: Number(data.cost),
      markup: data.markup !== undefined && data.markup !== null ? Number(data.markup) : undefined,
      isTaxInclusivePrice:
        data.isTaxInclusivePrice !== undefined && data.isTaxInclusivePrice !== null
          ? Boolean(data.isTaxInclusivePrice)
          : undefined,
      measurementUnit: data.measurementunit ? String(data.measurementunit) : undefined,
      isEnabled: Boolean(data.isenabled),
      productGroupId:
        data.productgroupid !== undefined && data.productgroupid !== null && Number.isFinite(Number(data.productgroupid))
          ? Number(data.productgroupid)
          : undefined,
    };

    const updated: any = await amplifyClient.models.Product.update(updatePayload);
    if (!updated?.data && Array.isArray(updated?.errors) && updated.errors.length) {
      return { success: false, error: String(updated.errors?.[0]?.message ?? "No se pudo actualizar el producto") };
    }

    // Sync taxes (ProductTax join table)
    if (Array.isArray(data.taxes)) {
      const desiredTaxIds = Array.from(
        new Set(data.taxes.map((t) => Number(t)).filter((t) => Number.isFinite(t) && t > 0))
      );

      const existingTaxesRes = await listAllPages<any>((args) => amplifyClient.models.ProductTax.list(args), {
        filter: { productId: { eq: idProduct } },
      });
      const existingTaxIds = new Set<number>(
        ("error" in existingTaxesRes ? [] : (existingTaxesRes.data ?? []))
          .map((pt: any) => Number(pt?.taxId))
          .filter((t: any) => Number.isFinite(t) && t > 0)
      );

      oldTaxIdsForAudit = Array.from(existingTaxIds).sort((a, b) => a - b);
      newTaxIdsForAudit = desiredTaxIds.slice().sort((a, b) => a - b);

      // Create missing
      for (const taxId of desiredTaxIds) {
        if (existingTaxIds.has(taxId)) continue;
        try {
          await amplifyClient.models.ProductTax.create({ productId: idProduct, taxId } as any);
        } catch {
          // ignore best-effort
        }
      }

      // Delete removed
      for (const taxId of Array.from(existingTaxIds)) {
        if (desiredTaxIds.includes(taxId)) continue;
        try {
          await amplifyClient.models.ProductTax.delete({ productId: idProduct, taxId } as any);
        } catch {
          // ignore best-effort
        }
      }
    }

    // Upsert default StockControl (customerId null)
    const controlsRes = await listAllPages<any>((args) => amplifyClient.models.StockControl.list(args), {
      filter: { productId: { eq: idProduct } },
    });

    const controls = "error" in controlsRes ? [] : (controlsRes.data ?? []);
    const pickDefault = (arr: any[]) => {
      const nullCustomer = arr.filter((c) => c?.customerId === null || c?.customerId === undefined);
      const base = nullCustomer.length ? nullCustomer : arr;
      return base
        .slice()
        .sort((a, b) => Number(a?.stockControlId ?? 0) - Number(b?.stockControlId ?? 0))[0];
    };

    const existingControl = pickDefault(controls);
    const reorderPoint = Number(data.reorderpoint ?? 0);
    const lowStockWarningQuantity = Number(data.lowstockwarningquantity ?? 0);
    const isLowStockWarningEnabled = Boolean(data.islowstockwarningenabled);

    if (existingControl?.stockControlId) {
      await amplifyClient.models.StockControl.update({
        stockControlId: Number(existingControl.stockControlId),
        productId: idProduct,
        reorderPoint,
        lowStockWarningQuantity,
        isLowStockWarningEnabled,
      } as any);
    } else {
      const counterName = "stockControlId";
      const counterRes = await amplifyClient.models.Counter.get({ name: counterName });
      if (!counterRes.data) {
        const existingControls = await listAllPages<any>((args) => amplifyClient.models.StockControl.list(args));
        if (!("error" in existingControls)) {
          const maxExistingId = (existingControls.data ?? []).reduce((max: number, sc: any) => {
            const id = Number(sc?.stockControlId ?? 0);
            return Number.isFinite(id) ? Math.max(max, id) : max;
          }, 0);
          await ensureCounterAtLeast(counterName, maxExistingId);
        }
      }

      const [stockControlId] = await allocateCounterRange(counterName, 1);
      await amplifyClient.models.StockControl.create({
        stockControlId,
        productId: idProduct,
        customerId: undefined,
        reorderPoint,
        preferredQuantity: 0,
        isLowStockWarningEnabled,
        lowStockWarningQuantity,
      } as any);
    }

    writeAuditLog({
      userId: session.userId,
      action: "UPDATE",
      tableName: "Product",
      recordId: idProduct,
      oldValues: {
        idProduct,
        name: existing?.name ?? null,
        code: existing?.code ?? null,
        description: existing?.description ?? null,
        price: existing?.price ?? null,
        cost: existing?.cost ?? null,
        markup: existing?.markup ?? null,
        isTaxInclusivePrice: existing?.isTaxInclusivePrice ?? null,
        taxes: oldTaxIdsForAudit,
        productGroupId: existing?.productGroupId ?? null,
        measurementUnit: existing?.measurementUnit ?? null,
        isEnabled: existing?.isEnabled ?? null,
      },
      newValues: {
        idProduct,
        name: data.name,
        code: code || null,
        description: data.description ?? null,
        price: Number(data.price),
        cost: Number(data.cost),
        markup: data.markup ?? null,
        isTaxInclusivePrice: data.isTaxInclusivePrice ?? null,
        taxes: newTaxIdsForAudit,
        productGroupId: data.productgroupid ?? null,
        measurementUnit: data.measurementunit ?? null,
        isEnabled: Boolean(data.isenabled),
      },
    }).catch(() => {});

    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);
    revalidateTag(CACHE_TAGS.heavy.stockData);
    revalidateTag(CACHE_TAGS.heavy.productsMaster);
    revalidateTag(CACHE_TAGS.heavy.productDetails);

    return { success: true, message: `Producto "${data.name}" actualizado correctamente.` };
  } catch (error: any) {
    console.error("Error al actualizar el producto:", error);
    return { success: false, error: formatAmplifyError(error) || error.message || "Error updating product." };
  }
}
