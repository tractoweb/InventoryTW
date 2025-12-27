
'use server';

import { z } from 'zod';
import { getDbConnection } from '@/lib/db-connection';
import type { Connection } from 'mysql2/promise';

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
  const validation = UpdateProductSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      error: "Datos de entrada inválidos.",
      details: validation.error.flatten().fieldErrors,
    };
  }

  const { id, name, code, taxes, ...data } = validation.data;

  let connection: Connection | null = null;
  try {
    connection = await getDbConnection();
    
    // 0. Validar que el nuevo código no esté en uso por OTRO producto.
    if (code) {
        const [existingProduct] = await connection.execute('SELECT id FROM product WHERE code = ? AND id != ?', [code, id]) as any[];
        if (existingProduct.length > 0) {
            return {
                success: false,
                error: `La referencia "${code}" ya está en uso por otro producto.`,
            };
        }
    }

    await connection.beginTransaction();

    // 1. Actualizar la tabla product
    const productQuery = `
      UPDATE product SET
        Name = ?, Code = ?, Description = ?, Price = ?, Cost = ?, MeasurementUnit = ?,
        IsEnabled = ?, ProductGroupId = ?
      WHERE Id = ?;
    `;
    await connection.execute(productQuery, [
      name,
      code || null,
      data.description || null,
      data.price,
      data.cost || 0,
      data.measurementunit || null,
      data.isenabled,
      data.productgroupid || null,
      id
    ]);
    
    // 2. Gestionar el código de barras
    // Primero, intentar eliminar el código de barras existente
    await connection.execute('DELETE FROM barcode WHERE ProductId = ?', [id]);
    // Luego, si se proporciona un nuevo código, insertarlo como barcode
    if (code) {
        await connection.execute('INSERT INTO barcode (ProductId, Value) VALUES (?, ?)', [id, code]);
    }


    // 3. Gestionar los impuestos en producttax
    // Primero, eliminar los impuestos existentes para este producto
    await connection.execute('DELETE FROM producttax WHERE ProductId = ?', [id]);
    
    // Luego, insertar los nuevos impuestos si existen
    if (taxes && taxes.length > 0) {
      const taxValues = taxes.map(taxId => [id, taxId]);
      await connection.query('INSERT INTO producttax (ProductId, TaxId) VALUES ?', [taxValues]);
    }

    // 4. Actualizar stockcontrol
    const stockControlQuery = `
      UPDATE stockcontrol SET
        ReorderPoint = ?, IsLowStockWarningEnabled = ?, LowStockWarningQuantity = ?
      WHERE ProductId = ?;
    `;
    await connection.execute(stockControlQuery, [
      data.reorderpoint || 0,
      data.islowstockwarningenabled,
      data.lowstockwarningquantity || 0,
      id
    ]);
    
    // Si todo fue bien, confirmar la transacción
    await connection.commit();

    return { success: true, message: `Producto "${name}" actualizado correctamente.` };
  } catch (error: any) {
    // Si algo falló, revertir todos los cambios
    if (connection) {
      await connection.rollback();
    }
    console.error("Error al actualizar el producto:", error);
    return { success: false, error: error.message || "Error al conectar o ejecutar la consulta en la base de datos." };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
