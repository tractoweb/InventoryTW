/**
 * Servicio de Kardex (Kardex)
 * Gestiona el registro de movimientos de inventario
 * Proporciona auditoría completa de entrada/salida/ajustes
 */

import { amplifyClient, KARDEX_TYPES, formatAmplifyError } from '@/lib/amplify-config';

export interface KardexEntry {
  productId: number;
  date: Date;
  documentId?: number;
  documentItemId?: number;
  documentNumber?: string;
  warehouseId?: number;
  type: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  quantity: number;
  balance: number;
  /** Balance right before applying this movement (for accurate audit trails). */
  previousBalance?: number;
  unitCost?: number;
  totalCost?: number;
  unitPrice?: number;
  totalPrice?: number;
  totalPriceAfterDiscount?: number;
  note?: string;
  userId?: number;
}

async function nextCounterValue(counterName: string): Promise<number> {
  const { data: existing } = await amplifyClient.models.Counter.get({ name: counterName });
  if (!existing) {
    const created = await amplifyClient.models.Counter.create({ name: counterName, value: 1 });
    return (created.data as any)?.value ?? 1;
  }

  const current = Number((existing as any).value ?? 0);
  const next = (Number.isFinite(current) ? current : 0) + 1;
  await amplifyClient.models.Counter.update({ name: counterName, value: next });
  return next;
}

/**
 * Registra un movimiento en el kardex
 * Automáticamente calcula el balance y crea el registro de auditoría
 */
export async function createKardexEntry(
  entry: KardexEntry
): Promise<{ success: boolean; kardexId?: number; error?: string }> {
  try {
    // Obtener balance previo (por bodega cuando aplique)
    // NOTE: if the caller already knows it, trust it (prevents "previous" being computed after Stock update).
    let previousBalance = Number.isFinite(Number(entry.previousBalance)) ? Number(entry.previousBalance) : 0;
    const hasExplicitPrevious = Number.isFinite(Number(entry.previousBalance));

    if (!hasExplicitPrevious) {
    if (Number.isFinite(Number(entry.warehouseId)) && Number(entry.warehouseId) > 0) {
      const { data: stocks } = await amplifyClient.models.Stock.list({
        filter: {
          productId: { eq: entry.productId },
          warehouseId: { eq: Number(entry.warehouseId) },
        },
        limit: 1,
      } as any);
      previousBalance = Number((stocks?.[0] as any)?.quantity ?? 0) || 0;
    } else {
      const { data: stocks } = await amplifyClient.models.Stock.list({
        filter: {
          productId: { eq: entry.productId },
        },
      } as any);
      previousBalance = (stocks ?? []).reduce((sum: number, s: any) => sum + (Number(s?.quantity ?? 0) || 0), 0);
    }
    }

    const kardexId = await nextCounterValue('kardexId');

    // Crear entrada en Kardex
    const result = await amplifyClient.models.Kardex.create({
      kardexId,
      productId: entry.productId,
      date: entry.date.toISOString(),
      documentId: entry.documentId,
      documentItemId: entry.documentItemId,
      documentNumber: entry.documentNumber,
      warehouseId: entry.warehouseId,
      type: entry.type,
      quantity: entry.quantity,
      balance: entry.balance,
      unitCost: entry.unitCost,
      totalCost: entry.totalCost,
      unitPrice: entry.unitPrice,
      totalPrice: entry.totalPrice,
      totalPriceAfterDiscount: entry.totalPriceAfterDiscount,
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
      const kardexHistoryId = await nextCounterValue('kardexHistoryId');
      await amplifyClient.models.KardexHistory.create({
        kardexHistoryId,
        kardexId,
        productId: entry.productId,
        previousBalance,
        newBalance: entry.balance,
        modifiedBy: entry.userId,
        modifiedDate: new Date().toISOString(),
        reason: entry.note,
      });
    }

    return {
      success: true,
      kardexId,
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
  productId: string | number,
  limit: number = 100
): Promise<{
  success: boolean;
  entries?: any[];
  error?: string;
}> {
  try {
    const normalizedProductId = Number(productId);
    const { data: entries, errors } = await amplifyClient.models.Kardex.list({
      filter: {
        productId: { eq: normalizedProductId }
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
  productId?: string | number
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
    const normalizedProductId = productId === undefined ? undefined : Number(productId);
    const filter = productId
      ? {
          productId: { eq: normalizedProductId },
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
