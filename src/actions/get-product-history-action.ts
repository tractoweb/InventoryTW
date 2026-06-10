'use server';

/**
 * Acción: Obtener historial completo del producto
 * 
 * Propósito:
 * - Obtener todos los cambios, deshabilitaciones y fusiones
 * - Compilar vista completa de la trazabilidad del producto
 */

import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'apiKey' });

export async function getProductHistory(productId: number) {
  try {
    // 1. Obtener producto actual
    const product = await client.models.Product.get({ idProduct: productId });

    if (!product) {
      return { 
        success: false, 
        message: '❌ Producto no encontrado' 
      };
    }

    // 2. Obtener historial de deshabilitaciones
    const disabledHistory = await client.models.DisabledEntityHistory.list();
    const productDisabledHistory = disabledHistory.data.filter(
      h => h.entityId === productId && h.entityType === 'Product'
    ).sort((a, b) => new Date(b.disabledAt || 0).getTime() - new Date(a.disabledAt || 0).getTime());

    // 3. Obtener historial de fusiones (como primario o duplicado)
    const mergeHistory = await client.models.ProductMergeHistory.list();
    const productMerges = mergeHistory.data.filter(
      m => m.primaryProductId === productId || m.duplicateProductId === productId
    );

    // 4. Obtener audit log del producto
    const auditLog = await client.models.AuditLog.list();
    const productAuditLog = auditLog.data.filter(
      a => a.recordId === productId
    ).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    // 5. Obtener candidatos a duplicado
    const duplicateCandidates = await client.models.ProductDuplicateCandidate.list();
    const productCandidates = duplicateCandidates.data.filter(
      d => d.primaryProductId === productId || d.duplicateProductId === productId
    );

    return {
      success: true,
      data: {
        product,
        disabledHistory: productDisabledHistory,
        mergeHistory: productMerges,
        auditLog: productAuditLog,
        duplicateCandidates: productCandidates,
        timeline: compileTimeline({
          product,
          disabledHistory: productDisabledHistory,
          mergeHistory: productMerges,
          auditLog: productAuditLog,
        }),
      },
    };
  } catch (error) {
    console.error('Error obteniendo historial de producto:', error);
    return {
      success: false,
      message: `❌ Error al obtener historial: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

/**
 * Compila un timeline de eventos del producto
 */
function compileTimeline(data: any) {
  const events: any[] = [];

  // Agregar creación (si existe en audit log)
  const createdEvent = data.auditLog?.find((a: any) => a.action === 'CREATED');
  if (createdEvent) {
    events.push({
      date: createdEvent.timestamp,
      type: 'CREATED',
      description: 'Producto creado',
      user: createdEvent.userId,
      details: createdEvent.newValues,
    });
  }

  // Agregar deshabilitaciones
  for (const history of data.disabledHistory || []) {
    events.push({
      date: history.disabledAt,
      type: 'DISABLED',
      description: `Deshabilitado: ${history.reason}`,
      user: history.disabledBy,
      details: history.notes,
    });

    if (history.reenabledAt) {
      events.push({
        date: history.reenabledAt,
        type: 'ENABLED',
        description: `Rehabilitado: ${history.reenableReason}`,
        user: history.reenabledBy,
        details: '',
      });
    }
  }

  // Agregar fusiones
  for (const merge of data.mergeHistory || []) {
    if (merge.primaryProductId === data.product?.idProduct) {
      events.push({
        date: merge.mergedAt,
        type: 'MERGE_PRIMARY',
        description: `Producto ${merge.duplicateProductId} fusionado en este`,
        user: merge.mergedBy,
        details: merge.notes,
      });
    } else {
      events.push({
        date: merge.mergedAt,
        type: 'MERGE_DUPLICATE',
        description: `Fusionado en producto ${merge.primaryProductId}`,
        user: merge.mergedBy,
        details: merge.notes,
      });
    }
  }

  // Agregar otros cambios del audit log
  for (const audit of data.auditLog || []) {
    if (!['CREATED', 'DISABLED', 'ENABLED', 'MERGED'].includes(audit.action)) {
      events.push({
        date: audit.timestamp,
        type: audit.action,
        description: audit.reason || `Acción: ${audit.action}`,
        user: audit.userId,
        details: audit.oldValues || audit.newValues,
      });
    }
  }

  // Ordenar por fecha (descendente)
  return events.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
}

/**
 * Obtener solo candidatos a duplicado pendientes
 */
export async function getPendingDuplicateCandidatesForProduct(productId: number) {
  try {
    const candidates = await client.models.ProductDuplicateCandidate.list();
    const pending = candidates.data.filter(
      c => (c.primaryProductId === productId || c.duplicateProductId === productId) && c.status === 'PENDING'
    );
    return { success: true, data: pending };
  } catch (error) {
    console.error('Error obteniendo candidatos pendientes:', error);
    return { success: false, data: [] };
  }
}
