'use server';

import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';
import { revalidateTag } from "next/cache";

import { finalizeDocument } from '@/services/document-service';
import { CACHE_TAGS } from "@/lib/cache-tags";

const FinalizeDocumentSchema = z.object({
  documentId: z.coerce.number().min(1),
  userId: z.coerce.number().min(1).default(1),
});

export async function finalizeDocumentAction(raw: z.infer<typeof FinalizeDocumentSchema>) {
  noStore();

  const parsed = FinalizeDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos' };
  }

  const result = await finalizeDocument(parsed.data.documentId, String(parsed.data.userId));
  if ((result as any)?.success) {
    revalidateTag(CACHE_TAGS.heavy.documents);
    revalidateTag(CACHE_TAGS.heavy.dashboardOverview);
    revalidateTag(CACHE_TAGS.heavy.stockData);
  }
  return result;
}
