"use server";
import "server-only";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";

export type DisabledProduct = {
  id: number;
  name: string;
  code: string | null;
  disabledReason: string | null;
  disabledAt: string | null;
  disabledBy: number | null;
  stock: number;
  documentCount: number;
  mergedIntoProductId: number | null;
  mergedIntoProductName: string | null;
};

/**
 * Obtiene todos los productos deshabilitados con filtros opcionales.
 */
export async function getDisabledProducts(options?: {
  reason?: string;
  period?: "7days" | "30days" | "90days" | "all";
}): Promise<{
  data: DisabledProduct[];
  total: number;
  error?: string;
}> {
  try {
    // Obtener todos los productos deshabilitados
    const productsRes = await amplifyClient.models.Product.list({
      filter: { isEnabled: { eq: false } },
    } as any);

    let products = (productsRes.data ?? []) as any[];

    // Filtrar por razón si se especifica
    if (options?.reason) {
      products = products.filter(
        (p) => p.disabledReason === options.reason
      );
    }

    // Filtrar por período
    if (options?.period && options.period !== "all") {
      const now = Date.now();
      const periodMs: Record<string, number> = {
        "7days": 7 * 24 * 60 * 60 * 1000,
        "30days": 30 * 24 * 60 * 60 * 1000,
        "90days": 90 * 24 * 60 * 60 * 1000,
      };

      products = products.filter((p) => {
        if (!p.disabledAt) return false;
        const disabledTime = new Date(p.disabledAt).getTime();
        return now - disabledTime <= periodMs[options.period!];
      });
    }

    const results: DisabledProduct[] = [];

    for (const product of products) {
      // Obtener stock total
      const stockRes = await amplifyClient.models.Stock.list({
        filter: { productId: { eq: product.idProduct } },
      } as any);
      const stock =
        (stockRes.data ?? []).reduce((sum: number, s: any) => sum + (s.quantity ?? 0), 0) || 0;

      // Obtener documentos que lo referencian
      const docRes = await amplifyClient.models.DocumentItem.list({
        filter: { productId: { eq: product.idProduct } },
      } as any);
      const documentCount = docRes.data?.length ?? 0;

      // Obtener producto en el que fue merged (si aplica)
      let mergedIntoName = null;
      if (product.mergedIntoProductId) {
        try {
          const mergedRes = await amplifyClient.models.Product.get({
            idProduct: product.mergedIntoProductId,
          } as any);
          mergedIntoName = (mergedRes as any)?.data?.name || null;
        } catch {
          // ignorar
        }
      }

      results.push({
        id: product.idProduct,
        name: product.name,
        code: product.code,
        disabledReason: product.disabledReason,
        disabledAt: product.disabledAt,
        disabledBy: product.disabledBy,
        stock,
        documentCount,
        mergedIntoProductId: product.mergedIntoProductId,
        mergedIntoProductName: mergedIntoName,
      });
    }

    // Ordenar por fecha de deshabilitación (más reciente primero)
    results.sort((a, b) => {
      const aDate = new Date(a.disabledAt || 0).getTime();
      const bDate = new Date(b.disabledAt || 0).getTime();
      return bDate - aDate;
    });

    return { data: results, total: results.length };
  } catch (error) {
    return { data: [], total: 0, error: formatAmplifyError(error) };
  }
}

/**
 * Obtiene estadísticas de productos deshabilitados.
 */
export async function getDisabledProductsStats(): Promise<{
  totalDisabled: number;
  byReason: Record<string, number>;
  accidentalCount: number;
  duplicateCount: number;
  error?: string;
}> {
  try {
    const productsRes = await amplifyClient.models.Product.list({
      filter: { isEnabled: { eq: false } },
    } as any);

    const products = (productsRes.data ?? []) as any[];
    const byReason: Record<string, number> = {};

    for (const p of products) {
      const reason = p.disabledReason || "UNKNOWN";
      byReason[reason] = (byReason[reason] || 0) + 1;
    }

    return {
      totalDisabled: products.length,
      byReason,
      accidentalCount: byReason["Accidental"] || 0,
      duplicateCount: byReason["Duplicate"] || 0,
    };
  } catch (error) {
    return {
      totalDisabled: 0,
      byReason: {},
      accidentalCount: 0,
      duplicateCount: 0,
      error: formatAmplifyError(error),
    };
  }
}
