
'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';
import { revalidateTag } from "next/cache";
import { amplifyClient } from '@/lib/amplify-config';
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
import { formatAmplifyError } from "@/lib/amplify-config";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { createProductAction } from "@/actions/create-product";
import { allocateCounterRange, ensureCounterAtLeast } from "@/lib/allocate-counter-range";
import { listAllPages } from "@/services/amplify-list-all";
import { inventoryService } from "@/services/inventory-service";
import { writeAuditLog } from "@/services/audit-log-service";
const AddProductSchema = z.object({
  name: z.string().min(2, "El nombre del producto es obligatorio."),
  code: z.string().optional(),
  measurementUnit: z.string().min(1, "La posición es obligatoria."),
  productGroupId: z.coerce.number().min(1, "Debe seleccionar una categoría."),
  description: z.string().optional(),
  isEnabled: z.boolean().default(true),
  isUsingDefaultQuantity: z.boolean().default(true),
  price: z.coerce.number().int().min(1, "El precio debe ser mayor a 0."),
  cost: z.coerce.number().int().min(1, "El costo debe ser mayor a 0."),
  markup: z.coerce.number().min(0, "El margen no puede ser negativo.").default(40),
  isTaxInclusivePrice: z.boolean().default(true),
  taxes: z.array(z.coerce.number()).optional(),
  reorderPoint: z.coerce.number().min(0).optional(),
  lowStockWarningQuantity: z.coerce.number().min(0).optional(),
  isLowStockWarningEnabled: z.boolean().default(true),
  initialQuantity: z.coerce.number().min(0).optional(),
  warehouseId: z.coerce.number().optional(),
}).refine(data => {
    if (data.initialQuantity && data.initialQuantity > 0) {
        return !!data.warehouseId;
    }
    return true;
}, {
    message: "Debe seleccionar un almacén si ingresa una cantidad inicial.",
    path: ["warehouseId"],
});


export type AddProductInput = z.infer<typeof AddProductSchema>;

/**
 * Crea un nuevo producto en la base de datos dentro de una transacción.
 * 1. Valida que el código no exista.
 * 2. Inserta en la tabla `product`.
 * 3. Si se provee, inserta el código como `barcode`.
 * 4. Si se proveen, inserta en `producttax`.
 * 5. Inserta la configuración de stock en `stockcontrol`.
 * 6. Si se provee, inserta el stock inicial en `stock`.
 */
export async function addProduct(input: AddProductInput) {
  noStore();
  const session = await requireSession(ACCESS_LEVELS.ADMIN);

  const validation = AddProductSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      error: "Datos de entrada inválidos.",
      details: validation.error.flatten().fieldErrors,
    };
  }

  try {
    const data = validation.data;

    const code = data.code ? String(data.code).trim() : "";
    if (code) {
      const existing: any = await amplifyClient.models.Product.list({
        filter: { code: { eq: code } },
        limit: 1,
      } as any);
      const found = Array.isArray(existing?.data) ? existing.data[0] : null;
      if (found?.idProduct !== undefined && found?.idProduct !== null) {
        return { success: false, error: `Ya existe un producto con el código: ${code}` };
      }
    }

    const createRes = await createProductAction({
      name: data.name,
      code: code || undefined,
      cost: data.cost,
      price: data.price,
      productGroupId: data.productGroupId,
      measurementUnit: data.measurementUnit,
      markup: data.markup,
      isUsingDefaultQuantity: data.isUsingDefaultQuantity,
      isEnabled: data.isEnabled,
      isService: false,
      isTaxInclusivePrice: data.isTaxInclusivePrice,
      barcodes: code ? [code] : undefined,
      taxIds: Array.isArray(data.taxes) ? data.taxes : undefined,
    });

    if (!createRes.success || !createRes.idProduct) {
      return { success: false, error: createRes.error || "No se pudo crear el producto." };
    }

    const idProduct = Number(createRes.idProduct);

    // Create a default StockControl entry for this product (one per product, customerId null)
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
      reorderPoint: Number(data.reorderPoint ?? 0),
      preferredQuantity: 0,
      isLowStockWarningEnabled: Boolean(data.isLowStockWarningEnabled),
      lowStockWarningQuantity: Number(data.lowStockWarningQuantity ?? 0),
    } as any);

    // Initial stock (optional): set warehouse stock to `initialQuantity` and write a Kardex entry.
    const initialQty = Number(data.initialQuantity ?? 0);
    const warehouseId = Number(data.warehouseId ?? 0);
    if (initialQty > 0 && Number.isFinite(warehouseId) && warehouseId > 0) {
      const res = await inventoryService.adjustStock(
        String(idProduct),
        String(warehouseId),
        initialQty,
        "Stock inicial",
        String(session.userId)
      );
      if (!res.success) {
        // Product created but stock init failed; return warning.
        return {
          success: true,
          message: `Producto "${data.name}" creado. Advertencia: no se pudo asignar stock inicial (${res.error ?? "error"}).`,
          idProduct,
        };
      }
    }

    writeAuditLog({
      userId: session.userId,
      action: "CREATE",
      tableName: "StockControl",
      recordId: stockControlId,
      newValues: {
        stockControlId,
        productId: idProduct,
        reorderPoint: Number(data.reorderPoint ?? 0),
        lowStockWarningQuantity: Number(data.lowStockWarningQuantity ?? 0),
        isLowStockWarningEnabled: Boolean(data.isLowStockWarningEnabled),
      },
    }).catch(() => {});

    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);
    revalidateTag(CACHE_TAGS.heavy.stockData);
    revalidateTag(CACHE_TAGS.heavy.productsMaster);
    revalidateTag(CACHE_TAGS.heavy.productDetails);

    return { success: true, message: `Producto "${data.name}" creado correctamente.`, idProduct };
  } catch (error: any) {
    console.error("Error al crear el producto:", error);
    return { success: false, error: formatAmplifyError(error) || error.message || "Error creating product." };
  }
}
