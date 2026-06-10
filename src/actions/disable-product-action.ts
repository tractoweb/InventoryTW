'use server';

/**
 * Acción: Deshabilitación de producto con trazabilidad
 * 
 * Propósito:
 * - Deshabilitar un producto de forma segura
 * - Registrar razón y quién lo deshabilitó
 * - Crear entrada en DisabledEntityHistory y AuditLog
 */

import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'apiKey' });

export async function disableProduct(
  productId: number,
  reason: 'Accidental' | 'Duplicate' | 'Obsolete' | 'Temporary',
  notes?: string,
  userId: number = 1
): Promise<{ success: boolean; message: string; historyId?: string }> {
  try {
    // 1. Validar que el producto existe
    const product = await client.models.Product.get(
      { idProduct: productId },
      { selectionSet: ['idProduct', 'name', 'isEnabled'] }
    );

    if (!product) {
      return { success: false, message: '❌ Producto no encontrado' };
    }

    if (!product.isEnabled) {
      return { success: false, message: '❌ El producto ya está deshabilitado' };
    }

    // 2. Crear entrada en DisabledEntityHistory
    const historyId = `DH-${Date.now()}-${productId}`;
    
    await client.models.DisabledEntityHistory.create({
      historyId,
      entityType: 'Product',
      entityId: productId,
      reason,
      disabledBy: userId,
      disabledAt: new Date(),
      tags: [reason],
      notes: notes || '',
    });

    // 3. Actualizar producto
    await client.models.Product.update({
      idProduct: productId,
      isEnabled: false,
      disabledReason: reason,
      disabledAt: new Date(),
    });

    // 4. Registrar en AuditLog
    await client.models.AuditLog.create({
      logId: `AL-${Date.now()}-${Math.random()}`,
      userId,
      action: 'DISABLED',
      tableName: 'Product',
      recordId: productId,
      timestamp: new Date(),
      reason: `Producto deshabilitado: ${reason}`,
      relatedRecords: JSON.stringify({ productId, reason }),
    });

    return {
      success: true,
      message: `✅ Producto "${product.name}" deshabilitado correctamente`,
      historyId,
    };
  } catch (error) {
    console.error('Error deshabilitando producto:', error);
    return {
      success: false,
      message: `❌ Error al deshabilitar el producto: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
