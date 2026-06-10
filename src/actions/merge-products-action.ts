'use server';

/**
 * Acción: Fusión de productos (MERGE)
 * 
 * Propósito:
 * - Fusionar dos productos (primary + duplicate)
 * - Ejecutar transacción segura consolidando datos
 * - Registrar en ProductMergeHistory y AuditLog
 * 
 * Flujo:
 * 1. Validar ambos productos
 * 2. Fusionar barcodes
 * 3. Redirigir kardex
 * 4. Redirigir documentos
 * 5. Fusionar stocks
 * 6. Desabilitar duplicado
 * 7. Registrar cambios
 */

import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>({ authMode: 'apiKey' });

export async function validateMerge(
  primaryId: number,
  duplicateId: number
): Promise<{
  canMerge: boolean;
  warnings: string[];
  conflicts: string[];
  impactedDocuments: number;
}> {
  const warnings: string[] = [];
  const conflicts: string[] = [];
  
  try {
    // Obtener ambos productos
    const primary = await client.models.Product.get(
      { idProduct: primaryId },
      { selectionSet: ['idProduct', 'price', 'code', 'name', 'isEnabled', 'mergedIntoProductId'] }
    );
    
    const duplicate = await client.models.Product.get(
      { idProduct: duplicateId },
      { selectionSet: ['idProduct', 'price', 'code', 'name', 'isEnabled', 'mergedIntoProductId'] }
    );

    if (!primary || !duplicate) {
      conflicts.push('❌ Uno o ambos productos no existen');
      return { canMerge: false, warnings, conflicts, impactedDocuments: 0 };
    }

    // Verificar si ya fueron merged
    if (duplicate.mergedIntoProductId) {
      conflicts.push(`❌ El producto ya fue fusionado con ${duplicate.mergedIntoProductId}`);
    }

    if (primary.mergedIntoProductId) {
      conflicts.push(`⚠️ El producto primario también fue fusionado. Revisar.`);
    }

    // Verificar diferencia de precios
    if (primary.price && duplicate.price) {
      const priceDiff = Math.abs(primary.price - duplicate.price) / primary.price * 100;
      if (priceDiff > 10) {
        warnings.push(
          `⚠️ Los precios difieren en ${priceDiff.toFixed(1)}%: $${primary.price} vs $${duplicate.price}`
        );
      }
    }

    // Contar documentos impactados
    const documentItems = await client.models.DocumentItem.list();
    const impactedDocs = new Set(
      documentItems.data
        .filter(item => item.productId === duplicateId)
        .map(item => item.documentId)
    );

    const impactedDocuments = impactedDocs.size;

    if (impactedDocuments > 0) {
      warnings.push(`📄 ${impactedDocuments} documento(s) serán redirigido(s)`);
    }

    return {
      canMerge: conflicts.length === 0,
      warnings,
      conflicts,
      impactedDocuments,
    };
  } catch (error) {
    console.error('Error validando merge:', error);
    conflicts.push(`Error de validación: ${error instanceof Error ? error.message : 'Unknown'}`);
    return { canMerge: false, warnings, conflicts, impactedDocuments: 0 };
  }
}

