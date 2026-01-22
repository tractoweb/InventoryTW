'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';
import { revalidateTag } from "next/cache";

import { ACCESS_LEVELS, formatAmplifyError } from '@/lib/amplify-config';
import { requireSession } from '@/lib/session';
import { finalizeDocument } from '@/services/document-service';
import { CACHE_TAGS } from "@/lib/cache-tags";

const FinalizeDocumentSchema = z.object({
  documentId: z.coerce.number().min(1),
  forceAllowNegativeStock: z.coerce.boolean().optional(),
});

export async function finalizeDocumentAction(raw: z.infer<typeof FinalizeDocumentSchema>) {
  noStore();

  let session: any;
  try {
    // Default: CASHIER can finalize. Forcing negative stock is restricted below.
    session = await requireSession(ACCESS_LEVELS.CASHIER);
  } catch (e) {
    return { success: false, error: formatAmplifyError(e) };
  }

  const parsed = FinalizeDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos' };
  }

  const force = Boolean(parsed.data.forceAllowNegativeStock);
  if (force) {
    // Only admins/masters can override the global setting.
    try {
      await requireSession(ACCESS_LEVELS.ADMIN);
    } catch {
      return { success: false, error: 'No autorizado para dejar stock negativo.' };
    }
  }

  const result = await finalizeDocument(parsed.data.documentId, String(session.userId), {
    forceAllowNegativeStock: force,
  });
  if ((result as any)?.success) {
    revalidateTag(CACHE_TAGS.heavy.documents);
    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);
    revalidateTag(CACHE_TAGS.heavy.stockData);
  }
  return result;
}
