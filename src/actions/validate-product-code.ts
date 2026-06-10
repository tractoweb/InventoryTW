"use server";
import "server-only";

import { amplifyClient, formatAmplifyError } from "@/lib/amplify-config";

/**
 * Valida que un código sea único entre productos ACTIVOS.
 * Permite código duplicado si el otro está deshabilitado.
 * 
 * Útil para crear/editar productos.
 */
export async function validateProductCode(
  code: string | null | undefined,
  excludeProductId?: number
): Promise<{
  valid: boolean;
  error?: string;
  conflictProductId?: number;
  conflictProductName?: string;
}> {
  try {
    if (!code || !code.trim()) {
      return { valid: true }; // Código opcional
    }

    const cleanCode = String(code).toLowerCase().trim();

    // Buscar productos activos con este código
    const existingRes = await amplifyClient.models.Product.list({
      filter: {
        and: [
          { code: { eq: code } },
          { isEnabled: { eq: true } },
        ],
      },
    } as any);

    const conflicts = (existingRes.data ?? []).filter(
      (p: any) => !excludeProductId || p.idProduct !== excludeProductId
    );

    if (conflicts.length > 0) {
      const conflictProduct = conflicts[0] as any;
      return {
        valid: false,
        error: `El código "${code}" ya está en uso en el producto "${conflictProduct.name}" (ID: ${conflictProduct.idProduct})`,
        conflictProductId: conflictProduct.idProduct,
        conflictProductName: conflictProduct.name,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Error validando código: ${formatAmplifyError(error)}`,
    };
  }
}

/**
 * Obtiene todos los productos con un código específico (incluyendo deshabilitados).
 * Útil para detectar duplicados históricos.
 */
export async function getProductsByCode(code: string): Promise<{
  data: Array<{
    id: number;
    name: string;
    code: string;
    isEnabled: boolean;
    disabledReason?: string | null;
  }>;
  error?: string;
}> {
  try {
    const res = await amplifyClient.models.Product.list({
      filter: { code: { eq: code } },
    } as any);

    const products = (res.data ?? []).map((p: any) => ({
      id: p.idProduct,
      name: p.name,
      code: p.code,
      isEnabled: p.isEnabled,
      disabledReason: p.disabledReason,
    }));

    return { data: products };
  } catch (error) {
    return { data: [], error: formatAmplifyError(error) };
  }
}