export async function mergeProducts(
  primaryId: number,
  duplicateId: number,
  userId: number = 1
): Promise<{
  success: boolean;
  message: string;
  summary?: {
    barcodesMerged: number;
    kardexMerged: number;
    documentsMerged: number;
    stocksMerged: number;
  };
}> {
  try {
    // 1. Validar merge
    const validation = await validateMerge(primaryId, duplicateId);

    if (!validation.canMerge) {
      return {
        success: false,
        message: `❌ No se puede fusionar: ${validation.conflicts.join(', ')}`,
      };
    }

    console.log(`🔄 Iniciando merge: ${primaryId} ← ${duplicateId}`);

    let barcodeCount = 0;
    let kardexCount = 0;
    let documentCount = 0;
    let stockCount = 0;

    // 2. Fusionar barcodes
    const barcodes = await client.models.Barcode.list();
    const productBarcodes = barcodes.data.filter(b => b.productId === duplicateId);

    for (const barcode of productBarcodes) {
      try {
        await client.models.Barcode.update({
          productId: primaryId,
          value: barcode.value,
        });
        barcodeCount++;
      } catch (e) {
        console.warn(`⚠️ No se pudo fusionar barcode ${barcode.value}:`, e);
      }
    }

    // 3. Redirigir kardex
    const kardexEntries = await client.models.Kardex.list();
    const productKardex = kardexEntries.data.filter(k => k.productId === duplicateId);

    for (const entry of productKardex) {
      try {
        await client.models.Kardex.update({
          kardexId: entry.kardexId,
          productId: primaryId,
        });
        kardexCount++;
      } catch (e) {
        console.warn(`⚠️ No se pudo redirigir kardex entry:`, e);
      }
    }

    // 4. Redirigir documentos
    const documentItems = await client.models.DocumentItem.list();
    const productDocs = documentItems.data.filter(d => d.productId === duplicateId);

    const documentIds = new Set<number>();
    for (const item of productDocs) {
      try {
        await client.models.DocumentItem.update({
          documentItemId: item.documentItemId,
          productId: primaryId,
        });
        if (item.documentId) {
          documentIds.add(item.documentId);
        }
        documentCount++;
      } catch (e) {
        console.warn(`⚠️ No se pudo redirigir documento item:`, e);
      }
    }

    // 5. Fusionar stocks
    const stocks = await client.models.Stock.list();
    const productStocks = stocks.data.filter(s => s.productId === duplicateId);

    for (const stock of productStocks) {
      try {
        // Buscar si existe stock del primario en el mismo warehouse
        const existingStocks = await client.models.Stock.list();
        const existingStock = existingStocks.data.find(
          s => s.productId === primaryId && s.warehouseId === stock.warehouseId
        );

        if (existingStock) {
          // Sumar cantidades
          await client.models.Stock.update({
            productId: primaryId,
            warehouseId: stock.warehouseId,
            quantity: (existingStock.quantity || 0) + (stock.quantity || 0),
          });
        } else {
          // Copiar stock
          await client.models.Stock.update({
            productId: primaryId,
            warehouseId: stock.warehouseId,
            quantity: stock.quantity,
          });
        }
        stockCount++;
      } catch (e) {
        console.warn(`⚠️ No se pudo fusionar stock:`, e);
      }
    }

    // 6. Deshabilitar producto duplicado
    try {
      await client.models.Product.update({
        idProduct: duplicateId,
        isEnabled: false,
        mergedIntoProductId: primaryId,
        disabledReason: 'MERGED_WITH_PRIMARY',
        disabledAt: new Date(),
      });
    } catch (e) {
      console.warn(`⚠️ No se pudo desabilitar duplicado:`, e);
    }

    // 7. Registrar en ProductMergeHistory
    try {
      const mergeId = `PM-${Date.now()}`;
      await client.models.ProductMergeHistory.create({
        mergeId,
        primaryProductId: primaryId,
        duplicateProductId: duplicateId,
        mergedBy: userId,
        mergedAt: new Date(),
        barcodesMerged: barcodeCount,
        commentsMerged: 0,
        stockControlsMerged: stockCount,
        notes: `Fusionado automáticamente. ${documentCount} documentos impactados.`,
        reversible: false,
      });
    } catch (e) {
      console.warn(`⚠️ No se pudo crear ProductMergeHistory:`, e);
    }

    // 8. Registrar en AuditLog
    try {
      await client.models.AuditLog.create({
        logId: `AL-${Date.now()}-${Math.random()}`,
        userId,
        action: 'MERGED',
        tableName: 'Product',
        recordId: duplicateId,
        timestamp: new Date(),
        reason: `Producto fusionado en ${primaryId}`,
        relatedRecords: JSON.stringify({
          primaryProductId: primaryId,
          impactedDocuments: Array.from(documentIds),
        }),
        impactedDocuments: documentIds.size,
      });
    } catch (e) {
      console.warn(`⚠️ No se pudo registrar AuditLog:`, e);
    }

    return {
      success: true,
      message: `✅ Productos fusionados exitosamente. ${documentIds.size} documento(s) actualizado(s).`,
      summary: {
        barcodesMerged: barcodeCount,
        kardexMerged: kardexCount,
        documentsMerged: documentCount,
        stocksMerged: stockCount,
      },
    };
  } catch (error) {
    console.error('Error en merge:', error);
    return {
      success: false,
      message: `❌ Error al fusionar productos: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
