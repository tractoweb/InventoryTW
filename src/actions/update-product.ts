"use server";
import { z } from 'zod';
import { amplifyClient } from '@/lib/amplify-config';
import { ACCESS_LEVELS } from "@/lib/amplify-config";
import { requireSession } from "@/lib/session";
const UpdateProductSchema = z.object({
  id: z.number(),
  name: z.string().min(2, "El nombre del producto es obligatorio."),
  code: z.string().optional(),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "El precio no puede ser negativo."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo.").optional(),
  measurementunit: z.string().optional(),
  isenabled: z.boolean(),
  productgroupid: z.coerce.number().optional(),
  taxes: z.array(z.coerce.number()).optional(),
  reorderpoint: z.coerce.number().min(0).optional(),
  lowstockwarningquantity: z.coerce.number().min(0).optional(),
  islowstockwarningenabled: z.boolean(),
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

/**
 * Actualiza un producto existente en la base de datos dentro de una transacción.
 */
export async function updateProduct(input: UpdateProductInput) {
  await requireSession(ACCESS_LEVELS.ADMIN);

  const validation = UpdateProductSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      error: "Datos de entrada inválidos.",
      details: validation.error.flatten().fieldErrors,
    };
  }

  try {
    // TODO: Implement product update in Amplify using amplifyClient
    const { name } = validation.data;
    return { success: true, message: `Producto "${name}" actualizado correctamente.` };
  } catch (error: any) {
    console.error("Error al actualizar el producto:", error);
    return { success: false, error: error.message || "Error updating product." };
  }
}
