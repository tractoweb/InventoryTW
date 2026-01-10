'use server';

import { z } from 'zod';

const AdjustStockSchema = z.object({
  productId: z.coerce.number().min(1, "Debe seleccionar un producto."),
  warehouseId: z.coerce.number().min(1, "Debe seleccionar un almacén."),
  quantity: z.coerce.number().min(0, "La cantidad no puede ser negativa."),
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
  const validation = AdjustStockSchema.safeParse(input);

  if (!validation.success) {
    return { 
        success: false, 
        error: "Datos de entrada inválidos.",
        details: validation.error.flatten().fieldErrors,
    };
  }

  const { productId, warehouseId, quantity } = validation.data;

  console.log(`Simulando ajuste de stock: Producto ID ${productId}, Almacén ID ${warehouseId}, Nueva Cantidad: ${quantity}`);
  
  // Aquí iría la lógica para interactuar con la base de datos.
  // Por ahora, siempre devolvemos éxito para la demo.
  
  try {
    // const result = await queryDatabase(
    //   `INSERT INTO stock (productid, warehouseid, quantity) VALUES (?, ?, ?)
    //    ON DUPLICATE KEY UPDATE quantity = ?`,
    //   [productId, warehouseId, quantity, quantity]
    // );
    // console.log("Resultado de la base de datos:", result);
    return { success: true, message: "Stock ajustado correctamente (simulado)." };
  } catch (error: any) {
    console.error("Error al ajustar stock:", error);
    return { success: false, error: error.message || "Error al conectar con la base de datos." };
  }
}
