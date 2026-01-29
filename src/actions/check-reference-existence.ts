
'use server';

import 'server-only';

import { ACCESS_LEVELS } from '@/lib/amplify-config';
import { amplifyClient } from '@/lib/amplify-server';
import { requireSession } from '@/lib/session';

/**
 * Verifica si un código/referencia ya está en uso.
 * Importante: solo marca `exists=true` para duplicados exactos (case-insensitive).
 */
export async function checkReferenceExistence(
  code: string
): Promise<{ exists: boolean; exactMatchIdProduct?: number }> {
  const normalized = String(code ?? '').trim();
  if (!normalized) return { exists: false };

  await requireSession(ACCESS_LEVELS.ADMIN);

  try {
    // Use a small 'contains' window to support case-insensitive exact matching,
    // without blocking on fuzzy/partial matches.
    const res: any = await amplifyClient.models.Product.list({
      filter: { code: { contains: normalized } },
      limit: 25,
    } as any);

    const list = Array.isArray(res?.data) ? res.data : [];
    const target = normalized.toLowerCase();

    const exact = list.find((p: any) => String(p?.code ?? '').trim().toLowerCase() === target);
    if (exact?.idProduct !== undefined && exact?.idProduct !== null) {
      return { exists: true, exactMatchIdProduct: Number(exact.idProduct) };
    }

    return { exists: false };
  } catch (error) {
    console.error('Error al verificar la existencia de la referencia:', error);
    return { exists: false };
  }
}

    