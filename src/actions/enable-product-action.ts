'use server';

/**
 * Acción: Rehabilitación de producto con validaciones
 * 
 * Propósito:
 * - Reabilitar un producto deshabilitado
 * - Validar que no fue merged (advertencia)
 * - Registrar reenablement en trazabilidad
 */

import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'apiKey' });

export async function enableProduct(
  productId: number,
  reason?: string,
  userId: number = 1
): Promise<{
  success: boolean;
  message: string;
  warnings?: string[];
}> {
  try {
    // 1. Obtener producto
    const product = await client.models.Product.get(
      { idProduct: productId },
      {
        selectionSet: [
          'idProduct',
          'name',
          'isEnabled',
          'mergedIntoProductId',
          'disabledReason',
        ],
      }
    );

    if (!product) {
      return { success: false, message: '❌ Producto no encontrado' };
    }

    if (product.isEnabled) {
      return { success: false, message: '❌ El producto ya está habilitado' };
    }

    // 2. Validar: Si fue merged, advertencia
    const warnings: string[] = [];
    if (product.mergedIntoProductId) {
      warnings.push(
        `⚠️ Este producto fue fusionado con ID ${product.mergedIntoProductId}. Reabilitar puede causar duplicidades.`
      );
    }

    // 3. Obtener último registro de deshabilitación
    const history = await client.models.DisabledEntityHistory.list();
    const productHistory = history.data.filter(
      h => h.entityId === productId && h.entityType === 'Product'
    ).sort((a, b) => new Date(b.disabledAt || 0).getTime() - new Date(a.disabledAt || 0).getTime());

    if (productHistory.length > 0) {
      const lastRecord = productHistory[0];
      
      await client.models.DisabledEntityHistory.update({
        historyId: lastRecord.historyId,
        reenabledBy: userId,
        reenabledAt: new Date(),
        reenableReason: reason || 'Manual re-enablement',
      });
    }

    // 4. Actualizar producto
    await client.models.Product.update({
      idProduct: productId,
      isEnabled: true,
      lastEnabledAt: new Date(),
    });

    // 5. Registrar en AuditLog
    await client.models.AuditLog.create({
      logId: `AL-${Date.now()}-${Math.random()}`,
      userId,
      action: 'ENABLED',
      tableName: 'Product',
      recordId: productId,
      timestamp: new Date(),
      reason: reason || 'Manual re-enablement',
    });

    return {
      success: true,
      message: `✅ Producto "${product.name}" habilitado correctamente`,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error('Error habilitando producto:', error);
    return {
      success: false,
      message: `❌ Error al habilitar el producto: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
