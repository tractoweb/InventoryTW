/**
 * Servicio de Kardex (Kardex)
 * Gestiona el registro de movimientos de inventario
 * Proporciona auditoría completa de entrada/salida/ajustes
 */

'use server';

import { amplifyClient, KARDEX_TYPES, formatAmplifyError } from '@/lib/amplify-config';

export interface KardexEntry {
  productId: string;
  date: Date;
  documentId?: string;
  documentNumber?: string;
  type: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  quantity: number;
  balance: number;
  unitCost?: number;
  totalCost?: number;
  note?: string;
  userId?: string;
}

/**
 * Registra un movimiento en el kardex
 * Automáticamente calcula el balance y crea el registro de auditoría
 */
export async function createKardexEntry(
  entry: KardexEntry
): Promise<{ success: boolean; kardexId?: string; error?: string }> {
  try {
    // Obtener balance actual del producto
    const { data: stocks } = await amplifyClient.models.Stock.list({
      filter: {
        productId: { eq: entry.productId },
      },
    });

    const currentStock = stocks?.[0]?.quantity || 0;

    // Crear entrada en Kardex
    const result = await amplifyClient.models.Kardex.create({
      productId: entry.productId,
      date: entry.date.toISOString(),
      documentId: entry.documentId,
      documentNumber: entry.documentNumber,
      type: entry.type,
      quantity: entry.quantity,
      balance: entry.balance,
      unitCost: entry.unitCost,
      totalCost: entry.totalCost,
      note: entry.note,
      userId: entry.userId,
    });

    if (!result.data) {
      return {
        success: false,
        error: 'Failed to create kardex entry',
      };
    }

    // Crear historial de cambios
    if (entry.userId && result.data) {
      await amplifyClient.models.KardexHistory.create({
        kardexId: (result.data as any).id,
        productId: entry.productId,
        previousBalance: currentStock,
        newBalance: entry.balance,
        modifiedBy: entry.userId,
        modifiedDate: new Date().toISOString(),
        reason: entry.note,
      });
    }

    return {
      success: true,
      kardexId: (result.data as any).id,
    };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Obtiene el historial de kardex para un producto
 */
export async function getProductKardexHistory(
  productId: string,
  limit: number = 100
): Promise<{
  success: boolean;
  entries?: any[];
  error?: string;
}> {
  try {
    const { data: entries, errors } = await amplifyClient.models.Kardex.list({
      filter: {
        productId: { eq: productId }
      }
    });

    if (errors) {
      return {
        success: false,
        error: 'Failed to fetch kardex history',
      };
    }

    // Ordenar por fecha descendente (más reciente primero)
    const sorted = entries?.sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );

    return {
      success: true,
      entries: sorted?.slice(0, limit),
    };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Obtiene el resumen de movimientos para un rango de fechas
 */
export async function getKardexSummary(
  startDate: Date,
  endDate: Date,
  productId?: string
): Promise<{
  success: boolean;
  summary?: {
    totalEntradas: number;
    totalSalidas: number;
    totalAjustes: number;
    netos: number;
  };
  error?: string;
}> {
  try {
    const filter = productId
      ? {
          productId: { eq: productId },
          date: {
            between: [startDate.toISOString(), endDate.toISOString()],
          },
        }
      : {
          date: {
            between: [startDate.toISOString(), endDate.toISOString()],
          },
        };

    const { data: entries, errors } = await amplifyClient.models.Kardex.list({
      filter: filter as any,
    });

    if (errors) {
      return {
        success: false,
        error: 'Failed to fetch kardex summary',
      };
    }

    const summary = {
      totalEntradas: 0,
      totalSalidas: 0,
      totalAjustes: 0,
      netos: 0,
    };

    entries?.forEach((entry) => {
      const quantity = entry.quantity || 0;
      if (entry.type === KARDEX_TYPES.ENTRADA) {
        summary.totalEntradas += quantity;
        summary.netos += quantity;
      } else if (entry.type === KARDEX_TYPES.SALIDA) {
        summary.totalSalidas += quantity;
        summary.netos -= quantity;
      } else if (entry.type === KARDEX_TYPES.AJUSTE) {
        summary.totalAjustes += quantity;
        summary.netos += quantity;
      }
    });

    return {
      success: true,
      summary,
    };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}

/**
 * Genera reporte de valuación de inventario basado en kardex
 */
export async function getInventoryValuation(
  warehouseId?: string
): Promise<{
  success: boolean;
  valuation?: {
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    totalValue: number;
  }[];
  totalValue?: number;
  error?: string;
}> {
  try {
    // Obtener todos los stocks
    const stockFilter = warehouseId ? { warehouseId: { eq: warehouseId } } : undefined;
    const { data: stocks } = await amplifyClient.models.Stock.list({
      filter: stockFilter as any,
    });

    if (!stocks || stocks.length === 0) {
      return {
        success: true,
        valuation: [],
        totalValue: 0,
      };
    }

    const valuation: any[] = [];
    let totalValue = 0;

    for (const stock of stocks) {
      // Obtener último costo unitario del kardex

      const { data: kardexEntries } = await amplifyClient.models.Kardex.list({
        filter: {
          productId: { eq: stock.productId },
        },
      });

      const lastUnitCost =
        kardexEntries?.[kardexEntries.length - 1]?.unitCost || (stock.product && 'cost' in stock.product ? stock.product.cost : 0) || 0;
      const value = Number(stock.quantity || 0) * Number(lastUnitCost);

      valuation.push({
        productId: stock.productId,
        productName: stock.product?.name || 'Unknown',
        quantity: stock.quantity,
        unitCost: lastUnitCost,
        totalValue: value,
      });

      totalValue += value;
    }

    return {
      success: true,
      valuation,
      totalValue,
    };
  } catch (error) {
    return {
      success: false,
      error: formatAmplifyError(error),
    };
  }
}
