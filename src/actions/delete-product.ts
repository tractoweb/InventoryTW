
'use server';

import { getDbConnection } from '@/lib/db-connection';
import type { Connection } from 'mysql2/promise';

/**
 * Elimina un producto de la base de datos si no tiene dependencias en documentos.
 * @param productId El ID del producto a eliminar.
 */
export async function deleteProduct(productId: number): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!productId) {
    return { success: false, error: "ID de producto no proporcionado." };
  }

  let connection: Connection | null = null;
  try {
    connection = await getDbConnection();
    await connection.beginTransaction();

    // 1. Verificar si el producto existe en algún 'documentitem'
    const checkQuery = 'SELECT DocumentId FROM documentitem WHERE ProductId = ? LIMIT 1;';
    const [documentItems] = await connection.execute(checkQuery, [productId]) as any[];

    if (documentItems.length > 0) {
      // Si el producto está en uso, no se puede eliminar.
      await connection.rollback();
      return {
        success: false,
        error: `El producto no se puede eliminar porque está asociado al documento con ID ${documentItems[0].DocumentId}. Considere deshabilitarlo en su lugar.`
      };
    }
    
    // 2. Si no hay dependencias, proceder con la eliminación.
    // Las tablas relacionadas como barcode, stock, stockcontrol, producttax
    // deberían tener ON DELETE CASCADE para eliminarse automáticamente.
    const deleteQuery = 'DELETE FROM product WHERE Id = ?;';
    const [deleteResult] = await connection.execute(deleteQuery, [productId]) as any[];

    if (deleteResult.affectedRows === 0) {
        await connection.rollback();
        return { success: false, error: "El producto no fue encontrado y no pudo ser eliminado." };
    }

    await connection.commit();
    return { success: true, message: `El producto con ID ${productId} ha sido eliminado correctamente.` };

  } catch (error: any) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error al eliminar el producto:", error);
    // Manejar errores de clave foránea que no sean de documentitem, si los hubiera
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        return { success: false, error: "No se puede eliminar el producto porque está referenciado en otras tablas (posiblemente órdenes abiertas o historiales)." };
    }
    return { success: false, error: error.message || "Error al conectar o ejecutar la consulta en la base de datos." };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
