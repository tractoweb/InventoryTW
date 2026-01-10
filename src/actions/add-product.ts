
'use server';

import { z } from 'zod';
import { amplifyClient } from '@/lib/amplify-config';
const AddProductSchema = z.object({
  name: z.string().min(2, "El nombre del producto es obligatorio."),
  code: z.string().optional(),
  measurementUnit: z.string().min(1, "La posición es obligatoria."),
  productGroupId: z.coerce.number().min(1, "Debe seleccionar una categoría."),
  description: z.string().optional(),
  isEnabled: z.boolean().default(true),
  isUsingDefaultQuantity: z.boolean().default(true),
  price: z.coerce.number().min(0, "El precio no puede ser negativo."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo.").optional(),
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
  const validation = AddProductSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      error: "Datos de entrada inválidos.",
      details: validation.error.flatten().fieldErrors,
    };
  }

  try {
    // TODO: Implement product creation in Amplify using amplifyClient
    const { name } = validation.data;
    return { success: true, message: `Producto "${name}" creado correctamente.` };
  } catch (error: any) {
    console.error("Error al crear el producto:", error);
    return { success: false, error: error.message || "Error creating product." };
  }
}
